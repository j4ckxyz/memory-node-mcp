#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ReadResourceRequestSchema,
    ListResourcesRequestSchema,
    CallToolRequest,
    ReadResourceRequest,
    ErrorCode,
    McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
    initDb,
    addMemory,
    getMemories,
    searchMemories,
    deleteMemory,
    updateMemory,
    getAllMemories,
    searchMemoriesByVector
} from "./db.js";
import { initScheduler, runMaintenance } from "./maintenance.js";
import { generateEmbedding } from "./ai.js";

// Initialize the database and scheduler
initDb();
initScheduler();

const server = new Server(
    {
        name: "memory-node",
        version: "1.0.0",
    },
    {
        capabilities: {
            resources: {},
            tools: {},
        },
    }
);

// Define Schemas
const RememberSchema = z.object({
    content: z.string().describe("The content of the memory to store"),
    type: z.string().optional().describe("Type of memory (e.g., conversation, fact, preference). Default: conversation"),
    metadata: z.record(z.string(), z.any()).optional().describe("Optional metadata"),
});

const SearchSchema = z.object({
    query: z.string().describe("Query to search for in memories"),
});

const DeleteSchema = z.object({
    id: z.string().describe("ID of the memory to delete"),
    confirm: z.string().describe("Confirmation string. Must be 'YES' to proceed."),
});

const UpdateSchema = z.object({
    id: z.string().describe("ID of the memory to update"),
    content: z.string().describe("New content for the memory"),
    confirm: z.string().describe("Confirmation string. Must be 'YES' to proceed."),
});

// List Resources
// @ts-ignore
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
        resources: [
            {
                uri: "memory://all",
                name: "All Memories",
                mimeType: "application/json",
                description: "A comprehensive list of all stored memories.",
            },
            {
                uri: "memory://recent",
                name: "Recent Memories",
                mimeType: "application/json",
                description: "The most recent 100 memories.",
            },
        ],
    };
});

// Read Resources
// @ts-ignore
server.setRequestHandler(ReadResourceRequestSchema, async (request: any) => {
    const uri = request.params.uri;
    if (uri === "memory://all") {
        const memories = getAllMemories();
        return {
            contents: [
                {
                    uri,
                    mimeType: "application/json",
                    text: JSON.stringify(memories, null, 2),
                },
            ],
        };
    } else if (uri === "memory://recent") {
        const memories = getMemories(100);
        return {
            contents: [
                {
                    uri,
                    mimeType: "application/json",
                    text: JSON.stringify(memories, null, 2),
                },
            ],
        };
    }

    throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
});

// List Tools
// @ts-ignore
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "remember",
                description: "Store a new memory. Use this to save important information, user preferences, or conversation context.",
                inputSchema: {
                    type: "object",
                    properties: {
                        content: { type: "string", description: "The content of the memory to store" },
                        type: { type: "string", description: "Type of memory (e.g., conversation, fact, preference). Default: conversation" },
                        metadata: { type: "object", description: "Optional key-value metadata" }
                    },
                    required: ["content"]
                }
            },
            {
                name: "search_memories",
                description: "Search through stored memories using a text query. Useful for recalling past context.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: { type: "string", description: "Query to search for" }
                    },
                    required: ["query"]
                }
            },
            {
                name: "delete_memory",
                description: "Permanently delete a memory. REQUIRES explicit confirmation.",
                inputSchema: {
                    type: "object",
                    properties: {
                        id: { type: "string", description: "ID of the memory to delete" },
                        confirm: { type: "string", description: "You must set this to 'YES' to confirm deletion." }
                    },
                    required: ["id", "confirm"]
                }
            },
            {
                name: "update_memory",
                description: "Update an existing memory's content. REQUIRES explicit confirmation.",
                inputSchema: {
                    type: "object",
                    properties: {
                        id: { type: "string", description: "ID of the memory to update" },
                        content: { type: "string", description: "New content" },
                        confirm: { type: "string", description: "You must set this to 'YES' to confirm update." }
                    },
                    required: ["id", "content", "confirm"]
                }
            }
        ],
    };
});

// Call Tools
// @ts-ignore
server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    const { name, arguments: args } = request.params;

    if (name === "remember") {
        const { content, type, metadata } = RememberSchema.parse(args);
        const id = addMemory(content, type, metadata);
        return {
            content: [
                {
                    type: "text",
                    text: `Memory stored with ID: ${id}`,
                },
            ],
        } as any;
    }

    if (name === "search_memories") {
        const { query } = SearchSchema.parse(args);
        let results: any[] = [];

        // Try vector search
        const vector = await generateEmbedding(query);
        if (vector) {
            results = searchMemoriesByVector(vector);
        }

        // If no vector results (or API failed), fall back to text search
        if (results.length === 0) {
            results = searchMemories(query);
        }

        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(results, null, 2),
                },
            ],
        } as any;
    }

    if (name === "delete_memory") {
        const { id, confirm } = DeleteSchema.parse(args);
        if (confirm !== "YES") {
            throw new McpError(ErrorCode.InvalidParams, "Confirmation must be explicitly 'YES' to delete a memory.");
        }
        const success = deleteMemory(id);
        if (!success) {
            return {
                isError: true,
                content: [{ type: "text", text: `Memory with ID ${id} not found.` }]
            } as any;
        }
        return {
            content: [
                {
                    type: "text",
                    text: `Memory ${id} deleted successfully.`,
                },
            ],
        } as any;
    }

    if (name === "update_memory") {
        const { id, content, confirm } = UpdateSchema.parse(args);
        if (confirm !== "YES") {
            throw new McpError(ErrorCode.InvalidParams, "Confirmation must be explicitly 'YES' to update a memory.");
        }
        const success = updateMemory(id, content);
        if (!success) {
            return {
                isError: true,
                content: [{ type: "text", text: `Memory with ID ${id} not found.` }]
            } as any;
        }
        return {
            content: [
                {
                    type: "text",
                    text: `Memory ${id} updated successfully.`,
                },
            ],
        } as any;
    }

    if (name === "force_maintenance") {
        await runMaintenance();
        return {
            content: [
                {
                    type: "text",
                    text: "Maintenance task triggered successfully.",
                },
            ],
        } as any;
    }

    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

// Start Server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
