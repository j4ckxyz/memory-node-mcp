# Memory Node MCP - Documentation

## Overview
The **Memory Node** is a specialized server implementing the **Model Context Protocol (MCP)**. It acts as a long-term memory store for LLMS, allowing them to persist information, user preferences, and conversation context across different sessions.

### Core Philosophy
- **Local First**: Data lives in a local SQLite database (`~/.memory-node/memories.db`).
- **Safety**: Destructive actions (delete/update) require explicit confirmation.
- **Efficiency**: Uses embeddings for semantic search and daily summarization to keep context density high.
- **Protocol**: Fully compliant with MCP, enabling integration with Claude Desktop, Open WebUI, and other MCP clients.

---

## Architecture

### Components
1.  **MCP Server** (`src/index.ts`):
    - Uses `@modelcontextprotocol/sdk` to handle JSON-RPC messages over `stdio`.
    - Exposes Tools (`remember`, `search`, etc.) and Resources (`memory://all`).
    - Validates inputs using `zod`.

2.  **Database Layer** (`src/db.ts`):
    - **SQLite** (`better-sqlite3`) stores memories.
    - Schema:
        - `id` (UUID)
        - `content` (Text)
        - `type` (e.g., 'conversation', 'fact')
        - `embedding` (JSON array of floats)
        - `created_at`

3.  **AI Service** (`src/ai.ts`):
    - Connects to **OpenRouter** (or generic OpenAI-compatible API).
    - **Embeddings**: Generates vectors for semantic search.
    - **Summarization**: Compresses multiple memories into high-density summaries.

4.  **Scheduler** (`src/maintenance.ts`):
    - **Cron Job**: Runs daily at midnight.
    - **Tasks**:
        - Backfills missing embeddings.
        - Summarizes recent conversation logs.

---

## Installation & Setup

### Prerequisites
- **Node.js**: v18+
- **Docker**: (Optional, for containerized running)
- **OpenRouter API Key**: For AI features.

### Local Setup
```bash
git clone <your-repo> memory-node
cd memory-node
npm install
npm run build
```

**Running:**
```bash
# Create .env file or export variables
export OPENROUTER_API_KEY=sk-or-v1-...
node dist/index.js
```

### Docker Setup
```bash
# Build
docker build -t memory-node .

# Run (Interactively via Stdio)
docker run -i \
  -v memory-data:/root/.memory-node \
  -e OPENROUTER_API_KEY=sk-or-v1-... \
  memory-node
```

---

## Configuration

| Environment Variable | Description | Default |
|----------------------|-------------|---------|
| `OPENROUTER_API_KEY` | **Required** for embeddings/summary. | - |
| `OPENROUTER_BASE_URL`| API Endpoint. | `https://openrouter.ai/api/v1` |
| `SITE_URL` | For OpenRouter rankings. | `http://localhost` |
| `SITE_NAME` | For OpenRouter rankings. | `Memory Node` |

---

## Usage Examples

### 1. Claude Desktop Config
Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "memory-node": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "-v",
        "memory-data:/root/.memory-node",
        "-e",
        "OPENROUTER_API_KEY=sk-or-...",
        "memory-node"
      ]
    }
  }
}
```

### 2. Manual Tool Calls (JSON-RPC)
If you are building your own client, here is how you interact:

**Request (Store Memory):**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "remember",
    "arguments": {
      "content": "User prefers concise python code.",
      "type": "preference"
    }
  }
}
```

**Request (Search):**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "search_memories",
    "arguments": {
      "query": "coding preference"
    }
  }
}
```
*Note: This triggers a vector search if embeddings are working, finding "User prefers concise python code" even if keywords don't exact-match.*

### 3. Maintenance
You can trigger the daily maintenance manually:
```bash
# Via MCP Tool
{
  "method": "tools/call",
  "params": { "name": "force_maintenance", "arguments": {} }
}
```

---

## Troubleshooting

### "Transport closed"
- **Cause**: The process crashed or exited.
- **Fix**: Check `docker logs` or run `node dist/index.js` manually to see error output. Usually missing API key or DB permission.

### No Embeddings?
- **Cause**: `OPENROUTER_API_KEY` missing or quota exceeded.
- **Check**: The app logs warnings to stderr if it skips embedding generation.

### Persistence?
- **Check**: Ensure you are mounting the volume (`-v memory-data:/root/.memory-node`) when using Docker. Inside the container, DB is at `/root/.memory-node/memories.db`.
