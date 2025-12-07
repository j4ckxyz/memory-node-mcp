# Using Memory Node with Open WebUI

Open WebUI can connect to your Memory Node via the **MCP Gateway** or by configuring it as an OpenAI-compatible endpoint if you use an adapter, but currently, the standard way is via **MCP Client** integration.

## Option 1: Direct Integration (if supported by your Open WebUI version)
If your version of Open WebUI supports MCP directly:
1. Go to **Settings > Connections > MCP**.
2. Add a new MCP Server:
   - **Type**: `stdio`
   - **Command**: `docker run -i -v memory-data:/root/.memory-node memory-node`
   - (Or if running locally: `node /path/to/memory-node/dist/index.js`)

## Option 2: Docker Compose (Sidecar)
You can run the Memory Node alongside Open WebUI in Docker Compose.

```yaml
services:
  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    # ... other settings ...
    volumes:
      - open-webui-data:/app/backend/data
    extra_hosts:
      - "host.docker.internal:host-gateway" # To access specific ports

  memory-node:
    build: ./memory-node-mcp
    volumes:
      - memory-data:/root/.memory-node
    command: node dist/index.js
    stdin_open: true # Keep stdin open
    tty: true
```
*Note: Since Open WebUI needs to speak MCP, you typically need an intermediate "MCP Gateway" or configure Open WebUI's experimental MCP support.*

## Simplest Setup (Stdio)
The most reliable way right now is to let your **MCP Host** (like Claude Desktop or a bridge) handle the connection.

If you specifically want Open WebUI to use these memories, you might need to wait for full native MCP support in Open WebUI or use an API bridge.
