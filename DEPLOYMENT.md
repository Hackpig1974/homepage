# Homepage TrueNAS WebSocket Deployment Guide

## Overview
This fork adds WebSocket support to Homepage's TrueNAS widget, enabling real-time JSON-RPC communication instead of REST API polling.

## Building from Source

### Prerequisites
- Docker with sufficient resources allocated
- Git

### Clone the Repository
```bash
git clone https://github.com/Hackpig1974/homepage.git
cd homepage
git checkout truenas-jsonrpc
```

### Build with Resource Limits
The build process requires adequate resources. We recommend:
- **Minimum**: 2 CPU cores, 4GB RAM (tested and verified)
- **Build time**: ~3 minutes with minimum resources
```bash
# Build the image
docker build --tag ghcr.io/hackpig1974/homepage:latest .
```

**Note**: The first build will regenerate `pnpm-lock.yaml` since the `ws` dependency was added. This is normal and expected.

**If the build fails** with out-of-memory errors, increase Docker resources to 4 CPU / 8GB RAM.

## Deployment

### Docker Run
```bash
docker run -d \
    --name homepage \
    -p 4000:3000 \
    -v /path/to/config:/app/config \
    -v /path/to/icons:/app/public/icons \
    ghcr.io/hackpig1974/homepage:latest
```

### Docker Compose
```yaml
version: "3.3"
services:
  homepage:
    image: ghcr.io/hackpig1974/homepage:latest
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

### Method 1: Check Container Logs
```bash
# Follow logs in real-time
docker logs homepage -f

# Look for WebSocket handler activity
docker logs homepage --tail 50 | grep jsonrpcWsProxyHandler
```

**Expected log entries:**
```
<jsonrpcWsProxyHandler> TrueNAS WS login...
<jsonrpcWsProxyHandler> TrueNAS WS JSON-RPC success...
```

**Note**: Source files don't exist in production builds - Next.js compiles everything to `.next` directory. You cannot verify implementation by checking source files in the container.

### Method 2: Browser DevTools
1. Open Homepage in browser
2. Press F12 to open DevTools
3. Go to **Network** tab
4. Filter by **WS** (WebSocket)
5. Refresh the page
6. Look for WebSocket connections to your TrueNAS instance

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
docker build --tag ghcr.io/hackpig1974/homepage:latest .
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
