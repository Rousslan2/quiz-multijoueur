(function () {
  'use strict';

  // ── Styles ──────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #chat-fab {
      position:fixed;bottom:20px;right:20px;z-index:9999;
      width:52px;height:52px;border-radius:50%;
      background:linear-gradient(135deg,#a78bfa,#7c3aed);
      border:none;cursor:pointer;box-shadow:0 4px 20px rgba(124,58,237,.5);
      font-size:1.5rem;display:flex;align-items:center;justify-content:center;
      transition:transform .2s,box-shadow .2s;color:#fff;
    }
    #chat-fab:hover{transform:scale(1.1);box-shadow:0 6px 28px rgba(124,58,237,.7)}
    #chat-badge {
      position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;
      border-radius:50%;width:20px;height:20px;font-size:.65rem;font-weight:700;
      display:none;align-items:center;justify-content:center;
    }
    #chat-panel {
      position:fixed;bottom:82px;right:20px;z-index:9998;
      width:320px;max-width:calc(100vw - 32px);
      background:rgba(15,12,41,.97);backdrop-filter:blur(16px);
      border:1.5px solid rgba(167,139,250,.3);border-radius:18px;
      box-shadow:0 12px 48px rgba(0,0,0,.6);
      display:none;flex-direction:column;overflow:hidden;
      font-family:'Segoe UI',system-ui,sans-serif;
    }
    #chat-panel.open{display:flex}
    #chat-header {
      padding:12px 16px;background:linear-gradient(135deg,rgba(124,58,237,.3),rgba(167,139,250,.15));
      border-bottom:1px solid rgba(167,139,250,.2);
      display:flex;align-items:center;justify-content:space-between;
    }
    #chat-header span{color:#e2e8f0;font-weight:700;font-size:.95rem}
    #chat-header small{color:#94a3b8;font-size:.72rem;margin-left:6px}
    #chat-close{background:none;border:none;color:#94a3b8;cursor:pointer;font-size:1.2rem;padding:2px 4px}
    #chat-close:hover{color:#e2e8f0}
    #chat-name-row {
      padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.07);
      display:flex;gap:8px;
    }
    #chat-name-row input {
      flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);
      border-radius:8px;padding:6px 10px;color:#f1f5f9;font-size:.82rem;outline:none;
    }
    #chat-name-row input:focus{border-color:#a78bfa}
    #chat-name-btn {
      background:linear-gradient(135deg,#7c3aed,#a78bfa);border:none;
      border-radius:8px;padding:6px 12px;color:#fff;font-size:.8rem;
      font-weight:600;cursor:pointer;white-space:nowrap;
    }
    #chat-messages {
      flex:1;overflow-y:auto;padding:10px 12px;
      display:flex;flex-direction:column;gap:6px;
      max-height:260px;min-height:160px;
      scrollbar-width:thin;scrollbar-color:rgba(167,139,250,.4) transparent;
    }
    .chat-msg {display:flex;flex-direction:column;gap:2px}
    .chat-msg .meta {font-size:.68rem;color:#a78bfa;font-weight:600}
    .chat-msg .meta .time {color:#64748b;font-weight:400;margin-left:4px}
    .chat-msg .bubble {
      background:rgba(255,255,255,.07);border-radius:10px;padding:6px 10px;
      color:#e2e8f0;font-size:.83rem;line-height:1.4;word-break:break-word;
      border:1px solid rgba(255,255,255,.08);
    }
    .chat-msg.me .meta{color:#f97316;text-align:right}
    .chat-msg.me .bubble{background:rgba(249,115,22,.15);border-color:rgba(249,115,22,.2);text-align:right}
    .chat-msg.system .bubble{
      background:rgba(167,139,250,.1);border-color:rgba(167,139,250,.2);
      color:#94a3b8;font-style:italic;font-size:.78rem;text-align:center;
    }
    #chat-input-row {
      padding:10px 12px;border-top:1px solid rgba(255,255,255,.07);
      display:flex;gap:8px;
    }
    #chat-input {
      flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);
      border-radius:10px;padding:8px 12px;color:#f1f5f9;font-size:.85rem;outline:none;
      resize:none;
    }
    #chat-input:focus{border-color:#a78bfa}
    #chat-send {
      background:linear-gradient(135deg,#7c3aed,#a78bfa);border:none;
      border-radius:10px;padding:8px 14px;color:#fff;font-size:1rem;
      cursor:pointer;transition:transform .15s;
    }
    #chat-send:hover{transform:scale(1.08)}
    #chat-send:active{transform:scale(.95)}
    #chat-offline{
      padding:8px 12px;text-align:center;font-size:.75rem;
      color:#ef4444;background:rgba(239,68,68,.1);
      border-top:1px solid rgba(239,68,68,.2);display:none;
    }
    @media (max-width: 640px){
      #chat-fab{right:12px;bottom:12px;width:48px;height:48px}
      #chat-panel{
        right:10px;left:10px;bottom:68px;
        width:auto;max-width:none;border-radius:14px;
      }
      #chat-messages{max-height:38vh;min-height:130px}
    }
  `;
  document.head.appendChild(style);

  // ── HTML ─────────────────────────────────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <button id="chat-fab" title="Chat">
      <span>&#128172;</span>
      <div id="chat-badge"></div>
    </button>
    <div id="chat-panel">
      <div id="chat-header">
        <div><span id="chat-title">Chat</span><small id="chat-online">&#x25cf; en ligne</small></div>
        <button id="chat-close">&#10005;</button>
      </div>
      <div id="chat-name-row">
        <input id="chat-name-input" maxlength="20" placeholder="Votre pseudo..." />
        <button id="chat-name-btn">OK</button>
      </div>
      <div id="chat-messages"></div>
      <div id="chat-offline">Reconnexion...</div>
      <div id="chat-input-row">
        <textarea id="chat-input" rows="1" placeholder="Message..." maxlength="200" disabled></textarea>
        <button id="chat-send" disabled>&#10148;</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  // ── State ────────────────────────────────────────────────────────────────────
  let ws = null;
  let myName = localStorage.getItem('chat_name') || (window.ZapPlay?ZapPlay.getSavedPseudo():'') || '';
  let unread = 0;
  let isOpen = false;
  let connected = false;

  const fab       = document.getElementById('chat-fab');
  const panel     = document.getElementById('chat-panel');
  const badge     = document.getElementById('chat-badge');
  const closeBtn  = document.getElementById('chat-close');
  const nameInput = document.getElementById('chat-name-input');
  const nameBtn   = document.getElementById('chat-name-btn');
  const messages  = document.getElementById('chat-messages');
  const offline   = document.getElementById('chat-offline');
  const input     = document.getElementById('chat-input');
  const sendBtn   = document.getElementById('chat-send');

  // ── i18n ─────────────────────────────────────────────────────────────────────
  function tt(key, fallback) {
    try {
      if (window.ZapPlay && typeof ZapPlay.t === 'function') return ZapPlay.t(key);
    } catch {}
    return fallback;
  }
  function applyI18n() {
    const title = document.getElementById('chat-title');
    if (title) title.textContent = tt('chat_title', 'Chat');
    const online = document.getElementById('chat-online');
    if (online) online.innerHTML = '&#x25cf; ' + tt('chat_online', 'en ligne');
    const phName = tt('chat_name_ph', 'Votre pseudo...');
    if (nameInput) nameInput.placeholder = phName;
    const phMsg = tt('chat_msg_ph', 'Message...');
    if (input) input.placeholder = phMsg;
    if (offline) offline.textContent = tt('chat_reconnect', 'Reconnexion...');
    if (fab) fab.title = tt('chat_fab_title', 'Chat');
  }
  applyI18n();
  window.addEventListener('zapplay:lang', applyI18n);

  if (myName) {
    nameInput.value = myName;
    document.getElementById('chat-name-row').style.display = 'none';
  }

  // ── WebSocket ────────────────────────────────────────────────────────────────
  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws/chat`);
    ws.onopen = () => {
      connected = true;
      offline.style.display = 'none';
      if (myName) {
        ws.send(JSON.stringify({ type: 'join_chat', name: myName }));
        enableInput(true);
      }
    };
    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      addMessage(d);
      if (!isOpen) {
        unread++;
        badge.textContent = unread > 9 ? '9+' : unread;
        badge.style.display = 'flex';
      }
    };
    ws.onclose = () => {
      connected = false;
      enableInput(false);
      offline.style.display = 'block';
      setTimeout(connect, 3000);
    };
    ws.onerror = () => ws.close();
  }

  function enableInput(on) {
    input.disabled = !on;
    sendBtn.disabled = !on;
  }

  // ── Messages ─────────────────────────────────────────────────────────────────
  function addMessage(d) {
    const isMe = d.name === myName;
    const isSystem = d.type === 'system';
    const div = document.createElement('div');
    div.className = 'chat-msg' + (isSystem ? ' system' : isMe ? ' me' : '');
    const t = d.time ? new Date(d.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';
    if (!isSystem) {
      div.innerHTML = `<div class="meta">${esc(d.name)}<span class="time">${t}</span></div>
                       <div class="bubble">${esc(d.text)}</div>`;
    } else {
      div.innerHTML = `<div class="bubble">${esc(d.text)}</div>`;
    }
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    // Limit history
    while (messages.children.length > 100) messages.removeChild(messages.firstChild);
  }

  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Send ─────────────────────────────────────────────────────────────────────
  function send() {
    const text = input.value.trim();
    if (!text || !connected || !myName) return;
    ws.send(JSON.stringify({ type: 'chat', name: myName, text }));
    input.value = '';
    input.style.height = 'auto';
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });

  // ── Name ─────────────────────────────────────────────────────────────────────
  function saveName() {
    const n = nameInput.value.trim().slice(0, 20);
    if (!n) return;
    myName = n;
    localStorage.setItem('chat_name', n);
    if (window.ZapPlay) ZapPlay.savePseudo(n);
    document.getElementById('chat-name-row').style.display = 'none';
    if (connected) {
      ws.send(JSON.stringify({ type: 'join_chat', name: myName }));
      enableInput(true);
    }
  }
  nameBtn.addEventListener('click', saveName);
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveName(); });

  // ── Toggle panel ─────────────────────────────────────────────────────────────
  fab.addEventListener('click', () => {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    if (isOpen) {
      unread = 0;
      badge.style.display = 'none';
      messages.scrollTop = messages.scrollHeight;
      if (myName) input.focus();
      else nameInput.focus();
    }
  });
  closeBtn.addEventListener('click', () => {
    isOpen = false;
    panel.classList.remove('open');
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen) {
      isOpen = false;
      panel.classList.remove('open');
    }
  });

  // ── Init ─────────────────────────────────────────────────────────────────────
  connect();
})();
