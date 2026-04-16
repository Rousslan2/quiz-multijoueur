(function(){
'use strict';

const STORAGE_KEY_NAME = 'zapplay_pseudo';
const STORAGE_KEY_HISTORY = 'zapplay_history';
const STORAGE_KEY_SOCIAL = 'zapplay_social_v1';
const STORAGE_KEY_PRESENCE = 'zapplay_presence_v1';
const MAX_HISTORY = 50;
const RESULT_DEDUP_WINDOW_MS = 4000;
const PRESENCE_TTL_MS = 45000;
let lastResultSignature = '';
let lastResultSavedAt = 0;

// ═══════════════════════════════════════════════════════
//  1. PSEUDOS PERSISTANTS
// ═══════════════════════════════════════════════════════

function getSavedPseudo(){
  return localStorage.getItem(STORAGE_KEY_NAME)||'';
}

function savePseudo(name){
  if(!name)return;
  const clean=String(name).trim().slice(0,20);
  if(!clean)return;
  localStorage.setItem(STORAGE_KEY_NAME,clean);
  localStorage.setItem('chat_name',clean);
  touchSocialProfile(clean);
}

function autoFillPseudo(){
  const saved=getSavedPseudo();
  if(!saved)return;
  const selectors=['#inp-name','#name-input','#inp-create-name','#inp-join-name'];
  selectors.forEach(sel=>{
    const el=document.querySelector(sel);
    if(el&&!el.value)el.value=saved;
  });
}

function hookPseudoInputs(){
  const selectors=['#inp-name','#name-input','#inp-create-name','#inp-join-name'];
  selectors.forEach(sel=>{
    const el=document.querySelector(sel);
    if(!el)return;
    el.addEventListener('change',()=>{ if(el.value.trim()) savePseudo(el.value.trim()); });
    el.addEventListener('blur',()=>{ if(el.value.trim()) savePseudo(el.value.trim()); });
  });
}

// ═══════════════════════════════════════════════════════
//  2. ÉCRAN DE CHARGEMENT
// ═══════════════════════════════════════════════════════

function injectLoader(){
  if(document.getElementById('zp-loader'))return;
  if(!document.querySelector('link[href*="Orbitron"]')){
    const lnk=document.createElement('link');
    lnk.rel='stylesheet';
    lnk.href='https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap';
    document.head.appendChild(lnk);
  }
  const css=document.createElement('style');
  css.textContent=[
    '#zp-loader{position:fixed;inset:0;z-index:99999;background:#06060F;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity .5s,visibility .5s;overflow:hidden;}',
    '#zp-loader.hide{opacity:0;visibility:hidden;pointer-events:none}',
    '#zp-loader::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(0,245,212,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,245,212,.04) 1px,transparent 1px);background-size:40px 40px;animation:zl-drift 8s linear infinite;}',
    '@keyframes zl-drift{0%{transform:translateY(0)}100%{transform:translateY(40px)}}',
    '#zp-loader::after{content:"";position:absolute;left:0;right:0;height:120px;background:linear-gradient(transparent,rgba(0,245,212,.04),transparent);animation:zl-scan 2.5s linear infinite;}',
    '@keyframes zl-scan{0%{top:-120px}100%{top:100vh}}',
    '.zl-corner{position:absolute;width:36px;height:36px;border-color:rgba(0,245,212,.5);border-style:solid;}',
    '.zl-corner.tl{top:18px;left:18px;border-width:2px 0 0 2px}',
    '.zl-corner.tr{top:18px;right:18px;border-width:2px 2px 0 0}',
    '.zl-corner.bl{bottom:18px;left:18px;border-width:0 0 2px 2px}',
    '.zl-corner.br{bottom:18px;right:18px;border-width:0 2px 2px 0}',
    '.zl-center{position:relative;display:flex;flex-direction:column;align-items:center;gap:22px;z-index:2;}',
    '.zl-logo{font-family:"Orbitron",monospace;font-size:clamp(2.8rem,10vw,4.5rem);font-weight:900;color:#00F5D4;letter-spacing:.06em;text-shadow:0 0 30px rgba(0,245,212,.8),0 0 80px rgba(0,245,212,.3);animation:zl-glitch 4s infinite,zl-fin .6s ease both;}',
    '@keyframes zl-fin{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}',
    '@keyframes zl-glitch{0%,88%,100%{transform:translate(0);text-shadow:0 0 30px rgba(0,245,212,.8),0 0 80px rgba(0,245,212,.3)}89%{transform:translate(-4px,1px);text-shadow:-4px 0 #FF3864,4px 0 #FF6B35}90%{transform:translate(4px,-1px);text-shadow:4px 0 #FF6B35,-4px 0 #FF3864}91%{transform:translate(0);text-shadow:0 0 30px rgba(0,245,212,.8),0 0 80px rgba(0,245,212,.3)}92%{transform:translate(2px,2px);text-shadow:-2px 0 #FF3864}93%{transform:translate(0);text-shadow:0 0 30px rgba(0,245,212,.8),0 0 80px rgba(0,245,212,.3)}}',
    '.zl-tag{font-family:"Orbitron",monospace;font-size:.62rem;letter-spacing:.3em;text-transform:uppercase;color:rgba(0,245,212,.45);animation:zl-fin .6s .15s ease both;}',
    '.zl-bar-wrap{width:200px;height:2px;background:rgba(0,245,212,.1);border-radius:1px;overflow:hidden;animation:zl-fin .6s .25s ease both;}',
    '.zl-bar{height:100%;width:0%;background:linear-gradient(90deg,#00F5D4,#FF6B35);border-radius:1px;box-shadow:0 0 8px rgba(0,245,212,.6);animation:zl-fill 1.6s .4s cubic-bezier(.4,0,.2,1) forwards;}',
    '@keyframes zl-fill{0%{width:0%}60%{width:75%}80%{width:82%}100%{width:92%}}',
    '.zl-sub{font-size:.62rem;color:rgba(90,90,120,.9);letter-spacing:.15em;font-family:"Orbitron",monospace;text-transform:uppercase;animation:zl-fin .6s .35s ease both;}',
    '.zl-p{position:absolute;width:2px;height:2px;border-radius:50%;background:#00F5D4;animation:zl-float linear infinite;}',
    '@keyframes zl-float{0%{transform:translateY(100vh);opacity:0}10%{opacity:.5}90%{opacity:.2}100%{transform:translateY(-30px);opacity:0}}',
    '::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:rgba(255,255,255,.03)}::-webkit-scrollbar-thumb{background:rgba(0,245,212,.2);border-radius:2px}::-webkit-scrollbar-thumb:hover{background:rgba(0,245,212,.4)}',
    '::selection{background:rgba(0,245,212,.25);color:#fff}',
  ].join('');
  document.head.appendChild(css);

  const mk=(tag,cls)=>{const e=document.createElement(tag);if(cls)e.className=cls;return e;};
  const loader=mk('div');loader.id='zp-loader';

  ['tl','tr','bl','br'].forEach(c=>{const d=mk('div','zl-corner '+c);loader.appendChild(d);});

  const particles=mk('div');particles.style.cssText='position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden';
  for(let i=0;i<16;i++){
    const p=mk('div','zl-p');
    const sz=(1+Math.random()*2).toFixed(1);
    p.style.cssText='left:'+Math.round(Math.random()*100)+'%;animation-duration:'+(3+Math.random()*5).toFixed(1)+'s;animation-delay:'+Math.random().toFixed(2)+'s;width:'+sz+'px;height:'+sz+'px;opacity:0';
    particles.appendChild(p);
  }
  loader.appendChild(particles);

  const center=mk('div','zl-center');
  const logo=mk('div','zl-logo');logo.textContent='ZapPlay';
  const tag=mk('div','zl-tag');tag.textContent='Arcade Multijoueur';
  const barWrap=mk('div','zl-bar-wrap');const bar=mk('div','zl-bar');barWrap.appendChild(bar);
  const sub=mk('div','zl-sub');sub.textContent='Connexion…';
  [logo,tag,barWrap,sub].forEach(el=>center.appendChild(el));
  loader.appendChild(center);

  document.body.prepend(loader);
}

const MIN_LOADER_MS=1500;
let loaderShownAt=0;
let loaderHideScheduled=false;

function hideLoader(){
  const el=document.getElementById('zp-loader');
  if(!el)return;
  if(loaderHideScheduled)return;
  loaderHideScheduled=true;
  const elapsed=Date.now()-loaderShownAt;
  const remaining=Math.max(0,MIN_LOADER_MS-elapsed);
  setTimeout(()=>{
    el.classList.add('hide');
    setTimeout(()=>el.remove(),500);
  },remaining);
}

function showLoader(){
  injectLoader();
  loaderShownAt=Date.now();
  loaderHideScheduled=false;
  const el=document.getElementById('zp-loader');
  if(el)el.classList.remove('hide');
}

// ═══════════════════════════════════════════════════════
//  3. SYSTÈME DE POINTS / HISTORIQUE
// ═══════════════════════════════════════════════════════

function getHistory(){
  try{return JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY)||'[]');}
  catch{return[];}
}

function buildResultSignature(data){
  const players=(data.players||[]).join('|');
  return [data.game||'?',data.winner||'?',data.myName||getSavedPseudo(),data.myScore??0,players].join('::');
}

function saveGameResult(data){
  const signature=buildResultSignature(data);
  const now=Date.now();
  if(signature===lastResultSignature && (now-lastResultSavedAt)<RESULT_DEDUP_WINDOW_MS){
    return;
  }
  const history=getHistory();
  const first=history[0];
  if(first && first.signature===signature && (now-(first.date||0))<RESULT_DEDUP_WINDOW_MS){
    return;
  }
  lastResultSignature=signature;
  lastResultSavedAt=now;
  history.unshift({
    game:data.game||'?',
    gameName:data.gameName||data.game||'?',
    date:now,
    signature,
    players:data.players||[],
    winner:data.winner||null,
    myName:data.myName||getSavedPseudo(),
    myScore:data.myScore??0,
    isWinner:!!data.isWinner,
    scores:data.scores||{}
  });
  if(history.length>MAX_HISTORY)history.length=MAX_HISTORY;
  localStorage.setItem(STORAGE_KEY_HISTORY,JSON.stringify(history));
}

function clearHistory(){
  localStorage.removeItem(STORAGE_KEY_HISTORY);
}

function exportHistory(){
  const payload={exportedAt:Date.now(),history:getHistory()};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='zapplay-history.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════
//  3b. SALON PRÉ-PARTIE (Joueurs + Profil + Chat room)
// ═══════════════════════════════════════════════════════

let loungeSender = null;
let loungeState = { roomCode:'', players:[], mySlot:-1, gameName:'' };
let loungeReady = false;
let loungeCollapsed = false;
const loungeReadyByRoom = Object.create(null);

function ensureLoungeUI(){
  if(loungeReady)return;
  loungeReady = true;
  const css = document.createElement('style');
  css.textContent = `
    #zp-lounge{
      position:fixed;right:14px;bottom:14px;z-index:220;
      width:min(460px,calc(100vw - 28px));
      background:rgba(8,8,20,.97);border:1px solid rgba(0,245,212,.18);
      border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.55),0 0 0 1px rgba(0,245,212,.05);
      display:none;overflow:hidden;backdrop-filter:blur(12px);
      font-family:'Exo 2','Segoe UI',system-ui,sans-serif;
    }
    #zp-lounge.show{display:block}
    #zp-lounge[data-collapsed="1"] #zp-lounge-body{display:none}
    #zp-lounge[data-collapsed="1"] #zp-lounge-head{border-bottom:none}
    #zp-lounge-head{
      display:flex;align-items:center;justify-content:space-between;
      padding:9px 12px;background:rgba(0,245,212,.07);border-bottom:1px solid rgba(0,245,212,.12);
    }
    #zp-lounge-toggle{
      border:1px solid rgba(0,245,212,.2);background:rgba(0,245,212,.08);color:#00F5D4;
      border-radius:7px;padding:3px 9px;font-size:.7rem;cursor:pointer;transition:all .15s
    }
    #zp-lounge-toggle:hover{background:rgba(0,245,212,.15)}
    #zp-lounge-head .t{font-size:.78rem;color:#00F5D4;font-weight:700;letter-spacing:.04em}
    #zp-lounge-head .s{font-size:.68rem;color:#5A5A78}
    #zp-lounge-body{display:grid;grid-template-columns:1fr 1fr;gap:0;max-height:42vh}
    #zp-lounge-players{padding:8px;border-right:1px solid rgba(255,255,255,.06);overflow:auto}
    .zp-player{
      background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);
      border-radius:10px;padding:7px 9px;margin-bottom:6px;cursor:pointer;
      display:flex;gap:8px;align-items:center;transition:background .15s,border-color .15s
    }
    .zp-player:hover{background:rgba(0,245,212,.06);border-color:rgba(0,245,212,.2)}
    .zp-player.me{border-color:rgba(0,245,212,.3);background:rgba(0,245,212,.05)}
    .zp-player .a{
      width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;
      background:linear-gradient(135deg,#00F5D4,#007a7a);color:#fff;font-size:.67rem;font-weight:800;flex-shrink:0
    }
    .zp-player.me .a{background:linear-gradient(135deg,#00F5D4,#0099aa)}
    .zp-player .n{font-size:.78rem;font-weight:700;color:#E8E8F0}
    .zp-player .m{font-size:.65rem;color:#5A5A78}
    #zp-lounge-chat{display:flex;flex-direction:column;min-height:170px}
    #zp-lounge-msgs{flex:1;overflow:auto;padding:8px;display:flex;flex-direction:column;gap:5px}
    .zp-chat{font-size:.74rem;line-height:1.4}
    .zp-chat .who{color:#00F5D4;font-weight:700}
    .zp-chat .txt{color:#c8c8d8}
    #zp-lounge-input{display:flex;gap:6px;padding:8px;border-top:1px solid rgba(255,255,255,.06)}
    #zp-lounge-input input{
      flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(0,245,212,.15);
      border-radius:8px;padding:7px 9px;color:#E8E8F0;font-size:.78rem;outline:none;
      transition:border-color .15s
    }
    #zp-lounge-input input:focus{border-color:rgba(0,245,212,.4)}
    #zp-lounge-input button{
      border:none;border-radius:8px;background:rgba(0,245,212,.85);color:#06060F;
      font-size:.78rem;padding:7px 10px;cursor:pointer;font-weight:700;transition:background .15s
    }
    #zp-lounge-input button:hover{background:#00F5D4}
    #zp-lounge-foot{
      display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 12px;
      border-top:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.02)
    }
    #zp-lounge-ready-label{font-size:.7rem;color:#5A5A78}
    #zp-lounge-ready-btn{
      border:none;border-radius:8px;padding:7px 12px;background:rgba(34,197,94,.18);color:#86efac;
      font-size:.74rem;font-weight:700;cursor:pointer;border:1px solid rgba(34,197,94,.25);transition:all .15s
    }
    #zp-lounge-ready-btn:hover{background:rgba(34,197,94,.28)}
    #zp-lounge-ready-btn.off{background:rgba(90,90,120,.2);color:#7A7A9A;border-color:rgba(255,255,255,.06)}
    #zp-player-modal{
      position:fixed;inset:0;background:rgba(0,0,0,.5);display:none;z-index:260;
      align-items:center;justify-content:center;backdrop-filter:blur(4px)
    }
    #zp-player-modal.show{display:flex}
    #zp-player-card{
      width:min(360px,92vw);background:#0D0D1F;border:1px solid rgba(0,245,212,.2);
      border-radius:14px;padding:16px;box-shadow:0 8px 30px rgba(0,0,0,.4)
    }
    #zp-player-card .n{font-size:1rem;font-weight:800;color:#E8E8F0}
    #zp-player-card .m{font-size:.78rem;color:#5A5A78;margin-top:4px}
    @media (max-width: 760px){
      #zp-lounge{left:14px;right:14px;width:auto}
      #zp-lounge-body{grid-template-columns:1fr}
      #zp-lounge-players{border-right:none;border-bottom:1px solid rgba(255,255,255,.08)}
      #zp-lounge-input input,#zp-lounge-input button,#zp-lounge-ready-btn{font-size:.9rem;padding:10px 11px}
      #zp-lounge-msgs{max-height:32vh}
    }
  `;
  document.head.appendChild(css);
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="zp-lounge">
      <div id="zp-lounge-head">
        <div>
          <div class="t" id="zp-lounge-title">Salon</div>
          <div class="s" id="zp-lounge-sub">En attente…</div>
        </div>
        <button id="zp-lounge-toggle" type="button">Réduire</button>
      </div>
      <div id="zp-lounge-body">
        <div id="zp-lounge-players"></div>
        <div id="zp-lounge-chat">
          <div id="zp-lounge-msgs"></div>
          <div id="zp-lounge-input">
            <input id="zp-lounge-text" maxlength="200" placeholder="Message salon..." />
            <button id="zp-lounge-send">Envoyer</button>
          </div>
        </div>
      </div>
      <div id="zp-lounge-foot">
        <span id="zp-lounge-ready-label">Statut: en attente</span>
        <button id="zp-lounge-ready-btn" type="button" class="off">Pas prêt</button>
      </div>
    </div>
    <div id="zp-player-modal">
      <div id="zp-player-card">
        <div class="n" id="zp-player-name">Joueur</div>
        <div class="m" id="zp-player-meta"></div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
  setLoungeCollapsed(window.matchMedia('(max-width:760px)').matches);

  const sendBtn = document.getElementById('zp-lounge-send');
  const input = document.getElementById('zp-lounge-text');
  function sendLounge(){
    const text = input.value.trim();
    if(!text || !loungeSender)return;
    loungeSender(text);
    input.value='';
  }
  sendBtn.addEventListener('click', sendLounge);
  input.addEventListener('keydown', e => { if(e.key==='Enter') sendLounge(); });
  document.getElementById('zp-lounge-toggle').addEventListener('click',()=>{
    setLoungeCollapsed(!loungeCollapsed);
  });
  document.getElementById('zp-lounge-ready-btn').addEventListener('click',()=>{
    const key = loungeState.roomCode || 'global';
    loungeReadyByRoom[key] = !loungeReadyByRoom[key];
    updateLoungeReadyUI();
  });
  document.getElementById('zp-player-modal').addEventListener('click', e => {
    if(e.target.id==='zp-player-modal') e.currentTarget.classList.remove('show');
  });
}

function setLoungeCollapsed(collapsed){
  loungeCollapsed = !!collapsed;
  const lounge = document.getElementById('zp-lounge');
  if(!lounge)return;
  lounge.setAttribute('data-collapsed', loungeCollapsed?'1':'0');
  const btn = document.getElementById('zp-lounge-toggle');
  if(btn) btn.textContent = loungeCollapsed ? 'Ouvrir' : 'Réduire';
}

function playerQuickStats(playerName){
  const key = normPseudo(playerName);
  const history = getHistory();
  let played = 0;
  let wins = 0;
  history.forEach(g=>{
    const players = Array.isArray(g.players)?g.players:[];
    const inGame = players.some(n=>normPseudo(n)===key);
    if(!inGame)return;
    played++;
    if(normPseudo(g.winner||'')===key)wins++;
  });
  return {played,wins};
}

function updateLoungeReadyUI(){
  const roomKey = loungeState.roomCode || 'global';
  const isReady = !!loungeReadyByRoom[roomKey];
  const lbl = document.getElementById('zp-lounge-ready-label');
  const btn = document.getElementById('zp-lounge-ready-btn');
  if(lbl) lbl.textContent = `Statut: ${isReady?'prêt ✅':'en attente'}`;
  if(btn){
    btn.classList.toggle('off', !isReady);
    btn.textContent = isReady ? 'Prêt' : 'Pas prêt';
  }
}

function showLounge(data){
  ensureLoungeUI();
  loungeState = {
    roomCode: data.roomCode || loungeState.roomCode || '',
    players: data.players || [],
    mySlot: Number.isInteger(data.mySlot)?data.mySlot:loungeState.mySlot,
    gameName: data.gameName || loungeState.gameName || ''
  };
  const lounge = document.getElementById('zp-lounge');
  lounge.classList.add('show');
  document.getElementById('zp-lounge-title').textContent = `Salon ${loungeState.gameName||''}`.trim();
  document.getElementById('zp-lounge-sub').textContent = `Code: ${loungeState.roomCode||'----'} • ${loungeState.players.length} joueur(s)`;

  const list = document.getElementById('zp-lounge-players');
  list.innerHTML = '';
  loungeState.players.forEach(p=>{
    const st = playerQuickStats(p.name);
    const div = document.createElement('div');
    div.className = 'zp-player' + (p.slot===loungeState.mySlot?' me':'');
    div.innerHTML = `
      <div class="a">${initials(p.name)}</div>
      <div>
        <div class="n">${escapeHtml(p.name)}${p.slot===loungeState.mySlot?' (toi)':''}</div>
        <div class="m">Slot ${p.slot+1} • ${st.wins}V / ${st.played}P</div>
      </div>`;
    div.addEventListener('click',()=>showPlayerProfile(p));
    list.appendChild(div);
  });
  updateLoungeReadyUI();
}

function hideLounge(){
  const lounge = document.getElementById('zp-lounge');
  if(lounge) lounge.classList.remove('show');
}

function setLoungeSender(fn){
  loungeSender = fn;
}

function escapeHtml(value){
  return String(value||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function addLoungeMessage(msg){
  ensureLoungeUI();
  const box = document.getElementById('zp-lounge-msgs');
  const row = document.createElement('div');
  row.className = 'zp-chat';
  const who = msg.name || 'Joueur';
  row.innerHTML = `<span class="who">${who}</span> <span class="txt">${escapeHtml(msg.text||'')}</span>`;
  box.appendChild(row);
  while(box.children.length>80) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
}

function showPlayerProfile(player){
  ensureLoungeUI();
  const modal = document.getElementById('zp-player-modal');
  const nameEl = document.getElementById('zp-player-name');
  const metaEl = document.getElementById('zp-player-meta');
  nameEl.textContent = player.name || 'Joueur';
  const me = player.slot===loungeState.mySlot?'Ton profil':'Joueur du salon';
  const st = playerQuickStats(player.name);
  const presence = getOnlinePresenceMap()[normPseudo(player.name)] ? 'En ligne' : 'Hors ligne';
  metaEl.textContent = `${me} • Slot ${Number(player.slot)+1} • ${st.wins}V/${st.played}P • ${presence}`;
  modal.classList.add('show');
}

function getStats(){
  const h=getHistory();
  const pseudo=getSavedPseudo();
  let wins=0,losses=0,games=h.length;
  const byGame={};
  h.forEach(g=>{
    if(g.isWinner)wins++;else losses++;
    if(!byGame[g.game])byGame[g.game]={wins:0,losses:0,played:0,name:g.gameName||g.game};
    byGame[g.game].played++;
    if(g.isWinner)byGame[g.game].wins++;else byGame[g.game].losses++;
  });
  return{pseudo,wins,losses,games,byGame};
}

function getProfileData(){
  const history=getHistory();
  const stats=getStats();
  const pseudo=stats.pseudo||'Joueur';
  const recent=history[0]||null;
  const topGames=Object.entries(stats.byGame)
    .map(([id,v])=>({id,...v,rate:v.played?Math.round(v.wins/v.played*100):0}))
    .sort((a,b)=>b.wins-a.wins||b.rate-a.rate);
  const best=topGames[0]||null;
  return{pseudo,recent,best,stats};
}

function initials(name){
  const n=String(name||'').trim();
  if(!n)return'JP';
  const parts=n.split(/\s+/).filter(Boolean);
  if(parts.length===1)return parts[0].slice(0,2).toUpperCase();
  return (parts[0][0]+parts[1][0]).toUpperCase();
}

function renderHistoryWidget(containerId){
  const container=document.getElementById(containerId);
  if(!container)return;
  const history=getHistory();
  const stats=getStats();

  if(!stats.games){
    container.innerHTML=`
      <div style="text-align:center;padding:20px;color:#94a3b8;font-size:.9rem">
        <div style="font-size:1.5rem;margin-bottom:8px">📊</div>
        Aucune partie jouée pour l'instant.<br>Lancez-vous !
      </div>`;
    return;
  }

  const gameIcons={quiz:'⚡',draw:'✏️',p4:'🟠',morpion:'✖️',taboo:'🚫',emoji:'🌟',verite:'❤️',loup:'🐺',uno:'🃏',bomb:'💣',sumo:'🥋',paint:'🎨',naval:'⚓'};
  const winRate=stats.games?Math.round(stats.wins/stats.games*100):0;
  const profile=getProfileData();
  const recentResult=profile.recent?`${profile.recent.isWinner?'Victoire':'Défaite'} · ${profile.recent.gameName||profile.recent.game}`:'Aucune partie';
  const bestGame=profile.best?`${gameIcons[profile.best.id]||'🎮'} ${profile.best.name||profile.best.id}`:'-';
  const topGames=Object.entries(stats.byGame)
    .map(([id,v])=>({id,...v,rate:v.played?Math.round(v.wins/v.played*100):0}))
    .sort((a,b)=>b.wins-a.wins||b.rate-a.rate)
    .slice(0,4);
  let streak=0;
  for(let i=0;i<history.length;i++){
    if(history[i].isWinner)streak++;
    else break;
  }
  const weekStart = Date.now() - (7*24*60*60*1000);
  const weekGames = history.filter(g=>(g.date||0)>=weekStart);
  const weekWins = weekGames.filter(g=>g.isWinner).length;
  const weekPoints = weekGames.reduce((acc,g)=>acc + (g.isWinner?3:1),0);
  const weekByGame = {};
  weekGames.forEach(g=>{
    if(!weekByGame[g.game])weekByGame[g.game]={id:g.game,name:g.gameName||g.game,wins:0,played:0,points:0};
    weekByGame[g.game].played++;
    if(g.isWinner)weekByGame[g.game].wins++;
    weekByGame[g.game].points += g.isWinner?3:1;
  });
  const weeklyTop = Object.values(weekByGame).sort((a,b)=>b.points-a.points||b.wins-a.wins).slice(0,3);
  const weekTier = weekPoints>=45?'Diamant':weekPoints>=30?'Or':weekPoints>=18?'Argent':'Bronze';

  let html=`
    <div style="display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:12px;margin-bottom:12px">
      <div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#a78bfa,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800">
        ${initials(profile.pseudo)}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:.92rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${profile.pseudo}</div>
        <div style="font-size:.72rem;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Dernier résultat: ${recentResult}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:.68rem;color:#64748b;text-transform:uppercase;letter-spacing:.04em">Meilleur jeu</div>
        <div style="font-size:.78rem;font-weight:700">${bestGame}</div>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
      <div style="flex:1;min-width:80px;background:rgba(167,139,250,.1);border:1px solid rgba(167,139,250,.25);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:1.6rem;font-weight:800;color:#a78bfa">${stats.games}</div>
        <div style="font-size:.72rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">Parties</div>
      </div>
      <div style="flex:1;min-width:80px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:1.6rem;font-weight:800;color:#22c55e">${stats.wins}</div>
        <div style="font-size:.72rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">Victoires</div>
      </div>
      <div style="flex:1;min-width:80px;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.25);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:1.6rem;font-weight:800;color:#fbbf24">${winRate}%</div>
        <div style="font-size:.72rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">Win rate</div>
      </div>
      <div style="flex:1;min-width:80px;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.25);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:1.6rem;font-weight:800;color:#60a5fa">${streak}</div>
        <div style="font-size:.72rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">Série</div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin:-2px 0 10px">
      <button id="zp-export-history-btn" style="background:rgba(59,130,246,.12);border:1px solid rgba(59,130,246,.3);color:#93c5fd;border-radius:8px;padding:6px 10px;font-size:.72rem;cursor:pointer">
        Exporter JSON
      </button>
      <button id="zp-clear-history-btn" style="background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:#fca5a5;border-radius:8px;padding:6px 10px;font-size:.72rem;cursor:pointer">
        Effacer l'historique
      </button>
    </div>`;

  if(topGames.length){
    html+=`<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">`;
    topGames.forEach(g=>{
      const icon=gameIcons[g.id]||'🎮';
      html+=`<div style="flex:1;min-width:130px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:8px 10px">
        <div style="font-size:.76rem;font-weight:700;display:flex;align-items:center;gap:6px">${icon} ${g.name||g.id}</div>
        <div style="font-size:.68rem;color:#94a3b8;margin-top:2px">${g.wins}V / ${g.played}P • ${g.rate}%</div>
      </div>`;
    });
    html+=`</div>`;
  }

  html+=`
    <div style="background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.2);border-radius:12px;padding:10px;margin:2px 0 10px">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:6px">
        <div style="font-size:.74rem;color:#7dd3fc;text-transform:uppercase;letter-spacing:.04em;font-weight:700">Classement hebdo</div>
        <div style="font-size:.72rem;color:#bae6fd">${weekTier} • ${weekPoints} pts</div>
      </div>
      <div style="font-size:.76rem;color:#bae6fd;margin-bottom:6px">${weekGames.length} partie(s) • ${weekWins} victoire(s) sur 7 jours</div>
      <div style="display:grid;gap:5px">
        ${weeklyTop.length?weeklyTop.map((g,i)=>`<div style="display:flex;justify-content:space-between;gap:8px;font-size:.74rem">
          <span>${i+1}. ${(gameIcons[g.id]||'🎮')} ${escapeHtml(g.name||g.id)}</span>
          <span style="color:#93c5fd">${g.points} pts</span>
        </div>`).join(''):`<div style="font-size:.74rem;color:#94a3b8">Aucune partie cette semaine.</div>`}
      </div>
    </div>`;

  const recent=history.slice(0,8);
  html+=`<div style="display:flex;flex-direction:column;gap:6px">`;
  recent.forEach(g=>{
    const icon=gameIcons[g.game]||'🎮';
    const dateStr=new Date(g.date).toLocaleDateString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    const result=g.isWinner
      ?'<span style="color:#22c55e;font-weight:700">Victoire</span>'
      :'<span style="color:#94a3b8">Défaite</span>';
    const players=(g.players||[]).join(', ');
    html+=`
      <div style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:8px 12px">
        <span style="font-size:1.2rem;flex-shrink:0">${icon}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:.82rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${g.gameName||g.game}</div>
          <div style="font-size:.7rem;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${players}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:.78rem">${result}</div>
          <div style="font-size:.65rem;color:#64748b">${dateStr}</div>
        </div>
      </div>`;
  });
  html+=`</div>`;

  if(history.length>8){
    html+=`<div style="text-align:center;padding:8px;font-size:.75rem;color:#64748b">… et ${history.length-8} autre(s)</div>`;
  }

  container.innerHTML=html;
  const exportBtn=document.getElementById('zp-export-history-btn');
  if(exportBtn){
    exportBtn.addEventListener('click',()=>exportHistory());
  }
  const clearBtn=document.getElementById('zp-clear-history-btn');
  if(clearBtn){
    clearBtn.addEventListener('click',()=>{
      if(!confirm('Effacer tout l’historique des parties ?'))return;
      clearHistory();
      renderHistoryWidget(containerId);
    });
  }
}

// ═══════════════════════════════════════════════════════
//  3c. PROFIL & AMIS (local multi-pseudos)
// ═══════════════════════════════════════════════════════

function normPseudo(name){
  return String(name||'')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,' ');
}

function getSocialStore(){
  try{
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY_SOCIAL)||'{}');
    if(raw && raw.users && typeof raw.users==='object') return raw;
  }catch{}
  return { users:{} };
}

function saveSocialStore(store){
  localStorage.setItem(STORAGE_KEY_SOCIAL, JSON.stringify(store));
}

function ensureSocialUser(store, pseudo){
  const clean = String(pseudo||'').trim().slice(0,20) || 'Joueur';
  const key = normPseudo(clean);
  if(!key)return null;
  if(!store.users[key]){
    store.users[key] = {
      key,
      pseudo: clean,
      bio: '',
      friends: [],
      incoming: [],
      outgoing: [],
      invitesIn: [],
      invitesOut: [],
      updatedAt: Date.now()
    };
  }
  const u = store.users[key];
  u.pseudo = clean || u.pseudo || 'Joueur';
  if(!Array.isArray(u.friends))u.friends=[];
  if(!Array.isArray(u.incoming))u.incoming=[];
  if(!Array.isArray(u.outgoing))u.outgoing=[];
  if(!Array.isArray(u.invitesIn))u.invitesIn=[];
  if(!Array.isArray(u.invitesOut))u.invitesOut=[];
  if(typeof u.bio!=='string')u.bio='';
  u.updatedAt = Date.now();
  return u;
}

function getActiveSocialUser(store){
  const pseudo = getSavedPseudo() || 'Joueur';
  return ensureSocialUser(store, pseudo);
}

function touchSocialProfile(name){
  const store = getSocialStore();
  ensureSocialUser(store, name || getSavedPseudo() || 'Joueur');
  saveSocialStore(store);
}

function gameMetaById(id){
  const map = {
    quiz:{name:'Quiz Éclair',url:'quiz.html'},
    draw:{name:'Dessin & Devine',url:'draw.html'},
    p4:{name:'Puissance 4',url:'p4.html'},
    morpion:{name:'Morpion',url:'morpion.html'},
    taboo:{name:'Mots Interdits',url:'taboo.html'},
    emoji:{name:'Devinette Emoji',url:'emoji.html'},
    loup:{name:'Loup-Garou',url:'loup.html'},
    uno:{name:'Uno',url:'uno.html'},
    bomb:{name:'Word Bomb',url:'wordbomb.html'},
    sumo:{name:'Sumo Arena',url:'sumo.html'},
    paint:{name:'Paint.io',url:'paint.html'},
    naval:{name:'Bataille navale',url:'naval.html'}
  };
  return map[id] || {name:id||'Jeu',url:'index.html'};
}

function getPresenceStore(){
  try{
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY_PRESENCE)||'{}');
    if(raw && typeof raw==='object' && raw.users && typeof raw.users==='object')return raw;
  }catch{}
  return { users:{} };
}

function savePresenceStore(store){
  localStorage.setItem(STORAGE_KEY_PRESENCE, JSON.stringify(store));
}

function touchPresence(){
  const pseudo = getSavedPseudo() || 'Joueur';
  const key = normPseudo(pseudo);
  if(!key)return;
  const store = getPresenceStore();
  const now = Date.now();
  store.users[key] = {
    key,
    pseudo,
    lastSeen: now,
    page: location.pathname.split('/').pop() || 'index.html'
  };
  Object.keys(store.users).forEach(k=>{
    const p = store.users[k];
    if(!p || !p.lastSeen || (now - p.lastSeen) > PRESENCE_TTL_MS*3){
      delete store.users[k];
    }
  });
  savePresenceStore(store);
}

function getOnlinePresenceMap(){
  const store = getPresenceStore();
  const now = Date.now();
  const out = {};
  Object.entries(store.users||{}).forEach(([k,v])=>{
    if(v && (now - (v.lastSeen||0)) <= PRESENCE_TTL_MS){
      out[k] = v;
    }
  });
  return out;
}

function socialSendInvite(targetPseudo, gameId, code){
  const toName = String(targetPseudo||'').trim().slice(0,20);
  const game = String(gameId||'').trim();
  if(!toName)return {ok:false,msg:'Choisis un ami.'};
  if(!game)return {ok:false,msg:'Choisis un jeu.'};
  const store = getSocialStore();
  const me = getActiveSocialUser(store);
  const to = ensureSocialUser(store, toName);
  if(!to)return {ok:false,msg:'Ami introuvable.'};
  if(me.key===to.key)return {ok:false,msg:'Action impossible.'};
  const now = Date.now();
  const inviteId = `${me.key}-${to.key}-${game}-${now}`;
  const payload = {
    id: inviteId,
    from: me.key,
    to: to.key,
    game,
    code: String(code||'').trim().toUpperCase().slice(0,8),
    at: now
  };
  me.invitesOut = (me.invitesOut||[]).filter(x=>x.to!==to.key || x.game!==game);
  to.invitesIn = (to.invitesIn||[]).filter(x=>x.from!==me.key || x.game!==game);
  me.invitesOut.unshift(payload);
  to.invitesIn.unshift(payload);
  me.invitesOut = me.invitesOut.slice(0,20);
  to.invitesIn = to.invitesIn.slice(0,20);
  saveSocialStore(store);
  return {ok:true,msg:`Invitation envoyée à ${to.pseudo} (${gameMetaById(game).name}).`};
}

function socialDismissInvite(inviteId, dir){
  const store = getSocialStore();
  const me = getActiveSocialUser(store);
  const arrName = dir==='out' ? 'invitesOut' : 'invitesIn';
  const inv = (me[arrName]||[]).find(x=>x.id===inviteId);
  me[arrName] = (me[arrName]||[]).filter(x=>x.id!==inviteId);
  if(inv){
    const other = store.users[dir==='out' ? inv.to : inv.from];
    if(other){
      const otherArr = dir==='out' ? 'invitesIn' : 'invitesOut';
      other[otherArr] = (other[otherArr]||[]).filter(x=>x.id!==inviteId);
    }
  }
  saveSocialStore(store);
}

function socialSendFriendRequest(targetPseudo){
  const toName = String(targetPseudo||'').trim().slice(0,20);
  if(!toName)return {ok:false,msg:'Entre un pseudo.'};
  const store = getSocialStore();
  const me = getActiveSocialUser(store);
  const to = ensureSocialUser(store, toName);
  if(!to)return {ok:false,msg:'Pseudo invalide.'};
  if(me.key===to.key)return {ok:false,msg:'Tu ne peux pas t’ajouter toi-même.'};
  if(me.friends.includes(to.key))return {ok:false,msg:'Déjà en amis.'};
  if(me.outgoing.some(x=>x.to===to.key))return {ok:false,msg:'Demande déjà envoyée.'};
  if(me.incoming.some(x=>x.from===to.key))return {ok:false,msg:'Cette personne t’a déjà demandé en ami.'};
  const now = Date.now();
  me.outgoing.unshift({to:to.key,at:now});
  to.incoming.unshift({from:me.key,at:now});
  saveSocialStore(store);
  return {ok:true,msg:`Demande envoyée à ${to.pseudo}.`};
}

function socialAccept(fromKey){
  const store = getSocialStore();
  const me = getActiveSocialUser(store);
  const from = store.users[fromKey];
  if(!from)return;
  me.incoming = me.incoming.filter(x=>x.from!==fromKey);
  from.outgoing = from.outgoing.filter(x=>x.to!==me.key);
  if(!me.friends.includes(fromKey))me.friends.push(fromKey);
  if(!from.friends.includes(me.key))from.friends.push(me.key);
  saveSocialStore(store);
}

function socialDecline(fromKey){
  const store = getSocialStore();
  const me = getActiveSocialUser(store);
  const from = store.users[fromKey];
  me.incoming = me.incoming.filter(x=>x.from!==fromKey);
  if(from)from.outgoing = from.outgoing.filter(x=>x.to!==me.key);
  saveSocialStore(store);
}

function socialCancel(toKey){
  const store = getSocialStore();
  const me = getActiveSocialUser(store);
  const to = store.users[toKey];
  me.outgoing = me.outgoing.filter(x=>x.to!==toKey);
  if(to)to.incoming = to.incoming.filter(x=>x.from!==me.key);
  saveSocialStore(store);
}

function socialRemoveFriend(friendKey){
  const store = getSocialStore();
  const me = getActiveSocialUser(store);
  const f = store.users[friendKey];
  me.friends = me.friends.filter(x=>x!==friendKey);
  if(f)f.friends = f.friends.filter(x=>x!==me.key);
  saveSocialStore(store);
}

function renderSocialWidget(containerId){
  const container = document.getElementById(containerId);
  if(!container)return;
  const store = getSocialStore();
  const me = getActiveSocialUser(store);

  container.innerHTML = `
    <div style="display:grid;gap:10px;max-width:520px">
      <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px">
        <div style="font-size:.72rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Mon profil</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <input id="zp-profile-pseudo" maxlength="20" value="${escapeHtml(me.pseudo||'')}" placeholder="Pseudo" style="flex:1;min-width:120px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:9px;color:#f1f5f9;padding:8px 10px">
          <button id="zp-profile-save" style="border:none;border-radius:9px;padding:8px 12px;background:#7c3aed;color:#fff;font-size:.75rem;cursor:pointer">Enregistrer</button>
        </div>
        <textarea id="zp-profile-bio" maxlength="120" placeholder="Petite bio (optionnel)" style="margin-top:8px;width:100%;min-height:58px;resize:vertical;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:9px;color:#f1f5f9;padding:8px 10px;font-family:inherit;font-size:.8rem">${escapeHtml(me.bio||'')}</textarea>
      </div>
      <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px">
        <div style="font-size:.78rem;color:#cbd5e1">La section amis et demandes d’ami a été désactivée.</div>
      </div>
    </div>
  `;

  container.querySelector('#zp-profile-save')?.addEventListener('click',()=>{
    const pseudo = String(container.querySelector('#zp-profile-pseudo')?.value||'').trim().slice(0,20);
    const bio = String(container.querySelector('#zp-profile-bio')?.value||'').trim().slice(0,120);
    if(!pseudo)return;
    const s = getSocialStore();
    const oldMe = getActiveSocialUser(s);
    const newKey = normPseudo(pseudo);
    if(newKey!==oldMe.key){
      const existing = s.users[newKey];
      if(existing && existing.key!==oldMe.key){
        alert('Ce pseudo existe déjà localement. Choisis un autre pseudo.');
        return;
      }
      const oldKey = oldMe.key;
      delete s.users[oldKey];
      oldMe.key = newKey;
      s.users[newKey] = oldMe;
      Object.values(s.users).forEach(u=>{
        if(Array.isArray(u.friends))u.friends = u.friends.map(k=>k===oldKey?newKey:k);
        if(Array.isArray(u.incoming))u.incoming = u.incoming.map(r=>r.from===oldKey?{from:newKey,at:r.at}:r);
        if(Array.isArray(u.outgoing))u.outgoing = u.outgoing.map(r=>r.to===oldKey?{to:newKey,at:r.at}:r);
        if(Array.isArray(u.invitesIn))u.invitesIn = u.invitesIn.map(r=>r.from===oldKey?{...r,from:newKey}:r.to===oldKey?{...r,to:newKey}:r);
        if(Array.isArray(u.invitesOut))u.invitesOut = u.invitesOut.map(r=>r.from===oldKey?{...r,from:newKey}:r.to===oldKey?{...r,to:newKey}:r);
      });
    }
    oldMe.pseudo = pseudo;
    oldMe.bio = bio;
    savePseudo(pseudo);
    saveSocialStore(s);
    renderSocialWidget(containerId);
    renderHistoryWidget('history-widget');
  });
}

// ═══════════════════════════════════════════════════════
//  4. ANIMATION ACCUEIL NOUVEAUX JOUEURS
// ═══════════════════════════════════════════════════════

function showWelcomeScreen(){
  if(document.getElementById('zp-welcome'))return;
  const css=document.createElement('style');
  css.id='zp-welcome-css';
  css.textContent=[
    '#zp-welcome{position:fixed;inset:0;z-index:99998;background:#06060F;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;animation:wc-bg-in .5s ease both;}',
    '@keyframes wc-bg-in{from{opacity:0}to{opacity:1}}',
    '#zp-welcome.hide{animation:wc-bg-out .7s ease forwards;pointer-events:none;}',
    '@keyframes wc-bg-out{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(1.04)}}',
    '#zp-welcome::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(0,245,212,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,245,212,.04) 1px,transparent 1px);background-size:40px 40px;animation:wc-grid 10s linear infinite;}',
    '@keyframes wc-grid{0%{transform:translateY(0)}100%{transform:translateY(40px)}}',
    '#zp-welcome::after{content:"";position:absolute;left:0;right:0;height:200px;background:linear-gradient(transparent,rgba(0,245,212,.05),transparent);animation:wc-scan 3.5s linear infinite;pointer-events:none;}',
    '@keyframes wc-scan{0%{top:-200px}100%{top:100vh}}',
    '.wc-corner{position:absolute;width:40px;height:40px;border-color:rgba(0,245,212,.4);border-style:solid;}',
    '.wc-corner.tl{top:16px;left:16px;border-width:2px 0 0 2px}',
    '.wc-corner.tr{top:16px;right:16px;border-width:2px 2px 0 0}',
    '.wc-corner.bl{bottom:16px;left:16px;border-width:0 0 2px 2px}',
    '.wc-corner.br{bottom:16px;right:16px;border-width:0 2px 2px 0}',
    '.wc-p{position:absolute;border-radius:50%;animation:wc-pfloat linear infinite;}',
    '@keyframes wc-pfloat{0%{transform:translateY(100vh) translateX(0);opacity:0}10%{opacity:.5}90%{opacity:.2}100%{transform:translateY(-40px) translateX(15px);opacity:0}}',
    '.wc-content{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;text-align:center;padding:0 24px;width:100%;max-width:420px;}',
    '.wc-eyebrow{font-family:"Orbitron",monospace;font-size:.52rem;font-weight:700;letter-spacing:.5em;text-transform:uppercase;color:rgba(0,245,212,.45);margin-bottom:14px;animation:wc-up .6s .1s ease both;}',
    '@keyframes wc-up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}',
    '.wc-logo{font-family:"Orbitron",monospace;font-weight:900;font-size:clamp(3rem,14vw,5.5rem);letter-spacing:.06em;color:#00F5D4;text-shadow:0 0 24px rgba(0,245,212,.9),0 0 70px rgba(0,245,212,.35),0 0 140px rgba(0,245,212,.12);animation:wc-up .7s .2s cubic-bezier(.2,0,.2,1) both,wc-glitch 5s 2s infinite;margin-bottom:8px;}',
    '@keyframes wc-glitch{0%,88%,100%{transform:translate(0);text-shadow:0 0 24px rgba(0,245,212,.9),0 0 70px rgba(0,245,212,.35)}89%{transform:translate(-4px,1px);text-shadow:-4px 0 #FF3864,4px 0 #FF6B35}90%{transform:translate(4px,-1px);text-shadow:4px 0 #FF6B35,-4px 0 #FF3864}91%{transform:translate(0);text-shadow:0 0 24px rgba(0,245,212,.9),0 0 70px rgba(0,245,212,.35)}92%{transform:translate(2px,2px);text-shadow:-2px 0 #FF3864}93%{transform:translate(0);text-shadow:0 0 24px rgba(0,245,212,.9),0 0 70px rgba(0,245,212,.35)}}',
    '.wc-sub{font-family:"Exo 2",sans-serif;font-size:.82rem;font-weight:500;letter-spacing:.22em;text-transform:uppercase;color:rgba(90,90,120,.85);margin-bottom:36px;animation:wc-up .6s .38s ease both;}',
    '.wc-card{background:rgba(14,14,34,.92);border:1px solid rgba(0,245,212,.14);border-top:2px solid rgba(0,245,212,.5);border-radius:18px;padding:30px 32px;width:100%;backdrop-filter:blur(14px);animation:wc-up .7s .52s cubic-bezier(.2,0,.2,1) both;box-shadow:0 0 80px rgba(0,245,212,.06),0 30px 60px rgba(0,0,0,.5);}',
    '.wc-card-title{font-family:"Orbitron",monospace;font-size:.78rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#00F5D4;margin-bottom:8px;}',
    '.wc-card-hint{font-family:"Exo 2",sans-serif;font-size:.73rem;color:rgba(90,90,120,.9);letter-spacing:.04em;line-height:1.55;margin-bottom:22px;}',
    '.wc-inp{width:100%;background:rgba(0,0,0,.45);border:1px solid rgba(0,245,212,.22);border-radius:10px;padding:14px 18px;font-family:"Exo 2",sans-serif;font-size:1rem;font-weight:600;color:#E8E8F0;outline:none;text-align:center;letter-spacing:.06em;transition:border-color .2s,box-shadow .2s;animation:wc-border-pulse 3s 1.8s ease-in-out infinite;margin-bottom:14px;}',
    '.wc-inp::placeholder{color:rgba(90,90,120,.65);}',
    '.wc-inp:focus{border-color:rgba(0,245,212,.75);box-shadow:0 0 0 3px rgba(0,245,212,.12),0 0 24px rgba(0,245,212,.15);animation:none;}',
    '@keyframes wc-border-pulse{0%,100%{border-color:rgba(0,245,212,.22);box-shadow:none}50%{border-color:rgba(0,245,212,.55);box-shadow:0 0 18px rgba(0,245,212,.12)}}',
    '.wc-inp.wc-shake{animation:wc-shk .4s ease !important;}',
    '@keyframes wc-shk{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}',
    '.wc-btn{width:100%;background:linear-gradient(135deg,rgba(0,245,212,.16),rgba(0,245,212,.07));border:1px solid rgba(0,245,212,.45);border-radius:10px;padding:15px;font-family:"Orbitron",monospace;font-size:.78rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#00F5D4;cursor:pointer;transition:background .2s,box-shadow .2s,transform .15s;position:relative;overflow:hidden;}',
    '.wc-btn:hover{background:linear-gradient(135deg,rgba(0,245,212,.28),rgba(0,245,212,.14));box-shadow:0 0 28px rgba(0,245,212,.28),0 0 60px rgba(0,245,212,.1);transform:translateY(-2px);}',
    '.wc-btn:active{transform:scale(.97);}',
    '.wc-btn::before{content:"";position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(0,245,212,.18),transparent);transition:left .45s;}',
    '.wc-btn:hover::before{left:100%;}',
    '.wc-burst{position:fixed;border-radius:50%;pointer-events:none;animation:wc-burst-a .9s ease-out forwards;}',
    '@keyframes wc-burst-a{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:var(--tx) scale(0);opacity:0}}',
    '.wc-greet{position:absolute;font-family:"Orbitron",monospace;font-size:clamp(.95rem,4vw,1.4rem);font-weight:700;letter-spacing:.08em;color:#00F5D4;text-shadow:0 0 20px rgba(0,245,212,.7);opacity:0;text-align:center;padding:0 20px;transition:opacity .4s,transform .4s;}',
  ].join('');
  document.head.appendChild(css);

  const ov=document.createElement('div');ov.id='zp-welcome';
  ['tl','tr','bl','br'].forEach(c=>{const d=document.createElement('div');d.className='wc-corner '+c;ov.appendChild(d);});

  const pColors=['#00F5D4','#FF3864','#3B82F6','#A855F7','#FFE234','#FF6B35'];
  for(let i=0;i<22;i++){
    const p=document.createElement('div');p.className='wc-p';
    const sz=(.5+Math.random()*2.5).toFixed(1);
    p.style.cssText='left:'+Math.round(Math.random()*100)+'%;width:'+sz+'px;height:'+sz+'px;background:'+pColors[i%pColors.length]+';animation-duration:'+(4+Math.random()*9).toFixed(1)+'s;animation-delay:'+(Math.random()*7).toFixed(1)+'s;opacity:0';
    ov.appendChild(p);
  }

  const cont=document.createElement('div');cont.className='wc-content';
  cont.innerHTML='<div class="wc-eyebrow">— Première connexion —</div>'
    +'<div class="wc-logo">ZapPlay</div>'
    +'<div class="wc-sub">Arcade Multijoueur · En ligne</div>'
    +'<div class="wc-card">'
      +'<div class="wc-card-title">Choisis ton pseudo</div>'
      +'<div class="wc-card-hint">Il sera utilisé dans tous les jeux &amp; chats.<br>Tu pourras le changer depuis ton profil.</div>'
      +'<input id="wc-inp" class="wc-inp" type="text" placeholder="Ex : FlashZap, NeonRider…" maxlength="20" autocomplete="off" spellcheck="false">'
      +'<button id="wc-btn" class="wc-btn">Entrer dans l\'arène ⚡</button>'
    +'</div>';
  ov.appendChild(cont);

  const greet=document.createElement('div');greet.className='wc-greet';ov.appendChild(greet);
  document.body.prepend(ov);
  setTimeout(()=>{const el=document.getElementById('wc-inp');if(el)el.focus();},900);

  function submit(){
    const inp=document.getElementById('wc-inp');
    const val=inp?inp.value.trim():'';
    if(!val){
      if(inp){inp.classList.remove('wc-shake');void inp.offsetWidth;inp.classList.add('wc-shake');}
      return;
    }
    savePseudo(val);
    const btn=document.getElementById('wc-btn');
    if(btn){
      const r=btn.getBoundingClientRect();
      const cx=r.left+r.width/2,cy=r.top+r.height/2;
      const bc=['#00F5D4','#FF3864','#FFE234','#3B82F6','#A855F7','#FF6B35','#22C55E'];
      for(let i=0;i<28;i++){
        const bp=document.createElement('div');bp.className='wc-burst';
        const ang=(i/28)*Math.PI*2;
        const dist=55+Math.random()*90;
        const sz=2+Math.random()*5;
        bp.style.cssText='left:'+cx+'px;top:'+cy+'px;width:'+sz+'px;height:'+sz+'px;background:'+bc[i%bc.length]+';--tx:translate('+Math.cos(ang)*dist+'px,'+Math.sin(ang)*dist+'px)';
        document.body.appendChild(bp);
        setTimeout(()=>bp.remove(),950);
      }
    }
    greet.textContent='Bienvenue, '+val+' !';
    setTimeout(()=>{greet.style.cssText='opacity:1;transform:translateY(0);';cont.style.cssText='opacity:0;transform:scale(.95);transition:opacity .35s,transform .35s;';},80);
    setTimeout(()=>{
      ov.classList.add('hide');
      setTimeout(()=>{ov.remove();const c=document.getElementById('zp-welcome-css');if(c)c.remove();},750);
      renderHistoryWidget('history-widget');
      renderSocialWidget('social-widget');
    },1300);
  }

  const btn=document.getElementById('wc-btn');if(btn)btn.addEventListener('click',submit);
  const inp=document.getElementById('wc-inp');if(inp)inp.addEventListener('keydown',e=>{if(e.key==='Enter')submit();});
}

// ═══════════════════════════════════════════════════════
//  5. INIT
// ═══════════════════════════════════════════════════════

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',init);
}else{
  init();
}

function init(){
  const isIndex=location.pathname.endsWith('index.html')||location.pathname.endsWith('/');
  if(!isIndex){injectLoader();loaderShownAt=Date.now();}
  autoFillPseudo();
  hookPseudoInputs();
  touchPresence();
  setInterval(()=>{
    if(document.visibilityState!=='hidden') touchPresence();
  },15000);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState!=='hidden') touchPresence();
  });
  if(isIndex){
    if(!getSavedPseudo()) showWelcomeScreen();
    renderHistoryWidget('history-widget');
    renderSocialWidget('social-widget');
    setInterval(()=>renderSocialWidget('social-widget'),12000);
  }
  // Auto-hide loader after 5s max
  if(!isIndex)setTimeout(hideLoader,8000);
}

window.ZapPlay={
  getSavedPseudo,savePseudo,
  hideLoader,showLoader,
  saveGameResult,getHistory,getStats,renderHistoryWidget,clearHistory,exportHistory,
  renderSocialWidget,
  showLounge,hideLounge,setLoungeSender,addLoungeMessage,
  showWelcomeScreen
};

})();
