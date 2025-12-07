# Exposing Memory Node via Tailscale

To securely access your Memory Node from another machine (e.g., your laptop accessing a home server running the node):

1.  **Install Tailscale** on both the host (where Memory Node runs) and your client.
2.  **Enable SSH** or expose a socket. Since this MCP server uses `stdio`, you can pipe input/output over SSH.

## Accessing via SSH
On your client (e.g., Mac with Claude Desktop):

1.  Configure Claude Desktop (or your MCP client) to use an SSH command:
    ```json
    {
      "mcpServers": {
        "memory-node": {
          "command": "ssh",
          "args": [
            "user@host-machine-tailscale-ip",
            "docker run -i -v memory-data:/root/.memory-node memory-node"
          ]
        }
      }
    }
    ```
    *Replace `user@host-machine-tailscale-ip` with your actual user and Tailscale IP.*

2.  **Auth**: Ensure you have SSH key authentication set up so it doesn't ask for a password.

## Public Web Access (Not Recommended via Stdio)
If you must expose it publicly:
1.  Use **Cloudflare Tunnel** to expose a TCP service (if you wrap Stdio in a TCP server).
2.  Or use **SSE Mode** (which we disabled in this version for stability).
3.  **Recommended**: Stick to Tailscale/VPN for security.
