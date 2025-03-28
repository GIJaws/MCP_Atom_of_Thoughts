# Single Instance Fix for Atom of Thoughts

This update fixes the issue where multiple instances of the MCP server and visualization server were starting simultaneously, causing port conflicts.

## What Was Fixed

1. **Port Availability Checking**
   - Added a utility for checking if ports are already in use
   - Implemented connection testing to detect existing servers
   - Added timeout-based connection waiting to ensure proper server startup

2. **MCP Server Improvements**
   - Modified server to check if another instance is already running
   - Made WebSocket server initialization asynchronous with proper error handling
   - Added graceful exit when another server is detected
   - Modified all WebSocket calls to use optional chaining (`?.`) to prevent errors when WebSocket server isn't available

3. **Visualization Server Improvements**
   - Restructured to support asynchronous initialization and startup
   - Added port conflict detection and graceful handling
   - Added proper shutdown and cleanup
   - Implemented wait-for-server logic to ensure connectivity with MCP

4. **Launcher Improvements**
   - Made launcher asynchronous to properly sequence server startups
   - Added detection for existing servers and reuses them instead of starting new ones
   - Added better status messages about reusing existing instances
   - Improved error handling and graceful shutdown

## How It Works

The solution follows these principles:

1. **First Instance Wins**: When a new instance is started, it checks if another instance is already running. If so, it gracefully exits.

2. **Port Detection**: Both MCP and visualization servers check if their respective ports (8090 and 3000 by default) are already in use. If a port is in use, the server attempts to connect to it to verify it's actually an MCP/visualization server.

3. **Graceful Degradation**: Even if the WebSocket connection fails, the MCP server will continue to function without visualization capabilities.

4. **Proper Cleanup**: All processes are properly cleaned up on shutdown, preventing orphaned processes.

## How To Test

1. **Build the updated code**:
   ```
   npx tsc
   ```
   or use the included `update.bat` script.

2. **Run the server in Claude Desktop**:
   Configure Claude Desktop as usual. The server will now detect if another instance is already running.

3. **Test multiple launch behavior**:
   Try launching another instance manually with:
   ```
   node build/launcher.js --visualize
   ```
   You should see a message indicating that existing servers were detected and the process exiting gracefully.

4. **Test visualization separately**:
   ```
   node build/visualize.js
   ```
   If the MCP server is already running, it should connect to it. If not, it will show a warning but still start up.

## Troubleshooting

- **"Cannot find module" errors**: Make sure to run `npx tsc` to build the latest code
- **Stale ports**: If a server crashed previously, the port might still be marked as in use. Wait a minute for the OS to release it, or restart your computer.
- **Multiple instances still starting**: In some rare cases, the port checking might fail. Try using different ports by specifying `--port=3001` for the visualization server.

## Known Limitations

- The port checking is not completely foolproof - other applications using the same ports can cause issues
- The WebSocket connection might not always be reliable when existing servers are reused
- CPU-intensive operations might still appear to freeze the interface momentarily

## Future Improvements

- Implement a proper locking mechanism using file locks
- Add an explicit command-line option to force a new instance to start
- Improve error handling for WebSocket communication
- Add a health checking mechanism to verify server functionality

## Issue Reference

This implementation specifically addresses the issue described in GitHub issue #812 regarding Claude Desktop starting MCP servers twice, by:

1. Detecting existing servers through port checking
2. Gracefully exiting when another instance is detected
3. Adding resilience to the code to handle cases where multiple instances are running
4. Properly initializing servers with asynchronous startup logic