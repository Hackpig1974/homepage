import WebSocket from "ws";

import getServiceWidget from "utils/config/service-helpers";
import createLogger from "utils/logger";
import widgets from "widgets/widgets";

const logger = createLogger("jsonrpcWsProxyHandler");

function buildWsUrl(widget) {
  const base = widget.url.replace(/^http/, "ws");
  return `${base}/api/current`;
}

function defaultParamsForMethod(method) {
  if (typeof method === "string" && method.endsWith(".query")) {
    return [[], {}];
  }
  return [];
}

function unwrapWsMessage(data) {
  if (data && typeof data === "object" && "data" in data) return data.data;
  if (data && typeof data === "object" && data.type === "Buffer" && Array.isArray(data.data)) {
    return Buffer.from(data.data);
  }
  return data;
}

function wsDataToText(data) {
  const d = unwrapWsMessage(data);
  if (d == null) return "";
  if (typeof d === "string") return d;
  if (Buffer.isBuffer(d)) return d.toString("utf8");
  if (d instanceof ArrayBuffer) return Buffer.from(d).toString("utf8");
  if (ArrayBuffer.isView(d)) return Buffer.from(d.buffer).toString("utf8");

  if (Array.isArray(d)) {
    try {
      return Buffer.concat(
        d.map((x) => {
          if (Buffer.isBuffer(x)) return x;
          if (x instanceof ArrayBuffer) return Buffer.from(x);
          if (ArrayBuffer.isView(x)) return Buffer.from(x.buffer);
          return Buffer.from(String(x));
        })
      ).toString("utf8");
    } catch {
      return String(d);
    }
  }
  return String(d);
}

async function sendJsonRpcWsRequest(widget, method, params) {
  const url = buildWsUrl(widget);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { rejectUnauthorized: false });
    const timeoutMs = 8000;
    const timer = setTimeout(() => {
      reject(new Error(`TrueNAS WS timeout waiting for JSON-RPC response: ${method}`));
      try {
        ws.close();
      } catch {}
    }, timeoutMs);

    const loginId = 1;
    const callId = 2;

    const loginPayload = widget.key
      ? {
          jsonrpc: "2.0",
          id: loginId,
          method: "auth.login_with_api_key",
          params: [widget.key],
        }
      : {
          jsonrpc: "2.0",
          id: loginId,
          method: "auth.login",
          params: [widget.username, widget.password],
        };

    const callPayload = {
      jsonrpc: "2.0",
      id: callId,
      method,
      params: params ?? defaultParamsForMethod(method),
    };

    const finish = (fn, value) => {
      clearTimeout(timer);
      try {
        ws.close();
      } catch {}
      fn(value);
    };

    ws.on("open", () => {
      ws.send(JSON.stringify(loginPayload));
    });

    ws.on("message", (data) => {
      const text = wsDataToText(data);
      let msg;
      try {
        msg = JSON.parse(text);
      } catch (e) {
        logger.error("TrueNAS WS parse failed method=%s error=%s", method, e.message);
        return finish(reject, new Error(`JSON parse failed: ${e.message}`));
      }

      if (msg?.id === loginId) {
        if (msg.error) {
          logger.error("TrueNAS WS login failed for method=%s", method);
          return finish(reject, new Error(`Login failed: ${JSON.stringify(msg.error)}`));
        }
        if (msg.result === true) {
          ws.send(JSON.stringify(callPayload));
        }
        return;
      }

      if (msg?.id === callId) {
        if (msg.error) {
          logger.error("TrueNAS WS call failed for method=%s", method);
          return finish(reject, new Error(`RPC error: ${JSON.stringify(msg.error)}`));
        }
        return finish(resolve, msg.result);
      }
    });

    ws.on("error", (err) => finish(reject, err));
  });
}

export default async function jsonrpcWsProxyHandler(req, res, map) {
  const { group, service, endpoint: method, index } = req.query;

  if (!group || !service) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const widget = await getServiceWidget(group, service, index);
  const api = widgets?.[widget.type]?.api;

  if (!api) {
    return res.status(403).json({ error: "Service does not support API calls" });
  }

  try {
    const result = await sendJsonRpcWsRequest(widget, method, null);
    const mapped = map instanceof Function ? map(result) : result;
    return res.status(200).json(mapped);
  } catch (err) {
    logger.error("TrueNAS WS JSON-RPC error (%s): %s", method, err?.message || err);
    return res.status(500).json({
      error: {
        message: err?.message || String(err),
        ...(err?.code && { code: err.code })
      }
    });
  }
}
