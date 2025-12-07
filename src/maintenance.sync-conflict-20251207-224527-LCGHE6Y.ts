import cron from 'node-cron';
import { getMemoriesWithoutEmbeddings, addEmbedding, getMemories, addMemory, updateMemory } from './db.js';
import { generateEmbedding, summarizeMemories } from './ai.js';

// Schedule: Daily at midnight
export function initScheduler() {
    console.log("Initializing scheduler (Daily at 00:00)...");
    cron.schedule('0 0 * * *', async () => {
        console.log("Running daily maintenance...");
        await runMaintenance();
    });
}

// Also exposed for manual trigger
export async function runMaintenance() {
    console.log("Starting maintenance task...");

    // 1. Backfill embeddings
    await fillMissingEmbeddings();

    // 2. Summarize recent memories (Mock logic: if > 10 new memories today, summarize them)
    // For simplicity, we'll just check the last 20 memories and see if they are raw conversations.
    await summarizeRecent();

    console.log("Maintenance task completed.");
}

async function fillMissingEmbeddings() {
    const missing = getMemoriesWithoutEmbeddings(20); // Process in chunks
    if (missing.length === 0) return;

    console.log(`Generating embeddings for ${missing.length} memories...`);
    for (const mem of missing) {
        const vector = await generateEmbedding(mem.content);
        if (vector) {
            addEmbedding(mem.id, vector);
        }
    }
}

async function summarizeRecent() {
    // This is a naive implementation: Get last 50 memories, if they are 'conversation' type, summarize them.
    // In a real system, we'd track "unsummarized" status.
    // Here we'll just leave it as a manual/daily trigger that doesn't delete old data yet to be safe, 
    // but appends a 'periodic_summary'.

    const recent = getMemories(50);
    const conversations = recent.filter(m => m.type === 'conversation' && !m.content.startsWith('Summary:'));

    if (conversations.length < 10) {
        console.log("Not enough recent conversations to summarize.");
        return;
    }

    console.log(`Summarizing ${conversations.length} conversation chunks...`);
    const summary = await summarizeMemories(conversations.map(c => c.content));

    if (summary) {
        addMemory(summary, 'periodic_summary', { source_count: conversations.length, date: new Date().toISOString() });
        console.log("Created new periodic summary.");
    }
}
