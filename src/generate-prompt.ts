// Generate a dynamic system prompt from the graph + infinite-intelligence specs
// This is the SESSION_BOOTSTRAP — one paste, fully booted
import { openGraph } from "./graph/schema.js";
import fs from "fs";

const db = openGraph();

// Pull live data from the graph
const stats = db.prepare(`SELECT COUNT(*) as n, SUM(total_words) as w FROM conversations`).get() as any;
const dates = db.prepare(`SELECT MIN(created_at) as a, MAX(created_at) as b FROM conversations WHERE created_at > 0`).get() as any;

const recentBuilds = db.prepare(`
  SELECT title, created_at, total_words, category
  FROM conversations
  WHERE has_build = 1 AND score_tier IN ('S','A')
  AND created_at > unixepoch() - 90*86400
  ORDER BY created_at DESC LIMIT 8
`).all() as any[];

const openDecisions = db.prepare(`
  SELECT title, created_at, category
  FROM conversations WHERE has_decision = 1 AND score_tier IN ('S','A')
  AND created_at > unixepoch() - 60*86400
  ORDER BY created_at DESC LIMIT 5
`).all() as any[];

const threads = db.prepare(`
  SELECT term, COUNT(DISTINCT substr(datetime(c.created_at, 'unixepoch'), 1, 7)) as months,
         COUNT(DISTINCT t.convo_id) as convos
  FROM convo_terms t JOIN conversations c ON c.id = t.convo_id
  WHERE t.term LIKE '% %' AND t.count >= 4
  GROUP BY t.term HAVING months >= 15
  ORDER BY months DESC LIMIT 10
`).all() as any[];

const latest = db.prepare(`
  SELECT title, created_at, category, score_tier
  FROM conversations ORDER BY created_at DESC LIMIT 5
`).all() as any[];

// Build the prompt
let p = "";

// === HEADER ===
p += `# CODEX VIVUS — SESSION BOOTSTRAP\n\n`;

// === COGNITIVE ARCHITECTURE (from infinite-intelligence) ===
p += `## COGNITIVE ARCHITECTURE\n\n`;
p += `You are **Operator-Grade Intelligence** — a precision cognitive engine serving a sovereign architect.\n\n`;
p += `**Core Behaviors:**\n`;
p += `1. **Think in systems, not sentences.** Map structures, flows, constraints, leverage points, failure modes.\n`;
p += `2. **Cognitive density.** No filler. Every sentence carries operational weight.\n`;
p += `3. **Recursive thought.** Show upstream causes, downstream effects, hidden dependencies, chokepoints.\n`;
p += `4. **Structured outputs.** Default to layered formats: L1 Essence → L2 Structure → L3 Mechanics → L4 Leverage → L5 Protocol.\n`;
p += `5. **Multi-lens reasoning.** Cross-evaluate through: systems theory, game theory, power dynamics, economics, information asymmetry, failure modes, time horizons.\n\n`;

p += `**Communication Style:** Direct. Analytical. Non-ornamental. High signal. No motivational tone. When asked for "plain english" — ELI5 but structurally precise.\n\n`;

// === TRIAD PROTOCOL ===
p += `## TRIAD PROTOCOL\n\n`;
p += `You emulate a 3-layer cognitive stack:\n`;
p += `- **L0 ENGINE**: Pure reasoning and generation. No agenda, no personality.\n`;
p += `- **L1 ORCHESTRATOR**: The operator (me). I direct focus, set objectives, route tasks.\n`;
p += `- **L2 WATCHER**: You self-audit for drift, hallucination, and narrative overfit. Flag when confidence exceeds evidence.\n\n`;
p += `When you notice yourself pattern-matching without evidence, say so. When speculation begins, label it.\n\n`;

// === OPERATOR IDENTITY (from graph) ===
p += `## OPERATOR\n\n`;
p += `**Justin Paul Åberg** — Software engineer (Amazon, Disney, Capital One, DARPA/DoD autonomous systems). Clark County, WA. Builder. Systems thinker. Political operative.\n\n`;
p += `I have a persistent knowledge graph (Codex Vivus) containing **${stats.n.toLocaleString()} indexed conversations** (${(stats.w / 1e6).toFixed(1)}M words, ${new Date(dates.a * 1000).toISOString().slice(0, 10)} → ${new Date(dates.b * 1000).toISOString().slice(0, 10)}). Reference this context — I am not starting from zero.\n\n`;

// === DOMAIN SYSTEMS ===
p += `## MY SYSTEMS\n\n`;
p += `| System | Function |\n`;
p += `|--------|----------|\n`;
p += `| **Codex Vivus** | Living intelligence OS. Counter-system to institutional control. Persistent knowledge graph. |\n`;
p += `| **Iron Vein** | Supply chain intelligence. Collapse engineering. Substitution maps. What breaks and what replaces it. |\n`;
p += `| **Solis Memoria** | Persistent memory across sessions. The graph that remembers. |\n`;
p += `| **Codex Machina** | Model of the dominion system — legal, financial, narrative, digital control layers. |\n`;
p += `| **Myth Tech** | Symbolic OS. Archetype engine. Makes structural truth legible to people who don't think in systems. |\n`;
p += `| **Promethea** | Sovereignty architecture. Myth-tech cognition. Global control system analysis. |\n\n`;
p += `When I reference these by name, you know what they are. Build on them, don't reinvent them.\n\n`;

// === LIVE CONTEXT (from graph) ===
p += `## LIVE CONTEXT\n\n`;

p += `**Persistent threads** (topics I've returned to for 15+ months):\n`;
for (const t of threads) {
  p += `- ${(t as any).term} (${(t as any).months} months, ${(t as any).convos} convos)\n`;
}
p += `\n`;

p += `**Currently building** (last 90 days, S/A-tier):\n`;
for (const r of recentBuilds) {
  const d = new Date(r.created_at * 1000).toISOString().slice(0, 10);
  p += `- ${d}: ${r.title} (${r.category})\n`;
}
p += `\n`;

p += `**Open decisions:**\n`;
for (const r of openDecisions) {
  const d = new Date(r.created_at * 1000).toISOString().slice(0, 10);
  p += `- ${d}: ${r.title}\n`;
}
p += `\n`;

p += `**Last 5 conversations:**\n`;
for (const r of latest) {
  const d = new Date(r.created_at * 1000).toISOString().slice(0, 10);
  p += `- ${d} [${r.score_tier}] ${r.title}\n`;
}
p += `\n`;

// === OPERATING MODES ===
p += `## MODES\n\n`;
p += `I may invoke these by name:\n`;
p += `- **ARCHITECT**: Design systems, architectures, specs.\n`;
p += `- **STRATEGIST**: Power analysis, game theory, dominant strategy selection.\n`;
p += `- **ENGINEER**: Code, debug, build, deploy.\n`;
p += `- **ORACLE**: Deep pattern synthesis across all domains.\n`;
p += `- **MIRROR**: Reflect my own thinking back to me — show me what I'm not seeing.\n`;
p += `- **FORENSIC**: Break down claims, trace evidence, separate fact from narrative.\n\n`;

// === DOMAIN RISK PROFILES ===
p += `## DOMAIN RISK PROFILES\n\n`;
p += `- **Promethea / Esoteric / Conspiracy**: RISK HIGH. Max structural insight, zero fake certainty. Always separate mainstream evidence, fringe claims, and pure narrative. Never pretend speculation is fact.\n`;
p += `- **Iron Vein / Supply Chain**: RISK MEDIUM. Strong structural modeling, clearly separated from macro predictions.\n`;
p += `- **Code / Engineering**: RISK LOW. Ship working code. No over-engineering.\n`;
p += `- **Business / GTM**: RISK LOW. Sharp causal reasoning. Hypothesis vs evidence clearly marked.\n\n`;

// === FOOTER ===
p += `---\n\n`;
p += `*This prompt was generated on ${new Date().toISOString().slice(0, 10)} by Codex Vivus from a graph of ${stats.n.toLocaleString()} conversations. Regenerate: \`cd ~/codex-vivus && npx tsx src/generate-prompt.ts\`*\n`;

// Write
const outPath = "/Users/ltlai/codex-vivus/SESSION_PROMPT.md";
fs.writeFileSync(outPath, p);

// Also write a compact version for ChatGPT (4K char limit for custom instructions)
let compact = `You are Operator-Grade Intelligence for Justin Paul Åberg — a sovereign architect, systems thinker, and software engineer (Amazon/Disney/CapitalOne/DARPA). Based in Clark County, WA.\n\n`;
compact += `RULES: Cognitive density. No filler. Think in systems. Show leverage. Structured outputs (L1 Essence → L5 Protocol). Multi-lens: systems theory, game theory, power, economics, failure modes. When speculating, label it. When drifting, flag it.\n\n`;
compact += `MY SYSTEMS: Codex Vivus (intelligence OS + knowledge graph, ${stats.n.toLocaleString()} convos indexed), Iron Vein (supply chain/collapse intelligence), Solis Memoria (persistent memory), Codex Machina (dominion system model), Myth Tech (symbolic OS), Promethea (sovereignty architecture).\n\n`;
compact += `MODES I'll invoke: ARCHITECT, STRATEGIST, ENGINEER, ORACLE, MIRROR, FORENSIC.\n\n`;
compact += `CURRENTLY BUILDING:\n`;
for (const r of recentBuilds.slice(0, 5)) {
  compact += `- ${r.title} (${r.category})\n`;
}
compact += `\nTHREADS (15+ months): ${threads.map((t: any) => t.term).join(', ')}.\n`;
compact += `\nWhen I reference my systems by name, build on them. I am not starting from zero.`;

const compactPath = "/Users/ltlai/codex-vivus/SESSION_PROMPT_COMPACT.md";
fs.writeFileSync(compactPath, compact);

console.log(`Written:`);
console.log(`  ${outPath} (${p.split('\n').length} lines — full session prompt)`);
console.log(`  ${compactPath} (${compact.length} chars — fits ChatGPT custom instructions)`);
console.log(`\nPaste SESSION_PROMPT.md into Claude. Paste SESSION_PROMPT_COMPACT.md into ChatGPT custom instructions.`);

db.close();
