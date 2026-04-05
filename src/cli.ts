#!/usr/bin/env node
// Codex Vivus CLI

import { ingest } from "./ingest/index.js";
import { search, topConversations, relatedConversations, topTopics, stats, contextBrief } from "./engine/query.js";

const [,, cmd, ...args] = process.argv;

function usage() {
  console.log(`
  codex-vivus — a living intelligence OS

  COMMANDS

    ingest <file>           Index a conversation export (.json or .jsonl)
    stats                   Show graph statistics
    search <query>          Full-text search across all conversations
    top [tier] [category]   Show highest-scoring conversations
    related <convo-id>      Find conversations related to a given one
    topics                  Show top topics in the graph
    brief <query>           Generate a context brief for a topic

  EXAMPLES

    codex-vivus ingest ~/conversations.json
    codex-vivus search "supply chain"
    codex-vivus top S Code
    codex-vivus brief "machine learning"
    codex-vivus topics
`);
}

function formatResult(r: any, i?: number) {
  const prefix = i !== undefined ? `  ${String(i + 1).padStart(3)}.  ` : "  ";
  return `${prefix}${r.tier || "?"}  ${(r.category || "").padEnd(12)} ${r.date || "?"}  ${String(r.words || 0).padStart(7)}w  ${(r.title || "").slice(0, 60)}${r.snippet ? "\n       " + r.snippet.slice(0, 120) : ""}`;
}

switch (cmd) {
  case "ingest": {
    if (!args[0]) { console.error("Usage: codex-vivus ingest <file>"); process.exit(1); }
    const t0 = Date.now();
    const result = ingest(args[0]);
    console.log(`\nIngested ${result.new} new conversations (${result.skipped} already existed, ${result.total} total)`);
    console.log(`Time: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    break;
  }
  case "stats": {
    const s = stats();
    console.log(`\n  Conversations: ${s.conversations.toLocaleString()}`);
    console.log(`  Total words:   ${(s.totalWords / 1e6).toFixed(1)}M`);
    console.log(`  Date range:    ${s.earliest} to ${s.latest}`);
    console.log(`\n  Tiers:  ${Object.entries(s.tiers).map(([t, n]) => `${t}=${n}`).join("  ")}`);
    console.log(`  Categories:  ${Object.entries(s.categories).map(([c, n]) => `${c}(${n})`).join("  ")}`);
    break;
  }
  case "search": {
    if (!args[0]) { console.error("Usage: codex-vivus search <query>"); process.exit(1); }
    const results = search(args.join(" "));
    if (!results.length) { console.log("No results."); break; }
    console.log(`\n  ${results.length} results for "${args.join(" ")}":\n`);
    results.forEach((r, i) => console.log(formatResult(r, i)));
    break;
  }
  case "top": {
    const tier = args[0] || undefined;
    const cat = args[1] || undefined;
    const results = topConversations(tier, cat);
    console.log(`\n  Top conversations${tier ? ` (tier ${tier})` : ""}${cat ? ` in ${cat}` : ""}:\n`);
    results.forEach((r, i) => console.log(formatResult(r, i)));
    break;
  }
  case "related": {
    if (!args[0]) { console.error("Usage: codex-vivus related <convo-id>"); process.exit(1); }
    const results = relatedConversations(args[0]);
    console.log(`\n  Related conversations:\n`);
    results.forEach((r, i) => console.log(formatResult(r, i)));
    break;
  }
  case "topics": {
    const topics = topTopics(40);
    console.log(`\n  Top topics:\n`);
    const max = topics[0]?.docFreq || 1;
    for (const t of topics) {
      const bar = "▓".repeat(Math.round(t.docFreq / max * 30));
      console.log(`  ${t.term.padEnd(28)} ${String(t.docFreq).padStart(5)} convos  ${bar}`);
    }
    break;
  }
  case "brief": {
    if (!args[0]) { console.error("Usage: codex-vivus brief <query>"); process.exit(1); }
    const b = contextBrief(args.join(" "));
    console.log(`\n  CONTEXT BRIEF: "${b.query}"\n`);
    console.log(`  Related conversations (${b.relatedConversations.length}):`);
    b.relatedConversations.forEach((r, i) => console.log(formatResult(r, i)));
    console.log(`\n  Active topics:`);
    for (const t of b.relevantTopics) {
      console.log(`    ${t.term.padEnd(28)} ${t.docFreq} convos`);
    }
    break;
  }
  default:
    usage();
}
