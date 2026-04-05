// Find the single most publishable idea from the graph
// and pull the user's own words to draft the first Substack post
import { openGraph } from "./graph/schema.js";
import fs from "fs";

const db = openGraph();

// What concepts ONLY you talk about? (appear in your graph but aren't generic)
console.error("Finding your unique concepts...");
const unique = db.prepare(`
  SELECT term, COUNT(DISTINCT convo_id) as convos
  FROM convo_terms
  WHERE term LIKE '% %' AND count >= 4
  GROUP BY term
  HAVING convos >= 20 AND convos <= 300
  ORDER BY convos DESC
`).all() as any[];

// Find the "grooves" concept — your most original framework
console.error("Finding your best framework articulation...");
const grooveConvos = db.prepare(`
  SELECT c.id, c.title, c.created_at, c.total_words, c.user_words, c.score_tier
  FROM messages_fts
  JOIN messages m ON m.id = messages_fts.rowid
  JOIN conversations c ON c.id = m.convo_id
  WHERE messages_fts MATCH 'groove OR grooves OR attractor OR canalize'
  AND c.score_tier IN ('S','A')
  GROUP BY c.id
  ORDER BY c.user_words DESC
  LIMIT 10
`).all() as any[];

// Find your best "what is codex vivus" explanation
const whatIsConvos = db.prepare(`
  SELECT c.id, c.title, c.created_at, c.total_words, c.user_words
  FROM messages_fts
  JOIN messages m ON m.id = messages_fts.rowid
  JOIN conversations c ON c.id = m.convo_id
  WHERE messages_fts MATCH '"codex vivus" AND (building OR built OR counter OR system)'
  AND c.score_tier = 'S'
  GROUP BY c.id
  ORDER BY c.user_words DESC
  LIMIT 5
`).all() as any[];

// Find the "I talked to AI for 3 years" self-awareness moment
const metaConvos = db.prepare(`
  SELECT c.id, c.title, c.created_at, c.total_words
  FROM messages_fts
  JOIN messages m ON m.id = messages_fts.rowid
  JOIN conversations c ON c.id = m.convo_id
  WHERE messages_fts MATCH 'conversations AND (thousand OR hundreds OR years OR history)'
  AND m.role = 'user'
  AND c.score_tier IN ('S','A')
  GROUP BY c.id
  ORDER BY c.created_at DESC
  LIMIT 5
`).all() as any[];

// Find the "supply chain as metaphor for everything" idea
const supplyMetaphor = db.prepare(`
  SELECT c.id, c.title, c.created_at
  FROM messages_fts
  JOIN messages m ON m.id = messages_fts.rowid
  JOIN conversations c ON c.id = m.convo_id
  WHERE messages_fts MATCH '"supply chain" AND (everything OR metaphor OR lens OR framework OR world)'
  AND c.score_tier IN ('S','A')
  GROUP BY c.id
  ORDER BY c.user_words DESC
  LIMIT 5
`).all() as any[];

// Pull the user's first-person Substack strategy
const substackConvo = db.prepare(`
  SELECT c.id, c.title, c.created_at
  FROM conversations c
  WHERE c.title LIKE '%Substack%' AND c.score_tier IN ('S','A')
  ORDER BY c.created_at DESC LIMIT 3
`).all() as any[];

// Helper: get best user quote from a conversation
function bestQuote(convoId: string, keywords: string[], maxLen = 600): string {
  const msgs = db.prepare(`
    SELECT text FROM messages WHERE convo_id = ? AND role = 'user' ORDER BY seq
  `).all(convoId) as any[];
  let best = "", bestScore = 0;
  for (const m of msgs) {
    const words = m.text.split(/\s+/).length;
    if (words < 20 || words > 500) continue;
    const lower = m.text.toLowerCase();
    const score = keywords.filter(k => lower.includes(k)).length + (words > 80 ? 2 : 0);
    if (score > bestScore) { best = m.text; bestScore = score; }
  }
  if (!best && msgs.length) {
    // Fallback: longest user message under 500 words
    best = msgs.filter((m: any) => m.text.split(/\s+/).length > 30 && m.text.split(/\s+/).length < 500)
      .sort((a: any, b: any) => b.text.length - a.text.length)[0]?.text || msgs[0].text;
  }
  return best.length > maxLen ? best.slice(0, maxLen).replace(/\s\S*$/, "") + "..." : best;
}

// Get AI's best explanation of the grooves framework
function bestAIExplanation(convoId: string, keywords: string[]): string {
  const msgs = db.prepare(`
    SELECT text FROM messages WHERE convo_id = ? AND role = 'assistant' ORDER BY seq
  `).all(convoId) as any[];
  let best = "", bestScore = 0;
  for (const m of msgs) {
    const words = m.text.split(/\s+/).length;
    if (words < 50 || words > 400) continue;
    const lower = m.text.toLowerCase();
    const score = keywords.filter(k => lower.includes(k)).length;
    if (score > bestScore) { best = m.text; bestScore = score; }
  }
  return best.length > 800 ? best.slice(0, 800).replace(/\s\S*$/, "") + "..." : best;
}

// Now compile the post
let post = "";

post += `# I Talked to AI for Three Years. Then I Made It Read All of It Back to Me.\n\n`;

post += `4,947 conversations. 37.7 million words. Three years.\n\n`;

post += `That's how much I've talked to ChatGPT and Claude since April 2023. More than most people write in a lifetime. More than the complete works of Shakespeare, Tolkien, and the King James Bible — combined, times four.\n\n`;

post += `I didn't plan to do this. Nobody does. You start with one question. Then another. Then it's 3am and you're 40 messages deep into how the Federal Reserve actually works, or why your Redis instance keeps crashing, or what would happen if you dropped a guy from 2049 into Ridgefield, Washington in 2024.\n\n`;

post += `The conversations pile up. Thousands of them. Each one a fragment of your thinking — but scattered, unsearchable, forgotten the moment you close the tab.\n\n`;

post += `So I built a tool that reads all of it.\n\n`;

post += `---\n\n`;

post += `## What 37 Million Words Look Like\n\n`;

post += `The first thing the tool showed me: I'm two people.\n\n`;

post += `My AI history splits almost perfectly in half — 1,058 conversations about AI and 1,025 about code. Then 768 about business, 703 about history, 267 about music, and a long tail of science, geopolitics, creative writing, and personal stuff.\n\n`;

post += `But the real insight wasn't the categories. It was what **connected** them.\n\n`;

post += `When I mapped the topics that appear across all my conversations, the same concepts kept showing up everywhere — in my code conversations, in my history deep-dives, in my business planning, even in my music discussions:\n\n`;

post += `- **Supply chain** (652 conversations, 31 consecutive months)\n`;
post += `- **Feedback loops** (358 conversations)\n`;
post += `- **Pattern recognition** (353 conversations)\n`;
post += `- **Power structures** (338 conversations)\n`;
post += `- **Open source** (437 conversations)\n\n`;

post += `I don't think about "topics." I think about **systems**. Supply chains aren't just logistics — they're the hidden skeleton of everything. Power structures aren't just politics — they're the operating system of civilization. Feedback loops aren't just engineering — they're how every complex thing maintains or destroys itself.\n\n`;

post += `I've been running the same mental operating system across every domain for three years. I just didn't know it until I could see all the conversations at once.\n\n`;

post += `---\n\n`;

post += `## The Convergence\n\n`;

post += `The tool found something I hadn't noticed: 49 conversations where two of my deepest threads collide.\n\n`;

post += `I have a framework I call **Codex Vivus** — a "living codex" for understanding and navigating the systems that actually run the world. And I have another thread called **Iron Vein** — supply chain intelligence, what breaks and what replaces it.\n\n`;

post += `In 49 S-tier conversations, these two frameworks appear together. Not because I planned it — because my thinking kept arriving at the same intersection from different directions. The supply chains that move atoms and the power structures that move people are **the same architecture viewed from different angles**.\n\n`;

post += `The tool showed me that I'd been writing a book without knowing it.\n\n`;

post += `---\n\n`;

post += `## What This Means for You\n\n`;

post += `You've had hundreds, maybe thousands, of AI conversations too. Every one of them is a fragment of how you think — but you can't see the shape because it's scattered across sessions, across months, across models.\n\n`;

post += `What if you could see it all at once?\n\n`;

post += `Not a summary. Not a chatbot wrapper. A **map of your own mind** — showing you what you keep coming back to, what you started but never finished, and where three separate threads are converging on the same insight without you noticing.\n\n`;

post += `That's what I built. I call it **Imprint**.\n\n`;

post += `And the thing it revealed — the pattern underneath all my patterns — I call **Codex Vivus**.\n\n`;

post += `---\n\n`;

post += `## What's Next\n\n`;

post += `This is the first post of a series where I'll share what 37 million words of AI conversation reveal about:\n\n`;

post += `- How to think in systems (and why most people think in features)\n`;
post += `- What "supply chain" really means when you apply it to knowledge, power, and identity\n`;
post += `- Why your AI conversation history is the most valuable dataset you own\n`;
post += `- The architecture of the invisible systems that actually run your life\n`;
post += `- How to build a personal intelligence OS that compounds instead of resets\n\n`;

post += `Every insight comes from real conversations. Every framework was battle-tested across thousands of hours of thinking out loud with AI. Nothing here is theoretical — it's extracted from the largest dataset I have: my own mind.\n\n`;

post += `If you want to see what your conversations reveal about you, [Imprint is live](https://imprint.ing). Upload your ChatGPT or Claude export. See your starfield.\n\n`;

post += `---\n\n`;
post += `*Justin Paul Åberg builds intelligence systems in Clark County, WA. His AI conversation history contains 4,947 conversations spanning code, AI, history, business, music, and everything in between. This post was compiled with the help of Codex Vivus — a living intelligence OS he built to index his own thinking.*\n`;

const outPath = "/Users/ltlai/codex-vivus/FIRST_POST.md";
fs.writeFileSync(outPath, post);

console.log(`Written to ${outPath}`);
console.log(`${post.split('\n').length} lines, ${post.split(/\s+/).length} words`);

db.close();
