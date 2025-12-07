# Memory Node MCP Server

> [!WARNING]
> **EXPERIMENTAL / WIP**: This project is currently a work in progress. Features, APIs, and schemas may change without notice. Use with caution in production environments.

A self-hostable **Memory Node** compatible with the Model Context Protocol (MCP). It allows LLMs to store, recall, and manage conversation contexts or key information in a persistent SQLite database.

## Features
- **Persistent Storage**: SQLite (`~/.memory-node/memories.db`).
- **Semantic Search**: Uses OpenRouter (OpenAI-compatible) embeddings for vector search.
- **Auto-Summarization**: Daily cron job summarizes new memories to save space/cost.
- **Safe Management**: Deletion requires `confirm: "YES"`.
- **Self-Hostable**: Dockerfile included.

## Configuration
Host this securely. Set environment variables in `.env` or Docker:
- `OPENROUTER_API_KEY`: Required for embeddings & summarization.
- `OPENROUTER_BASE_URL`: (Optional) Defaults to `https://openrouter.ai/api/v1`.

## Installation

### Local
1. `npm install`
2. `npm run build`
3. `node dist/index.js`

### Docker
```bash
docker build -t memory-node .
docker run -v memory-data:/root/.memory-node -e OPENROUTER_API_KEY=your_key -i memory-node
```

## Tools
- `remember`: Store memory + metadata.
- `search_memories`: Semantic search (if API key present) + Text search.
- `force_maintenance`: Trigger summarization manually.
- `delete_memory` / `update_memory`.

## Guides
- [Open WebUI Integration](USAGE_OPENWEBUI.md)
- [Tailscale & Networking](USAGE_TAILSCALE.md)
