
require('dotenv').config();
const { addMemory, deleteMemory, getMemories, initDb, getGlobalSummary, saveGlobalSummary } = require('../dist/db.js');
const { updateGlobalSummary } = require('../dist/maintenance.js');

async function run() {
    console.log("Initializing DB...");
    initDb();

    console.log("Adding dummy memories for summary test...");
    await addMemory("I love playing tennis on weekends.", "conversation");
    await addMemory("My favorite food is pizza.", "conversation");
    await addMemory("I work as a software engineer.", "conversation");

    console.log("Running updateGlobalSummary...");
    const status = await updateGlobalSummary();
    console.log("Update status:", status);

    const summary = getGlobalSummary();
    console.log("Retrieved Summary:", summary);

    if (summary && summary.length > 0) {
        console.log("SUCCESS: Global summary generated and retrieved.");
    } else {
        console.log("WARNING: Summary is empty (check API key if expected).");
    }

    // Verify retrieval limits
    console.log("Checking retrieval limit...");
    const recent = getMemories(500);
    console.log(`Fetched ${recent.length} memories (should exclude global_summary).`);

    const isSummaryInList = recent.some(m => m.type === 'global_summary');
    if (isSummaryInList) {
        console.error("FAILED: global_summary appeared in normal list!");
    } else {
        console.log("SUCCESS: global_summary excluded from normal list.");
    }
}

run().catch(console.error);
