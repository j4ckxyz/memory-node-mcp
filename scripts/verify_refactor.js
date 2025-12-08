
require('dotenv').config();
const { addMemory, deleteMemory, getMemories, initDb } = require('../dist/db.js');
const { backfillAllEmbeddings } = require('../dist/maintenance.js');

async function run() {
    console.log("Initializing DB...");
    initDb();

    const content = "Verification Test Memory " + Date.now();
    console.log(`Adding memory: "${content}"`);

    // Test addMemory (async)
    const id = await addMemory(content, "test");
    console.log(`Memory added with ID: ${id}`);

    // Verify it exists
    const memories = getMemories(10);
    const mem = memories.find(m => m.id === id);
    if (!mem) {
        console.error("FAILED: Memory not found after adding.");
        process.exit(1);
    }
    console.log("Memory found in DB.");
    console.log("Embedding status:", mem.embedding ? "Has embedding" : "No embedding (Check API Key)");

    // Test backfill (shouldn't crash even if no key)
    console.log("Running backfill...");
    await backfillAllEmbeddings();
    console.log("Backfill finished.");

    // Test delete
    console.log("Deleting memory...");
    const deleted = deleteMemory(id);
    if (deleted) {
        console.log("Memory deleted successfully.");
    } else {
        console.error("FAILED: deleteMemory returned false.");
    }

    // Verify deletion
    const check = getMemories(10).find(m => m.id === id);
    if (check) {
        console.error("FAILED: Memory still exists after deletion.");
    } else {
        console.log("Verified memory is gone.");
    }
}

run().catch(console.error);
