export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ProviderKind = "omniroute" | "openai" | "mock";

type ChatConfig = {
  apiKey?: string;
  baseUrl: string;
  model: string;
  fallbacks: string[];
  systemPrompt: string;
  botName: string;
  provider: ProviderKind;
};

const DEFAULT_OPENAI = "https://api.openai.com/v1";

/** Built-in OmniRoute free-first routing chain */
const OMNIROUTE_FREE_FALLBACKS = [
  "auto/best-free",
  "auto/coding:free",
  "auto/cheap",
  "auto/fast",
  "auto/chat",
  "auto/smart",
  "auto/best-chat",
  "auto/best-fast",
];

let freeModelCache: { at: number; models: string[] } | null = null;

function detectProvider(baseUrl: string): Exclude<ProviderKind, "mock"> {
  const host = baseUrl.toLowerCase();
  if (host.includes("omniroute") || host.includes(":20128")) return "omniroute";
  return "openai";
}

function parseList(value?: string): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function unique(models: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of models) {
    const key = m.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function looksFree(modelId: string): boolean {
  const id = modelId.toLowerCase();
  return (
    id.includes("free") ||
    id.startsWith("pol/") ||
    id.includes("pollination") ||
    id.includes("longcat") ||
    id.includes("kiro") ||
    id.includes("qoder") ||
    id.includes("cerebras") ||
    id.includes("nvidia") ||
    id.includes("cloudflare")
  );
}

export function loadChatConfig(): ChatConfig {
  const baseUrl = (
    process.env.LLM_BASE_URL ??
    process.env.OPENAI_BASE_URL ??
    DEFAULT_OPENAI
  ).replace(/\/$/, "");

  const apiKey =
    process.env.LLM_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.OMNIROUTE_API_KEY?.trim() ||
    undefined;

  const kind = detectProvider(baseUrl);
  const isCustomGateway = baseUrl !== DEFAULT_OPENAI;
  const canCallRemote = Boolean(apiKey) || isCustomGateway;

  let model =
    process.env.LLM_MODEL ??
    process.env.OPENAI_MODEL ??
    (kind === "omniroute" || isCustomGateway ? "auto/best-free" : "gpt-4o-mini");

  // Plain "auto" on OmniRoute should prefer free routing
  if ((kind === "omniroute" || isCustomGateway) && model === "auto") {
    model = "auto/best-free";
  }

  const envFallbacks = parseList(process.env.LLM_FALLBACKS);
  const fallbacks =
    envFallbacks.length > 0
      ? envFallbacks
      : kind === "omniroute" || isCustomGateway
        ? OMNIROUTE_FREE_FALLBACKS
        : [];

  return {
    apiKey,
    baseUrl,
    model,
    fallbacks,
    systemPrompt:
      process.env.SYSTEM_PROMPT ??
      "You are a helpful website assistant for a small business. Be concise, friendly, and practical.",
    botName: process.env.BOT_NAME ?? "Site Assistant",
    provider: canCallRemote ? kind : "mock",
  };
}

async function discoverFreeModels(config: ChatConfig): Promise<string[]> {
  if (config.provider !== "omniroute") return [];
  const now = Date.now();
  if (freeModelCache && now - freeModelCache.at < 5 * 60_000) {
    return freeModelCache.models;
  }

  try {
    const headers: Record<string, string> = {};
    if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
    const res = await fetch(`${config.baseUrl}/models`, { headers });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    const models = (data.data ?? [])
      .map((m) => m.id ?? "")
      .filter((id) => id && looksFree(id));
    freeModelCache = { at: now, models };
    return models;
  } catch {
    return [];
  }
}

async function buildModelChain(config: ChatConfig): Promise<string[]> {
  const discovered = await discoverFreeModels(config);
  return unique([config.model, ...config.fallbacks, ...discovered]);
}

function mockReply(messages: ChatMessage[], botName: string): string {
  const last = [...messages].reverse().find((m) => m.role === "user")?.content?.trim() ?? "";
  if (!last) {
    return `Hi — I'm ${botName}. Ask me about services, pricing, or next steps.`;
  }
  if (/price|cost|quote|fee/i.test(last)) {
    return "Pricing depends on scope. Share what you need built or automated and we can outline a clear quote.";
  }
  if (/hello|hi|hey/i.test(last)) {
    return `Hello — I'm ${botName}. How can I help today?`;
  }
  if (/contact|email|phone|call/i.test(last)) {
    return "You can leave your details on the contact form, or tell me what you need and I'll note it for the team.";
  }
  return `Got it. Here's a short take on that: ${last.slice(0, 180)}${last.length > 180 ? "…" : ""} — want me to turn this into next steps or a contact handoff?`;
}

async function callModel(
  config: ChatConfig,
  model: string,
  messages: ChatMessage[],
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: config.systemPrompt }, ...messages],
      temperature: 0.6,
      max_tokens: 500,
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`model_error:${model}:${response.status}:${text.slice(0, 200)}`);
  }

  const raw = await response.text();
  const reply = extractReply(raw);
  if (!reply) throw new Error(`empty_model_reply:${model}`);
  return reply;
}

export async function generateReply(
  messages: ChatMessage[],
  config: ChatConfig,
): Promise<{ reply: string; provider: ProviderKind; model: string; attempted: string[] }> {
  const cleaned = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: String(m.content ?? "").slice(0, 4000) }))
    .slice(-12);

  if (config.provider === "mock") {
    return {
      reply: mockReply(cleaned, config.botName),
      provider: "mock",
      model: "mock",
      attempted: ["mock"],
    };
  }

  const chain = await buildModelChain(config);
  const attempted: string[] = [];
  const errors: string[] = [];

  for (const model of chain) {
    attempted.push(model);
    try {
      const reply = await callModel(config, model, cleaned);
      return { reply, provider: config.provider, model, attempted };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(
    `all_models_failed:${attempted.length}:` + errors.slice(0, 3).join(" | "),
  );
}

function extractReply(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  try {
    const data = JSON.parse(trimmed) as {
      choices?: Array<{ message?: { content?: string }; delta?: { content?: string } }>;
    };
    const direct = data.choices?.[0]?.message?.content?.trim();
    if (direct) return direct;
  } catch {
    // SSE below
  }

  let out = "";
  for (const line of trimmed.split("\n")) {
    const payload = line.startsWith("data:") ? line.slice(5).trim() : "";
    if (!payload || payload === "[DONE]") continue;
    try {
      const chunk = JSON.parse(payload) as {
        choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
      };
      const piece =
        chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content ?? "";
      if (piece) out += piece;
    } catch {
      // ignore
    }
  }
  return out.trim() || undefined;
}
