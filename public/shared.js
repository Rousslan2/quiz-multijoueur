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
  const css=document.createElement('style');
  css.textContent=`
    #zp-loader{
      position:fixed;inset:0;z-index:99999;
      background:linear-gradient(135deg,#0f0c29 0%,#302b63 55%,#24243e 100%);
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;
      transition:opacity .4s,visibility .4s;
    }
    #zp-loader.hide{opacity:0;visibility:hidden;pointer-events:none}
    #zp-loader .zl-title{
      font-size:2.4rem;font-weight:800;
      background:linear-gradient(135deg,#a78bfa,#f97316);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;
      background-clip:text;letter-spacing:-.02em;
      font-family:'Segoe UI',system-ui,sans-serif;
    }
    #zp-loader .zl-sub{color:#94a3b8;font-size:.9rem;font-family:'Segoe UI',system-ui,sans-serif}
    #zp-loader .zl-spinner{
      width:36px;height:36px;
      border:3px solid rgba(167,139,250,.2);
      border-top-color:#a78bfa;
      border-radius:50%;animation:zl-spin .7s linear infinite;
    }
    @keyframes zl-spin{to{transform:rotate(360deg)}}
    #zp-loader .zl-dots{display:flex;gap:6px}
    #zp-loader .zl-dot{
      width:8px;height:8px;border-radius:50%;background:#a78bfa;
      animation:zl-bounce .6s ease-in-out infinite alternate;
    }
    #zp-loader .zl-dot:nth-child(2){animation-delay:.15s}
    #zp-loader .zl-dot:nth-child(3){animation-delay:.3s}
    @keyframes zl-bounce{0%{opacity:.3;transform:translateY(0)}100%{opacity:1;transform:translateY(-6px)}}
  `;
  document.head.appendChild(css);

  const loader=document.createElement('div');
  loader.id='zp-loader';
  loader.innerHTML=`
    <div class="zl-title">ZapPlay</div>
    <div class="zl-sub">Connexion en cours…</div>
    <div class="zl-dots"><div class="zl-dot"></div><div class="zl-dot"></div><div class="zl-dot"></div></div>
  `;
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
      background:rgba(12,10,30,.96);border:1px solid rgba(167,139,250,.25);
      border-radius:14px;box-shadow:0 10px 34px rgba(0,0,0,.45);
      display:none;overflow:hidden;backdrop-filter:blur(10px);
      font-family:'Segoe UI',system-ui,sans-serif;
    }
    #zp-lounge.show{display:block}
    #zp-lounge[data-collapsed="1"] #zp-lounge-body{display:none}
    #zp-lounge[data-collapsed="1"] #zp-lounge-head{border-bottom:none}
    #zp-lounge-head{
      display:flex;align-items:center;justify-content:space-between;
      padding:8px 10px;background:rgba(167,139,250,.1);border-bottom:1px solid rgba(167,139,250,.2);
    }
    #zp-lounge-toggle{
      border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#e2e8f0;
      border-radius:8px;padding:3px 8px;font-size:.72rem;cursor:pointer
    }
    #zp-lounge-head .t{font-size:.78rem;color:#c4b5fd;font-weight:700}
    #zp-lounge-head .s{font-size:.7rem;color:#94a3b8}
    #zp-lounge-body{display:grid;grid-template-columns:1fr 1fr;gap:0;max-height:42vh}
    #zp-lounge-players{padding:8px;border-right:1px solid rgba(255,255,255,.08);overflow:auto}
    .zp-player{
      background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
      border-radius:10px;padding:7px 9px;margin-bottom:6px;cursor:pointer;
      display:flex;gap:8px;align-items:center
    }
    .zp-player.me{border-color:rgba(34,197,94,.4)}
    .zp-player .a{
      width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;
      background:linear-gradient(135deg,#a78bfa,#7c3aed);color:#fff;font-size:.67rem;font-weight:800;flex-shrink:0
    }
    .zp-player .n{font-size:.78rem;font-weight:700;color:#f1f5f9}
    .zp-player .m{font-size:.67rem;color:#94a3b8}
    #zp-lounge-chat{display:flex;flex-direction:column;min-height:170px}
    #zp-lounge-msgs{flex:1;overflow:auto;padding:8px;display:flex;flex-direction:column;gap:5px}
    .zp-chat{font-size:.74rem}
    .zp-chat .who{color:#a78bfa;font-weight:700}
    .zp-chat .txt{color:#e2e8f0}
    #zp-lounge-input{display:flex;gap:6px;padding:8px;border-top:1px solid rgba(255,255,255,.08)}
    #zp-lounge-input input{
      flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);
      border-radius:8px;padding:7px 9px;color:#f1f5f9;font-size:.78rem;outline:none
    }
    #zp-lounge-input button{
      border:none;border-radius:8px;background:#7c3aed;color:#fff;
      font-size:.78rem;padding:7px 10px;cursor:pointer
    }
    #zp-lounge-foot{
      display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;
      border-top:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03)
    }
    #zp-lounge-ready-label{font-size:.72rem;color:#94a3b8}
    #zp-lounge-ready-btn{
      border:none;border-radius:8px;padding:7px 10px;background:rgba(34,197,94,.2);color:#86efac;
      font-size:.75rem;font-weight:700;cursor:pointer
    }
    #zp-lounge-ready-btn.off{background:rgba(148,163,184,.2);color:#cbd5e1}
    #zp-player-modal{
      position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;z-index:260;
      align-items:center;justify-content:center
    }
    #zp-player-modal.show{display:flex}
    #zp-player-card{
      width:min(360px,92vw);background:#16122f;border:1px solid rgba(167,139,250,.3);
      border-radius:14px;padding:14px
    }
    #zp-player-card .n{font-size:1rem;font-weight:800}
    #zp-player-card .m{font-size:.78rem;color:#94a3b8;margin-top:4px}
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

  const gameIcons={quiz:'⚡',draw:'✏️',p4:'🟠',morpion:'✖️',taboo:'🚫',emoji:'🌟',verite:'❤️',loup:'🐺',uno:'🃏',bomb:'💣',sumo:'🥋',paint:'🎨'};
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
    paint:{name:'Paint.io',url:'paint.html'}
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
//  4. INIT
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
  showLounge,hideLounge,setLoungeSender,addLoungeMessage
};

})();
