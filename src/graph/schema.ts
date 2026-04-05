import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";

const DB_PATH =
  process.env.CODEX_DB || path.join(os.homedir(), ".codex-vivus", "graph.db");

export function openGraph(): Database.Database {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    -- Conversations
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,           -- deterministic hash
      provider TEXT NOT NULL,        -- chatgpt | claude | gemini | doc | note
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,   -- unix seconds
      total_words INTEGER NOT NULL,
      user_words INTEGER NOT NULL,
      msg_count INTEGER NOT NULL,
      category TEXT,
      color TEXT,
      score_total REAL,
      score_tier TEXT,               -- S/A/B/C/D
      has_code INTEGER DEFAULT 0,
      has_decision INTEGER DEFAULT 0,
      has_idea INTEGER DEFAULT 0,
      has_plan INTEGER DEFAULT 0,
      has_build INTEGER DEFAULT 0,
      user_thinking INTEGER DEFAULT 0,
      preview TEXT,
      ingested_at INTEGER NOT NULL   -- when we indexed it
    );

    -- Messages (full text, for search and retrieval)
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      convo_id TEXT NOT NULL REFERENCES conversations(id),
      seq INTEGER NOT NULL,          -- order within conversation
      role TEXT NOT NULL,            -- user | assistant
      text TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_convo ON messages(convo_id, seq);

    -- Terms extracted from conversations
    CREATE TABLE IF NOT EXISTS convo_terms (
      convo_id TEXT NOT NULL REFERENCES conversations(id),
      term TEXT NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (convo_id, term)
    );
    CREATE INDEX IF NOT EXISTS idx_terms_term ON convo_terms(term);

    -- Entities (proper nouns that appear across conversations)
    CREATE TABLE IF NOT EXISTS convo_entities (
      convo_id TEXT NOT NULL REFERENCES conversations(id),
      entity TEXT NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (convo_id, entity)
    );
    CREATE INDEX IF NOT EXISTS idx_entities_entity ON convo_entities(entity);

    -- Topics (global: bigram topics that emerge from TF-IDF)
    CREATE TABLE IF NOT EXISTS topics (
      term TEXT PRIMARY KEY,
      doc_freq INTEGER NOT NULL,
      idf REAL NOT NULL,
      score REAL NOT NULL
    );

    -- Topic-conversation links
    CREATE TABLE IF NOT EXISTS topic_links (
      convo_id TEXT NOT NULL REFERENCES conversations(id),
      topic TEXT NOT NULL REFERENCES topics(term),
      strength REAL NOT NULL,
      PRIMARY KEY (convo_id, topic)
    );

    -- Projects (detected clusters)
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      first_date TEXT,
      last_date TEXT,
      convo_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_terms (
      project_id INTEGER NOT NULL REFERENCES projects(id),
      term TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_convos (
      project_id INTEGER NOT NULL REFERENCES projects(id),
      convo_id TEXT NOT NULL REFERENCES conversations(id)
    );

    -- Knowledge threads (topics recurring across 3+ months)
    CREATE TABLE IF NOT EXISTS threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term TEXT NOT NULL UNIQUE,
      total_mentions INTEGER NOT NULL,
      span_months INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS thread_months (
      thread_id INTEGER NOT NULL REFERENCES threads(id),
      month TEXT NOT NULL,
      count INTEGER NOT NULL
    );

    -- Open threads: deep thinking sessions that went unresolved
    CREATE TABLE IF NOT EXISTS open_threads (
      convo_id TEXT PRIMARY KEY REFERENCES conversations(id),
      reason TEXT NOT NULL,           -- unfinished_project | deep_thinking | convergence
      related_convos TEXT,            -- JSON array of related convo IDs
      status TEXT DEFAULT 'open'      -- open | resolved | merged
    );

    -- Convergence points: where multiple threads meet
    CREATE TABLE IF NOT EXISTS convergences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      detected_at INTEGER NOT NULL,
      description TEXT NOT NULL,
      thread_ids TEXT NOT NULL,        -- JSON array
      convo_ids TEXT NOT NULL,         -- JSON array
      strength REAL NOT NULL
    );

    -- Full-text search on messages
    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      text, content=messages, content_rowid=id
    );

    -- Triggers to keep FTS in sync
    CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts(rowid, text) VALUES (new.id, new.text);
    END;
    CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, text) VALUES ('delete', old.id, old.text);
    END;
  `);
}
