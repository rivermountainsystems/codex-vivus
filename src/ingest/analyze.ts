// Analysis functions: scoring, signals, term extraction, categorization
// Ported from imprint processor.ts + scoring.ts + clustering.ts

import type { NormalizedMessage } from "./normalize.js";

export type ScoreResult = { total: number; tier: "S" | "A" | "B" | "C" | "D"; tags: string[] };
export type Signals = { hasCode: boolean; hasDecision: boolean; hasIdea: boolean; hasPlan: boolean; hasBuild: boolean; userThinking: boolean };

const STOP = new Set([
  ..."i me my myself we our you your he him his she her it its they them their what which who whom this that these those am is are was were be been being have has had do does did a an the and but if or because as until while of at by for with about against between through during before after above below to from up down in out on off over under again further then once here there when where why how all both each few more most other some such no nor not only own same so than too very can will just don should now could would like know think want say said use used also one two three new first last well back even still way take come make made go going get got let need tell ask give find try keep start show help turn play run move set put".split(" "),
  ..."into specific might based including time often information ensure data within provide significant high using development state technology various system different real detailed making focus include systems world many potential social create resources events consider advanced areas understanding involves particularly approach control crucial work look personal role name public access known several complex step comprehensive life changes across major important available current following original standard simply actually basically essentially typically generally rather quite almost enough really especially however instead although since though still already perhaps maybe probably would could should overall common means ability requires involve impact likely related need example note possible understand process maintain ability aspects solutions steps roles practical broader context insights term manage plan activities central value offers performance deep natural language full text platform resource ground options profile gain creation enhanced results aspects larger promote daily according navigate sustainable needed starting along meet powerful regulations compliance thinking options emerging demand substantial operating rich influential logistics size year lead science united government historical area traditional examples clear setting levels forms involved developed explore international cultural past group application laws driven cloud investment networks blockchain looking maintaining learn intelligence programs applications vision number leadership cost contact national place better communities environmental necessary running living needed plans starting virtual serve point narrative".split(" "),
]);

const CAT_PATTERNS: [string, RegExp, string][] = [
  ["Code", /\b(code|python|javascript|typescript|react|api|backend|frontend|firebase|supabase|docker|git|npm|sql|deploy|debug|function|component|server|database)\b/i, "#4ecdc4"],
  ["AI", /\b(ai|gpt|llm|model|prompt|neural|machine learning|deep learning|transformer|agent)\b/i, "#bb77ff"],
  ["Business", /\b(business|startup|revenue|pricing|market|strategy|investor|pitch|saas|monetiz|customer|growth)\b/i, "#f5a623"],
  ["Music", /\b(music|audio|song|beat|mix|master|sound|dsp|frequency|sonic|studio)\b/i, "#ff6b9d"],
  ["History", /\b(history|war|century|ancient|civilization|president|empire|revolution|founding)\b/i, "#c4a35a"],
  ["Creative", /\b(story|write|essay|poem|novel|character|narrative|creative|script|design)\b/i, "#ff8a65"],
  ["Science", /\b(math|equation|physics|quantum|geometry|fractal|algebra|formula|scientific)\b/i, "#64b5f6"],
  ["Personal", /\b(life|career|advice|goal|habit|mindset|motivation|relationship|health)\b/i, "#81c784"],
  ["Geopolitics", /\b(geopolit|foreign policy|sanctions|tariff|trade war|sovereignty|nation|border|diplomacy)\b/i, "#e57373"],
];

const CONTENT_PATTERNS: [RegExp, string][] = [
  [/\b(function|class|import|export|def |const |let |var |async |await)\b/g, "code"],
  [/\b(build|create|implement|design|architect|deploy|launch|ship)\b/g, "building"],
  [/\b(strategy|business|revenue|pricing|monetiz|growth|market)\b/g, "business"],
  [/\b(idea|concept|framework|theory|model|system|approach)\b/g, "conceptual"],
  [/\b(plan|roadmap|milestone|phase|step \d|goal)\b/g, "planning"],
  [/```/g, "code_blocks"],
];

export function categorize(text: string): [string, string] {
  for (const [cat, pat, color] of CAT_PATTERNS) {
    if (pat.test(text)) return [cat, color];
  }
  return ["General", "#555555"];
}

export function extractTerms(text: string): Map<string, number> {
  const cleaned = text.replace(/```[\s\S]*?```/g, " ").replace(/https?:\/\/\S+/g, " ").replace(/[^a-zA-Z\s]/g, " ").toLowerCase();
  const words = cleaned.split(/\s+/).filter(w => w.length > 3 && !STOP.has(w));
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
  for (let i = 0; i < words.length - 1; i++) {
    const bg = words[i] + " " + words[i + 1];
    counts.set(bg, (counts.get(bg) || 0) + 2);
  }
  return counts;
}

export function extractEntities(text: string): Map<string, number> {
  const SKIP = new Set(["Google","Apple","Amazon","Microsoft","Facebook","Twitter","Reddit","YouTube","Netflix","ChatGPT","Claude","Gemini","Anthropic","OpenAI","GPT","React","Python","Docker","Linux","The","This","That","Here","What"]);
  const singles = text.match(/\b[A-Z][a-z]{2,}\b/g) || [];
  const counts = new Map<string, number>();
  for (const n of singles) {
    if (!SKIP.has(n)) counts.set(n, (counts.get(n) || 0) + 1);
  }
  return counts;
}

export function score(msgs: NormalizedMessage[]): ScoreResult {
  if (!msgs.length) return { total: -20, tier: "D", tags: [] };
  const tw = msgs.reduce((s, m) => s + m.text.split(/\s+/).length, 0);
  const uw = msgs.filter(m => m.role === "user").reduce((s, m) => s + m.text.split(/\s+/).length, 0);
  const allText = msgs.map(m => m.text).join(" ").toLowerCase();
  const d = Math.min(30, Math.log2(Math.max(tw, 1)) * 3);
  const e = tw > 200 ? Math.min(15, (uw / Math.max(tw, 1)) * 30) : 0;
  const t = Math.min(15, msgs.length * 0.5);
  let content = 0; const tags: string[] = [];
  for (const [pat, tag] of CONTENT_PATTERNS) {
    const m = (allText.match(pat) || []).length;
    if (m >= 2) { content += Math.min(3, m * 0.5); tags.push(tag); }
  }
  content = Math.min(20, content);
  const o = Math.min(10, (uw / Math.max(msgs.filter(m => m.role === "user").length, 1)) / 10);
  const p = tw < 100 ? -20 : tw < 300 ? -5 : 0;
  const total = Math.round((d + e + t + content + o + p) * 10) / 10;
  const tier = total >= 55 ? "S" : total >= 40 ? "A" : total >= 25 ? "B" : total >= 15 ? "C" : "D";
  return { total, tier, tags };
}

export function detectSignals(msgs: NormalizedMessage[]): Signals {
  const userText = msgs.filter(m => m.role === "user").map(m => m.text).join(" ");
  const allText = msgs.map(m => m.text).join(" ");
  const uw = userText.split(/\s+/).length;
  return {
    hasCode: /```/.test(allText),
    hasDecision: /\b(should i|decided|going with|chose|vs\.?|versus|option|alternative|trade.?off)\b/i.test(userText),
    hasIdea: /\b(what if|idea|concept|framework|theory|hypothesis|imagine|envision|propose|my thought)\b/i.test(userText),
    hasPlan: /\b(plan|roadmap|milestone|phase|step \d|timeline|launch|ship|deploy|release)\b/i.test(allText),
    hasBuild: /\b(build|create|implement|develop|code|app|website|platform|tool|product|feature|startup|company|business)\b/i.test(allText),
    userThinking: uw > 500,
  };
}

export function preview(msgs: NormalizedMessage[]): string {
  for (const m of msgs) {
    if (m.role === "user" && m.text.split(/\s+/).length > 5) {
      const flat = m.text.trim().replace(/\n/g, " ").replace(/\s+/g, " ");
      const match = flat.match(/^(.+?[.!?])\s/);
      return match && match[1].length < 150 ? match[1] : flat.slice(0, 150);
    }
  }
  return "";
}
