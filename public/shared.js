(function(){
'use strict';

const STORAGE_KEY_NAME = 'zapplay_pseudo';
const STORAGE_KEY_HISTORY = 'zapplay_history';
const MAX_HISTORY = 50;
const RESULT_DEDUP_WINDOW_MS = 4000;
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

  const gameIcons={quiz:'⚡',draw:'✏️',p4:'🟠',morpion:'✖️',taboo:'🚫',emoji:'🌟',verite:'❤️',loup:'🐺',uno:'🃏'};
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
  if(isIndex){
    renderHistoryWidget('history-widget');
  }
  // Auto-hide loader after 5s max
  if(!isIndex)setTimeout(hideLoader,8000);
}

window.ZapPlay={
  getSavedPseudo,savePseudo,
  hideLoader,showLoader,
  saveGameResult,getHistory,getStats,renderHistoryWidget,clearHistory,exportHistory
};

})();
