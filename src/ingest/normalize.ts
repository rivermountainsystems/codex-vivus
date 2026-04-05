// Provider-agnostic conversation normalizer
// Replicates imprint/web/src/lib/providers.ts logic for Node.js

export type NormalizedMessage = {
  role: "user" | "assistant";
  text: string;
};

export type NormalizedConversation = {
  id: string;
  provider: "chatgpt" | "claude" | "gemini" | "unknown";
  title: string;
  createTime: number;
  messages: NormalizedMessage[];
};

function hashId(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function genId(provider: string, title: string, createTime: number): string {
  return hashId(`${provider}::${title}::${createTime}`);
}

// ChatGPT tree-walk
function extractChatGPTMessages(
  mapping: Record<string, any>
): NormalizedMessage[] {
  let root: string | null = null;
  for (const [nid, node] of Object.entries(mapping)) {
    if (!node.parent) { root = nid; break; }
  }
  if (!root) return [];
  const messages: NormalizedMessage[] = [];
  const stack = [root];
  while (stack.length) {
    const nid = stack.shift()!;
    const node = mapping[nid];
    if (!node) continue;
    const msg = node.message;
    if (msg) {
      const role = msg.author?.role || "";
      const parts: any[] = msg.content?.parts || [];
      const text = parts.filter((p: any) => typeof p === "string" && p.trim()).join("\n");
      const hidden = msg.metadata?.is_visually_hidden_from_conversation;
      if (text && (role === "user" || role === "assistant") && !hidden) {
        messages.push({ role: role as "user" | "assistant", text });
      }
    }
    const children: string[] = node.children || [];
    children.forEach((c: string, i: number) => stack.splice(i, 0, c));
  }
  return messages;
}

function normalizeChatGPT(convos: any[]): NormalizedConversation[] {
  const results: NormalizedConversation[] = [];
  for (const c of convos) {
    const title = c.title || "(untitled)";
    const createTime = c.create_time || 0;
    const messages = extractChatGPTMessages(c.mapping || {});
    if (!messages.length) continue;
    results.push({
      id: genId("chatgpt", title, createTime),
      provider: "chatgpt",
      title,
      createTime,
      messages,
    });
  }
  return results;
}

function normalizeClaudeConvo(obj: any): NormalizedConversation | null {
  const title = obj.name || obj.title || "(untitled)";
  const createTime = obj.created_at
    ? Math.floor(new Date(obj.created_at).getTime() / 1000)
    : obj.create_time || 0;
  const rawMessages: any[] = obj.chat_messages || [];
  const messages: NormalizedMessage[] = [];
  for (const msg of rawMessages) {
    const role = msg.sender === "human" ? "user" : msg.sender === "assistant" ? "assistant" : null;
    if (!role) continue;
    let text = "";
    if (typeof msg.text === "string") text = msg.text;
    else if (Array.isArray(msg.content)) {
      text = msg.content.filter((b: any) => b.type === "text" && typeof b.text === "string").map((b: any) => b.text).join("\n");
    }
    if (text.trim()) messages.push({ role, text });
  }
  if (!messages.length) return null;
  return { id: genId("claude", title, createTime), provider: "claude", title, createTime, messages };
}

function detectProvider(data: unknown): "chatgpt" | "claude" | "unknown" {
  if (Array.isArray(data) && data.length > 0) {
    if (data[0]?.mapping) return "chatgpt";
    if (data[0]?.chat_messages) return "claude";
  }
  if (data && typeof data === "object") {
    if ("mapping" in data) return "chatgpt";
    if ("chat_messages" in data) return "claude";
  }
  return "unknown";
}

export function normalizeFile(rawText: string, filename: string): NormalizedConversation[] {
  if (filename.endsWith(".jsonl")) {
    const lines = rawText.split("\n").filter(l => l.trim()).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    if (!lines.length) return [];
    if (lines[0]?.chat_messages) return lines.map(normalizeClaudeConvo).filter(Boolean) as NormalizedConversation[];
    if (lines[0]?.mapping) return normalizeChatGPT(lines);
    return [];
  }
  const parsed = JSON.parse(rawText);
  const data = Array.isArray(parsed) ? parsed : [parsed];
  const provider = detectProvider(data);
  if (provider === "chatgpt") return normalizeChatGPT(data);
  if (provider === "claude") return data.map(normalizeClaudeConvo).filter(Boolean) as NormalizedConversation[];
  if (data[0]?.mapping) return normalizeChatGPT(data);
  if (data[0]?.chat_messages) return data.map(normalizeClaudeConvo).filter(Boolean) as NormalizedConversation[];
  return [];
}

// Stream-parse a large JSON array file (>500MB) without loading it all into a single string
export function* streamParseConversations(
  buffer: Buffer,
  provider: "chatgpt" | "claude" = "chatgpt"
): Generator<NormalizedConversation> {
  let depth = 0, inStr = false, esc = false, objStart = -1;
  for (let i = 0; i < buffer.length; i++) {
    const b = buffer[i];
    if (esc) { esc = false; continue; }
    if (b === 0x5C && inStr) { esc = true; continue; }
    if (b === 0x22) { inStr = !inStr; continue; }
    if (inStr) continue;
    if (b === 0x7B) { if (depth === 1) objStart = i; depth++; }
    else if (b === 0x7D) {
      depth--;
      if (depth === 1 && objStart >= 0) {
        try {
          const obj = JSON.parse(buffer.slice(objStart, i + 1).toString("utf-8"));
          if (provider === "chatgpt") {
            const msgs = extractChatGPTMessages(obj.mapping || {});
            if (msgs.length > 0) {
              const title = obj.title || "(untitled)";
              const createTime = obj.create_time || 0;
              yield { id: genId("chatgpt", title, createTime), provider: "chatgpt", title, createTime, messages: msgs };
            }
          } else if (provider === "claude") {
            const c = normalizeClaudeConvo(obj);
            if (c) yield c;
          }
        } catch {}
        objStart = -1;
      }
    } else if (b === 0x5B && depth === 0) { depth = 1; }
  }
}
