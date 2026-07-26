import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateReply, loadChatConfig, type ChatMessage } from "./chat.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const config = loadChatConfig();

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "*")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return "*";
      if (allowedOrigins.includes("*")) return origin;
      return allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? "*";
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "website-chatbot",
    provider: config.provider,
    model: config.model,
    botName: config.botName,
  }),
);

app.get("/api/config", (c) =>
  c.json({
    botName: config.botName,
    greeting:
      process.env.GREETING ??
      `Hi — I'm ${config.botName}. Ask anything about our services.`,
    provider: config.provider,
    model: config.model,
  }),
);

app.post("/api/chat", async (c) => {
  const body = await c.req.json().catch(() => null);
  const messages = Array.isArray(body?.messages) ? (body.messages as ChatMessage[]) : [];
  if (!messages.length) {
    return c.json({ error: "messages_required" }, 400);
  }

  try {
    const result = await generateReply(messages, config);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "chat_failed";
    return c.json({ error: message }, 502);
  }
});

app.get("/widget.js", (c) => {
  const js = readFileSync(join(root, "public/widget.js"), "utf8");
  return c.body(js, 200, {
    "Content-Type": "application/javascript; charset=utf-8",
    "Cache-Control": "public, max-age=60",
  });
});

app.use("/assets/*", serveStatic({ root: "./public" }));

app.get("/", (c) => {
  const html = readFileSync(join(root, "public/index.html"), "utf8");
  return c.html(html);
});

const port = Number(process.env.PORT ?? 8788);
console.log(`Website chatbot listening on http://0.0.0.0:${port}`);
console.log(`Embed: <script src="https://YOUR_HOST/widget.js" defer></script>`);
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" });
