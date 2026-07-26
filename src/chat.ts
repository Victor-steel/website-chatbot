export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatConfig = {
  apiKey?: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  botName: string;
};

export function loadChatConfig(): ChatConfig {
  return {
    apiKey: process.env.OPENAI_API_KEY?.trim() || undefined,
    baseUrl: (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, ""),
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    systemPrompt:
      process.env.SYSTEM_PROMPT ??
      "You are a helpful website assistant for a small business. Be concise, friendly, and practical.",
    botName: process.env.BOT_NAME ?? "Site Assistant",
  };
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

export async function generateReply(
  messages: ChatMessage[],
  config: ChatConfig,
): Promise<{ reply: string; provider: "openai" | "mock" }> {
  const cleaned = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: String(m.content ?? "").slice(0, 4000) }))
    .slice(-12);

  if (!config.apiKey) {
    return { reply: mockReply(cleaned, config.botName), provider: "mock" };
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "system", content: config.systemPrompt }, ...cleaned],
      temperature: 0.6,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`model_error:${response.status}:${text.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error("empty_model_reply");
  return { reply, provider: "openai" };
}
