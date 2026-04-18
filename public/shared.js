(function(){
'use strict';

const STORAGE_KEY_NAME = 'zapplay_pseudo';
const STORAGE_KEY_HISTORY = 'zapplay_history';
const STORAGE_KEY_DEVICE = 'zapplay_device_v1';
const STORAGE_KEY_ACCOUNT = 'zapplay_account_v1';
const STORAGE_KEY_ADMIN = 'zapplay_admin_password';
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
  scheduleProfileSync();
}

function autoFillPseudo(){
  const saved=getSavedPseudo();
  if(!saved)return;
  const selectors=['#inp-name','#name-input','#name','#inp-create-name','#inp-join-name'];
  selectors.forEach(sel=>{
    const el=document.querySelector(sel);
    if(el&&!el.value)el.value=saved;
  });
}

function hookPseudoInputs(){
  const selectors=['#inp-name','#name-input','#name','#inp-create-name','#inp-join-name'];
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
    const lnk=document.createElement('link');lnk.rel='stylesheet';
    lnk.href='https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap';
    document.head.appendChild(lnk);
  }
  const css=document.createElement('style');
  css.textContent=[
    /* ── overlay ── */
    '#zp-loader{position:fixed;inset:0;z-index:99999;background:#03030A;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;transition:opacity .6s,visibility .6s;}',
    '#zp-loader.hide{opacity:0;visibility:hidden;pointer-events:none;}',
    /* animated grid */
    '#zp-loader::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(0,232,212,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,232,212,.03) 1px,transparent 1px);background-size:48px 48px;animation:zl-grid 12s linear infinite;}',
    '@keyframes zl-grid{0%{transform:translateY(0) translateX(0)}100%{transform:translateY(48px) translateX(0)}}',
    /* scan beam */
    '#zp-loader::after{content:"";position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(0,232,212,.6),transparent);box-shadow:0 0 20px rgba(0,232,212,.4);animation:zl-beam 2.8s linear infinite;}',
    '@keyframes zl-beam{0%{top:-2px;opacity:0}5%{opacity:1}95%{opacity:.6}100%{top:100vh;opacity:0}}',
    /* nebula glow */
    '.zl-nebula{position:absolute;border-radius:50%;pointer-events:none;filter:blur(60px);}',
    '.zl-nebula.a{width:500px;height:500px;background:radial-gradient(circle,rgba(0,232,212,.1) 0%,transparent 65%);animation:zl-neb 5s ease-in-out infinite;}',
    '.zl-nebula.b{width:340px;height:340px;background:radial-gradient(circle,rgba(255,56,100,.07) 0%,transparent 65%);animation:zl-neb 7s ease-in-out infinite reverse;}',
    '@keyframes zl-neb{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.18);opacity:1}}',
    /* corners */
    '.zl-corner{position:absolute;width:44px;height:44px;border-color:rgba(0,232,212,.5);border-style:solid;animation:zl-ci .5s ease both;}',
    '.zl-corner.tl{top:20px;left:20px;border-width:2px 0 0 2px;animation-delay:.05s;}',
    '.zl-corner.tr{top:20px;right:20px;border-width:2px 2px 0 0;animation-delay:.1s;}',
    '.zl-corner.bl{bottom:20px;left:20px;border-width:0 0 2px 2px;animation-delay:.08s;}',
    '.zl-corner.br{bottom:20px;right:20px;border-width:0 2px 2px 0;animation-delay:.13s;}',
    '@keyframes zl-ci{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}',
    /* orbit rings */
    '.zl-ring{position:absolute;border-radius:50%;border:1px solid transparent;pointer-events:none;}',
    '.zl-ring.r1{width:210px;height:210px;border-top-color:rgba(0,232,212,.5);border-right-color:rgba(0,232,212,.15);animation:zl-spin 3s linear infinite;}',
    '.zl-ring.r2{width:270px;height:270px;border-bottom-color:rgba(255,56,100,.4);border-left-color:rgba(255,56,100,.1);animation:zl-spin 5s linear infinite reverse;}',
    '.zl-ring.r3{width:330px;height:330px;border-top-color:rgba(91,159,255,.25);border-right-color:rgba(91,159,255,.08);animation:zl-spin 9s linear infinite;}',
    '@keyframes zl-spin{to{transform:rotate(360deg)}}',
    /* center */
    '.zl-center{position:relative;display:flex;flex-direction:column;align-items:center;gap:18px;z-index:2;}',
    /* logo */
    '.zl-logo{font-family:"Orbitron",monospace;font-size:clamp(3rem,11vw,5rem);font-weight:900;color:#00E8D4;letter-spacing:.06em;text-shadow:0 0 20px rgba(0,232,212,.9),0 0 60px rgba(0,232,212,.4),0 0 120px rgba(0,232,212,.15);animation:zl-logo-in .7s cubic-bezier(.2,0,.2,1) both,zl-glitch 5s 1.2s infinite;}',
    '@keyframes zl-logo-in{from{opacity:0;transform:scale(.85) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}',
    '@keyframes zl-glitch{0%,86%,100%{transform:translate(0);filter:none}87%{transform:translate(-4px,1px);filter:hue-rotate(-30deg)}88%{transform:translate(4px,-1px);filter:hue-rotate(30deg)}89%{transform:translate(0);filter:none}90%{transform:translate(3px,2px);filter:brightness(1.3)}91%{transform:translate(0);filter:none}}',
    /* tag */
    '.zl-tag{font-family:"Orbitron",monospace;font-size:.58rem;letter-spacing:.35em;text-transform:uppercase;color:rgba(0,232,212,.4);animation:zl-up .5s .15s ease both;}',
    /* divider */
    '.zl-div{display:flex;align-items:center;gap:10px;width:240px;animation:zl-up .5s .22s ease both;}',
    '.zl-div::before,.zl-div::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(0,232,212,.25));}',
    '.zl-div::after{background:linear-gradient(90deg,rgba(0,232,212,.25),transparent);}',
    '.zl-div-dot{width:3px;height:3px;border-radius:50%;background:rgba(0,232,212,.5);}',
    /* progress bar */
    '.zl-bar-wrap{width:260px;height:3px;background:rgba(0,232,212,.08);border-radius:2px;overflow:visible;position:relative;animation:zl-up .5s .28s ease both;}',
    '.zl-bar{height:100%;width:0%;background:linear-gradient(90deg,#00E8D4,#5B9FFF,#FF4D6D);border-radius:2px;animation:zl-fill 2s .4s cubic-bezier(.25,0,.15,1) forwards;position:relative;overflow:hidden;}',
    '.zl-bar::after{content:"";position:absolute;top:-2px;right:0;width:8px;height:7px;background:rgba(255,255,255,.9);border-radius:50%;filter:blur(3px);box-shadow:0 0 8px #00E8D4,0 0 16px rgba(0,232,212,.6);}',
    '@keyframes zl-fill{0%{width:0%}50%{width:68%}75%{width:82%}100%{width:93%}}',
    /* status row */
    '.zl-status{display:flex;align-items:center;gap:8px;animation:zl-up .5s .35s ease both;}',
    '.zl-sub{font-size:.58rem;color:rgba(90,90,120,.85);letter-spacing:.2em;font-family:"Orbitron",monospace;text-transform:uppercase;}',
    '.zl-dot{width:3px;height:3px;border-radius:50%;background:#00E8D4;animation:zl-dot-b 1.1s ease-in-out infinite;}',
    '.zl-dot:nth-child(2){animation-delay:.18s}.zl-dot:nth-child(3){animation-delay:.36s}',
    '@keyframes zl-dot-b{0%,100%{opacity:.2;transform:scale(.7)}50%{opacity:1;transform:scale(1.3)}}',
    /* particles */
    '.zl-p{position:absolute;border-radius:50%;animation:zl-pfloat linear infinite;}',
    '@keyframes zl-pfloat{0%{transform:translateY(100vh) translateX(0);opacity:0}8%{opacity:.7}92%{opacity:.15}100%{transform:translateY(-40px) translateX(var(--dx,12px));opacity:0}}',
    /* shared */
    '@keyframes zl-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}',
    '::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:rgba(255,255,255,.03)}::-webkit-scrollbar-thumb{background:rgba(0,232,212,.2);border-radius:2px}::-webkit-scrollbar-thumb:hover{background:rgba(0,232,212,.4)}',
    '::selection{background:rgba(0,232,212,.25);color:#fff}',
  ].join('');
  document.head.appendChild(css);

  const mk=(tag,cls)=>{const e=document.createElement(tag);if(cls)e.className=cls;return e;};
  const loader=mk('div');loader.id='zp-loader';

  /* nebulas */
  ['a','b'].forEach(c=>{const n=mk('div','zl-nebula '+c);loader.appendChild(n);});

  /* corners */
  ['tl','tr','bl','br'].forEach(c=>{loader.appendChild(Object.assign(mk('div','zl-corner '+c)));});

  /* orbit rings */
  ['r1','r2','r3'].forEach(c=>{
    const r=mk('div','zl-ring '+c);
    r.style.cssText='position:absolute;top:50%;left:50%;margin-top:-'+(parseInt(c[1])*30+75)+'px;margin-left:-'+(parseInt(c[1])*30+75)+'px';
    /* override margin with correct sizes */
    const sz={r1:105,r2:135,r3:165}[c];
    r.style.marginTop=r.style.marginLeft='-'+sz+'px';
    loader.appendChild(r);
  });

  /* particles */
  const pBox=mk('div');pBox.style.cssText='position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden';
  const pCols=['#00E8D4','#FF4D6D','#5B9FFF','#A78BFA','#F5D547','#FF7033'];
  for(let i=0;i<22;i++){
    const p=mk('div','zl-p');
    const sz=(.5+Math.random()*2.5).toFixed(1);
    const dx=(Math.random()*40-20).toFixed(0)+'px';
    p.style.cssText='left:'+Math.round(Math.random()*100)+'%;width:'+sz+'px;height:'+sz+'px;background:'+pCols[i%pCols.length]+';animation-duration:'+(4+Math.random()*7).toFixed(1)+'s;animation-delay:'+(Math.random()*5).toFixed(1)+'s;--dx:'+dx+';opacity:0';
    pBox.appendChild(p);
  }
  loader.appendChild(pBox);

  /* center */
  const center=mk('div','zl-center');
  const logo=mk('div','zl-logo');logo.textContent='ZapPlay';
  const tag=mk('div','zl-tag');tag.textContent='Arcade Multijoueur';
  const div=mk('div','zl-div');div.appendChild(mk('div','zl-div-dot'));
  const barWrap=mk('div','zl-bar-wrap');
  const bar=mk('div','zl-bar');barWrap.appendChild(bar);
  const status=mk('div','zl-status');
  const sub=mk('div','zl-sub');sub.textContent='Initialisation';
  [1,2,3].forEach(()=>status.appendChild(mk('div','zl-dot')));
  status.insertBefore(sub,status.firstChild);
  [logo,tag,div,barWrap,status].forEach(el=>center.appendChild(el));
  loader.appendChild(center);

  /* cycle status messages */
  const msgs=['Initialisation','Chargement','Connexion','Préparation'];
  let mi=0;
  const cycleId=setInterval(()=>{mi=(mi+1)%msgs.length;sub.textContent=msgs[mi];},900);
  loader._cycleId=cycleId;

  document.body.prepend(loader);
}

const MIN_LOADER_MS=1500;
/** Si le WS ne répond jamais, on débloque l’UI (sinon overlay bloque clavier / clic). */
const LOADER_SAFETY_MS=9000;
let loaderShownAt=0;
let loaderHideScheduled=false;
let loaderSafetyTimer=null;

function hideLoader(){
  const el=document.getElementById('zp-loader');
  if(!el)return;
  if(loaderHideScheduled)return;
  loaderHideScheduled=true;
  if(loaderSafetyTimer){ clearTimeout(loaderSafetyTimer); loaderSafetyTimer=null; }
  if(el._cycleId)clearInterval(el._cycleId);
  const elapsed=Date.now()-loaderShownAt;
  const remaining=Math.max(0,MIN_LOADER_MS-elapsed);
  setTimeout(()=>{
    el.classList.add('hide');
    setTimeout(()=>el.remove(),650);
  },remaining);
}

function showLoader(){
  injectLoader();
  loaderShownAt=Date.now();
  loaderHideScheduled=false;
  const el=document.getElementById('zp-loader');
  if(el)el.classList.remove('hide');
  if(loaderSafetyTimer) clearTimeout(loaderSafetyTimer);
  loaderSafetyTimer=setTimeout(()=>{
    loaderSafetyTimer=null;
    if(document.getElementById('zp-loader') && !loaderHideScheduled) hideLoader();
  }, LOADER_SAFETY_MS);
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

function getOrCreateDeviceId(){
  try{
    let id=localStorage.getItem(STORAGE_KEY_DEVICE);
    if(id&&/^[a-zA-Z0-9_-]{1,80}$/.test(id))return id;
    const rnd='zp'+Math.random().toString(36).slice(2)+Date.now().toString(36);
    id=rnd.slice(0,40);
    localStorage.setItem(STORAGE_KEY_DEVICE,id);
    return id;
  }catch{ return 'zp'+Date.now().toString(36); }
}

function replaceHistory(arr){
  if(!Array.isArray(arr))return;
  const clean=arr.slice(0,MAX_HISTORY).map(e=>({
    game:e.game||'?',
    gameName:e.gameName||e.game||'?',
    date:Number(e.date)||0,
    signature:String(e.signature||''),
    players:Array.isArray(e.players)?e.players:[],
    winner:e.winner==null?null:String(e.winner),
    myName:String(e.myName||getSavedPseudo()),
    myScore:Number(e.myScore)||0,
    isWinner:!!e.isWinner,
    scores:e.scores&&typeof e.scores==='object'?e.scores:{}
  })).filter(e=>e.signature);
  localStorage.setItem(STORAGE_KEY_HISTORY,JSON.stringify(clean));
}

let profileSyncTimer=null;
function scheduleProfileSync(){
  if(profileSyncTimer)return;
  profileSyncTimer=setTimeout(()=>{
    profileSyncTimer=null;
    syncProfileWithServer();
  },1200);
}

function getAccountToken(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY_ACCOUNT);
    if(!raw)return null;
    const j=JSON.parse(raw);
    return j&&j.token?String(j.token):null;
  }catch{return null;}
}

function setAccountSession(data){
  if(!data||!data.token){
    localStorage.removeItem(STORAGE_KEY_ACCOUNT);
    return;
  }
  localStorage.setItem(STORAGE_KEY_ACCOUNT,JSON.stringify({
    token:data.token,
    accountId:data.accountId,
    email:data.email,
    displayName:data.displayName
  }));
  if(data.displayName) savePseudo(data.displayName);
}

function logoutAccount(){
  localStorage.removeItem(STORAGE_KEY_ACCOUNT);
}

function syncProfileWithServer(){
  const deviceId=getOrCreateDeviceId();
  const accTok=getAccountToken();
  const body=JSON.stringify({
    deviceId,
    displayName:getSavedPseudo(),
    history:getHistory(),
    accountToken:accTok||undefined
  });
  const headers={'Content-Type':'application/json'};
  if(accTok) headers.Authorization='Bearer '+accTok;
  return fetch('/api/profile/sync',{
    method:'POST',
    headers,
    body
  }).then(r=>{
    if(!r.ok)return null;
    return r.json();
  }).then(j=>{
    if(!j||!Array.isArray(j.history))return;
    replaceHistory(j.history);
    window.dispatchEvent(new CustomEvent('zapplay-profile-synced'));
  }).catch(()=>{});
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
  scheduleProfileSync();
}

function clearHistory(){
  localStorage.removeItem(STORAGE_KEY_HISTORY);
  scheduleProfileSync();
}

function mergeHistoryArrays(a,b){
  const map=new Map();
  [...(a||[]),...(b||[])].forEach(raw=>{
    if(!raw||!raw.signature)return;
    const prev=map.get(raw.signature);
    const d=Number(raw.date)||0;
    if(!prev||(d>(prev.date||0)))map.set(raw.signature,raw);
  });
  const out=[...map.values()].sort((x,y)=>(y.date||0)-(x.date||0));
  if(out.length>MAX_HISTORY)out.length=MAX_HISTORY;
  return out;
}

function pullProfileFromServer(){
  const id=getOrCreateDeviceId();
  return fetch('/api/profile/'+encodeURIComponent(id))
    .then(r=>{ if(r.status===404)return null; return r.json(); })
    .then(j=>{
      if(!j||!Array.isArray(j.history))return;
      const merged=mergeHistoryArrays(getHistory(),j.history);
      replaceHistory(merged);
      window.dispatchEvent(new CustomEvent('zapplay-profile-synced'));
    })
    .catch(()=>{});
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

/** Accent salon / bordure — aligné sur data-zp-game (même charte partout, couleur par jeu) */
const ZP_LOUNGE_ACCENTS = {
  quiz: '#00e8d4', draw: '#fb923c', debat: '#ec4899', imposteur: '#ff4d6d',
  wordbomb: '#fbbf24', typer: '#38bdf8', anagramme: '#f472b6', justeprix: '#fbbf24',
  timeline: '#5b9fff', memoire: '#a78bfa', taboo: '#34d399', p4: '#3b82f6',
  morpion: '#34d399', emoji: '#f5d547', loup: '#dc2626', uno: '#ef4444',
  sumo: '#ec4899', paint: '#22c55e', naval: '#3b82f6', lobby: '#00e8d4',
  home: '#00e8d4', account: '#a78bfa', admin: '#f59e0b', default: '#00e8d4'
};

function zpGameKey(){
  try {
    const k = (document.documentElement.getAttribute('data-zp-game') || 'default').trim();
    return k || 'default';
  } catch (_) { return 'default'; }
}

function zpHexToRgba(hex, a){
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return 'rgba(0,232,212,' + a + ')';
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

function applyLoungeGameAccent(){
  const el = document.getElementById('zp-lounge');
  const hex = ZP_LOUNGE_ACCENTS[zpGameKey()] || ZP_LOUNGE_ACCENTS.default;
  const targets = [document.documentElement];
  if (el) targets.push(el);
  const props = {
    '--zp-lounge-accent': hex,
    '--zp-lounge-accent-22': zpHexToRgba(hex, 0.22),
    '--zp-lounge-accent-35': zpHexToRgba(hex, 0.35),
    '--zp-lounge-accent-12': zpHexToRgba(hex, 0.12),
    '--zp-lounge-accent-08': zpHexToRgba(hex, 0.08),
    '--zp-lounge-accent-45': zpHexToRgba(hex, 0.45),
    '--zp-lounge-accent-55': zpHexToRgba(hex, 0.55),
    '--zp-lounge-accent-18': zpHexToRgba(hex, 0.18),
    '--zp-lounge-accent-10': zpHexToRgba(hex, 0.1)
  };
  targets.forEach(t => {
    Object.keys(props).forEach(k => t.style.setProperty(k, props[k]));
  });
}

function ensureLoungeUI(){
  if(loungeReady)return;
  loungeReady = true;
  const css = document.createElement('style');
  css.id = 'zp-lounge-styles';
  css.textContent = `
    #zp-lounge{
      --zp-lounge-accent: #00e8d4;
      --zp-lounge-accent-22: rgba(0,232,212,.22);
      --zp-lounge-accent-35: rgba(0,232,212,.35);
      --zp-lounge-accent-12: rgba(0,232,212,.12);
      --zp-lounge-accent-08: rgba(0,232,212,.08);
      --zp-lounge-accent-45: rgba(0,232,212,.45);
      --zp-lounge-accent-55: rgba(0,232,212,.55);
      --zp-lounge-accent-18: rgba(0,232,212,.18);
      --zp-lounge-accent-10: rgba(0,232,212,.1);
      position:fixed;right:14px;bottom:max(14px, env(safe-area-inset-bottom));z-index:10240;
      width:min(480px,calc(100vw - 28px));
      font-family:'Exo 2','Segoe UI',system-ui,sans-serif;
      background:linear-gradient(165deg, rgba(14,14,28,.98), rgba(6,6,18,.99));
      border:1px solid var(--zp-lounge-accent-35);
      border-radius:18px;
      box-shadow:
        0 0 0 1px rgba(255,255,255,.05),
        0 16px 48px rgba(0,0,0,.55),
        0 0 80px var(--zp-lounge-accent-12);
      display:none;overflow:hidden;
      backdrop-filter:blur(16px) saturate(150%);
      -webkit-backdrop-filter:blur(16px) saturate(150%);
    }
    #zp-lounge.show{display:block}
    #zp-lounge[data-collapsed="1"] #zp-lounge-body{display:none}
    #zp-lounge[data-collapsed="1"] #zp-lounge-head{border-bottom:none}
    #zp-lounge-head{
      display:flex;align-items:center;justify-content:space-between;gap:10px;
      padding:11px 14px;
      background:linear-gradient(180deg, var(--zp-lounge-accent-10), rgba(255,255,255,.02));
      border-bottom:1px solid var(--zp-lounge-accent-22);
    }
    #zp-lounge-toggle{
      border:1px solid var(--zp-lounge-accent-35);
      background:rgba(255,255,255,.06);color:var(--zp-lounge-accent);
      border-radius:10px;padding:6px 12px;font-size:.72rem;font-weight:700;cursor:pointer;
      transition:background .15s,border-color .15s,transform .12s;
    }
    #zp-lounge-toggle:hover{background:var(--zp-lounge-accent-08)}
    #zp-lounge-head .t{
      font-size:.8rem;color:var(--zp-lounge-accent);font-weight:800;letter-spacing:.06em;
      text-transform:uppercase;font-family:'Orbitron',monospace,sans-serif;
    }
    #zp-lounge-head .s{font-size:.7rem;color:#9aa0b8;line-height:1.35}
    #zp-lounge-body{display:grid;grid-template-columns:1fr 1fr;gap:0;max-height:min(44vh,420px)}
    #zp-lounge-players{padding:10px 12px;border-right:1px solid rgba(255,255,255,.07);overflow:auto}
    .zp-player{
      background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
      border-radius:12px;padding:8px 10px;margin-bottom:7px;cursor:pointer;
      display:flex;gap:10px;align-items:center;transition:background .15s,border-color .15s,box-shadow .15s
    }
    .zp-player:hover{
      background:rgba(255,255,255,.05);
      border-color:var(--zp-lounge-accent-35);
    }
    .zp-player.me{
      border-color:var(--zp-lounge-accent-45);
      box-shadow:0 0 0 1px var(--zp-lounge-accent-18);
      background:var(--zp-lounge-accent-10);
    }
    .zp-player .a{
      width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;
      background:linear-gradient(135deg, var(--zp-lounge-accent), #0a3d38);
      color:#041018;font-size:.68rem;font-weight:900;flex-shrink:0;
      box-shadow:0 2px 8px var(--zp-lounge-accent-35);
    }
    .zp-player.me .a{
      background:linear-gradient(135deg, var(--zp-lounge-accent), #1a4d48);
      color:#fff;
    }
    .zp-player .n{font-size:.8rem;font-weight:700;color:#ececf4}
    .zp-player .m{font-size:.66rem;color:#8b92a8}
    #zp-lounge-chat{display:flex;flex-direction:column;min-height:176px}
    #zp-lounge-msgs{flex:1;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:6px}
    .zp-chat{font-size:.76rem;line-height:1.45}
    .zp-chat .who{color:var(--zp-lounge-accent);font-weight:800}
    .zp-chat .txt{color:#c4c8d8}
    #zp-lounge-input{display:flex;gap:8px;padding:10px 12px;border-top:1px solid rgba(255,255,255,.07)}
    #zp-lounge-input input{
      flex:1;background:rgba(255,255,255,.06);border:1px solid var(--zp-lounge-accent-22);
      border-radius:11px;padding:8px 11px;color:#ececf4;font-size:.8rem;outline:none;
      transition:border-color .15s, box-shadow .15s;
    }
    #zp-lounge-input input:focus{
      border-color:var(--zp-lounge-accent-55);
      box-shadow:0 0 0 3px var(--zp-lounge-accent-18);
    }
    #zp-lounge-input button{
      border:none;border-radius:11px;
      background:linear-gradient(135deg, var(--zp-lounge-accent), #5b9fff);
      color:#041018;
      font-size:.78rem;padding:8px 12px;cursor:pointer;font-weight:800;transition:filter .15s,transform .1s;
    }
    #zp-lounge-input button:hover{filter:brightness(1.08)}
    #zp-lounge-foot{
      display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 14px;
      border-top:1px solid rgba(255,255,255,.07);
      background:rgba(0,0,0,.2);
    }
    #zp-lounge-ready-label{font-size:.72rem;color:#8b92a8}
    #zp-lounge-ready-btn{
      border:none;border-radius:11px;padding:8px 14px;
      background:rgba(34,197,94,.2);color:#86efac;
      font-size:.74rem;font-weight:800;cursor:pointer;border:1px solid rgba(34,197,94,.35);transition:all .15s
    }
    #zp-lounge-ready-btn:hover{background:rgba(34,197,94,.32)}
    #zp-lounge-ready-btn.off{background:rgba(90,90,120,.22);color:#9ca3af;border-color:rgba(255,255,255,.08)}
    #zp-player-modal{
      position:fixed;inset:0;background:rgba(3,3,12,.55);display:none;z-index:10300;
      align-items:center;justify-content:center;backdrop-filter:blur(6px);
    }
    #zp-player-modal.show{display:flex}
    #zp-player-card{
      width:min(380px,92vw);
      background:linear-gradient(165deg, rgba(18,18,34,.98), rgba(10,10,22,.99));
      border:1px solid var(--zp-lounge-accent-35);
      border-radius:16px;padding:18px;
      box-shadow:0 24px 64px rgba(0,0,0,.5), 0 0 60px var(--zp-lounge-accent-10);
    }
    #zp-player-card .n{font-size:1.05rem;font-weight:900;color:#ececf4;font-family:'Orbitron',monospace,sans-serif}
    #zp-player-card .m{font-size:.8rem;color:#8b92a8;margin-top:6px;line-height:1.4}
    @media (max-width: 760px){
      #zp-lounge{left:14px;right:14px;width:auto}
      #zp-lounge-body{grid-template-columns:1fr}
      #zp-lounge-players{border-right:none;border-bottom:1px solid rgba(255,255,255,.08)}
      #zp-lounge-input input,#zp-lounge-input button,#zp-lounge-ready-btn{font-size:.9rem;padding:10px 12px}
      #zp-lounge-msgs{max-height:min(34vh,280px)}
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
  applyLoungeGameAccent();
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
  applyLoungeGameAccent();
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

function computeBadges(stats, history){
  const h=history||[];
  const games=stats.games||0;
  const wins=stats.wins||0;
  let streak=0;
  for(let i=0;i<h.length;i++){
    if(h[i].isWinner)streak++;
    else break;
  }
  const uniq=new Set(h.map(g=>g.game).filter(Boolean));
  const wr=games?Math.round(wins/games*100):0;
  const out=[];
  if(games>=1)out.push({id:'first',label:'Première partie',icon:'🎮'});
  if(games>=10)out.push({id:'regular',label:'Joueur régulier',icon:'⭐'});
  if(games>=50)out.push({id:'vet',label:'Vétéran',icon:'🏆'});
  if(wins>=5)out.push({id:'w5',label:'Premiers succès',icon:'✅'});
  if(wins>=25)out.push({id:'w25',label:'Serial winner',icon:'👑'});
  if(streak>=3)out.push({id:'st3',label:'En feu',icon:'🔥'});
  if(streak>=5)out.push({id:'st5',label:'Série invincible',icon:'💥'});
  if(uniq.size>=5)out.push({id:'poly',label:'Polyvalent',icon:'🎯'});
  if(games>=10&&wr>=50)out.push({id:'prec',label:'Précis',icon:'🎲'});
  return out;
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
  const badges=computeBadges(stats,history);

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
    </div>`;
  if(badges.length){
    html+=`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px" title="Badges débloqués selon ton activité">`;
    badges.forEach(b=>{
      html+=`<span style="display:inline-flex;align-items:center;gap:4px;padding:5px 9px;border-radius:999px;font-size:.68rem;font-weight:700;background:rgba(0,232,212,.08);border:1px solid rgba(0,232,212,.22);color:#c8fff8">${b.icon} ${escapeHtml(b.label)}</span>`;
    });
    html+=`</div>`;
  }
  html+=`
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
      <div style="flex:1;min-width:80px;background:rgba(91,159,255,.1);border:1px solid rgba(91,159,255,.25);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:1.6rem;font-weight:800;color:#60a5fa">${streak}</div>
        <div style="font-size:.72rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">Série</div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin:-2px 0 10px">
      <button id="zp-export-history-btn" style="background:rgba(91,159,255,.12);border:1px solid rgba(91,159,255,.3);color:#93c5fd;border-radius:8px;padding:6px 10px;font-size:.72rem;cursor:pointer">
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
    /* ── overlay ── */
    '#zp-welcome{position:fixed;inset:0;z-index:99998;background:#03030A;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;}',
    '#zp-welcome.hide{animation:wc-out .75s cubic-bezier(.4,0,1,1) forwards;pointer-events:none;}',
    '@keyframes wc-out{0%{opacity:1;filter:blur(0)}60%{opacity:.8;filter:blur(2px)}100%{opacity:0;filter:blur(8px);transform:scale(1.04)}}',
    /* animated grid */
    '#zp-welcome::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(0,232,212,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,232,212,.03) 1px,transparent 1px);background-size:48px 48px;animation:wc-grid 12s linear infinite;}',
    '@keyframes wc-grid{0%{transform:translateY(0)}100%{transform:translateY(48px)}}',
    /* reveal scan (runs once on entry) */
    '.wc-scan-line{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(0,232,212,.9),transparent);box-shadow:0 0 24px rgba(0,232,212,.7);z-index:10;animation:wc-scan-once 1s ease-out both;pointer-events:none;}',
    '@keyframes wc-scan-once{0%{top:0;opacity:1}90%{opacity:.8}100%{top:100vh;opacity:0}}',
    /* recurring scan beam */
    '.wc-beam{position:absolute;left:0;right:0;height:180px;background:linear-gradient(transparent,rgba(0,232,212,.04),transparent);animation:wc-beam-loop 4s linear 1.2s infinite;pointer-events:none;}',
    '@keyframes wc-beam-loop{0%{top:-180px;opacity:0}5%{opacity:1}95%{opacity:.5}100%{top:100vh;opacity:0}}',
    /* nebulas */
    '.wc-neb{position:absolute;border-radius:50%;pointer-events:none;filter:blur(80px);}',
    '.wc-neb.a{width:600px;height:600px;background:radial-gradient(circle,rgba(0,232,212,.1) 0%,transparent 65%);top:50%;left:50%;transform:translate(-50%,-60%);animation:wc-neb-p 6s ease-in-out infinite;}',
    '.wc-neb.b{width:400px;height:400px;background:radial-gradient(circle,rgba(168,85,247,.08) 0%,transparent 65%);top:70%;left:60%;transform:translate(-50%,-50%);animation:wc-neb-p 8s ease-in-out 1s infinite reverse;}',
    '@keyframes wc-neb-p{0%,100%{opacity:.5;transform:translate(-50%,-60%) scale(1)}50%{opacity:.9;transform:translate(-50%,-60%) scale(1.2)}}',
    /* stars */
    '.wc-star{position:absolute;border-radius:50%;background:#fff;animation:wc-twinkle ease-in-out infinite;}',
    '@keyframes wc-twinkle{0%,100%{opacity:.05}50%{opacity:.7}}',
    /* corners */
    '.wc-corner{position:absolute;width:44px;height:44px;border-color:rgba(0,232,212,.45);border-style:solid;animation:wc-ci .6s ease both;}',
    '.wc-corner.tl{top:18px;left:18px;border-width:2px 0 0 2px;animation-delay:.3s}',
    '.wc-corner.tr{top:18px;right:18px;border-width:2px 2px 0 0;animation-delay:.4s}',
    '.wc-corner.bl{bottom:18px;left:18px;border-width:0 0 2px 2px;animation-delay:.35s}',
    '.wc-corner.br{bottom:18px;right:18px;border-width:0 2px 2px 0;animation-delay:.45s}',
    '@keyframes wc-ci{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:scale(1)}}',
    /* side tick marks */
    '.wc-tick{position:absolute;background:rgba(0,232,212,.25);}',
    '.wc-tick.v{width:1px;height:28px;}.wc-tick.h{width:28px;height:1px;}',
    '.wc-tick.lt{top:50%;left:18px;transform:translateY(-50%);animation:wc-ci .6s .5s ease both}',
    '.wc-tick.rt{top:50%;right:18px;transform:translateY(-50%);animation:wc-ci .6s .5s ease both}',
    '.wc-tick.tb{left:50%;top:18px;transform:translateX(-50%);animation:wc-ci .6s .55s ease both}',
    '.wc-tick.bb{left:50%;bottom:18px;transform:translateX(-50%);animation:wc-ci .6s .55s ease both}',
    /* particles */
    '.wc-p{position:absolute;border-radius:50%;animation:wc-float linear infinite;}',
    '@keyframes wc-float{0%{transform:translateY(100vh) translateX(0);opacity:0}8%{opacity:.6}92%{opacity:.15}100%{transform:translateY(-50px) translateX(var(--dx,10px));opacity:0}}',
    /* content wrapper */
    '.wc-content{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;text-align:center;padding:0 20px;width:100%;max-width:440px;}',
    /* eyebrow */
    '.wc-eyebrow{font-family:"Orbitron",monospace;font-size:.5rem;font-weight:700;letter-spacing:.55em;text-transform:uppercase;color:rgba(0,232,212,.4);margin-bottom:12px;animation:wc-up .5s .4s ease both;}',
    '@keyframes wc-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}',
    /* logo */
    '.wc-logo{font-family:"Orbitron",monospace;font-weight:900;font-size:clamp(3.2rem,14vw,5.8rem);letter-spacing:.06em;color:#00E8D4;text-shadow:0 0 20px rgba(0,232,212,1),0 0 60px rgba(0,232,212,.5),0 0 120px rgba(0,232,212,.2),0 0 200px rgba(0,232,212,.08);animation:wc-logo-in .8s .5s cubic-bezier(.2,0,.2,1) both,wc-glitch 6s 2.5s infinite;margin-bottom:4px;}',
    '@keyframes wc-logo-in{from{opacity:0;transform:scale(.8) translateY(12px);filter:blur(6px)}to{opacity:1;transform:scale(1) translateY(0);filter:blur(0)}}',
    '@keyframes wc-glitch{0%,85%,100%{transform:translate(0);filter:none}86%{transform:translate(-5px,2px);filter:hue-rotate(-40deg) brightness(1.2)}87%{transform:translate(5px,-2px);filter:hue-rotate(40deg)}88%{transform:translate(0);filter:none}89%{transform:translate(3px,3px);filter:brightness(1.4)}90%{transform:translate(0);filter:none}}',
    /* logo underline */
    '.wc-logo-line{display:flex;align-items:center;gap:10px;width:280px;margin:0 auto 6px;animation:wc-up .5s .7s ease both;}',
    '.wc-logo-line::before,.wc-logo-line::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(0,232,212,.35));}',
    '.wc-logo-line::after{background:linear-gradient(90deg,rgba(0,232,212,.35),transparent);}',
    '.wc-logo-line-dot{width:4px;height:4px;border-radius:50%;background:#00E8D4;box-shadow:0 0 6px #00E8D4;}',
    /* subtitle */
    '.wc-sub{font-family:"Exo 2",sans-serif;font-size:.78rem;font-weight:500;letter-spacing:.25em;text-transform:uppercase;color:rgba(90,90,120,.8);margin-bottom:32px;animation:wc-up .5s .78s ease both;}',
    /* card with animated gradient border */
    '.wc-card-wrap{position:relative;width:100%;border-radius:20px;padding:1px;background:linear-gradient(135deg,rgba(0,232,212,.5),rgba(168,85,247,.3),rgba(91,159,255,.4),rgba(0,232,212,.5));background-size:300% 300%;animation:wc-up .7s .85s cubic-bezier(.2,0,.2,1) both,wc-border-rot 5s linear 1.6s infinite;}',
    '@keyframes wc-border-rot{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}',
    '.wc-card{background:#09091A;border-radius:19px;padding:30px 30px 28px;width:100%;}',
    '.wc-card-title{font-family:"Orbitron",monospace;font-size:.75rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#00E8D4;margin-bottom:6px;}',
    '.wc-card-hint{font-family:"Exo 2",sans-serif;font-size:.72rem;color:rgba(90,90,120,.85);letter-spacing:.04em;line-height:1.6;margin-bottom:22px;}',
    /* input */
    '.wc-inp-wrap{position:relative;margin-bottom:12px;}',
    '.wc-inp{width:100%;background:rgba(0,0,0,.5);border:1px solid rgba(0,232,212,.2);border-radius:10px;padding:14px 18px;font-family:"Exo 2",sans-serif;font-size:1rem;font-weight:600;color:#E8E8F0;outline:none;text-align:center;letter-spacing:.05em;transition:border-color .25s,box-shadow .25s,background .25s;animation:wc-pulse-b 3s 2.2s ease-in-out infinite;}',
    '.wc-inp::placeholder{color:rgba(90,90,120,.55);}',
    '.wc-inp:focus{border-color:rgba(0,232,212,.8);box-shadow:0 0 0 3px rgba(0,232,212,.1),0 0 30px rgba(0,232,212,.18);background:rgba(0,232,212,.04);animation:none;}',
    '@keyframes wc-pulse-b{0%,100%{border-color:rgba(0,232,212,.2)}50%{border-color:rgba(0,232,212,.5);box-shadow:0 0 16px rgba(0,232,212,.1)}}',
    '.wc-inp.wc-shake{animation:wc-shk .4s ease !important;}',
    '@keyframes wc-shk{0%,100%{transform:translateX(0)}20%{transform:translateX(-9px)}40%{transform:translateX(9px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}',
    /* char counter */
    '.wc-counter{position:absolute;right:12px;top:50%;transform:translateY(-50%);font-family:"Orbitron",monospace;font-size:.5rem;color:rgba(90,90,120,.5);letter-spacing:.05em;pointer-events:none;}',
    /* button */
    '.wc-btn{width:100%;background:linear-gradient(135deg,rgba(0,232,212,.18),rgba(91,159,255,.1));border:1px solid rgba(0,232,212,.4);border-radius:10px;padding:15px;font-family:"Orbitron",monospace;font-size:.76rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#00E8D4;cursor:pointer;transition:box-shadow .2s,transform .15s,border-color .2s;position:relative;overflow:hidden;}',
    '.wc-btn:hover{box-shadow:0 0 32px rgba(0,232,212,.32),0 0 70px rgba(0,232,212,.12);border-color:rgba(0,232,212,.7);transform:translateY(-2px);}',
    '.wc-btn:active{transform:scale(.97) translateY(0);}',
    /* continuous sweep on button */
    '.wc-btn::after{content:"";position:absolute;top:0;left:-70%;width:50%;height:100%;background:linear-gradient(90deg,transparent,rgba(0,232,212,.25),transparent);animation:wc-sweep 2.8s ease-in-out 2s infinite;}',
    '@keyframes wc-sweep{0%{left:-70%}100%{left:130%}}',
    /* burst */
    '.wc-burst{position:fixed;border-radius:50%;pointer-events:none;animation:wc-burst-a var(--dur,.9s) ease-out forwards;}',
    '@keyframes wc-burst-a{0%{transform:translate(0,0) scale(1) rotate(0deg);opacity:1}100%{transform:var(--tx) scale(0) rotate(var(--rot,180deg));opacity:0}}',
    /* greeting */
    '.wc-greet{position:absolute;z-index:10;font-family:"Orbitron",monospace;font-size:clamp(1.1rem,4.5vw,1.6rem);font-weight:900;letter-spacing:.06em;color:#00E8D4;text-shadow:0 0 30px rgba(0,232,212,.9),0 0 80px rgba(0,232,212,.4);opacity:0;text-align:center;padding:0 20px;transition:opacity .5s,transform .5s;transform:scale(.85);}',
    '.wc-greet.show{opacity:1;transform:scale(1);}',
  ].join('');
  document.head.appendChild(css);

  const ov=document.createElement('div');ov.id='zp-welcome';

  /* scan line (once) */
  const sl=document.createElement('div');sl.className='wc-scan-line';ov.appendChild(sl);
  const beam=document.createElement('div');beam.className='wc-beam';ov.appendChild(beam);

  /* nebulas */
  ['a','b'].forEach(c=>{const n=document.createElement('div');n.className='wc-neb '+c;ov.appendChild(n);});

  /* corners */
  ['tl','tr','bl','br'].forEach(c=>{const d=document.createElement('div');d.className='wc-corner '+c;ov.appendChild(d);});

  /* tick marks */
  [{cl:'v lt'},{cl:'v rt'},{cl:'h tb'},{cl:'h bb'}].forEach(o=>{
    const t=document.createElement('div');t.className='wc-tick '+o.cl;ov.appendChild(t);
  });

  /* stars */
  for(let i=0;i<55;i++){
    const s=document.createElement('div');s.className='wc-star';
    const sz=(.5+Math.random()*1.2).toFixed(1);
    s.style.cssText='left:'+Math.random()*100+'%;top:'+Math.random()*100+'%;width:'+sz+'px;height:'+sz+'px;animation-duration:'+(2+Math.random()*4).toFixed(1)+'s;animation-delay:'+(Math.random()*5).toFixed(1)+'s';
    ov.appendChild(s);
  }

  /* particles */
  const pCols=['#00E8D4','#FF4D6D','#5B9FFF','#A78BFA','#F5D547','#FF7033','#22C55E'];
  for(let i=0;i<26;i++){
    const p=document.createElement('div');p.className='wc-p';
    const sz=(.4+Math.random()*2.8).toFixed(1);
    const dx=(Math.random()*40-20).toFixed(0)+'px';
    p.style.cssText='left:'+Math.round(Math.random()*100)+'%;width:'+sz+'px;height:'+sz+'px;background:'+pCols[i%pCols.length]+';animation-duration:'+(5+Math.random()*9).toFixed(1)+'s;animation-delay:'+(Math.random()*8).toFixed(1)+'s;--dx:'+dx+';opacity:0';
    ov.appendChild(p);
  }

  /* content */
  const cont=document.createElement('div');cont.className='wc-content';
  cont.innerHTML=
    '<div class="wc-eyebrow">— Première connexion —</div>'
    +'<div class="wc-logo">ZapPlay</div>'
    +'<div class="wc-logo-line"><span class="wc-logo-line-dot"></span></div>'
    +'<div class="wc-sub">Arcade Multijoueur · En ligne</div>'
    +'<div class="wc-card-wrap"><div class="wc-card">'
      +'<div class="wc-card-title">Choisis ton pseudo</div>'
      +'<div class="wc-card-hint">Il sera visible dans tous les jeux &amp; le chat.<br>Tu pourras le changer depuis ton profil.</div>'
      +'<div class="wc-inp-wrap">'
        +'<input id="wc-inp" class="wc-inp" type="text" placeholder="Ex : FlashZap, NeonRider…" maxlength="20" autocomplete="off" spellcheck="false">'
        +'<span class="wc-counter" id="wc-cnt">0/20</span>'
      +'</div>'
      +'<button id="wc-btn" class="wc-btn">Entrer dans l\'arène ⚡</button>'
    +'</div></div>';
  ov.appendChild(cont);

  const greet=document.createElement('div');greet.className='wc-greet';ov.appendChild(greet);
  document.body.prepend(ov);

  /* char counter */
  const inpEl=document.getElementById('wc-inp');
  const cntEl=document.getElementById('wc-cnt');
  if(inpEl&&cntEl){
    inpEl.addEventListener('input',()=>{
      const n=inpEl.value.length;
      cntEl.textContent=n+'/20';
      cntEl.style.color=n>16?'rgba(255,107,53,.7)':'rgba(90,90,120,.5)';
    });
  }
  setTimeout(()=>{if(inpEl)inpEl.focus();},1000);

  function spawnBurst(cx,cy){
    const bc=['#00E8D4','#FF4D6D','#F5D547','#5B9FFF','#A78BFA','#FF7033','#22C55E','#fff'];
    for(let i=0;i<40;i++){
      const bp=document.createElement('div');bp.className='wc-burst';
      const ang=(i/40)*Math.PI*2+Math.random()*.3;
      const dist=50+Math.random()*120;
      const sz=Math.random()<.3?Math.random()*8+4:Math.random()*4+2;
      const dur=(.6+Math.random()*.5).toFixed(2)+'s';
      const rot=(Math.random()*360).toFixed(0)+'deg';
      bp.style.cssText='left:'+cx+'px;top:'+cy+'px;width:'+sz+'px;height:'+sz+'px;background:'+bc[i%bc.length]+';--tx:translate('+Math.cos(ang)*dist+'px,'+Math.sin(ang)*dist+'px);--dur:'+dur+';--rot:'+rot+';border-radius:'+(Math.random()<.4?'2px':'50%');
      document.body.appendChild(bp);
      setTimeout(()=>bp.remove(),1100);
    }
  }

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
      spawnBurst(r.left+r.width/2, r.top+r.height/2);
      /* second wave slightly delayed */
      setTimeout(()=>spawnBurst(r.left+r.width/2, r.top+r.height/2),180);
    }
    /* fade content, show greeting */
    cont.style.cssText='opacity:0;transform:scale(.94) translateY(-6px);transition:opacity .4s,transform .4s;pointer-events:none;';
    greet.textContent='Bienvenue, '+val+' !';
    setTimeout(()=>greet.classList.add('show'),120);
    setTimeout(()=>{
      ov.classList.add('hide');
      setTimeout(()=>{ov.remove();const c=document.getElementById('zp-welcome-css');if(c)c.remove();},800);
      renderHistoryWidget('history-widget');
      renderSocialWidget('social-widget');
    },1400);
  }

  const btn=document.getElementById('wc-btn');if(btn)btn.addEventListener('click',submit);
  if(inpEl)inpEl.addEventListener('keydown',e=>{if(e.key==='Enter')submit();});
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
  initAdminNavVisibility();
  autoFillPseudo();
  hookPseudoInputs();
  getOrCreateDeviceId();
  pullProfileFromServer().then(()=>syncProfileWithServer());
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
    document.addEventListener('zapplay-profile-synced', ()=>{
      renderHistoryWidget('history-widget');
    });
  }
  // Auto-hide loader after 5s max
  if(!isIndex)setTimeout(hideLoader,8000);
}

/**
 * Affiche les liens « Admin » seulement si un mot de passe admin est mémorisé et accepté par le serveur.
 */
function initAdminNavVisibility(){
  const pwd = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY_ADMIN)) || '';
  const links = document.querySelectorAll('a.zp-admin-nav');
  const lobbyLines = document.querySelectorAll('.lobby-admin-line');
  if(!pwd || !links.length){
    links.forEach(a => { a.setAttribute('aria-hidden', 'true'); });
    return;
  }
  fetch('/api/admin/ping', { headers: { Authorization: 'Bearer ' + pwd, 'X-Admin-Password': pwd } })
    .then(r => {
      if(r.status !== 200) throw new Error('bad');
      return r.json();
    })
    .then(() => {
      links.forEach(a => {
        a.classList.add('zp-admin-visible');
        a.removeAttribute('aria-hidden');
      });
      lobbyLines.forEach(el => el.classList.add('zp-admin-unlocked'));
    })
    .catch(() => {
      links.forEach(a => { a.setAttribute('aria-hidden', 'true'); });
    });
}

window.ZapPlay={
  getSavedPseudo,savePseudo,
  getOrCreateDeviceId,syncProfileWithServer,pullProfileFromServer,
  getAccountToken,setAccountSession,logoutAccount,
  computeBadges,
  hideLoader,showLoader,
  saveGameResult,getHistory,getStats,renderHistoryWidget,clearHistory,exportHistory,
  renderSocialWidget,
  showLounge,hideLounge,setLoungeSender,addLoungeMessage,
  showWelcomeScreen,
  initAdminNavVisibility
};

})();
