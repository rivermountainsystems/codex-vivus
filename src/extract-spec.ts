// Extract every user message from codex vivus + iron vein conversations
// to compile the product spec you already wrote across 280 conversations
import { openGraph } from "./graph/schema.js";
const db = openGraph();

// Find conversations where codex vivus AND iron vein co-occur (the convergence zone)
const convergence = db.prepare(`
  SELECT DISTINCT c.id, c.title, c.created_at, c.total_words, c.user_words, c.category, c.score_tier
  FROM convo_terms t1
  JOIN convo_terms t2 ON t1.convo_id = t2.convo_id
  JOIN conversations c ON c.id = t1.convo_id
  WHERE t1.term = 'codex vivus' AND t2.term = 'iron vein'
  AND c.score_tier IN ('S','A')
  ORDER BY c.created_at ASC
`).all() as any[];

console.log(`=== THE CONVERGENCE ZONE: ${convergence.length} convos where codex vivus + iron vein meet ===\n`);
for (const r of convergence) {
  const d = new Date(r.created_at * 1000).toISOString().slice(0, 10);
  console.log(`  ${d}  ${r.score_tier}  ${(r.total_words/1000).toFixed(0).padStart(4)}K  ${r.category.padEnd(10)}  ${r.title}`);
}

// Now extract YOUR words from these conversations — the parts where you were designing the system
console.log(`\n${"=".repeat(80)}`);
console.log(`  YOUR WORDS FROM THE CONVERGENCE ZONE`);
console.log(`  (user messages >100 words from codex vivus + iron vein conversations)`);
console.log(`${"=".repeat(80)}\n`);

for (const conv of convergence.slice(0, 15)) { // top 15 by date
  const d = new Date(conv.created_at * 1000).toISOString().slice(0, 10);
  const msgs = db.prepare(`
    SELECT text FROM messages
    WHERE convo_id = ? AND role = 'user'
    ORDER BY seq
  `).all(conv.id) as any[];

  // Find user messages that mention codex, vivus, iron, vein, sovereign, supply, or system concepts
  const relevant = msgs.filter((m: any) => {
    const words = m.text.split(/\s+/).length;
    if (words < 30) return false;
    const t = m.text.toLowerCase();
    return t.includes('codex') || t.includes('vivus') || t.includes('iron') || t.includes('vein') ||
           t.includes('sovereign') || t.includes('supply') || t.includes('system') || t.includes('build') ||
           t.includes('architecture') || t.includes('framework') || t.includes('promethea') ||
           words > 200; // or just long thinking
  });

  if (!relevant.length) continue;

  console.log(`\n--- ${d} | ${conv.title} (${conv.score_tier}, ${(conv.total_words/1000).toFixed(0)}K words) ---\n`);
  for (const m of relevant.slice(0, 3)) { // max 3 per convo
    const text = m.text.trim();
    // Show first 500 chars of each relevant message
    const display = text.length > 600 ? text.slice(0, 600) + "\n  [...cont'd]" : text;
    console.log(`  > ${display.replace(/\n/g, '\n  > ')}\n`);
  }
}

// Also pull the pure codex vivus conversations (without iron vein) for the philosophical/structural layer
console.log(`\n${"=".repeat(80)}`);
console.log(`  CODEX VIVUS — THE FRAMEWORK LAYER (pure codex conversations)`);
console.log(`${"=".repeat(80)}\n`);

const pureCodex = db.prepare(`
  SELECT DISTINCT c.id, c.title, c.created_at, c.total_words, c.category, c.score_tier
  FROM convo_terms t
  JOIN conversations c ON c.id = t.convo_id
  WHERE t.term = 'codex vivus' AND c.score_tier = 'S'
  AND c.id NOT IN (SELECT convo_id FROM convo_terms WHERE term = 'iron vein')
  ORDER BY c.user_words DESC
  LIMIT 10
`).all() as any[];

for (const conv of pureCodex) {
  const d = new Date(conv.created_at * 1000).toISOString().slice(0, 10);
  const msgs = db.prepare(`
    SELECT text FROM messages
    WHERE convo_id = ? AND role = 'user'
    ORDER BY seq
  `).all(conv.id) as any[];

  const relevant = msgs.filter((m: any) => {
    const t = m.text.toLowerCase();
    return (t.includes('codex') || t.includes('vivus') || t.includes('sovereign') || t.includes('flame') || t.includes('machina')) && m.text.split(/\s+/).length > 30;
  });

  if (!relevant.length) continue;

  console.log(`\n--- ${d} | ${conv.title} ---\n`);
  for (const m of relevant.slice(0, 2)) {
    const text = m.text.trim();
    const display = text.length > 500 ? text.slice(0, 500) + "\n  [...cont'd]" : text;
    console.log(`  > ${display.replace(/\n/g, '\n  > ')}\n`);
  }
}

// Finally: what terms co-occur with codex vivus? This IS the spec vocabulary.
console.log(`\n${"=".repeat(80)}`);
console.log(`  CODEX VIVUS VOCABULARY — terms that always appear alongside it`);
console.log(`${"=".repeat(80)}\n`);

const coterms = db.prepare(`
  SELECT t2.term, COUNT(*) as together
  FROM convo_terms t1
  JOIN convo_terms t2 ON t1.convo_id = t2.convo_id AND t1.term != t2.term
  WHERE t1.term = 'codex vivus'
  AND t2.term LIKE '% %'
  AND t2.count >= 4
  GROUP BY t2.term
  HAVING together >= 10
  ORDER BY together DESC
  LIMIT 40
`).all() as any[];

for (const r of coterms) {
  const bar = "\u2593".repeat(Math.round((r as any).together / 2));
  console.log(`  ${((r as any).term as string).padEnd(28)} ${String((r as any).together).padStart(3)} convos  ${bar}`);
}

db.close();
