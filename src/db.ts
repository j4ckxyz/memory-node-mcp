import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync, existsSync } from 'fs';
import { randomUUID } from 'node:crypto';
import similarity from 'compute-cosine-similarity';
import { generateEmbedding } from './ai.js';
export { similarity };

export interface Memory {
  id: string;
  content: string;
  type: string;
  created_at: string;
  metadata: string | null;
  embedding?: string | null; // JSON string of number[]
}

const DB_DIR = join(homedir(), '.memory-node');
if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(join(DB_DIR, 'memories.db'));

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'conversation',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT,
      embedding TEXT -- JSON array of floats
    );
    CREATE INDEX IF NOT EXISTS idx_memories_content ON memories(content);
    CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
  `);

  // Migration: Add embedding column if it doesn't exist
  try {
    db.prepare('SELECT embedding FROM memories LIMIT 1').get();
  } catch (e) {
    db.exec('ALTER TABLE memories ADD COLUMN embedding TEXT');
  }
}

export async function addMemory(content: string, type: string = 'conversation', metadata?: any): Promise<string> {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO memories (id, content, type, metadata)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, content, type, metadata ? JSON.stringify(metadata) : null);

  // Generate and save embedding immediately
  try {
    const vector = await generateEmbedding(content);
    if (vector) {
      addEmbedding(id, vector);
    }
  } catch (error) {
    console.error("Failed to generate embedding for new memory:", error);
    // Continue without embedding, it can be backfilled later
  }

  return id;
}

export function addEmbedding(id: string, embedding: number[]) {
  const stmt = db.prepare('UPDATE memories SET embedding = ? WHERE id = ?');
  stmt.run(JSON.stringify(embedding), id);
}

export function getMemories(limit: number = 100): Memory[] {
  const stmt = db.prepare(`
    SELECT * FROM memories
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(limit) as Memory[];
}

export function getMemoriesWithoutEmbeddings(limit: number = 20): Memory[] {
  const stmt = db.prepare(`
        SELECT * FROM memories WHERE embedding IS NULL AND type != 'summary'
        ORDER BY created_at DESC
        LIMIT ?
    `);
  return stmt.all(limit) as Memory[];
}

export function searchMemories(query: string): Memory[] {
  // Basic text search
  const stmt = db.prepare(`
    SELECT * FROM memories
    WHERE content LIKE ?
    ORDER BY created_at DESC
    LIMIT 20
  `);
  return stmt.all(`%${query}%`) as Memory[];
}

export function searchMemoriesByVector(vector: number[], limit: number = 10): Memory[] {
  // Brute-force cosine similarity (fine for <10k rows)
  const stmt = db.prepare('SELECT * FROM memories WHERE embedding IS NOT NULL');
  const allMemories = stmt.all() as Memory[];

  if (allMemories.length === 0) return [];

  const scored = allMemories.map(mem => {
    const memVector = JSON.parse(mem.embedding!);
    return {
      ...mem,
      score: similarity(vector, memVector) || 0
    };
  });

  // Sort by score desc
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}

export function deleteMemory(id: string): boolean {
  const stmt = db.prepare('DELETE FROM memories WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function updateMemory(id: string, content: string): boolean {
  const stmt = db.prepare('UPDATE memories SET content = ?, embedding = NULL WHERE id = ?'); // Reset embedding on update
  const result = stmt.run(content, id);
  return result.changes > 0;
}

export function getAllMemories(): Memory[] {
  const stmt = db.prepare('SELECT * FROM memories ORDER BY created_at ASC');
  return stmt.all() as Memory[];
}
