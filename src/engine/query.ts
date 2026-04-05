// Query engine: search, surface connections, generate context briefs

import { openGraph } from "../graph/schema.js";

export type SearchResult = {
  id: string;
  title: string;
  date: string;
  category: string;
  tier: string;
  words: number;
  snippet: string;
};

export type ThreadStatus = {
  id: string;
  title: string;
  date: string;
  words: number;
  tier: string;
  reason: string;
  relatedCount: number;
};

export type ContextBrief = {
  query: string;
  relatedConversations: SearchResult[];
  relevantTopics: { term: string; docFreq: number }[];
  openThreads: ThreadStatus[];
  convergences: string[];
};

export function search(query: string, limit = 20): SearchResult[] {
  const db = openGraph();
  // Use FTS5 for full-text search, join back to conversations for metadata
  const rows = db.prepare(`
    SELECT c.id, c.title, c.created_at, c.category, c.score_tier, c.total_words, c.preview,
           MIN(messages_fts.rank) as best_rank
    FROM messages_fts
    JOIN messages m ON m.id = messages_fts.rowid
    JOIN conversations c ON c.id = m.convo_id
    WHERE messages_fts MATCH ?
    GROUP BY c.id
    ORDER BY best_rank
    LIMIT ?
  `).all(query, limit) as any[];
  db.close();

  return rows.map(r => ({
    id: r.id,
    title: r.title,
    date: r.created_at ? new Date(r.created_at * 1000).toISOString().slice(0, 10) : "?",
    category: r.category,
    tier: r.score_tier,
    words: r.total_words,
    snippet: r.preview || "",
  }));
}

export function topConversations(tier?: string, category?: string, limit = 20): SearchResult[] {
  const db = openGraph();
  let sql = `SELECT id, title, created_at, category, score_tier, total_words, preview
             FROM conversations WHERE 1=1`;
  const params: any[] = [];
  if (tier) { sql += ` AND score_tier = ?`; params.push(tier); }
  if (category) { sql += ` AND category = ?`; params.push(category); }
  sql += ` ORDER BY score_total DESC LIMIT ?`;
  params.push(limit);

  const rows = db.prepare(sql).all(...params) as any[];
  db.close();
  return rows.map(r => ({
    id: r.id, title: r.title,
    date: r.created_at ? new Date(r.created_at * 1000).toISOString().slice(0, 10) : "?",
    category: r.category, tier: r.score_tier, words: r.total_words, snippet: r.preview || "",
  }));
}

export function relatedConversations(convoId: string, limit = 10): SearchResult[] {
  const db = openGraph();
  // Find conversations that share the most terms with the given one
  const rows = db.prepare(`
    SELECT c2.id, c2.title, c2.created_at, c2.category, c2.score_tier, c2.total_words, c2.preview,
           COUNT(*) as shared_terms
    FROM convo_terms t1
    JOIN convo_terms t2 ON t1.term = t2.term AND t2.convo_id != t1.convo_id
    JOIN conversations c2 ON c2.id = t2.convo_id
    WHERE t1.convo_id = ?
    GROUP BY c2.id
    ORDER BY shared_terms DESC
    LIMIT ?
  `).all(convoId, limit) as any[];
  db.close();
  return rows.map(r => ({
    id: r.id, title: r.title,
    date: r.created_at ? new Date(r.created_at * 1000).toISOString().slice(0, 10) : "?",
    category: r.category, tier: r.score_tier, words: r.total_words, snippet: r.preview || "",
  }));
}

export function topTopics(limit = 30): { term: string; docFreq: number }[] {
  const db = openGraph();
  const rows = db.prepare(`
    SELECT term, COUNT(DISTINCT convo_id) as doc_freq
    FROM convo_terms
    WHERE term LIKE '% %'
    GROUP BY term
    HAVING doc_freq >= 10
    ORDER BY doc_freq DESC
    LIMIT ?
  `).all(limit) as any[];
  db.close();
  return rows.map(r => ({ term: r.term, docFreq: r.doc_freq }));
}

export function stats(): Record<string, any> {
  const db = openGraph();
  const total = (db.prepare(`SELECT COUNT(*) as n FROM conversations`).get() as any).n;
  const totalWords = (db.prepare(`SELECT SUM(total_words) as n FROM conversations`).get() as any).n || 0;
  const tiers = db.prepare(`SELECT score_tier, COUNT(*) as n FROM conversations GROUP BY score_tier ORDER BY score_tier`).all() as any[];
  const cats = db.prepare(`SELECT category, COUNT(*) as n FROM conversations GROUP BY category ORDER BY n DESC`).all() as any[];
  const dates = db.prepare(`SELECT MIN(created_at) as earliest, MAX(created_at) as latest FROM conversations WHERE created_at > 0`).get() as any;
  db.close();
  return {
    conversations: total,
    totalWords,
    tiers: Object.fromEntries(tiers.map(r => [r.score_tier, r.n])),
    categories: Object.fromEntries(cats.map(r => [r.category, r.n])),
    earliest: dates?.earliest ? new Date(dates.earliest * 1000).toISOString().slice(0, 10) : "?",
    latest: dates?.latest ? new Date(dates.latest * 1000).toISOString().slice(0, 10) : "?",
  };
}

export function contextBrief(query: string): ContextBrief {
  const related = search(query, 10);
  const topics = topTopics(15);
  return {
    query,
    relatedConversations: related,
    relevantTopics: topics,
    openThreads: [],
    convergences: [],
  };
}
