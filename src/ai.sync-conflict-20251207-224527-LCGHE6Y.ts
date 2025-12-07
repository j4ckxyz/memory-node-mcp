import OpenAI from 'openai';

// Defaults to OpenRouter, but can be overridden
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
const API_BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const SITE_URL = process.env.SITE_URL || "http://localhost";
const SITE_NAME = process.env.SITE_NAME || "Memory Node";

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
const SUMMARY_MODEL = process.env.SUMMARY_MODEL || "openai/gpt-4o-mini";

const client = new OpenAI({
    baseURL: API_BASE_URL,
    apiKey: OPENROUTER_API_KEY || "dummy-key", // Prevent crash if key missing, handled in calls
    defaultHeaders: {
        "HTTP-Referer": SITE_URL, // Required by OpenRouter
        "X-Title": SITE_NAME,
    }
});

export async function generateEmbedding(text: string): Promise<number[] | null> {
    if (!OPENROUTER_API_KEY) {
        console.warn("Skipping embedding: No API key provided.");
        return null;
    }

    try {
        const response = await client.embeddings.create({
            model: EMBEDDING_MODEL,
            input: text,
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error("Error generating embedding:", error);
        return null;
    }
}

export async function summarizeMemories(memories: string[]): Promise<string | null> {
    if (!OPENROUTER_API_KEY) {
        console.warn("Skipping summary: No API key provided.");
        return null;
    }

    if (memories.length === 0) return null;

    try {
        const completion = await client.chat.completions.create({
            model: SUMMARY_MODEL,
            messages: [
                { role: "system", content: "You are a helpful assistant managing a long-term memory system. Summarize the following memory chunks into a single, dense paragraph. Preserve key facts, dates, and preferences. Discard redundant information." },
                { role: "user", content: memories.join("\n\n---\n\n") }
            ],
        });
        return completion.choices[0].message.content;
    } catch (error) {
        console.error("Error summarizing memories:", error);
        return null;
    }
}
