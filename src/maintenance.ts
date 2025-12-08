import cron from 'node-cron';
import { getMemoriesWithoutEmbeddings, addEmbedding, getMemories, addMemory, updateMemory, getAllMemories, saveGlobalSummary } from './db.js';
import { generateEmbedding, summarizeMemories, checkAiConfig, generateTopicSummary } from './ai.js';

export async function updateGlobalSummary(): Promise<string> {
    console.error("Updating global topic summary...");
    const config = checkAiConfig();
    if (!config.ok) return `FAILED: ${config.error}`;

    const allMemories = getAllMemories();
    if (allMemories.length === 0) return "No memories to summarize.";

    // Limit to recent 200 or so to avoid huge context, or just take all if consistent with limits.
    // For now, let's take the last 500 lines of content combined, or just 100 most recent memories.
    const recent = allMemories.slice(0, 100);
    const summary = await generateTopicSummary(recent.map(m => m.content));

    if (summary) {
        saveGlobalSummary(summary);
        console.error("Global summary updated.");
        return "Global summary updated successfully.";
    }
    return "Failed to generate summary.";
}

export async function backfillAllEmbeddings(): Promise<string> {
    console.error("Starting full backfill of embeddings...");

    const config = checkAiConfig();
    if (!config.ok) {
        return `FAILED: ${config.error}`;
    }

    let processed = 0;
    while (true) {
        const missing = getMemoriesWithoutEmbeddings(20);
        if (missing.length === 0) break;

        console.error(`Backfilling batch of ${missing.length} memories...`);
        let batchSuccess = 0;
        for (const mem of missing) {
            const vector = await generateEmbedding(mem.content);
            if (vector) {
                addEmbedding(mem.id, vector);
                processed++;
                batchSuccess++;
            }
        }

        // If we processed a batch but didn't successfully embed any, assume failure (e.g. no API key) and stop to avoid infinite loop.
        if (batchSuccess === 0) {
            console.error("Failed to generate embeddings for batch. Aborting backfill.");
            return `PARTIAL: Processed ${processed} memories, then failed to generate embeddings. Check logs.`;
        }
    }
    console.error(`Backfill complete. Processed ${processed} memories.`);
    return `SUCCESS: Processed ${processed} memories.`;
}

// Schedule: Daily at midnight
export function initScheduler() {
    console.error("Initializing scheduler...");

    // Daily maintenance at midnight
    cron.schedule('0 0 * * *', async () => {
        console.error("Running daily maintenance...");
        await runMaintenance();
    });

    // Update summary every 6 hours
    cron.schedule('0 */6 * * *', async () => {
        await updateGlobalSummary();
    });
}

// Also exposed for manual trigger
export async function runMaintenance() {
    console.error("Starting maintenance task...");

    // 1. Backfill embeddings
    await fillMissingEmbeddings();

    // 2. Summarize recent memories (Mock logic: if > 10 new memories today, summarize them)
    // For simplicity, we'll just check the last 20 memories and see if they are raw conversations.
    await summarizeRecent();

    console.error("Maintenance task completed.");
}

async function fillMissingEmbeddings() {
    const missing = getMemoriesWithoutEmbeddings(20); // Process in chunks
    if (missing.length === 0) return;

    console.error(`Generating embeddings for ${missing.length} memories...`);
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
        console.error("Not enough recent conversations to summarize.");
        return;
    }

    console.error(`Summarizing ${conversations.length} conversation chunks...`);
    const summary = await summarizeMemories(conversations.map(c => c.content));

    if (summary) {
        await addMemory(summary, 'periodic_summary', { source_count: conversations.length, date: new Date().toISOString() });
        console.error("Created new periodic summary.");
    }
}
