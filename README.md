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
