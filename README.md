# Website Chatbot

Embeddable chatbot service for client websites. Deploy on Railway, then paste one script tag into any site.

## Local

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://127.0.0.1:8788/

Without `OPENAI_API_KEY`, replies run in mock mode so you can test the widget.

## Railway

1. Create a new Railway project from this repo.
2. Set env vars from `.env.example` (at least `OPENAI_API_KEY` for live AI).
3. Deploy — Railway uses the Dockerfile and `/health` check.
4. Copy your public URL into the embed snippet.

## Embed

```html
<script
  src="https://YOUR_RAILWAY_HOST/widget.js"
  data-bot-name="Flow Forge"
  data-accent="#c4a35a"
  defer
></script>
```

## API

- `GET /health`
- `GET /api/config`
- `POST /api/chat` — `{ "messages": [{ "role": "user"|"assistant", "content": "..." }] }`
- `GET /widget.js`


## OmniRoute (free models)

OmniRoute is a **self-hosted** gateway ([omniroute.online](https://omniroute.online/)) — not a cloud API by itself. Run it, connect free providers in its dashboard, then point this chatbot at it.

### Railway setup

1. In the **website-chatbot** project, add a service → **Docker Image**
2. Image: `diegosouzapw/omniroute:latest`
3. Generate a public domain for OmniRoute (for dashboard setup)
4. Open the OmniRoute dashboard → connect free providers (Pollinations, Cerebras, NVIDIA, etc.)
5. On the **website-chatbot** service Variables, set:

```
LLM_BASE_URL=http://<omniroute-private-host>:20128/v1
LLM_MODEL=auto
```

Prefer Railway **private networking** URL between services. If unsure, use the OmniRoute public `https://YOUR-OMNIROUTE.up.railway.app/v1`.

6. Remove `OPENAI_API_KEY` if you no longer want OpenAI
7. Redeploy chatbot → `/health` should show `"provider":"omniroute"`
