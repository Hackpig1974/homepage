import getServiceWidget from "utils/config/service-helpers";
import createLogger from "utils/logger";
import credentialedProxyHandler from "utils/proxy/handlers/credentialed";
import jsonrpcWsProxyHandler from "utils/proxy/handlers/jsonrpc-ws";

const logger = createLogger("truenasProxyHandler");

function restEndpointToRpcMethod(endpoint) {
  if (!endpoint) return endpoint;
  if (endpoint === "pool") return "pool.query";
  if (endpoint === "pool/dataset") return "pool.dataset.query";
  return endpoint.replaceAll("/", ".");
}

export default async function truenasProxyHandler(req, res, map) {
  const { group, service, index, endpoint } = req.query;

  if (!group || !service) {
    return res.status(400).json({ error: "Invalid proxy service type" });
  }

  const widget = await getServiceWidget(group, service, index);
  const useWebSocket = widget?.useWebsocket === true;

  if (!useWebSocket) {
    return credentialedProxyHandler(req, res, map);
  }

  req.query.endpoint = restEndpointToRpcMethod(endpoint);
  return jsonrpcWsProxyHandler(req, res, map);
}
