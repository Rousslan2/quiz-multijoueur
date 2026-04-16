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
//  0. I18N — SYSTÈME DE TRADUCTION (FR / EN)
// ═══════════════════════════════════════════════════════
const STORAGE_KEY_LANG = 'zapplay_lang';
let currentLang = localStorage.getItem(STORAGE_KEY_LANG) || 'fr';

const LANGS = {
fr:{
  l_tag:'Arcade Multijoueur',l_init:'Initialisation',l_load:'Chargement',l_conn:'Connexion',l_prep:'Préparation',
  w_eye:'— Première connexion —',w_sub:'Arcade Multijoueur · En ligne',
  w_ctit:'Choisis ton pseudo',w_chint:'Il sera visible dans tous les jeux &amp; le chat.<br>Tu pourras le changer depuis ton profil.',
  w_ph:'Ex : FlashZap, NeonRider…',w_btn:"Entrer dans l'arène ⚡",w_greet:'Bienvenue, {n} !',
  lo_t:'Salon',lo_w:'En attente…',lo_red:'Réduire',lo_open:'Ouvrir',
  lo_ph:'Message salon...',lo_send:'Envoyer',
  lo_sw:'Statut: en attente',lo_sr:'Statut: prêt ✅',lo_npr:'Pas prêt',lo_pr:'Prêt',lo_self:'(toi)',
  lo_joueurs:'joueur(s)',
  s_empty:'Aucune partie jouée pour l\'instant.<br>Lancez-vous !',
  s_win:'Victoire',s_loss:'Défaite',s_none:'Aucune partie',
  s_last:'Dernier résultat:',s_best:'Meilleur jeu',
  s_games:'Parties',s_wins:'Victoires',s_wr:'Win rate',s_str:'Série',
  s_exp:'Exporter JSON',s_clr:'Effacer l\'historique',
  s_clrq:'Effacer tout l\'historique des parties ?',
  s_week:'Classement hebdo',s_noweek:'Aucune partie cette semaine.',
  s_pts:'pts',s_parts:'partie(s)',s_vicw:'victoire(s) sur 7 jours',
  s_more:'… et {n} autre(s)',s_v:'V',s_p:'P',
  p_tit:'Mon profil',p_ph:'Pseudo',p_save:'Enregistrer',
  p_bio:'Petite bio (optionnel)',p_friends:'La section amis et demandes d\'ami a été désactivée.',
  pr_me:'Ton profil',pr_other:'Joueur du salon',pr_on:'En ligne',pr_off:'Hors ligne',
  room_0:'{n} salle en ligne',room_1:'{n} salle en ligne',room_n:'{n} salles en ligne',
  idx_eye:'— Bienvenue sur —',idx_line:'Arcade Multijoueur',
  idx_tag:'Jouez ensemble · En temps réel',idx_sec:'Jeux disponibles',
  idx_ps:'📊 Mes statistiques',idx_pp:'👤 Profil joueur',
  idx_foot:'ZapPlay · Arcade multijoueur',
  g_quiz_n:'Quiz Éclair',g_quiz_d:'Buzzez le premier et répondez ! 15 questions, 9 catégories.',g_quiz_b:'Buzz · 2–4 joueurs',
  g_draw_n:'Dessin &amp; Devine',g_draw_d:'Dessinez et faites deviner votre partenaire !',g_draw_b:'6 manches · Chill',
  g_p4_n:'Puissance 4',g_p4_d:'Alignez 4 pions avant votre adversaire !',g_p4_b:'Stratégie · Tour/tour',
  g_morp_n:'Morpion',g_morp_d:'Tic-tac-toe en ligne, best of 5 !',g_morp_b:'Best of 5',
  g_tab_n:'Mots Interdits',g_tab_d:'Faites deviner sans prononcer les mots tabous !',g_tab_b:'8 manches',
  g_emo_n:'Devinette Emoji',g_emo_d:'Devinez le film ou la chanson en emojis !',g_emo_b:'15 devinettes',
  g_loup_n:'Loup-Garou',g_loup_d:'Loups contre villageois, rôles secrets chaque nuit !',g_loup_b:'4–10 joueurs · Rôles',
  g_uno_n:'Uno',g_uno_d:'Le classique des cartes ! Videz votre main en premier.',g_uno_b:'2–4 joueurs · Cartes',
  g_bomb_n:'Word Bomb',g_bomb_d:"Trouve un mot avec la syllabe avant l'explosion.",g_bomb_b:'2–6 joueurs · Vitesse',
  g_sumo_n:'Sumo Arena',g_sumo_d:'Pousse tes adversaires hors du ring !',g_sumo_b:'2–4 joueurs · Combat',
  g_paint_n:'Paint.io',g_paint_d:'Capture le plus de territoire sans te faire couper !',g_paint_b:'2–4 joueurs · Survie',
  g_naval_n:'Bataille navale',g_naval_d:'Place ta flotte puis coule tous les navires adverses !',g_naval_b:'2–4 joueurs · Stratégie',
  g_typer_n:'Typer Race',g_typer_d:'Tape le texte le plus vite ! Qui finira 1er sur 5 manches ?',g_typer_b:'2–4 joueurs · Vitesse',
  g_ana_n:'Anagramme',g_ana_d:'Déchiffre les lettres mélangées avant les autres ! 8 manches.',g_ana_b:'2–4 joueurs · Mots',
  g_prix_n:'Juste Prix',g_prix_d:'Estimez le prix ou la valeur — le plus proche gagne !',g_prix_b:'8 manches · Estimation',
  g_time_n:'Timeline',g_time_d:'Quel événement s\'est produit en premier ? Histoire &amp; culture.',g_time_b:'10 manches · Histoire',
  g_mem_n:'Mémoire',g_mem_d:'Retourne les cartes et retrouve les paires ! Tour par tour.',g_mem_b:'2–4 joueurs · Mémoire',
  g_imp_n:'Imposteur',g_imp_d:'Un mot secret, un traître parmi vous. Décrivez, bluffez, démasquez !',g_imp_b:'3–8 joueurs · Bluff',
  g_lob_n:'Salles en ligne',g_lob_d:'Créez ou rejoignez une salle, voyez les parties en cours en temps réel !',g_lob_b:'Lobby · Temps réel',

  // Lobby page
  lobby_back:'Accueil',
  lobby_title:'Salles en ligne',
  lobby_rt:'Temps réel',
  lobby_create:'Créer une salle',
  lobby_create_desc:'Choisissez un jeu et partagez le code.',
  lobby_your_name_ph:'Votre prénom',
  lobby_create_btn:'Créer la salle',
  lobby_room_code:'Code de la salle',
  lobby_copy:'Cliquer pour copier',
  lobby_join:'Rejoindre',
  lobby_join_desc:"Entrez le code 4 lettres partagé par l'hôte.",
  lobby_join_btn:'Rejoindre',
  lobby_rooms:'Salles disponibles',

  // Chat global
  chat_title:'Chat',
  chat_online:'● en ligne',
  chat_name_ph:'Votre pseudo...',
  chat_reconnect:'Reconnexion...',
  chat_msg_ph:'Message...',

  // Imposteur
  imp_home_back:'Accueil',
  imp_wait_msg:'En attente des joueurs (3–8)…',
  imp_waiting_others:'En attente des autres joueurs…',
  imp_waiting_host:'En attente de l’hôte…',
  imp_gameover_title:'Fin de partie !',
  imp_rank:'Classement',
  imp_replay:'Rejouer',
  imp_quit:'Quitter',

  // Word Bomb
  bomb_back:'Accueil',
  bomb_name_ph:'Ton pseudo',
  bomb_create:'Créer une salle',
  bomb_join_code:'Rejoindre (code)',
  bomb_join:'Rejoindre',
  bomb_home:'Accueil',
},
en:{
  l_tag:'Multiplayer Arcade',l_init:'Initializing',l_load:'Loading',l_conn:'Connecting',l_prep:'Preparing',
  w_eye:'— First connection —',w_sub:'Multiplayer Arcade · Online',
  w_ctit:'Choose your username',w_chint:'It will be visible in all games &amp; chat.<br>You can change it from your profile.',
  w_ph:'E.g.: FlashZap, NeonRider…',w_btn:'Enter the arena ⚡',w_greet:'Welcome, {n}!',
  lo_t:'Lounge',lo_w:'Waiting…',lo_red:'Minimize',lo_open:'Expand',
  lo_ph:'Lounge message...',lo_send:'Send',
  lo_sw:'Status: waiting',lo_sr:'Status: ready ✅',lo_npr:'Not ready',lo_pr:'Ready',lo_self:'(you)',
  lo_joueurs:'player(s)',
  s_empty:'No games played yet.<br>Let\'s go!',
  s_win:'Victory',s_loss:'Defeat',s_none:'No games',
  s_last:'Last result:',s_best:'Best game',
  s_games:'Games',s_wins:'Wins',s_wr:'Win rate',s_str:'Streak',
  s_exp:'Export JSON',s_clr:'Clear history',
  s_clrq:'Clear all game history?',
  s_week:'Weekly ranking',s_noweek:'No games this week.',
  s_pts:'pts',s_parts:'game(s)',s_vicw:'win(s) over 7 days',
  s_more:'… and {n} more',s_v:'W',s_p:'P',
  p_tit:'My profile',p_ph:'Username',p_save:'Save',
  p_bio:'Short bio (optional)',p_friends:'The friends section has been disabled.',
  pr_me:'Your profile',pr_other:'Room player',pr_on:'Online',pr_off:'Offline',
  room_0:'{n} room online',room_1:'{n} room online',room_n:'{n} rooms online',
  idx_eye:'— Welcome to —',idx_line:'Multiplayer Arcade',
  idx_tag:'Play together · In real time',idx_sec:'Available games',
  idx_ps:'📊 My statistics',idx_pp:'👤 Player profile',
  idx_foot:'ZapPlay · Multiplayer arcade',
  g_quiz_n:'Flash Quiz',g_quiz_d:'Buzz first and answer! 15 questions, 9 categories.',g_quiz_b:'Buzz · 2–4 players',
  g_draw_n:'Draw &amp; Guess',g_draw_d:'Draw and make your partner guess!',g_draw_b:'6 rounds · Chill',
  g_p4_n:'Connect 4',g_p4_d:'Line up 4 pieces before your opponent!',g_p4_b:'Strategy · Turn-based',
  g_morp_n:'Tic-Tac-Toe',g_morp_d:'Classic tic-tac-toe online, best of 5!',g_morp_b:'Best of 5',
  g_tab_n:'Taboo',g_tab_d:'Make them guess without saying the forbidden words!',g_tab_b:'8 rounds',
  g_emo_n:'Emoji Quiz',g_emo_d:'Guess the movie or song from emojis!',g_emo_b:'15 riddles',
  g_loup_n:'Werewolf',g_loup_d:'Wolves vs villagers, secret roles every night!',g_loup_b:'4–10 players · Roles',
  g_uno_n:'Uno',g_uno_d:'The classic card game! Empty your hand first.',g_uno_b:'2–4 players · Cards',
  g_bomb_n:'Word Bomb',g_bomb_d:'Find a word with the syllable before it explodes.',g_bomb_b:'2–6 players · Speed',
  g_sumo_n:'Sumo Arena',g_sumo_d:'Push your opponents out of the ring!',g_sumo_b:'2–4 players · Combat',
  g_paint_n:'Paint.io',g_paint_d:'Capture the most territory without getting cut!',g_paint_b:'2–4 players · Survival',
  g_naval_n:'Battleship',g_naval_d:'Place your fleet then sink all enemy ships!',g_naval_b:'2–4 players · Strategy',
  g_typer_n:'Typer Race',g_typer_d:'Type the fastest! Who finishes 1st over 5 rounds?',g_typer_b:'2–4 players · Speed',
  g_ana_n:'Anagram',g_ana_d:'Unscramble the letters before the others! 8 rounds.',g_ana_b:'2–4 players · Words',
  g_prix_n:'Price is Right',g_prix_d:'Estimate the price or value — closest wins!',g_prix_b:'8 rounds · Estimation',
  g_time_n:'Timeline',g_time_d:'Which event happened first? History &amp; culture.',g_time_b:'10 rounds · History',
  g_mem_n:'Memory',g_mem_d:'Flip cards and find the pairs! Turn by turn.',g_mem_b:'2–4 players · Memory',
  g_imp_n:'Impostor',g_imp_d:'A secret word, a traitor among you. Describe, bluff, expose!',g_imp_b:'3–8 players · Bluff',
  g_lob_n:'Online Rooms',g_lob_d:'Create or join a room, see live games in real time!',g_lob_b:'Lobby · Real time',

  // Lobby page
  lobby_back:'Home',
  lobby_title:'Online rooms',
  lobby_rt:'Real-time',
  lobby_create:'Create a room',
  lobby_create_desc:'Choose a game and share the code.',
  lobby_your_name_ph:'Your name',
  lobby_create_btn:'Create room',
  lobby_room_code:'Room code',
  lobby_copy:'Click to copy',
  lobby_join:'Join',
  lobby_join_desc:'Enter the 4-letter code shared by the host.',
  lobby_join_btn:'Join',
  lobby_rooms:'Available rooms',

  // Global chat
  chat_title:'Chat',
  chat_online:'● online',
  chat_name_ph:'Your name...',
  chat_reconnect:'Reconnecting...',
  chat_msg_ph:'Message...',

  // Impostor
  imp_home_back:'Home',
  imp_wait_msg:'Waiting for players (3–8)…',
  imp_waiting_others:'Waiting for other players…',
  imp_waiting_host:'Waiting for host…',
  imp_gameover_title:'Game over!',
  imp_rank:'Ranking',
  imp_replay:'Play again',
  imp_quit:'Quit',

  // Word Bomb
  bomb_back:'Home',
  bomb_name_ph:'Your name',
  bomb_create:'Create room',
  bomb_join_code:'Join (code)',
  bomb_join:'Join',
  bomb_home:'Home',
}};

function t(key,vars){
  const d=LANGS[currentLang]||LANGS.fr;
  let s=d[key]!==undefined?d[key]:(LANGS.fr[key]!==undefined?LANGS.fr[key]:key);
  if(vars)Object.keys(vars).forEach(k=>{s=s.replace('{'+k+'}',vars[k]);});
  return s;
}

function roomsLabel(n){
  if(n===0)return t('room_0',{n:0});
  if(n===1)return t('room_1',{n:1});
  return t('room_n',{n});
}

function setLang(lang){
  if(!LANGS[lang])return;
  currentLang=lang;
  localStorage.setItem(STORAGE_KEY_LANG,lang);
  const btn=document.getElementById('zp-lang-btn');
  if(btn){btn.textContent=lang==='fr'?'EN':'FR';btn.setAttribute('data-lang',lang);}
  applyLang();
  renderHistoryWidget('history-widget');
  renderSocialWidget('social-widget');
  try{ window.dispatchEvent(new CustomEvent('zapplay:lang', { detail:{ lang: currentLang } })); }catch{}
}

function applyLang(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    el.innerHTML=t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el=>{
    el.placeholder=t(el.getAttribute('data-i18n-ph'));
  });
  document.documentElement.lang=currentLang;
  /* update live rooms count if on index */
  const oc=document.getElementById('online-count');
  if(oc&&oc.dataset.count!==undefined)oc.innerHTML=roomsLabel(Number(oc.dataset.count));
  /* update lounge if visible */
  const lt=document.getElementById('zp-lounge-toggle');
  if(lt)lt.textContent=document.getElementById('zp-lounge')?.getAttribute('data-collapsed')==='1'?t('lo_open'):t('lo_red');
  const lp=document.getElementById('zp-lounge-text');
  if(lp)lp.placeholder=t('lo_ph');
  const ls=document.getElementById('zp-lounge-send');
  if(ls)ls.textContent=t('lo_send');
  updateLoungeReadyUI();
}

function injectLangButton(){
  if(document.getElementById('zp-lang-btn'))return;
  const s=document.createElement('style');
  s.textContent='#zp-lang-btn{position:fixed;top:14px;right:14px;z-index:9000;background:rgba(0,245,212,.1);border:1px solid rgba(0,245,212,.3);color:#00F5D4;border-radius:8px;padding:5px 13px;font-family:"Orbitron",monospace;font-size:.58rem;font-weight:700;letter-spacing:.15em;cursor:pointer;transition:background .2s,box-shadow .2s;}#zp-lang-btn:hover{background:rgba(0,245,212,.22);box-shadow:0 0 14px rgba(0,245,212,.3);}#zp-lang-btn[data-lang="en"]{border-color:rgba(59,130,246,.4);color:#93c5fd;background:rgba(59,130,246,.1);}#zp-lang-btn[data-lang="en"]:hover{background:rgba(59,130,246,.22);box-shadow:0 0 14px rgba(59,130,246,.25);}';
  document.head.appendChild(s);
  const btn=document.createElement('button');
  btn.id='zp-lang-btn';
  btn.setAttribute('data-lang',currentLang);
  btn.textContent=currentLang==='fr'?'EN':'FR';
  btn.addEventListener('click',()=>setLang(currentLang==='fr'?'en':'fr'));
  document.body.appendChild(btn);
}

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
    '#zp-loader::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(0,245,212,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,245,212,.03) 1px,transparent 1px);background-size:48px 48px;animation:zl-grid 12s linear infinite;}',
    '@keyframes zl-grid{0%{transform:translateY(0) translateX(0)}100%{transform:translateY(48px) translateX(0)}}',
    /* scan beam */
    '#zp-loader::after{content:"";position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(0,245,212,.6),transparent);box-shadow:0 0 20px rgba(0,245,212,.4);animation:zl-beam 2.8s linear infinite;}',
    '@keyframes zl-beam{0%{top:-2px;opacity:0}5%{opacity:1}95%{opacity:.6}100%{top:100vh;opacity:0}}',
    /* nebula glow */
    '.zl-nebula{position:absolute;border-radius:50%;pointer-events:none;filter:blur(60px);}',
    '.zl-nebula.a{width:500px;height:500px;background:radial-gradient(circle,rgba(0,245,212,.1) 0%,transparent 65%);animation:zl-neb 5s ease-in-out infinite;}',
    '.zl-nebula.b{width:340px;height:340px;background:radial-gradient(circle,rgba(255,56,100,.07) 0%,transparent 65%);animation:zl-neb 7s ease-in-out infinite reverse;}',
    '@keyframes zl-neb{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.18);opacity:1}}',
    /* corners */
    '.zl-corner{position:absolute;width:44px;height:44px;border-color:rgba(0,245,212,.5);border-style:solid;animation:zl-ci .5s ease both;}',
    '.zl-corner.tl{top:20px;left:20px;border-width:2px 0 0 2px;animation-delay:.05s;}',
    '.zl-corner.tr{top:20px;right:20px;border-width:2px 2px 0 0;animation-delay:.1s;}',
    '.zl-corner.bl{bottom:20px;left:20px;border-width:0 0 2px 2px;animation-delay:.08s;}',
    '.zl-corner.br{bottom:20px;right:20px;border-width:0 2px 2px 0;animation-delay:.13s;}',
    '@keyframes zl-ci{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}',
    /* orbit rings */
    '.zl-ring{position:absolute;border-radius:50%;border:1px solid transparent;pointer-events:none;}',
    '.zl-ring.r1{width:210px;height:210px;border-top-color:rgba(0,245,212,.5);border-right-color:rgba(0,245,212,.15);animation:zl-spin 3s linear infinite;}',
    '.zl-ring.r2{width:270px;height:270px;border-bottom-color:rgba(255,56,100,.4);border-left-color:rgba(255,56,100,.1);animation:zl-spin 5s linear infinite reverse;}',
    '.zl-ring.r3{width:330px;height:330px;border-top-color:rgba(59,130,246,.25);border-right-color:rgba(59,130,246,.08);animation:zl-spin 9s linear infinite;}',
    '@keyframes zl-spin{to{transform:rotate(360deg)}}',
    /* center */
    '.zl-center{position:relative;display:flex;flex-direction:column;align-items:center;gap:18px;z-index:2;}',
    /* logo */
    '.zl-logo{font-family:"Orbitron",monospace;font-size:clamp(3rem,11vw,5rem);font-weight:900;color:#00F5D4;letter-spacing:.06em;text-shadow:0 0 20px rgba(0,245,212,.9),0 0 60px rgba(0,245,212,.4),0 0 120px rgba(0,245,212,.15);animation:zl-logo-in .7s cubic-bezier(.2,0,.2,1) both,zl-glitch 5s 1.2s infinite;}',
    '@keyframes zl-logo-in{from{opacity:0;transform:scale(.85) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}',
    '@keyframes zl-glitch{0%,86%,100%{transform:translate(0);filter:none}87%{transform:translate(-4px,1px);filter:hue-rotate(-30deg)}88%{transform:translate(4px,-1px);filter:hue-rotate(30deg)}89%{transform:translate(0);filter:none}90%{transform:translate(3px,2px);filter:brightness(1.3)}91%{transform:translate(0);filter:none}}',
    /* tag */
    '.zl-tag{font-family:"Orbitron",monospace;font-size:.58rem;letter-spacing:.35em;text-transform:uppercase;color:rgba(0,245,212,.4);animation:zl-up .5s .15s ease both;}',
    /* divider */
    '.zl-div{display:flex;align-items:center;gap:10px;width:240px;animation:zl-up .5s .22s ease both;}',
    '.zl-div::before,.zl-div::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(0,245,212,.25));}',
    '.zl-div::after{background:linear-gradient(90deg,rgba(0,245,212,.25),transparent);}',
    '.zl-div-dot{width:3px;height:3px;border-radius:50%;background:rgba(0,245,212,.5);}',
    /* progress bar */
    '.zl-bar-wrap{width:260px;height:3px;background:rgba(0,245,212,.08);border-radius:2px;overflow:visible;position:relative;animation:zl-up .5s .28s ease both;}',
    '.zl-bar{height:100%;width:0%;background:linear-gradient(90deg,#00F5D4,#3B82F6,#FF3864);border-radius:2px;animation:zl-fill 2s .4s cubic-bezier(.25,0,.15,1) forwards;position:relative;overflow:hidden;}',
    '.zl-bar::after{content:"";position:absolute;top:-2px;right:0;width:8px;height:7px;background:rgba(255,255,255,.9);border-radius:50%;filter:blur(3px);box-shadow:0 0 8px #00F5D4,0 0 16px rgba(0,245,212,.6);}',
    '@keyframes zl-fill{0%{width:0%}50%{width:68%}75%{width:82%}100%{width:93%}}',
    /* status row */
    '.zl-status{display:flex;align-items:center;gap:8px;animation:zl-up .5s .35s ease both;}',
    '.zl-sub{font-size:.58rem;color:rgba(90,90,120,.85);letter-spacing:.2em;font-family:"Orbitron",monospace;text-transform:uppercase;}',
    '.zl-dot{width:3px;height:3px;border-radius:50%;background:#00F5D4;animation:zl-dot-b 1.1s ease-in-out infinite;}',
    '.zl-dot:nth-child(2){animation-delay:.18s}.zl-dot:nth-child(3){animation-delay:.36s}',
    '@keyframes zl-dot-b{0%,100%{opacity:.2;transform:scale(.7)}50%{opacity:1;transform:scale(1.3)}}',
    /* particles */
    '.zl-p{position:absolute;border-radius:50%;animation:zl-pfloat linear infinite;}',
    '@keyframes zl-pfloat{0%{transform:translateY(100vh) translateX(0);opacity:0}8%{opacity:.7}92%{opacity:.15}100%{transform:translateY(-40px) translateX(var(--dx,12px));opacity:0}}',
    /* shared */
    '@keyframes zl-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}',
    '::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:rgba(255,255,255,.03)}::-webkit-scrollbar-thumb{background:rgba(0,245,212,.2);border-radius:2px}::-webkit-scrollbar-thumb:hover{background:rgba(0,245,212,.4)}',
    '::selection{background:rgba(0,245,212,.25);color:#fff}',
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
  const pCols=['#00F5D4','#FF3864','#3B82F6','#A855F7','#FFE234','#FF6B35'];
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
  const tag=mk('div','zl-tag');tag.textContent=t('l_tag');
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
  const msgs=[t('l_init'),t('l_load'),t('l_conn'),t('l_prep')];
  let mi=0;
  const cycleId=setInterval(()=>{mi=(mi+1)%msgs.length;sub.textContent=msgs[mi];},900);
  loader._cycleId=cycleId;

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
          <div class="t" id="zp-lounge-title">${t('lo_t')}</div>
          <div class="s" id="zp-lounge-sub">${t('lo_w')}</div>
        </div>
        <button id="zp-lounge-toggle" type="button">${t('lo_red')}</button>
      </div>
      <div id="zp-lounge-body">
        <div id="zp-lounge-players"></div>
        <div id="zp-lounge-chat">
          <div id="zp-lounge-msgs"></div>
          <div id="zp-lounge-input">
            <input id="zp-lounge-text" maxlength="200" placeholder="${t('lo_ph')}" />
            <button id="zp-lounge-send">${t('lo_send')}</button>
          </div>
        </div>
      </div>
      <div id="zp-lounge-foot">
        <span id="zp-lounge-ready-label">${t('lo_sw')}</span>
        <button id="zp-lounge-ready-btn" type="button" class="off">${t('lo_npr')}</button>
      </div>
    </div>
    <div id="zp-player-modal">
      <div id="zp-player-card">
        <div class="n" id="zp-player-name">—</div>
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
  if(btn) btn.textContent = loungeCollapsed ? t('lo_open') : t('lo_red');
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
  if(lbl) lbl.textContent = isReady?t('lo_sr'):t('lo_sw');
  if(btn){
    btn.classList.toggle('off', !isReady);
    btn.textContent = isReady ? t('lo_pr') : t('lo_npr');
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
  document.getElementById('zp-lounge-title').textContent = `${t('lo_t')} ${loungeState.gameName||''}`.trim();
  document.getElementById('zp-lounge-sub').textContent = `Code: ${loungeState.roomCode||'----'} • ${loungeState.players.length} ${t('lo_joueurs')}`;

  const list = document.getElementById('zp-lounge-players');
  list.innerHTML = '';
  loungeState.players.forEach(p=>{
    const st = playerQuickStats(p.name);
    const div = document.createElement('div');
    div.className = 'zp-player' + (p.slot===loungeState.mySlot?' me':'');
    div.innerHTML = `
      <div class="a">${initials(p.name)}</div>
      <div>
        <div class="n">${escapeHtml(p.name)}${p.slot===loungeState.mySlot?' '+t('lo_self'):''}</div>
        <div class="m">Slot ${p.slot+1} • ${st.wins}${t('s_v')} / ${st.played}${t('s_p')}</div>
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
  const me = player.slot===loungeState.mySlot?t('pr_me'):t('pr_other');
  const st = playerQuickStats(player.name);
  const presence = getOnlinePresenceMap()[normPseudo(player.name)] ? t('pr_on') : t('pr_off');
  metaEl.textContent = `${me} • Slot ${Number(player.slot)+1} • ${st.wins}${t('s_v')}/${st.played}${t('s_p')} • ${presence}`;
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
        ${t('s_empty')}
      </div>`;
    return;
  }

  const gameIcons={quiz:'⚡',draw:'✏️',p4:'🟠',morpion:'✖️',taboo:'🚫',emoji:'🌟',verite:'❤️',loup:'🐺',uno:'🃏',bomb:'💣',sumo:'🥋',paint:'🎨',naval:'⚓'};
  const winRate=stats.games?Math.round(stats.wins/stats.games*100):0;
  const profile=getProfileData();
  const recentResult=profile.recent?`${profile.recent.isWinner?t('s_win'):t('s_loss')} · ${profile.recent.gameName||profile.recent.game}`:t('s_none');
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
        <div style="font-size:.72rem;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t('s_last')} ${recentResult}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:.68rem;color:#64748b;text-transform:uppercase;letter-spacing:.04em">${t('s_best')}</div>
        <div style="font-size:.78rem;font-weight:700">${bestGame}</div>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
      <div style="flex:1;min-width:80px;background:rgba(167,139,250,.1);border:1px solid rgba(167,139,250,.25);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:1.6rem;font-weight:800;color:#a78bfa">${stats.games}</div>
        <div style="font-size:.72rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">${t('s_games')}</div>
      </div>
      <div style="flex:1;min-width:80px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:1.6rem;font-weight:800;color:#22c55e">${stats.wins}</div>
        <div style="font-size:.72rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">${t('s_wins')}</div>
      </div>
      <div style="flex:1;min-width:80px;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.25);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:1.6rem;font-weight:800;color:#fbbf24">${winRate}%</div>
        <div style="font-size:.72rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">${t('s_wr')}</div>
      </div>
      <div style="flex:1;min-width:80px;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.25);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:1.6rem;font-weight:800;color:#60a5fa">${streak}</div>
        <div style="font-size:.72rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">${t('s_str')}</div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin:-2px 0 10px">
      <button id="zp-export-history-btn" style="background:rgba(59,130,246,.12);border:1px solid rgba(59,130,246,.3);color:#93c5fd;border-radius:8px;padding:6px 10px;font-size:.72rem;cursor:pointer">
        ${t('s_exp')}
      </button>
      <button id="zp-clear-history-btn" style="background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:#fca5a5;border-radius:8px;padding:6px 10px;font-size:.72rem;cursor:pointer">
        ${t('s_clr')}
      </button>
    </div>`;

  if(topGames.length){
    html+=`<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">`;
    topGames.forEach(g=>{
      const icon=gameIcons[g.id]||'🎮';
      html+=`<div style="flex:1;min-width:130px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:8px 10px">
        <div style="font-size:.76rem;font-weight:700;display:flex;align-items:center;gap:6px">${icon} ${g.name||g.id}</div>
        <div style="font-size:.68rem;color:#94a3b8;margin-top:2px">${g.wins}${t('s_v')} / ${g.played}${t('s_p')} • ${g.rate}%</div>
      </div>`;
    });
    html+=`</div>`;
  }

  html+=`
    <div style="background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.2);border-radius:12px;padding:10px;margin:2px 0 10px">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:6px">
        <div style="font-size:.74rem;color:#7dd3fc;text-transform:uppercase;letter-spacing:.04em;font-weight:700">${t('s_week')}</div>
        <div style="font-size:.72rem;color:#bae6fd">${weekTier} • ${weekPoints} pts</div>
      </div>
      <div style="font-size:.76rem;color:#bae6fd;margin-bottom:6px">${weekGames.length} ${t('s_parts')} • ${weekWins} ${t('s_vicw')}</div>
      <div style="display:grid;gap:5px">
        ${weeklyTop.length?weeklyTop.map((g,i)=>`<div style="display:flex;justify-content:space-between;gap:8px;font-size:.74rem">
          <span>${i+1}. ${(gameIcons[g.id]||'🎮')} ${escapeHtml(g.name||g.id)}</span>
          <span style="color:#93c5fd">${g.points} ${t('s_pts')}</span>
        </div>`).join(''):`<div style="font-size:.74rem;color:#94a3b8">${t('s_noweek')}</div>`}
      </div>
    </div>`;

  const recent=history.slice(0,8);
  html+=`<div style="display:flex;flex-direction:column;gap:6px">`;
  recent.forEach(g=>{
    const icon=gameIcons[g.game]||'🎮';
    const dateStr=new Date(g.date).toLocaleDateString(currentLang==='en'?'en-GB':'fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    const result=g.isWinner
      ?`<span style="color:#22c55e;font-weight:700">${t('s_win')}</span>`
      :`<span style="color:#94a3b8">${t('s_loss')}</span>`;
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
    html+=`<div style="text-align:center;padding:8px;font-size:.75rem;color:#64748b">${t('s_more',{n:history.length-8})}</div>`;
  }

  container.innerHTML=html;
  const exportBtn=document.getElementById('zp-export-history-btn');
  if(exportBtn){
    exportBtn.addEventListener('click',()=>exportHistory());
  }
  const clearBtn=document.getElementById('zp-clear-history-btn');
  if(clearBtn){
    clearBtn.addEventListener('click',()=>{
      if(!confirm(t('s_clrq')))return;
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
  if(me.key===to.key)return {ok:false,msg:"Tu ne peux pas t'ajouter toi-même."};
  if(me.friends.includes(to.key))return {ok:false,msg:'Déjà en amis.'};
  if(me.outgoing.some(x=>x.to===to.key))return {ok:false,msg:'Demande déjà envoyée.'};
  if(me.incoming.some(x=>x.from===to.key))return {ok:false,msg:"Cette personne t'a déjà demandé en ami."};
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
        <div style="font-size:.72rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">${t('p_tit')}</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <input id="zp-profile-pseudo" maxlength="20" value="${escapeHtml(me.pseudo||'')}" placeholder="${t('p_ph')}" style="flex:1;min-width:120px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:9px;color:#f1f5f9;padding:8px 10px">
          <button id="zp-profile-save" style="border:none;border-radius:9px;padding:8px 12px;background:#7c3aed;color:#fff;font-size:.75rem;cursor:pointer">${t('p_save')}</button>
        </div>
        <textarea id="zp-profile-bio" maxlength="120" placeholder="${t('p_bio')}" style="margin-top:8px;width:100%;min-height:58px;resize:vertical;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:9px;color:#f1f5f9;padding:8px 10px;font-family:inherit;font-size:.8rem">${escapeHtml(me.bio||'')}</textarea>
      </div>
      <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px">
        <div style="font-size:.78rem;color:#cbd5e1">${t('p_friends')}</div>
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
    '#zp-welcome::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(0,245,212,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,245,212,.03) 1px,transparent 1px);background-size:48px 48px;animation:wc-grid 12s linear infinite;}',
    '@keyframes wc-grid{0%{transform:translateY(0)}100%{transform:translateY(48px)}}',
    /* reveal scan (runs once on entry) */
    '.wc-scan-line{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(0,245,212,.9),transparent);box-shadow:0 0 24px rgba(0,245,212,.7);z-index:10;animation:wc-scan-once 1s ease-out both;pointer-events:none;}',
    '@keyframes wc-scan-once{0%{top:0;opacity:1}90%{opacity:.8}100%{top:100vh;opacity:0}}',
    /* recurring scan beam */
    '.wc-beam{position:absolute;left:0;right:0;height:180px;background:linear-gradient(transparent,rgba(0,245,212,.04),transparent);animation:wc-beam-loop 4s linear 1.2s infinite;pointer-events:none;}',
    '@keyframes wc-beam-loop{0%{top:-180px;opacity:0}5%{opacity:1}95%{opacity:.5}100%{top:100vh;opacity:0}}',
    /* nebulas */
    '.wc-neb{position:absolute;border-radius:50%;pointer-events:none;filter:blur(80px);}',
    '.wc-neb.a{width:600px;height:600px;background:radial-gradient(circle,rgba(0,245,212,.1) 0%,transparent 65%);top:50%;left:50%;transform:translate(-50%,-60%);animation:wc-neb-p 6s ease-in-out infinite;}',
    '.wc-neb.b{width:400px;height:400px;background:radial-gradient(circle,rgba(168,85,247,.08) 0%,transparent 65%);top:70%;left:60%;transform:translate(-50%,-50%);animation:wc-neb-p 8s ease-in-out 1s infinite reverse;}',
    '@keyframes wc-neb-p{0%,100%{opacity:.5;transform:translate(-50%,-60%) scale(1)}50%{opacity:.9;transform:translate(-50%,-60%) scale(1.2)}}',
    /* stars */
    '.wc-star{position:absolute;border-radius:50%;background:#fff;animation:wc-twinkle ease-in-out infinite;}',
    '@keyframes wc-twinkle{0%,100%{opacity:.05}50%{opacity:.7}}',
    /* corners */
    '.wc-corner{position:absolute;width:44px;height:44px;border-color:rgba(0,245,212,.45);border-style:solid;animation:wc-ci .6s ease both;}',
    '.wc-corner.tl{top:18px;left:18px;border-width:2px 0 0 2px;animation-delay:.3s}',
    '.wc-corner.tr{top:18px;right:18px;border-width:2px 2px 0 0;animation-delay:.4s}',
    '.wc-corner.bl{bottom:18px;left:18px;border-width:0 0 2px 2px;animation-delay:.35s}',
    '.wc-corner.br{bottom:18px;right:18px;border-width:0 2px 2px 0;animation-delay:.45s}',
    '@keyframes wc-ci{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:scale(1)}}',
    /* side tick marks */
    '.wc-tick{position:absolute;background:rgba(0,245,212,.25);}',
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
    '.wc-eyebrow{font-family:"Orbitron",monospace;font-size:.5rem;font-weight:700;letter-spacing:.55em;text-transform:uppercase;color:rgba(0,245,212,.4);margin-bottom:12px;animation:wc-up .5s .4s ease both;}',
    '@keyframes wc-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}',
    /* logo */
    '.wc-logo{font-family:"Orbitron",monospace;font-weight:900;font-size:clamp(3.2rem,14vw,5.8rem);letter-spacing:.06em;color:#00F5D4;text-shadow:0 0 20px rgba(0,245,212,1),0 0 60px rgba(0,245,212,.5),0 0 120px rgba(0,245,212,.2),0 0 200px rgba(0,245,212,.08);animation:wc-logo-in .8s .5s cubic-bezier(.2,0,.2,1) both,wc-glitch 6s 2.5s infinite;margin-bottom:4px;}',
    '@keyframes wc-logo-in{from{opacity:0;transform:scale(.8) translateY(12px);filter:blur(6px)}to{opacity:1;transform:scale(1) translateY(0);filter:blur(0)}}',
    '@keyframes wc-glitch{0%,85%,100%{transform:translate(0);filter:none}86%{transform:translate(-5px,2px);filter:hue-rotate(-40deg) brightness(1.2)}87%{transform:translate(5px,-2px);filter:hue-rotate(40deg)}88%{transform:translate(0);filter:none}89%{transform:translate(3px,3px);filter:brightness(1.4)}90%{transform:translate(0);filter:none}}',
    /* logo underline */
    '.wc-logo-line{display:flex;align-items:center;gap:10px;width:280px;margin:0 auto 6px;animation:wc-up .5s .7s ease both;}',
    '.wc-logo-line::before,.wc-logo-line::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(0,245,212,.35));}',
    '.wc-logo-line::after{background:linear-gradient(90deg,rgba(0,245,212,.35),transparent);}',
    '.wc-logo-line-dot{width:4px;height:4px;border-radius:50%;background:#00F5D4;box-shadow:0 0 6px #00F5D4;}',
    /* subtitle */
    '.wc-sub{font-family:"Exo 2",sans-serif;font-size:.78rem;font-weight:500;letter-spacing:.25em;text-transform:uppercase;color:rgba(90,90,120,.8);margin-bottom:32px;animation:wc-up .5s .78s ease both;}',
    /* card with animated gradient border */
    '.wc-card-wrap{position:relative;width:100%;border-radius:20px;padding:1px;background:linear-gradient(135deg,rgba(0,245,212,.5),rgba(168,85,247,.3),rgba(59,130,246,.4),rgba(0,245,212,.5));background-size:300% 300%;animation:wc-up .7s .85s cubic-bezier(.2,0,.2,1) both,wc-border-rot 5s linear 1.6s infinite;}',
    '@keyframes wc-border-rot{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}',
    '.wc-card{background:#09091A;border-radius:19px;padding:30px 30px 28px;width:100%;}',
    '.wc-card-title{font-family:"Orbitron",monospace;font-size:.75rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#00F5D4;margin-bottom:6px;}',
    '.wc-card-hint{font-family:"Exo 2",sans-serif;font-size:.72rem;color:rgba(90,90,120,.85);letter-spacing:.04em;line-height:1.6;margin-bottom:22px;}',
    /* input */
    '.wc-inp-wrap{position:relative;margin-bottom:12px;}',
    '.wc-inp{width:100%;background:rgba(0,0,0,.5);border:1px solid rgba(0,245,212,.2);border-radius:10px;padding:14px 18px;font-family:"Exo 2",sans-serif;font-size:1rem;font-weight:600;color:#E8E8F0;outline:none;text-align:center;letter-spacing:.05em;transition:border-color .25s,box-shadow .25s,background .25s;animation:wc-pulse-b 3s 2.2s ease-in-out infinite;}',
    '.wc-inp::placeholder{color:rgba(90,90,120,.55);}',
    '.wc-inp:focus{border-color:rgba(0,245,212,.8);box-shadow:0 0 0 3px rgba(0,245,212,.1),0 0 30px rgba(0,245,212,.18);background:rgba(0,245,212,.04);animation:none;}',
    '@keyframes wc-pulse-b{0%,100%{border-color:rgba(0,245,212,.2)}50%{border-color:rgba(0,245,212,.5);box-shadow:0 0 16px rgba(0,245,212,.1)}}',
    '.wc-inp.wc-shake{animation:wc-shk .4s ease !important;}',
    '@keyframes wc-shk{0%,100%{transform:translateX(0)}20%{transform:translateX(-9px)}40%{transform:translateX(9px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}',
    /* char counter */
    '.wc-counter{position:absolute;right:12px;top:50%;transform:translateY(-50%);font-family:"Orbitron",monospace;font-size:.5rem;color:rgba(90,90,120,.5);letter-spacing:.05em;pointer-events:none;}',
    /* button */
    '.wc-btn{width:100%;background:linear-gradient(135deg,rgba(0,245,212,.18),rgba(59,130,246,.1));border:1px solid rgba(0,245,212,.4);border-radius:10px;padding:15px;font-family:"Orbitron",monospace;font-size:.76rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#00F5D4;cursor:pointer;transition:box-shadow .2s,transform .15s,border-color .2s;position:relative;overflow:hidden;}',
    '.wc-btn:hover{box-shadow:0 0 32px rgba(0,245,212,.32),0 0 70px rgba(0,245,212,.12);border-color:rgba(0,245,212,.7);transform:translateY(-2px);}',
    '.wc-btn:active{transform:scale(.97) translateY(0);}',
    /* continuous sweep on button */
    '.wc-btn::after{content:"";position:absolute;top:0;left:-70%;width:50%;height:100%;background:linear-gradient(90deg,transparent,rgba(0,245,212,.25),transparent);animation:wc-sweep 2.8s ease-in-out 2s infinite;}',
    '@keyframes wc-sweep{0%{left:-70%}100%{left:130%}}',
    /* burst */
    '.wc-burst{position:fixed;border-radius:50%;pointer-events:none;animation:wc-burst-a var(--dur,.9s) ease-out forwards;}',
    '@keyframes wc-burst-a{0%{transform:translate(0,0) scale(1) rotate(0deg);opacity:1}100%{transform:var(--tx) scale(0) rotate(var(--rot,180deg));opacity:0}}',
    /* greeting */
    '.wc-greet{position:absolute;z-index:10;font-family:"Orbitron",monospace;font-size:clamp(1.1rem,4.5vw,1.6rem);font-weight:900;letter-spacing:.06em;color:#00F5D4;text-shadow:0 0 30px rgba(0,245,212,.9),0 0 80px rgba(0,245,212,.4);opacity:0;text-align:center;padding:0 20px;transition:opacity .5s,transform .5s;transform:scale(.85);}',
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
  const pCols=['#00F5D4','#FF3864','#3B82F6','#A855F7','#FFE234','#FF6B35','#22C55E'];
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
    '<div class="wc-eyebrow">'+t('w_eye')+'</div>'
    +'<div class="wc-logo">ZapPlay</div>'
    +'<div class="wc-logo-line"><span class="wc-logo-line-dot"></span></div>'
    +'<div class="wc-sub">'+t('w_sub')+'</div>'
    +'<div class="wc-card-wrap"><div class="wc-card">'
      +'<div class="wc-card-title">'+t('w_ctit')+'</div>'
      +'<div class="wc-card-hint">'+t('w_chint')+'</div>'
      +'<div class="wc-inp-wrap">'
        +'<input id="wc-inp" class="wc-inp" type="text" placeholder="'+t('w_ph')+'" maxlength="20" autocomplete="off" spellcheck="false">'
        +'<span class="wc-counter" id="wc-cnt">0/20</span>'
      +'</div>'
      +'<button id="wc-btn" class="wc-btn">'+t('w_btn')+'</button>'
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
    const bc=['#00F5D4','#FF3864','#FFE234','#3B82F6','#A855F7','#FF6B35','#22C55E','#fff'];
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
    greet.textContent=t('w_greet',{n:val});
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
  autoFillPseudo();
  hookPseudoInputs();
  touchPresence();
  setInterval(()=>{
    if(document.visibilityState!=='hidden') touchPresence();
  },15000);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState!=='hidden') touchPresence();
  });
  injectLangButton();
  applyLang();
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
  showWelcomeScreen,
  t,setLang,applyLang,roomsLabel,
  getLang:()=>currentLang
};

})();
