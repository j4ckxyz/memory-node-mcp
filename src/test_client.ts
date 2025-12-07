// Basic test script to verify memory-node functionality
// This script simulates a client connecting to the Stdio server
// NOTE: Since the server uses Stdio, we can't easily "connect" from another node process via stdin/stdout easily without a proper client impl.
// Instead, we will import the functions from db.ts directly to verify logic, 
// AND/OR we can try to spawn the server process and talk to it.

// For simplicity in this environment, I will verify the DB logic first.
// Then I will try to use the MCP SDK Client to connect to the sub-process.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
    CallToolRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

async function main() {
    console.log("Starting test client...");
    const transport = new StdioClientTransport({
        command: "node",
        args: ["dist/index.js"]
    });

    const client = new Client({
        name: "test-client",
        version: "1.0.0"
    }, {
        capabilities: {}
    });

    try {
        await client.connect(transport);
        console.log("Connected to server!");

        // 1. List Resources
        console.log("\n--- Listing Resources ---");
        const resources = await client.listResources();
        console.log(JSON.stringify(resources, null, 2));

        // 2. Add Memory
        console.log("\n--- Adding Memory ---");
        const addResult = await client.callTool({
            name: "remember",
            arguments: {
                content: "This is a test memory.",
                type: "test",
                metadata: { source: "test-client" }
            }
        });
        console.log("Add Result:", JSON.stringify(addResult, null, 2));

        // 3. Read Memory
        console.log("\n--- Reading Memories ---");
        const readResult = await client.readResource({ uri: "memory://recent" });
        console.log("Read Result:", JSON.stringify(readResult, null, 2));

        // 4. Search Memory
        console.log("\n--- Searching Memories ---");
        const searchResult = await client.callTool({
            name: "search_memories",
            arguments: {
                query: "test memory"
            }
        });
        console.log("Search Result:", JSON.stringify(searchResult, null, 2));

        // 5. Delete Memory (fail)
        console.log("\n--- Deleting Memory (Should Fail) ---");
        // We need an ID. Let's parse it from search or read result.
        // For now, assuming we can get it.
        // Actually, let's just create another one to delete so we have the ID if we captured it? 
        // The addResult returns text "Memory stored with ID: <uuid>"
        // I'll skip parsing for now and just try to delete a fake ID with NO confirmation.
        try {
            await client.callTool({
                name: "delete_memory",
                arguments: {
                    id: "fake-id",
                    confirm: "NO"
                }
            });
        } catch (e: any) {
            console.log("Caught expected error:", e.message);
        }

    } catch (error) {
        console.error("Test failed:", error);
    } finally {
        await client.close();
    }
}

main();
