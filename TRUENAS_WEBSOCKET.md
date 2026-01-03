# TrueNAS WebSocket Support for Homepage Dashboard

This fork adds WebSocket JSON-RPC support to the Homepage dashboard's TrueNAS widget to address the REST API deprecation in TrueNAS SCALE 25.04+.

## Background

TrueNAS deprecated the REST API in version 25.04 and will completely remove it in version 26.04. Users running SCALE 25.04+ receive daily alerts when using the deprecated REST API endpoints.

This implementation adds WebSocket JSON-RPC 2.0 support while maintaining full backward compatibility with TrueNAS CORE and older SCALE versions.

## Installation

### Step 1: Download Modified Files

Download these files from this repository and place them in your homepage installation:

**New Files:**
- `src/utils/proxy/handlers/jsonrpc-ws.js`
- `src/utils/proxy/handlers/truenas.js`

**Modified Files:**
- `src/widgets/truenas/widget.js`
- `src/utils/config/service-helpers.js`

### Step 2: Install WebSocket Dependency

Navigate to your homepage directory and run:

```bash
pnpm add ws
```

Or if using npm:

```bash
npm install ws
```

### Step 3: Update Configuration

Edit your `services.yaml` file to enable WebSocket support:

```yaml
- TrueNAS:
    widget:
      type: truenas
      url: https://your-truenas-ip
      key: your-api-key
      enablePools: true
      nasType: scale
      useWebsocket: true  # Add this line for SCALE 25.04+
```

### Step 4: Restart Homepage

Restart your homepage container or service to apply the changes.

## Configuration Options

### TrueNAS SCALE 25.04+
```yaml
useWebsocket: true  # Use WebSocket JSON-RPC (recommended)
```

### TrueNAS CORE or older SCALE versions
```yaml
# Leave useWebsocket unset or set to false
# Widget will use REST API (default behavior)
```

## Compatibility

- **TrueNAS SCALE 25.04+**: Set `useWebsocket: true` to avoid deprecation warnings
- **TrueNAS CORE**: Leave default settings (uses REST API)
- **Backward Compatible**: Existing configurations continue to work without changes

## Testing

Tested and verified on:
- TrueNAS SCALE 25.10.1
- All widget endpoints: alerts, pools, dataset, status
- Both API key and username/password authentication

## Technical Details

### What Changed

The implementation adds:
- WebSocket JSON-RPC 2.0 handler for SCALE 25.04+
- Automatic routing between REST and WebSocket based on configuration
- Opt-in configuration via `useWebsocket` setting
- Full backward compatibility with existing installations

### Files Modified

1. **jsonrpc-ws.js** (new) - Core WebSocket JSON-RPC handler
2. **truenas.js** (new) - Router that selects REST or WebSocket
3. **widget.js** - Updated to use new proxy handler
4. **service-helpers.js** - Added useWebsocket config option

## Troubleshooting

### Widget shows "API Error"
- Verify `useWebsocket: true` is set for SCALE 25.04+
- Check that your API key is valid
- Ensure TrueNAS is accessible from homepage

### Still seeing deprecation warnings
- Confirm `useWebsocket: true` is in your services.yaml
- Restart homepage after configuration changes

### Widget not displaying data
- Check homepage logs for specific errors
- Verify network connectivity to TrueNAS
- Test API key with TrueNAS API documentation

## References

- TrueNAS API Documentation: https://api.truenas.com
- TrueNAS 25.04 Release Notes: https://www.truenas.com/docs/scale/25.04/api/
- Homepage Documentation: https://gethomepage.dev

## Contributing

If you encounter issues or have improvements, please open an issue on this repository.

## License

This code follows the same license as the upstream homepage project.
