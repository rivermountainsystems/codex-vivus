# Codex Vivus

A living intelligence OS that turns your AI conversation history into a persistent, queryable knowledge graph.

## What This Does

You've had thousands of AI conversations. Each one is a fragment of how you think — scattered across sessions, unsearchable, forgotten the moment you close the tab.

Codex Vivus indexes all of it into a single SQLite graph with full-text search, scores every conversation, extracts topics and entities, and surfaces the patterns you can't see from inside any single chat.

Then it writes back: generating session prompts loaded with your real context, so your next AI conversation starts where all previous ones left off.

## Quick Start

```bash
git clone https://github.com/rivermountainsystems/codex-vivus.git
cd codex-vivus
npm install

# Index your ChatGPT or Claude export
npx tsx src/cli.ts ingest ~/conversations.json

# See what you've got
npx tsx src/cli.ts stats
npx tsx src/cli.ts topics
npx tsx src/cli.ts search "any topic"
npx tsx src/cli.ts top S
npx tsx src/cli.ts brief "what you're about to work on"

# Generate a session prompt from your graph
npx tsx src/generate-prompt.ts
# → SESSION_PROMPT.md (paste into any AI)
# → SESSION_PROMPT_COMPACT.md (fits ChatGPT custom instructions)

# Generate operator context for Claude Code
npx tsx src/generate-context.ts
# → ~/CLAUDE.md (auto-loaded by Claude Code)
```

## How to Export Your Conversations

**ChatGPT:** Settings → Data Controls → Export Data → download the zip → extract `conversations.json`

**Claude:** Settings → Account → Export Data → download the zip → extract the `.jsonl` files

## Commands

| Command | What it does |
|---------|-------------|
| `ingest <file>` | Index a conversation export (`.json` or `.jsonl`). Idempotent — safe to re-run. |
| `stats` | Total conversations, word count, date range, tier distribution, categories. |
| `search <query>` | Full-text search across all messages in all conversations. |
| `topics` | Top bigram topics ranked by frequency. |
| `top [tier] [category]` | Highest-scoring conversations. Filter by tier (S/A/B/C/D) and/or category. |
| `related <convo-id>` | Find conversations that share the most terms with a given one. |
| `brief <query>` | Context brief: related conversations + active topics for any subject. |

## Scoring

Every conversation is scored on 6 dimensions and assigned a tier:

| Tier | Score | Meaning |
|------|-------|---------|
| **S** | 55+ | Must-revisit. Deep, effortful, multi-signal. |
| **A** | 40–54 | High value. Substantial thinking or building. |
| **B** | 25–39 | Solid. Useful but not exceptional. |
| **C** | 15–24 | Light. Quick questions, short exchanges. |
| **D** | <15 | Throwaway. One-liners, tests, noise. |

Dimensions: depth (word count), user effort, turn count, content signals (code, building, business, ideas, planning), originality, length penalty.

## What Gets Indexed

- **Messages**: Full text of every user and assistant message, with FTS5 full-text search.
- **Terms**: Bigram and single-word extraction with ChatGPT-filler filtering. TF-IDF weighted.
- **Entities**: Proper nouns that recur across conversations.
- **Signals**: Code, decisions, ideas, plans, builds, deep thinking (500+ user words).
- **Scores**: 6-dimension composite score with tier assignment.

## Architecture

```
~/.codex-vivus/graph.db          ← SQLite + FTS5, all local
src/ingest/normalize.ts          ← Provider-agnostic normalizer (ChatGPT, Claude)
src/ingest/analyze.ts            ← Scoring, signals, term extraction, categorization
src/ingest/index.ts              ← Ingest pipeline: file → normalize → analyze → store
src/graph/schema.ts              ← Database schema (conversations, messages, terms, entities, topics, threads)
src/engine/query.ts              ← Search, related conversations, top topics, context briefs
src/cli.ts                       ← CLI interface
src/generate-prompt.ts           ← Session prompt generator (Triad Protocol + live graph data)
src/generate-context.ts          ← Operator context + CLAUDE.md generator
```

Everything is local. No server. No API keys. Your conversations never leave your machine.

## The Session Prompt

`npx tsx src/generate-prompt.ts` generates a system prompt that includes:

- **Cognitive architecture** from the [Infinite Intelligence](https://github.com/rivermountainsystems/infinite-intelligence) framework
- **Triad Protocol** (Engine / Orchestrator / Watcher)
- **Your identity** and named systems
- **Live context**: persistent threads, active projects, open decisions, recent conversations
- **Operating modes**: Architect, Strategist, Engineer, Oracle, Mirror, Forensic
- **Domain risk profiles**: epistemic safety guardrails per domain

Paste it into any AI session. You never start from zero again.

## Companion Projects

- **[Imprint](https://github.com/rivermountainsystems/imprint)** — Visual starfield of your AI conversations. Upload and explore in the browser.
- **[Infinite Intelligence](https://github.com/rivermountainsystems/infinite-intelligence)** — Prompt architecture and cognitive OS specs. The cognitive layer that Codex Vivus loads.

## License

MIT
