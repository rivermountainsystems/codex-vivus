// Explore your graph — the queries that reveal something
import { openGraph } from "./graph/schema.js";
const db = openGraph();

console.log("=== ABANDONED S-TIER BUILDS (6+ months old, 10K+ words, never revisited) ===\n");
const oldBuilds = db.prepare(`
  SELECT title, created_at, total_words, user_words, score_tier, category
  FROM conversations
  WHERE has_build = 1 AND score_tier = 'S' AND total_words > 10000
  AND created_at < unixepoch() - 180*86400
  ORDER BY total_words DESC LIMIT 15
`).all() as any[];
for (const r of oldBuilds) {
  const d = new Date(r.created_at * 1000).toISOString().slice(0, 10);
  const you = Math.round(r.user_words / r.total_words * 100);
  console.log(`  ${d}  ${(r.total_words / 1000).toFixed(0).padStart(4)}K  (${you}% you)  ${r.category.padEnd(10)}  ${r.title.slice(0, 60)}`);
}

console.log("\n=== DEEPEST THINKING (you wrote 500+ words AND explored ideas) ===\n");
const deep = db.prepare(`
  SELECT title, created_at, total_words, user_words, category, score_tier
  FROM conversations
  WHERE user_thinking = 1 AND has_idea = 1 AND score_tier IN ('S','A')
  ORDER BY user_words DESC LIMIT 20
`).all() as any[];
for (const r of deep) {
  const d = new Date(r.created_at * 1000).toISOString().slice(0, 10);
  console.log(`  ${d}  ${(r.user_words / 1000).toFixed(0).padStart(4)}K you  ${r.score_tier}  ${r.category.padEnd(10)}  ${r.title.slice(0, 55)}`);
}

console.log("\n=== RECENT DECISIONS (last 6 months) ===\n");
const decisions = db.prepare(`
  SELECT title, created_at, total_words, category, score_tier, preview
  FROM conversations
  WHERE has_decision = 1 AND score_tier IN ('S','A')
  AND created_at > unixepoch() - 180*86400
  ORDER BY created_at DESC LIMIT 15
`).all() as any[];
for (const r of decisions) {
  const d = new Date(r.created_at * 1000).toISOString().slice(0, 10);
  console.log(`  ${d}  ${r.score_tier}  ${r.category.padEnd(10)}  ${r.title.slice(0, 55)}`);
}

console.log("\n=== TOPICS YOU KEEP RETURNING TO (appear across most months) ===\n");
const recurring = db.prepare(`
  SELECT term, COUNT(DISTINCT substr(datetime(c.created_at, 'unixepoch'), 1, 7)) as months,
         COUNT(DISTINCT t.convo_id) as convos
  FROM convo_terms t
  JOIN conversations c ON c.id = t.convo_id
  WHERE t.term LIKE '% %'
  AND t.count >= 4
  GROUP BY t.term
  HAVING months >= 12
  ORDER BY months DESC, convos DESC
  LIMIT 25
`).all() as any[];
for (const r of recurring) {
  const bar = "\u2593".repeat(Math.round(r.months / 3));
  console.log(`  ${r.term.padEnd(28)} ${String(r.months).padStart(2)} months  ${String(r.convos).padStart(4)} convos  ${bar}`);
}

console.log("\n=== CONVERGENCE: topics that appear together in S-tier convos ===\n");
const cooccur = db.prepare(`
  SELECT t1.term as a, t2.term as b, COUNT(*) as together
  FROM convo_terms t1
  JOIN convo_terms t2 ON t1.convo_id = t2.convo_id AND t1.term < t2.term
  JOIN conversations c ON c.id = t1.convo_id
  WHERE c.score_tier = 'S'
  AND t1.term LIKE '% %' AND t2.term LIKE '% %'
  AND t1.count >= 4 AND t2.count >= 4
  GROUP BY t1.term, t2.term
  HAVING together >= 15
  ORDER BY together DESC
  LIMIT 20
`).all() as any[];
for (const r of cooccur) {
  console.log(`  ${r.a.padEnd(25)} + ${r.b.padEnd(25)} ${r.together} S-tier convos`);
}

console.log("\n=== YOUR IDENTITY IN THE GRAPH ===\n");
const identity = db.prepare(`
  SELECT term, COUNT(*) as mentions
  FROM convo_terms
  WHERE term IN ('codex vivus','codex machina','iron vein','solis memoria','myth tech',
                 'justin oberg','clark county','salmon creek','pacific northwest','columbia river',
                 'promethea systems','self awareness','power structures','sovereign')
  GROUP BY term
  ORDER BY mentions DESC
`).all() as any[];
for (const r of identity) {
  const bar = "\u2593".repeat(Math.round((r as any).mentions / 10));
  console.log(`  ${(r as any).term.padEnd(24)} ${String((r as any).mentions).padStart(5)} mentions  ${bar}`);
}

console.log("\n=== CATEGORY CROSSOVER: S-tier convos that bridge 2+ categories by terms ===\n");
// Find individual conversations where terms usually from one category appear in another
const bridges = db.prepare(`
  SELECT c.title, c.category, c.created_at, c.total_words, c.score_tier
  FROM conversations c
  WHERE c.score_tier = 'S' AND c.total_words > 20000
  AND EXISTS (SELECT 1 FROM convo_terms t WHERE t.convo_id = c.id AND t.term = 'codex vivus')
  ORDER BY c.total_words DESC
  LIMIT 10
`).all() as any[];
for (const r of bridges) {
  const d = new Date(r.created_at * 1000).toISOString().slice(0, 10);
  console.log(`  ${d}  ${(r.total_words / 1000).toFixed(0).padStart(4)}K  ${r.category.padEnd(10)}  ${r.title.slice(0, 60)}`);
}

db.close();
