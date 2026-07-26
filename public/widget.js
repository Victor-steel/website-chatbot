(() => {
  if (window.__SITE_CHATBOT_LOADED__) return;
  window.__SITE_CHATBOT_LOADED__ = true;

  const script =
    document.currentScript ||
    document.querySelector('script[src*="widget.js"]');
  if (!script || !script.src) return;
  const origin = new URL(script.src, window.location.href).origin;
  const botName = script.dataset.botName || "Site Assistant";
  const accent = script.dataset.accent || "#c4a35a";
  const position = script.dataset.position === "left" ? "left" : "right";

  const css = `
@import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Syne:wght@600;700&display=swap");
#scb-root{
  position:fixed !important; z-index:2147483000 !important; ${position}:20px !important; bottom:20px !important;
  width:56px !important; height:56px !important; margin:0 !important; padding:0 !important;
  font-family:"DM Sans",system-ui,sans-serif !important; pointer-events:auto !important;
}
#scb-root *, #scb-root *::before, #scb-root *::after{box-sizing:border-box !important;}
#scb-launcher{
  width:56px !important; height:56px !important; border:0 !important; border-radius:999px !important; cursor:pointer !important;
  background:${accent} !important; background-image:none !important;
  color:#14110c !important; box-shadow:0 10px 30px rgba(0,0,0,.45) !important;
  display:grid !important; place-items:center !important; position:relative !important; overflow:hidden !important;
  appearance:none !important; -webkit-appearance:none !important; margin:0 !important; padding:0 !important;
  transition:transform .2s ease, box-shadow .2s ease !important;
}
#scb-launcher::before{
  content:"" !important; position:absolute !important; inset:0 !important; border-radius:inherit !important;
  box-shadow:inset 0 0 0 2px rgba(20,17,12,.25) !important; opacity:1 !important;
  pointer-events:none !important;
}
#scb-launcher:hover{transform:translateY(-2px) !important; box-shadow:0 14px 34px rgba(0,0,0,.5) !important;}
#scb-launcher svg{width:24px !important; height:24px !important; fill:currentColor !important; display:block !important;}
#scb-panel{
  position:absolute;${position}:0;bottom:72px;width:min(360px,calc(100vw - 32px));
  height:520px;max-height:calc(100vh - 110px);display:none;flex-direction:column;
  background:#12151a;color:#ebe6dc;border-radius:18px;overflow:hidden;
  box-shadow:0 24px 60px rgba(0,0,0,.45);
  border:1px solid #2a3038;
  transform-origin:bottom ${position};
  animation:scb-in .22s ease;
}
#scb-panel.open{display:flex}
@keyframes scb-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){#scb-panel{animation:none}#scb-launcher{transition:none}}
#scb-head{
  padding:16px 16px 14px;background:linear-gradient(180deg,#1a1f27,#14181f);
  border-bottom:1px solid #2a3038;display:flex;align-items:center;justify-content:space-between;gap:12px;
}
#scb-head h2{margin:0;font:700 15px/1.2 Syne,sans-serif;letter-spacing:.02em}
#scb-head p{margin:4px 0 0;font-size:12px;color:#9aa1ab}
#scb-close{background:transparent;border:0;color:#9aa1ab;cursor:pointer;font-size:18px;line-height:1;padding:4px}
#scb-msgs{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
.scb-msg{max-width:88%;padding:10px 12px;border-radius:12px;font-size:14px;line-height:1.45;white-space:pre-wrap}
.scb-msg.bot{align-self:flex-start;background:#1b2129;border:1px solid #2a3038}
.scb-msg.user{align-self:flex-end;background:${accent};color:#14110c;font-weight:500}
.scb-msg.err{align-self:flex-start;background:#2a1717;border:1px solid #5a2a2a;color:#f0c2c2}
#scb-form{display:flex;gap:8px;padding:12px;border-top:1px solid #2a3038;background:#10141a}
#scb-input{
  flex:1;border:1px solid #2a3038;background:#0c0f14;color:#ebe6dc;border-radius:12px;
  padding:11px 12px;font:400 14px/1.3 "DM Sans",sans-serif;outline:none;
}
#scb-input:focus{border-color:${accent}}
#scb-send{
  border:0;border-radius:12px;padding:0 14px;background:${accent};color:#14110c;
  font:600 13px/1 "DM Sans",sans-serif;cursor:pointer;
}
#scb-send:disabled{opacity:.55;cursor:wait}
`;

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.id = "scb-root";
  root.innerHTML = `
    <button id="scb-launcher" aria-label="Open chat" type="button">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H9l-4 4v-4.2A2.5 2.5 0 0 1 4 13.5z"/></svg>
    </button>
    <section id="scb-panel" role="dialog" aria-label="${botName} chat">
      <header id="scb-head">
        <div>
          <h2 id="scb-title">${botName}</h2>
          <p id="scb-sub">Usually replies in a few seconds</p>
        </div>
        <button id="scb-close" type="button" aria-label="Close chat">×</button>
      </header>
      <div id="scb-msgs"></div>
      <form id="scb-form">
        <input id="scb-input" type="text" placeholder="Ask a question…" autocomplete="off" />
        <button id="scb-send" type="submit">Send</button>
      </form>
    </section>
  `;
  document.body.appendChild(root);

  const panel = root.querySelector("#scb-panel");
  const launcher = root.querySelector("#scb-launcher");
  const closer = root.querySelector("#scb-close");
  const msgs = root.querySelector("#scb-msgs");
  const form = root.querySelector("#scb-form");
  const input = root.querySelector("#scb-input");
  const send = root.querySelector("#scb-send");
  const title = root.querySelector("#scb-title");

  /** @type {{role:string, content:string}[]} */
  const history = [];

  function addMessage(role, content, cls) {
    const el = document.createElement("div");
    el.className = `scb-msg ${cls || (role === "user" ? "user" : "bot")}`;
    el.textContent = content;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  async function loadConfig() {
    try {
      const res = await fetch(`${origin}/api/config`);
      const data = await res.json();
      if (data.botName) title.textContent = data.botName;
      if (data.greeting) {
        addMessage("assistant", data.greeting);
        history.push({ role: "assistant", content: data.greeting });
      }
    } catch {
      addMessage("assistant", `Hi — I'm ${botName}. How can I help?`);
    }
  }

  function setOpen(open) {
    panel.classList.toggle("open", open);
    if (open) input.focus();
  }

  launcher.addEventListener("click", () => setOpen(!panel.classList.contains("open")));
  closer.addEventListener("click", () => setOpen(false));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    addMessage("user", text);
    history.push({ role: "user", content: text });
    send.disabled = true;
    try {
      const res = await fetch(`${origin}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      addMessage("assistant", data.reply);
      history.push({ role: "assistant", content: data.reply });
    } catch (err) {
      addMessage("assistant", err.message || "Could not reach the assistant.", "err");
    } finally {
      send.disabled = false;
      input.focus();
    }
  });

  loadConfig();
})();
