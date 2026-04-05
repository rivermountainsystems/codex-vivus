// Ingest pipeline: file -> normalize -> analyze -> store in graph

import fs from "fs";
import Database from "better-sqlite3";
import { openGraph } from "../graph/schema.js";
import { normalizeFile, streamParseConversations, type NormalizedConversation } from "./normalize.js";
import { categorize, extractTerms, extractEntities, score, detectSignals, preview } from "./analyze.js";

export function ingest(filePath: string): { total: number; new: number; skipped: number } {
  const db = openGraph();
  const raw = fs.readFileSync(filePath);
  const filename = filePath.split("/").pop() || "";

  let convos: Iterable<NormalizedConversation>;

  // Large files (>100MB): stream parse
  if (raw.length > 100_000_000) {
    console.error(`Large file (${(raw.length / 1e6).toFixed(0)}MB) — streaming...`);
    convos = streamParseConversations(raw, "chatgpt");
  } else {
    convos = normalizeFile(raw.toString("utf-8"), filename);
  }

  const insertConvo = db.prepare(`
    INSERT OR IGNORE INTO conversations
    (id, provider, title, created_at, total_words, user_words, msg_count, category, color,
     score_total, score_tier, has_code, has_decision, has_idea, has_plan, has_build,
     user_thinking, preview, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMsg = db.prepare(`INSERT INTO messages (convo_id, seq, role, text) VALUES (?, ?, ?, ?)`);
  const insertTerm = db.prepare(`INSERT OR IGNORE INTO convo_terms (convo_id, term, count) VALUES (?, ?, ?)`);
  const insertEntity = db.prepare(`INSERT OR IGNORE INTO convo_entities (convo_id, entity, count) VALUES (?, ?, ?)`);

  let total = 0, added = 0, skipped = 0;

  const batchInsert = db.transaction((batch: NormalizedConversation[]) => {
    for (const c of batch) {
      total++;
      const tw = c.messages.reduce((s, m) => s + m.text.split(/\s+/).length, 0);
      const uw = c.messages.filter(m => m.role === "user").reduce((s, m) => s + m.text.split(/\s+/).length, 0);
      const allText = c.messages.map(m => m.text.slice(0, 2000)).join(" ");
      const [cat, color] = categorize(c.title + " " + allText.slice(0, 2000));
      const s = score(c.messages);
      const sig = detectSignals(c.messages);
      const prev = preview(c.messages);

      const result = insertConvo.run(
        c.id, c.provider, c.title, c.createTime, tw, uw, c.messages.length,
        cat, color, s.total, s.tier,
        sig.hasCode ? 1 : 0, sig.hasDecision ? 1 : 0, sig.hasIdea ? 1 : 0,
        sig.hasPlan ? 1 : 0, sig.hasBuild ? 1 : 0, sig.userThinking ? 1 : 0,
        prev, Math.floor(Date.now() / 1000)
      );

      if (result.changes === 0) { skipped++; continue; }
      added++;

      // Store messages
      for (let i = 0; i < c.messages.length; i++) {
        insertMsg.run(c.id, i, c.messages[i].role, c.messages[i].text);
      }

      // Store terms (top 50 per convo)
      const terms = extractTerms(allText);
      const topTerms = [...terms.entries()].filter(([, cnt]) => cnt >= 2).sort((a, b) => b[1] - a[1]).slice(0, 50);
      for (const [term, count] of topTerms) {
        insertTerm.run(c.id, term, count);
      }

      // Store entities (top 20 per convo)
      const entities = extractEntities(allText);
      const topEntities = [...entities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
      for (const [entity, count] of topEntities) {
        insertEntity.run(c.id, entity, count);
      }

      if (added % 500 === 0) console.error(`  ${added} indexed...`);
    }
  });

  // Process in batches
  let batch: NormalizedConversation[] = [];
  for (const c of convos) {
    batch.push(c);
    if (batch.length >= 100) {
      batchInsert(batch);
      batch = [];
    }
  }
  if (batch.length) batchInsert(batch);

  console.error(`Indexed ${added} new, ${skipped} already existed, ${total} total processed`);
  db.close();
  return { total, new: added, skipped };
}
