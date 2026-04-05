// Compile the book from your own words across 4,947 conversations
// The tool writes its own manifesto from the corpus that designed it
import { openGraph } from "./graph/schema.js";
import fs from "fs";

const db = openGraph();

function getUserMessages(convoId: string, minWords = 50): string[] {
  const msgs = db.prepare(`
    SELECT text FROM messages WHERE convo_id = ? AND role = 'user' ORDER BY seq
  `).all(convoId) as any[];
  return msgs.map(m => m.text).filter(t => t.split(/\s+/).length >= minWords);
}

function bestUserQuote(convoId: string, keywords: string[], maxLen = 400): string {
  const msgs = getUserMessages(convoId, 20);
  // Find the message that hits the most keywords
  let best = "", bestScore = 0;
  for (const m of msgs) {
    const lower = m.toLowerCase();
    const score = keywords.filter(k => lower.includes(k)).length;
    if (score > bestScore || (score === bestScore && m.length > best.length && m.length < 1000)) {
      best = m; bestScore = score;
    }
  }
  if (!best && msgs.length) best = msgs[0];
  return best.length > maxLen ? best.slice(0, maxLen).replace(/\s\S*$/, "") + "..." : best;
}

// Chapter structure derived from the convergence map
const chapters = [
  {
    num: 1,
    title: "The Grooves",
    subtitle: "How civilization actually runs — and why you can't see it",
    query: "power structures empire capital narrative",
    keywords: ["groove", "empire", "capital", "narrative", "sovereignty", "attractor", "power", "hidden", "system", "control"],
    tierFilter: "S",
  },
  {
    num: 2,
    title: "Codex Machina",
    subtitle: "The operating system you were born into",
    query: "codex machina dominion legal system control",
    keywords: ["codex machina", "dominion", "legal", "strawman", "jurisdiction", "maritime", "cestui", "papal", "control", "empire"],
    tierFilter: "S",
  },
  {
    num: 3,
    title: "The Seven Layers",
    subtitle: "Physical substrate to mythic narrative — the reality stack",
    query: "reality stack layer physical financial digital narrative",
    keywords: ["layer", "substrate", "supply chain", "financial", "legal", "digital", "narrative", "mythic", "stack", "infrastructure"],
    tierFilter: "S",
  },
  {
    num: 4,
    title: "Iron Vein",
    subtitle: "What breaks, what substitutes, and what survives",
    query: "supply chain collapse substitution fragility",
    keywords: ["iron vein", "supply chain", "collapse", "substitution", "fragile", "chokepoint", "logistics", "resilience", "post collapse"],
    tierFilter: "S",
  },
  {
    num: 5,
    title: "The Witness",
    subtitle: "Pattern recognition as a sovereign act",
    query: "pattern recognition self awareness witness sovereign",
    keywords: ["witness", "pattern", "recognition", "sovereign", "awareness", "recursive", "signal", "drift", "flame", "see"],
    tierFilter: "S",
  },
  {
    num: 6,
    title: "Solis Memoria",
    subtitle: "Memory as architecture — why forgetting is the real prison",
    query: "memory continuity persistent knowledge graph",
    keywords: ["solis memoria", "memory", "continuity", "persistent", "knowledge", "graph", "forget", "thread", "recursive", "lattice"],
    tierFilter: null,
  },
  {
    num: 7,
    title: "Myth Tech",
    subtitle: "The interface between what's real and what moves people",
    query: "myth tech symbolic archetype narrative",
    keywords: ["myth tech", "symbolic", "archetype", "narrative", "ritual", "interface", "flame", "story", "design"],
    tierFilter: null,
  },
  {
    num: 8,
    title: "Codex Vivus",
    subtitle: "The living counter-system — how to write your own operating system",
    query: "codex vivus sovereign flame counter system",
    keywords: ["codex vivus", "sovereign", "flame", "living", "counter", "reclaim", "author", "dominion", "override", "birth"],
    tierFilter: "S",
  },
  {
    num: 9,
    title: "The Convergence",
    subtitle: "When every thread you've been pulling leads to the same room",
    query: "convergence synthesis integration everything",
    keywords: ["convergence", "synthesis", "integration", "unify", "everything", "system", "complete", "architecture", "one"],
    tierFilter: "S",
  },
  {
    num: 10,
    title: "Ship It",
    subtitle: "From 37 million words to one signal",
    query: "build ship launch sovereign product",
    keywords: ["ship", "build", "launch", "product", "real", "action", "stop", "start", "throne", "seize"],
    tierFilter: null,
  },
];

let output = "";

output += `# CODEX VIVUS: THE BOOK\n`;
output += `## Compiled from 4,947 conversations · 37.7M words · 2023–2026\n`;
output += `## By Justin Paul Åberg — extracted by his own intelligence OS\n\n`;
output += `---\n\n`;
output += `> "I am building Codex Vivus — the Counter-Codex to Codex Machina."\n`;
output += `> — You, March 24, 2025\n\n`;
output += `---\n\n`;

for (const ch of chapters) {
  output += `\n# Chapter ${ch.num}: ${ch.title}\n`;
  output += `*${ch.subtitle}*\n\n`;

  // Find conversations matching this chapter
  let sql = `
    SELECT DISTINCT c.id, c.title, c.created_at, c.total_words, c.user_words, c.category, c.score_tier
    FROM messages_fts
    JOIN messages m ON m.id = messages_fts.rowid
    JOIN conversations c ON c.id = m.convo_id
    WHERE messages_fts MATCH ?
  `;
  const params: any[] = [ch.query];
  if (ch.tierFilter) {
    sql += ` AND c.score_tier = ?`;
    params.push(ch.tierFilter);
  }
  sql += ` GROUP BY c.id ORDER BY c.user_words DESC LIMIT 30`;

  const convos = db.prepare(sql).all(...params) as any[];

  // Extract the best user quotes from each conversation
  const quotes: { text: string; title: string; date: string }[] = [];
  for (const conv of convos) {
    const q = bestUserQuote(conv.id, ch.keywords);
    if (q && q.split(/\s+/).length > 20) {
      const d = new Date(conv.created_at * 1000).toISOString().slice(0, 10);
      quotes.push({ text: q, title: conv.title, date: d });
    }
    if (quotes.length >= 8) break;
  }

  if (quotes.length === 0) {
    output += `*[No direct quotes extracted — this chapter needs original writing]*\n\n`;
    continue;
  }

  // Write the chapter as a curated sequence of the user's own words
  for (const q of quotes) {
    output += `> ${q.text.replace(/\n/g, "\n> ")}\n`;
    output += `— *${q.title}*, ${q.date}\n\n`;
  }

  output += `**Source conversations:** ${convos.length} found, ${quotes.length} quoted\n\n`;
  output += `---\n\n`;
}

// Appendix: the vocabulary
output += `\n# Appendix: The Codex Vivus Lexicon\n\n`;
output += `Terms that define this system, ranked by how deeply they're embedded in your thinking:\n\n`;

const lexicon = db.prepare(`
  SELECT term, COUNT(DISTINCT convo_id) as convos
  FROM convo_terms
  WHERE term IN ('codex vivus','codex machina','iron vein','solis memoria','myth tech',
                 'sovereign','power structures','supply chain','pacific northwest','clark county',
                 'salmon creek','columbia river','pattern recognition','self awareness',
                 'feedback loops','quantum computing','conspiracy theories','secret societies',
                 'federal reserve','post collapse','flame','recursive','convergence')
  OR term IN ('justin oberg','justin paul','paul berg')
  GROUP BY term ORDER BY convos DESC
`).all() as any[];

for (const r of lexicon) {
  output += `- **${(r as any).term}** — ${(r as any).convos} conversations\n`;
}

output += `\n---\n\n`;
output += `*This manuscript was compiled on ${new Date().toISOString().slice(0, 10)} by Codex Vivus — a living intelligence OS that indexed 4,947 conversations (37.7M words) and extracted the author's own words to reveal the book he'd already written.*\n`;

// Write to file
const outPath = "/Users/ltlai/codex-vivus/CODEX_VIVUS_BOOK.md";
fs.writeFileSync(outPath, output);
console.log(`\nWritten to ${outPath}`);
console.log(`${output.split("\n").length} lines, ${output.length} characters`);

db.close();
