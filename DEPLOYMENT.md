# Homepage TrueNAS WebSocket Deployment Guide

## Overview
This fork adds WebSocket support to Homepage's TrueNAS widget, enabling real-time JSON-RPC communication instead of REST API polling.

## Building from Source

### Prerequisites
- Docker with sufficient resources allocated
- Git

### Clone the Repository
```bash
git clone https://github.com/Hackpig1974/homepage.git truenas-websocket
cd truenas-websocket
git checkout truenas-jsonrpc
```

### Resource Requirements

**Important**: Build and runtime have different resource needs.

#### For Building the Image:
- **CPU**: 2 cores minimum
- **RAM**: 4GB minimum  
- **Build time**: ~3 minutes
- **Note**: Only needed during `docker build` - can use temporary allocation

#### For Running the Container:
- **CPU**: 1 core (sufficient for normal operation)
- **RAM**: 1GB (sufficient for normal operation)
- **Note**: Homepage widget refresh rates are low (5-30 seconds), minimal resources needed
```bash
# Build the image (requires 2 CPU / 4GB RAM)
docker build --tag homepage-truenas-websocket:latest .
```

**Resource Allocation Tips:**
- If using LXC/VM: Temporarily increase resources for build, then reduce for runtime
- If using Docker Desktop: Ensure at least 4GB allocated for builds
- Build failures due to memory are usually obvious (killed/OOM errors)

**If the build fails** with out-of-memory errors, increase Docker resources to 4 CPU / 8GB RAM.

**Note**: The first build will regenerate `pnpm-lock.yaml` since the `ws` dependency was added. This is normal and expected.

## Deployment

### Docker Run
```bash
docker run -d \
    --name homepage \
    -p 4000:3000 \
    -v /path/to/config:/app/config \
    -v /path/to/icons:/app/public/icons \
    homepage-truenas-websocket:latest
```

### Docker Compose
```yaml
version: "3.3"
services:
  homepage:
    build: /path/to/truenas-websocket
    container_name: homepage
    ports:
      - 4000:3000
    volumes:
      - /path/to/config:/app/config
      - /path/to/icons:/app/public/icons
    restart: unless-stopped
```

## Configuration

### Enable WebSocket for TrueNAS Widget
Edit your `services.yaml`:
```yaml
- TrueNAS:
    widget:
      type: truenas
      url: https://truenas.example.com
      key: your-api-key-here
      enablePools: true
      nasType: scale
      useWebsocket: true  # IMPORTANT: lowercase 's' in 'socket'
```

**Critical Configuration Notes:**
- `useWebsocket` must be lowercase 's' (case-sensitive)
- Set to `true` to enable WebSocket, `false` to use REST API
- REST API fallback is automatic if WebSocket is disabled

## Verification

### Method 1: Check Container Logs (Recommended)

**View real-time logs:**
```bash
docker logs homepage -f
```

**Or check recent WebSocket activity:**
```bash
docker logs homepage --tail 100 | grep "jsonrpcWsProxyHandler"
```

**Expected output when WebSocket is working:**
```
[2026-01-03T19:10:17.276Z] info: <jsonrpcWsProxyHandler> TrueNAS WebSocket handler invoked: group=... service=... endpoint=pool.query
[2026-01-03T19:10:17.281Z] info: <jsonrpcWsProxyHandler> TrueNAS WS connecting to wss://192.168.100.60/api/current for method=pool.query
[2026-01-03T19:10:17.291Z] info: <jsonrpcWsProxyHandler> TrueNAS WS connection opened, sending login for method=pool.query
[2026-01-03T19:10:17.733Z] info: <jsonrpcWsProxyHandler> TrueNAS WS login successful, calling method=pool.query
[2026-01-03T19:10:17.742Z] info: <jsonrpcWsProxyHandler> TrueNAS WS call successful: method=pool.query
```

**Key indicators of successful WebSocket usage:**
- ✅ `TrueNAS WebSocket handler invoked` - Handler is being called
- ✅ `TrueNAS WS connecting to wss://...` - Secure WebSocket connection
- ✅ `TrueNAS WS login successful` - Authentication worked
- ✅ `TrueNAS WS call successful` - Data retrieved successfully

**If WebSocket is NOT enabled:**
You'll see REST API calls instead (or no TrueNAS-related logs):
```
<httpProxy> Calling https://192.168.100.60/api/v2.0/...
```

**If you see no logs at all:**
1. Verify `useWebsocket: true` is set in `services.yaml`
2. Restart container: `docker restart homepage`
3. Hard refresh browser (Ctrl+F5 or Cmd+Shift+R)
4. Check that the widget is visible on your Homepage dashboard

**Note**: Source files don't exist in production builds - Next.js compiles everything to `.next` directory. You cannot verify implementation by checking source files in the container.

### Method 2: Browser DevTools

1. Open Homepage in browser
2. Press F12 to open DevTools
3. Go to Network tab
4. Look for WebSocket connections (ws:// or wss://)
5. Refresh the page

You should see WebSocket connections to your TrueNAS server at `/api/current`
## Troubleshooting

### "Rate Limit Exceeded" Errors
```
[EBUSY] Rate Limit Exceeded
```

**Cause**: TrueNAS rate limits authentication attempts. Rapid page refreshes trigger this.

**Solution**: Wait 2-3 minutes for the rate limit to reset. Don't refresh rapidly during testing.

### Widget Not Using WebSocket
**Check configuration:**
```bash
# Verify useWebsocket is set correctly (case-sensitive)
cat /path/to/config/services.yaml | grep -A 10 truenas
```

**Restart container after config changes:**
```bash
docker restart homepage
```

### Widget Shows No Data
1. Verify TrueNAS URL is accessible from container
2. Check API key is valid
3. Review container logs for specific errors:
```bash
   docker logs homepage --tail 100
```

### Build Failures
**Out of Memory:**
- Ensure Docker daemon has at least 4GB RAM available
- Close other resource-intensive applications during build
- Consider increasing to 4 CPU / 8GB RAM if issues persist

**pnpm Lockfile Errors:**
If you see "Cannot install with frozen-lockfile" errors, regenerate the lockfile:
```bash
# Use Docker to regenerate lockfile (run from repository root)
docker run --rm -v $(pwd):/app -w /app node:22-slim bash -c "
  corepack enable && 
  corepack prepare pnpm@latest --activate && 
  pnpm install --no-frozen-lockfile
"

# Retry build
docker build --tag homepage-truenas-websocket:latest .
```

**Build Takes Too Long:**
- Ensure adequate resources allocated to Docker daemon
- Check disk space availability
- Verify network connectivity for package downloads

## Architecture Notes

### WebSocket Implementation
- Creates new WebSocket connection per API call
- Authenticates for each request
- This is acceptable for Homepage's refresh rate (~5-30 seconds)
- TrueNAS rate limiting prevents abuse

### Fallback Behavior
When `useWebsocket: false` or not specified:
- Widget uses standard REST API endpoint
- Authentication via credentialed proxy handler
- No WebSocket connections created

### Modified Files
- `src/utils/proxy/handlers/jsonrpc-ws.js` - WebSocket JSON-RPC handler
- `src/utils/proxy/handlers/truenas.js` - TrueNAS routing logic
- `src/widgets/truenas/widget.js` - Widget configuration
- `src/utils/config/service-helpers.js` - Service helper registration
- `package.json` - Added `ws@^8.18.3` dependency

## Support

For issues related to:
- **WebSocket implementation**: Open issue on [Hackpig1974/homepage](https://github.com/Hackpig1974/homepage/issues)
- **Homepage core features**: See [gethomepage/homepage](https://github.com/gethomepage/homepage)
- **TrueNAS API**: Consult [TrueNAS documentation](https://www.truenas.com/docs/)
