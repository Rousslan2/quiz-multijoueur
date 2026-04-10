'use strict';
const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');
const path      = require('path');
const os        = require('os');
let QRCode; try { QRCode = require('qrcode'); } catch {}

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 3001;

// ── 11 WebSocket servers ──────────────────────────────────────────────────────
const wssQuiz    = new WebSocket.Server({ noServer: true });
const wssDraw    = new WebSocket.Server({ noServer: true });
const wssP4      = new WebSocket.Server({ noServer: true });
const wssMorpion = new WebSocket.Server({ noServer: true });
const wssTaboo   = new WebSocket.Server({ noServer: true });
const wssEmoji   = new WebSocket.Server({ noServer: true });
const wssVerite  = new WebSocket.Server({ noServer: true });
const wssChat    = new WebSocket.Server({ noServer: true });
const wssLobby   = new WebSocket.Server({ noServer: true });
const wssLoup    = new WebSocket.Server({ noServer: true });
const wssUno     = new WebSocket.Server({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const routes = {
    '/ws/quiz':wssQuiz,'/ws/draw':wssDraw,'/ws/p4':wssP4,
    '/ws/morpion':wssMorpion,'/ws/taboo':wssTaboo,'/ws/emoji':wssEmoji,
    '/ws/verite':wssVerite,'/ws/chat':wssChat,'/ws/lobby':wssLobby,
    '/ws/loup':wssLoup,'/ws/uno':wssUno
  };
  const h = routes[req.url];
  if (h) h.handleUpgrade(req, socket, head, ws => h.emit('connection', ws));
  else socket.destroy();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function getLocalIP() {
  for (const ifaces of Object.values(os.networkInterfaces()))
    for (const i of ifaces) if (i.family==='IPv4'&&!i.internal) return i.address;
  return 'localhost';
}
app.get('/api/qr', async (_, res) => {
  if (!QRCode) { res.status(503).end(); return; }
  try {
    const svg = await QRCode.toString(`http://${getLocalIP()}:${PORT}`, { type:'svg', margin:1, color:{dark:'#a78bfa',light:'#0f0c29'} });
    res.setHeader('Content-Type','image/svg+xml').send(svg);
  } catch { res.status(500).end(); }
});
app.get('/api/ip', (_, res) => res.json({ ip: getLocalIP(), port: PORT }));

// ── Rooms API ─────────────────────────────────────────────────────────────────
const GAME_NAMES = {
  quiz:'Quiz Éclair', draw:'Dessin & Devine', p4:'Puissance 4',
  morpion:'Morpion', taboo:'Mots Interdits', emoji:'Devinette Emoji', verite:'Vérité ou Défi',
  loup:'Loup-Garou', uno:'Uno'
};

function getRoomsSnapshot() {
  const all = [];
  const maps = { quiz:quizRooms, draw:drawRooms, p4:p4Rooms, morpion:morpionRooms, taboo:tabooRooms, emoji:emojiRooms, verite:veriteRooms, loup:loupRooms, uno:unoRooms };
  for (const [game, map] of Object.entries(maps)) {
    for (const [code, room] of map) {
      all.push({
        code,
        game,
        gameName: GAME_NAMES[game],
        host: room.host,
        players: room.players.map(p => p.name),
        maxPlayers: game==='loup'?10:game==='uno'?4:4,
        status: room.phase === 'LOBBY' || room.phase === 'WAITING' ? 'waiting' : 'playing'
      });
    }
  }
  return all;
}

app.get('/api/rooms', (_, res) => res.json(getRoomsSnapshot()));

// ── Lobby WebSocket ───────────────────────────────────────────────────────────
const lobbyClients = new Set();
wssLobby.on('connection', ws => {
  lobbyClients.add(ws);
  wsend(ws, { type: 'rooms', rooms: getRoomsSnapshot() });
  ws.on('close', () => lobbyClients.delete(ws));
});

function broadcastLobby() {
  const msg = JSON.stringify({ type: 'rooms', rooms: getRoomsSnapshot() });
  lobbyClients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
}

const shuffle = a => [...a].sort(()=>Math.random()-.5);

function makeWS(wss) {
  const aliveFn = ws => { const t=setInterval(()=>{if(ws.readyState===WebSocket.OPEN)ws.ping();},25000); ws._alive=t; };
  const clearFn = ws => clearInterval(ws._alive);
  return { alive: aliveFn, clear: clearFn };
}

function bcast(players, data) {
  const m = JSON.stringify(data);
  players.forEach(p => { if(p.ws.readyState===WebSocket.OPEN) p.ws.send(m); });
}
function wsend(ws, data) { if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify(data)); }

function genCode(existingMap) {
  let code;
  do { code = Math.random().toString(36).slice(2,6).toUpperCase(); } while (existingMap.has(code));
  return code;
}

// ════════════════════════════════════════════════════════
//  QUIZ
// ════════════════════════════════════════════════════════

const ALL_Q = [
  {text:"Quelle est la capitale de l'Australie ?",opts:["Sydney","Melbourne","Canberra","Brisbane"],ans:2,cat:'geo',diff:2},
  {text:"Quel pays a la plus grande superficie ?",opts:["Canada","Chine","USA","Russie"],ans:3,cat:'geo',diff:1},
  {text:"Quelle est la capitale du Brésil ?",opts:["Rio de Janeiro","São Paulo","Brasília","Salvador"],ans:2,cat:'geo',diff:2},
  {text:"Sur quel continent se trouve l'Égypte ?",opts:["Asie","Afrique","Europe","Amérique"],ans:1,cat:'geo',diff:1},
  {text:"Quelle est la capitale du Japon ?",opts:["Kyoto","Osaka","Tokyo","Hiroshima"],ans:2,cat:'geo',diff:1},
  {text:"Quel est le plus petit pays du monde ?",opts:["Monaco","Saint-Marin","Vatican","Liechtenstein"],ans:2,cat:'geo',diff:2},
  {text:"Quelle est la plus haute montagne du monde ?",opts:["K2","Everest","Mont Blanc","Kilimandjaro"],ans:1,cat:'geo',diff:1},
  {text:"Dans quel pays se trouve le Machu Picchu ?",opts:["Mexique","Colombie","Pérou","Chili"],ans:2,cat:'geo',diff:2},
  {text:"Quel océan est le plus grand ?",opts:["Atlantique","Indien","Arctique","Pacifique"],ans:3,cat:'geo',diff:1},
  {text:"Quelle est la capitale du Canada ?",opts:["Toronto","Vancouver","Montréal","Ottawa"],ans:3,cat:'geo',diff:2},
  {text:"Combien de pays forment l'Union Européenne ?",opts:["25","27","30","32"],ans:1,cat:'geo',diff:3},
  {text:"Quel est le plus long fleuve du monde ?",opts:["Nil","Amazone","Yangtsé","Mississippi"],ans:0,cat:'geo',diff:2},
  {text:"Quelle ville est surnommée 'La Ville Éternelle' ?",opts:["Paris","Athènes","Rome","Istanbul"],ans:2,cat:'geo',diff:2},
  {text:"Quelle mer sépare l'Europe de l'Afrique ?",opts:["Mer Noire","Mer Rouge","Mer Méditerranée","Mer Caspienne"],ans:2,cat:'geo',diff:2},
  {text:"Quel pays est connu pour ses tulipes et ses moulins ?",opts:["Belgique","Danemark","Pays-Bas","Suède"],ans:2,cat:'geo',diff:1},
  {text:"En quelle année a eu lieu la Révolution française ?",opts:["1769","1789","1799","1809"],ans:1,cat:'histoire',diff:1},
  {text:"Qui était le premier président des États-Unis ?",opts:["Abraham Lincoln","Thomas Jefferson","John Adams","George Washington"],ans:3,cat:'histoire',diff:1},
  {text:"En quelle année s'est terminée la Seconde Guerre mondiale ?",opts:["1943","1944","1945","1946"],ans:2,cat:'histoire',diff:1},
  {text:"Qui a peint la Joconde ?",opts:["Michel-Ange","Raphaël","Léonard de Vinci","Botticelli"],ans:2,cat:'histoire',diff:1},
  {text:"En quelle année l'homme a-t-il marché sur la Lune ?",opts:["1965","1967","1969","1971"],ans:2,cat:'histoire',diff:1},
  {text:"En quelle année a été construite la Tour Eiffel ?",opts:["1879","1889","1899","1909"],ans:1,cat:'histoire',diff:2},
  {text:"En quelle année a eu lieu la chute du mur de Berlin ?",opts:["1985","1987","1989","1991"],ans:2,cat:'histoire',diff:2},
  {text:"Qui a découvert l'Amérique en 1492 ?",opts:["Vasco de Gama","Christophe Colomb","Magellan","Amerigo Vespucci"],ans:1,cat:'histoire',diff:1},
  {text:"Quel empire était dirigé par Jules César ?",opts:["Grec","Romain","Ottoman","Perse"],ans:1,cat:'histoire',diff:1},
  {text:"En quelle année a eu lieu la Première Guerre mondiale ?",opts:["1912","1914","1916","1918"],ans:1,cat:'histoire',diff:2},
  {text:"Qui a peint la Chapelle Sixtine ?",opts:["Léonard de Vinci","Raphaël","Michel-Ange","Titien"],ans:2,cat:'histoire',diff:2},
  {text:"Quelle reine d'Angleterre a régné le plus longtemps ?",opts:["Victoria","Elizabeth I","Elizabeth II","Mary I"],ans:2,cat:'histoire',diff:2},
  {text:"Quel est le symbole chimique de l'or ?",opts:["Ag","Fe","Au","Cu"],ans:2,cat:'sciences',diff:2},
  {text:"Combien de couleurs y a-t-il dans un arc-en-ciel ?",opts:["5","6","7","8"],ans:2,cat:'sciences',diff:1},
  {text:"Quel est le plus grand organe du corps humain ?",opts:["Le foie","Le poumon","La peau","Le cerveau"],ans:2,cat:'sciences',diff:2},
  {text:"Quelle planète est la plus grande du système solaire ?",opts:["Saturne","Neptune","Jupiter","Uranus"],ans:2,cat:'sciences',diff:1},
  {text:"De quoi est composée l'eau ?",opts:["H2O","CO2","H2O2","HO"],ans:0,cat:'sciences',diff:1},
  {text:"Quelle est la planète la plus proche du Soleil ?",opts:["Venus","Mars","Mercure","Terre"],ans:2,cat:'sciences',diff:1},
  {text:"Quel gaz les plantes absorbent-elles pour la photosynthèse ?",opts:["Oxygène","Azote","CO2","Hydrogène"],ans:2,cat:'sciences',diff:1},
  {text:"Quel scientifique a formulé la théorie de la relativité ?",opts:["Newton","Curie","Einstein","Hawking"],ans:2,cat:'sciences',diff:1},
  {text:"Combien d'os y a-t-il dans le corps humain adulte ?",opts:["186","196","206","216"],ans:2,cat:'sciences',diff:3},
  {text:"Quel est le numéro atomique de l'hydrogène ?",opts:["1","2","3","4"],ans:0,cat:'sciences',diff:2},
  {text:"Quelle planète est surnommée 'la planète rouge' ?",opts:["Jupiter","Mars","Mercure","Saturne"],ans:1,cat:'sciences',diff:1},
  {text:"Quel est le métal le plus léger ?",opts:["Aluminium","Titane","Lithium","Magnésium"],ans:2,cat:'sciences',diff:3},
  {text:"Combien de chromosomes possède l'être humain ?",opts:["23","44","46","48"],ans:2,cat:'sciences',diff:3},
  {text:"Dans quel film trouve-t-on Jack Sparrow ?",opts:["Pirates des Caraïbes","Gladiator","Titanic","Avatar"],ans:0,cat:'cinema',diff:1},
  {text:"Qui joue Iron Man dans les films Marvel ?",opts:["Chris Evans","Chris Hemsworth","Robert Downey Jr.","Mark Ruffalo"],ans:2,cat:'cinema',diff:1},
  {text:"Dans quel film dit-on 'Je suis ton père' ?",opts:["Star Wars IV","Star Wars V","Star Wars VI","Rogue One"],ans:1,cat:'cinema',diff:1},
  {text:"Qui réalise la saga 'Le Seigneur des Anneaux' ?",opts:["Spielberg","Cameron","Peter Jackson","Ridley Scott"],ans:2,cat:'cinema',diff:2},
  {text:"Quelle série parle d'enfants et de créatures surnaturelles à Hawkins ?",opts:["Dark","The Witcher","Stranger Things","Squid Game"],ans:2,cat:'cinema',diff:1},
  {text:"Qui joue Hermione Granger dans Harry Potter ?",opts:["Emma Watson","Emma Stone","Natalie Portman","Keira Knightley"],ans:0,cat:'cinema',diff:1},
  {text:"Dans quelle série voit-on le Trône de Fer ?",opts:["Vikings","The Witcher","Game of Thrones","The Last Kingdom"],ans:2,cat:'cinema',diff:1},
  {text:"Dans quel film Léonardo DiCaprio rêve dans des rêves ?",opts:["The Revenant","Shutter Island","Inception","Interstellar"],ans:2,cat:'cinema',diff:2},
  {text:"Qui joue le Joker dans 'Joker' (2019) ?",opts:["Johnny Depp","Jared Leto","Joaquin Phoenix","Heath Ledger"],ans:2,cat:'cinema',diff:1},
  {text:"Dans quel pays se déroule 'Squid Game' ?",opts:["Japon","Chine","Corée du Sud","Thaïlande"],ans:2,cat:'cinema',diff:1},
  {text:"Quel groupe a chanté 'Bohemian Rhapsody' ?",opts:["The Beatles","Rolling Stones","Queen","Led Zeppelin"],ans:2,cat:'musique',diff:1},
  {text:"Quel artiste a sorti l'album 'Thriller' ?",opts:["Prince","Michael Jackson","Whitney Houston","James Brown"],ans:1,cat:'musique',diff:1},
  {text:"Dans quel pays est née Céline Dion ?",opts:["France","Belgique","Canada","Suisse"],ans:2,cat:'musique',diff:1},
  {text:"Qui chante 'Shape of You' ?",opts:["Justin Bieber","Ed Sheeran","Sam Smith","Harry Styles"],ans:1,cat:'musique',diff:1},
  {text:"Quel groupe légendaire comptait John Lennon et Paul McCartney ?",opts:["Rolling Stones","The Who","The Beatles","Pink Floyd"],ans:2,cat:'musique',diff:1},
  {text:"Quelle chanteuse est surnommée 'Queen of Pop' ?",opts:["Beyoncé","Rihanna","Madonna","Lady Gaga"],ans:2,cat:'musique',diff:1},
  {text:"Quel groupe français est connu pour 'Around the World' ?",opts:["Air","Phoenix","Daft Punk","Justice"],ans:2,cat:'musique',diff:2},
  {text:"Qui a chanté 'Hello' en 2015 ?",opts:["Beyoncé","Rihanna","Adele","Amy Winehouse"],ans:2,cat:'musique',diff:1},
  {text:"Quel compositeur était sourd en fin de vie ?",opts:["Bach","Mozart","Beethoven","Chopin"],ans:2,cat:'musique',diff:2},
  {text:"Combien de joueurs dans une équipe de football ?",opts:["9","10","11","12"],ans:2,cat:'sport',diff:1},
  {text:"Dans quel pays ont eu lieu les JO 2024 ?",opts:["USA","Japon","France","Australie"],ans:2,cat:'sport',diff:1},
  {text:"Quel pays a remporté la Coupe du Monde 2018 ?",opts:["Brésil","Allemagne","Argentine","France"],ans:3,cat:'sport',diff:1},
  {text:"Qui est surnommé 'La Pulga' dans le football ?",opts:["Cristiano Ronaldo","Lionel Messi","Neymar","Mbappé"],ans:1,cat:'sport',diff:2},
  {text:"Dans quel sport marque-t-on des 'essais' ?",opts:["Football","Hockey","Rugby","Basketball"],ans:2,cat:'sport',diff:1},
  {text:"Quel pays a gagné le plus de Coupes du Monde ?",opts:["Allemagne","Italie","Brésil","Argentine"],ans:2,cat:'sport',diff:2},
  {text:"Combien de sets pour gagner en Grand Chelem hommes ?",opts:["2","3","4","5"],ans:1,cat:'sport',diff:2},
  {text:"Quel sport utilise un volant (shuttlecock) ?",opts:["Tennis","Badminton","Squash","Ping-pong"],ans:1,cat:'sport',diff:1},
  {text:"De quel pays vient la pizza ?",opts:["Grèce","Espagne","France","Italie"],ans:3,cat:'cuisine',diff:1},
  {text:"Quel fruit est utilisé pour faire le guacamole ?",opts:["Mangue","Avocat","Citron vert","Ananas"],ans:1,cat:'cuisine',diff:1},
  {text:"De quel pays viennent les sushis ?",opts:["Chine","Corée","Japon","Thaïlande"],ans:2,cat:'cuisine',diff:1},
  {text:"Quelle épice donne sa couleur jaune au curry ?",opts:["Safran","Curcuma","Paprika","Cumin"],ans:1,cat:'cuisine',diff:2},
  {text:"De quel pays vient le croissant à l'origine ?",opts:["France","Belgique","Autriche","Suisse"],ans:2,cat:'cuisine',diff:3},
  {text:"Quel alcool est distillé à partir d'agave ?",opts:["Vodka","Rhum","Tequila","Gin"],ans:2,cat:'cuisine',diff:2},
  {text:"Quel légume est la base du guacamole ?",opts:["Tomate","Oignon","Avocat","Piment"],ans:2,cat:'cuisine',diff:1},
  {text:"Qui a fondé Apple avec Steve Jobs ?",opts:["Bill Gates","Steve Wozniak","Mark Zuckerberg","Elon Musk"],ans:1,cat:'tech',diff:2},
  {text:"En quelle année a été créé Facebook ?",opts:["2001","2002","2003","2004"],ans:3,cat:'tech',diff:2},
  {text:"Qui a inventé le téléphone ?",opts:["Edison","Tesla","Graham Bell","Marconi"],ans:2,cat:'tech',diff:1},
  {text:"En quelle année a été fondée Google ?",opts:["1996","1997","1998","1999"],ans:2,cat:'tech',diff:2},
  {text:"Quel langage de programmation est le plus utilisé ?",opts:["Java","C++","Python","JavaScript"],ans:3,cat:'tech',diff:2},
  {text:"Que signifie CPU ?",opts:["Central Power Unit","Central Processing Unit","Core Processing Unit","Computer Primary Unit"],ans:1,cat:'tech',diff:2},
  {text:"Quelle est la couleur du sang des pieuvres ?",opts:["Rouge","Vert","Bleu","Violet"],ans:2,cat:'culture',diff:3},
  {text:"Combien de jours dure une année bissextile ?",opts:["364","365","366","367"],ans:2,cat:'culture',diff:1},
  {text:"Quel animal est le symbole de la paix ?",opts:["Aigle","Colombe","Hirondelle","Cygne"],ans:1,cat:'culture',diff:1},
  {text:"Combien font 15% de 200 ?",opts:["25","30","35","40"],ans:1,cat:'culture',diff:1},
  {text:"Combien y a-t-il de secondes dans une heure ?",opts:["3 000","3 600","4 000","4 200"],ans:1,cat:'culture',diff:1},
  {text:"Quel pays a inventé le papier ?",opts:["Japon","Inde","Chine","Égypte"],ans:2,cat:'culture',diff:2},
  {text:"Quel est le plus grand désert du monde ?",opts:["Sahara","Gobi","Antarctique","Arabie"],ans:2,cat:'culture',diff:3},
  {text:"Combien de faces a un cube ?",opts:["4","5","6","8"],ans:2,cat:'culture',diff:1},
];

const quizRooms = new Map();

function makeQuizRoom(code, host) {
  return {
    code, host, phase:'WAITING',
    players:[], questions:[], qIndex:0,
    buzzedSlot:-1, secondChanceSlot:-1, firstWrongAns:-1,
    streaks:[0,0,0,0], wins:[0,0,0,0], timer:null, questionStartTime:0,
  };
}

function qSnap(room, extra={}) {
  return {
    type:'state', phase:room.phase,
    players:room.players.map(p=>({name:p.name,score:p.score,slot:p.slot,streak:room.streaks[p.slot]||0,jokers:p.jokers})),
    wins:[...room.wins], qIndex:room.qIndex, total:room.questions.length,
    question:room.questions[room.qIndex]?{text:room.questions[room.qIndex].text,opts:room.questions[room.qIndex].opts}:null,
    buzzedSlot:room.buzzedSlot, secondChanceSlot:room.secondChanceSlot, firstWrongAns:room.firstWrongAns,
    code:room.code,
    ...extra,
  };
}

function qStart(room) {
  if(room.qIndex>=room.questions.length){qEnd(room);return;}
  room.phase='QUESTION'; room.buzzedSlot=-1; room.secondChanceSlot=-1; room.firstWrongAns=-1;
  room.questionStartTime=Date.now();
  bcast(room.players,{...qSnap(room),timerSeconds:15});
  clearTimeout(room.timer);
  room.timer=setTimeout(()=>{if(room.phase==='QUESTION')qReveal(room,-1,-1);},15000);
}

function qReveal(room, answererSlot, selectedIndex, isSecondChance=false) {
  clearTimeout(room.timer);
  const q=room.questions[room.qIndex];
  const correct=selectedIndex>=0&&selectedIndex===q.ans;
  let pts=0,streakBonus=false,timeBonus=false;
  if(correct&&answererSlot>=0){
    pts=isSecondChance?1:2;
    room.streaks[answererSlot]++;
    if(room.streaks[answererSlot]>0&&room.streaks[answererSlot]%3===0){pts++;streakBonus=true;}
    const elapsed=Date.now()-room.questionStartTime;
    if(!isSecondChance&&elapsed<5000){pts++;timeBonus=true;}
    room.players[answererSlot].score+=pts;
  }else if(answererSlot>=0&&!correct){room.streaks[answererSlot]=0;}
  room.phase='REVEAL';
  bcast(room.players,{...qSnap(room),reveal:{correct:q.ans,selected:selectedIndex,isCorrect:correct,answererSlot,isSecondChance,pts,streakBonus,timeBonus,firstWrongAns:room.firstWrongAns}});
  room.qIndex++;
  room.timer=setTimeout(()=>qStart(room),3000);
}

function qWrong(room, wrongSlot, selectedIndex) {
  room.streaks[wrongSlot]=0; room.firstWrongAns=selectedIndex;
  // Second chance only in 2-player games
  if(room.players.length===2){
    const other=wrongSlot===0?1:0;
    room.phase='SECOND_CHANCE'; room.secondChanceSlot=other;
    bcast(room.players,{...qSnap(room),timerSeconds:5});
    clearTimeout(room.timer);
    room.timer=setTimeout(()=>{if(room.phase==='SECOND_CHANCE')qReveal(room,-1,-1);},5000);
  }else qReveal(room,-1,-1);
}

function qEnd(room) {
  clearTimeout(room.timer); room.phase='GAME_OVER';
  let win=-1;
  let bestScore=-1;
  room.players.forEach(p=>{if(p.score>bestScore){bestScore=p.score;win=p.slot;}else if(p.score===bestScore){win=-1;}});
  if(win>=0)room.wins[win]++;
  bcast(room.players,{...qSnap(room),winnerSlot:win,wins:[...room.wins]});
  broadcastLobby();
}

wssQuiz.on('connection',ws=>{
  makeWS(wssQuiz).alive(ws);
  let myRoom = null;
  ws.on('close',()=>{
    makeWS(wssQuiz).clear(ws);
    if(!myRoom)return;
    const idx=myRoom.players.findIndex(p=>p.ws===ws);if(idx<0)return;
    const name=myRoom.players[idx].name;
    myRoom.players.splice(idx,1);myRoom.players.forEach((p,i)=>p.slot=i);
    clearTimeout(myRoom.timer);myRoom.phase='WAITING';myRoom.streaks=[0,0,0,0];
    bcast(myRoom.players,{type:'player_left',name});
    if(myRoom.players.length===0){quizRooms.delete(myRoom.code);}
    broadcastLobby();
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    switch(d.type){
      case 'create':{
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const code=genCode(quizRooms);
        const room=makeQuizRoom(code,name);
        quizRooms.set(code,room);
        myRoom=room;
        const slot=0;
        room.players.push({ws,name,score:0,slot,jokers:{fifty:true,pass:true}});
        wsend(ws,{type:'created',code,slot,name});
        wsend(ws,qSnap(room));
        broadcastLobby();
        break;
      }
      case 'join':{
        const code=String(d.code||'').trim().toUpperCase();
        const room=quizRooms.get(code);
        if(!room){wsend(ws,{type:'error',msg:'Salle introuvable.'});return;}
        if(room.players.length>=4){wsend(ws,{type:'error',msg:'Partie pleine (4 joueurs max).'});return;}
        if(room.phase!=='WAITING'){wsend(ws,{type:'error',msg:'La partie a déjà commencé.'});return;}
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot=room.players.length;
        room.players.push({ws,name,score:0,slot,jokers:{fifty:true,pass:true}});
        myRoom=room;
        wsend(ws,{type:'welcome',slot,name,code});
        // Move to SETUP as soon as 2+ players; host can start whenever ready
        if(room.players.length>=2){room.phase='SETUP';}
        bcast(room.players,qSnap(room));
        broadcastLobby();
        break;
      }
      case 'start':{
        if(!myRoom)return;
        const p=myRoom.players.find(x=>x.ws===ws);if(!p||p.slot!==0)return;
        if(!['SETUP','GAME_OVER'].includes(myRoom.phase))return;
        const cats=Array.isArray(d.categories)&&d.categories.length?new Set(d.categories):null;
        const diff=Number(d.difficulty)||0;
        const count=Number(d.count)||15;
        let pool=ALL_Q.filter(q=>{if(cats&&!cats.has(q.cat))return false;if(diff>0&&q.diff>diff)return false;return true;});
        if(Array.isArray(d.custom)&&d.custom.length)d.custom.forEach(cq=>{if(cq.text&&Array.isArray(cq.opts)&&cq.opts.length===4&&cq.ans>=0&&cq.ans<=3)pool.push({...cq,cat:'custom',diff:2});});
        if(!pool.length){wsend(ws,{type:'error',msg:'Aucune question avec ces filtres.'});return;}
        myRoom.players.forEach(x=>{x.score=0;x.jokers={fifty:true,pass:true};});
        myRoom.streaks=[0,0,0,0];
        myRoom.questions=shuffle(pool).slice(0,Math.min(count,pool.length));myRoom.qIndex=0;
        myRoom.phase='COUNTDOWN';bcast(myRoom.players,{type:'countdown',seconds:3});
        clearTimeout(myRoom.timer);myRoom.timer=setTimeout(()=>qStart(myRoom),3000);
        broadcastLobby();
        break;
      }
      case 'buzz':{
        if(!myRoom||myRoom.phase!=='QUESTION')return;
        const p=myRoom.players.find(x=>x.ws===ws);if(!p)return;
        clearTimeout(myRoom.timer);myRoom.phase='BUZZED';myRoom.buzzedSlot=p.slot;
        bcast(myRoom.players,{...qSnap(myRoom),timerSeconds:10});
        myRoom.timer=setTimeout(()=>{if(myRoom.phase==='BUZZED')qWrong(myRoom,p.slot,-1);},10000);
        break;
      }
      case 'answer':{
        if(!myRoom)return;
        const p=myRoom.players.find(x=>x.ws===ws);if(!p)return;
        const idx=Number(d.index);if(idx<0||idx>3)return;
        if(myRoom.phase==='BUZZED'&&p.slot===myRoom.buzzedSlot){
          if(idx===myRoom.questions[myRoom.qIndex].ans)qReveal(myRoom,p.slot,idx,false);
          else qWrong(myRoom,p.slot,idx);
        }else if(myRoom.phase==='SECOND_CHANCE'&&p.slot===myRoom.secondChanceSlot){
          qReveal(myRoom,p.slot,idx,true);
        }
        break;
      }
      case 'joker':{
        if(!myRoom)return;
        const p=myRoom.players.find(x=>x.ws===ws);if(!p)return;
        if(d.kind==='fifty'&&p.jokers.fifty&&myRoom.phase==='QUESTION'){
          p.jokers.fifty=false;
          const q=myRoom.questions[myRoom.qIndex];
          const wrongs=[];for(let i=0;i<4;i++)if(i!==q.ans)wrongs.push(i);
          const hide=shuffle(wrongs).slice(0,2);
          bcast(myRoom.players,{...qSnap(myRoom),joker50:{hide}});
        }else if(d.kind==='pass'&&p.jokers.pass&&myRoom.phase==='QUESTION'){
          p.jokers.pass=false;
          clearTimeout(myRoom.timer);
          bcast(myRoom.players,{...qSnap(myRoom),jokerPass:{by:p.name}});
          myRoom.qIndex++;
          myRoom.timer=setTimeout(()=>qStart(myRoom),1500);
        }
        break;
      }
      case 'restart':{
        if(!myRoom)return;
        const p=myRoom.players.find(x=>x.ws===ws);if(!p||myRoom.phase!=='GAME_OVER')return;
        myRoom.phase='SETUP';bcast(myRoom.players,qSnap(myRoom));
        broadcastLobby();
        break;
      }
    }
  });
});

// ════════════════════════════════════════════════════════
//  DRAW
// ════════════════════════════════════════════════════════

const DRAW_WORDS = {
  animaux:['chien','chat','lion','éléphant','girafe','singe','pingouin','requin','dauphin','papillon','renard','lapin','ours','tigre','zèbre','flamant rose','hibou','tortue','crocodile','poulpe','baleine','aigle','bison','loup','raton laveur','manchot','fennec','pangolin','axolotl','capybara'],
  objets:['avion','voiture','vélo','train','bateau','fusée','hélicoptère','moto','bus','camion','parapluie','horloge','bougie','ballon','cadeau','couronne','épée','bouclier','lunettes','chapeau','clé','marteau','loupe','seringue','jumelles','sablier','boussole','télescope','accordéon','harmonica'],
  lieux:['maison','château','phare','igloo','pyramide','pont','escalier','grotte','volcan','île','désert','forêt','glacier','cimetière','stade','cirque','phare','gare','aéroport','sous-marin'],
  nourriture:['pizza','gâteau','glace','hamburger','sushi','baguette','croissant','fraise','ananas','champignon','taco','bento','fondue','ratatouille','crêpe','macaron','churros','boba','ramen','curry'],
  nature:['soleil','lune','étoile','arc-en-ciel','montagne','mer','cactus','arbre','fleur','tornde','foudre','aurora','glacier','marécage','oasis','delta','geysir','stalactite','banquise','tourbillon'],
  celebrites:['Einstein','Napoléon','Cléopâtre','Newton','Shakespeare','Picasso','Mozart','Darwin','Léonard de Vinci','Marie Curie'],
  divers:['dragon','licorne','fantôme','robot','sorcière','alien','super-héros','vampire','sirène','astronaute','pirate','ninja','chevalier','pharaon','elfes','zombie','fée','cyclope','centaure','phoenix'],
};

function drawNorm(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();}
function drawClose(g,a){
  const gn=drawNorm(g),an=drawNorm(a);
  if(gn===an)return'correct';
  if(Math.abs(gn.length-an.length)>3)return'wrong';
  let d=0;const lo=gn.length>an.length?gn:an,sh=gn.length>an.length?an:gn;
  for(let i=0;i<sh.length;i++)if(sh[i]!==lo[i])d++;
  d+=lo.length-sh.length;
  return d<=2?'close':'wrong';
}
function buildHint(word,revealed){
  return word.split('').map((c,i)=>{if(c===' ')return ' ';if(c==='-')return '-';return revealed.includes(i)?c:'_';}).join(' ');
}

const drawRooms = new Map();

function makeDrawRoom(code, host) {
  return {
    code, host, phase:'WAITING',
    players:[],drawerSlot:0,round:0,maxRounds:6,
    word:null,scores:[0,0,0,0],timer:null,guessedBy:-1,
    strokeBatches:[],revealedLetters:[],
  };
}

function dSnap(room, extra={}, forSlot=-1){
  const base={type:'draw_state',phase:room.phase,
    players:room.players.map(p=>({name:p.name,slot:p.slot})),
    scores:[...room.scores],drawerSlot:room.drawerSlot,round:room.round,maxRounds:room.maxRounds,
    letterCount:room.word?room.word.length:0,
    hint:room.word?buildHint(room.word,room.revealedLetters):null,
    guessedBy:room.guessedBy,
    guessedSlots:room.roundGuessers?[...room.roundGuessers]:[],
    code:room.code,...extra};
  // Only send word to the drawer
  if(forSlot>=0 && forSlot===room.drawerSlot && room.word) base.word=room.word;
  return base;
}

function dStartRound(room){
  if(room.round>=room.maxRounds){dEnd(room);return;}
  room.round++;
  // Rotate drawer through ALL players
  room.drawerSlot=room.players[(room.round-1)%room.players.length]?.slot??0;
  const allWords=Object.values(DRAW_WORDS).flat();
  room.word=shuffle(allWords)[0];
  room.phase='DRAWING';room.guessedBy=-1;room.strokeBatches=[];room.revealedLetters=[];
  room.roundGuessers=new Set();
  clearTimeout(room.timer);
  room.players.forEach(p=>{
    wsend(p.ws,dSnap(room,{timerSeconds:60},p.slot));
  });
  room.timer=setTimeout(()=>{if(room.phase==='DRAWING')dReveal(room);},60000);
}

function dReveal(room){
  clearTimeout(room.timer);room.phase='ROUND_OVER';
  // Broadcast with revealWord to ALL, including word reveal
  room.players.forEach(p=>{
    wsend(p.ws,{...dSnap(room,{revealWord:room.word},p.slot),revealWord:room.word,guessedBy:room.guessedBy,guessedSlots:room.roundGuessers?[...room.roundGuessers]:[]});
  });
  room.timer=setTimeout(()=>{if(room.players.length>=2)dStartRound(room);},4000);
}

function dEnd(room){
  clearTimeout(room.timer);room.phase='GAME_OVER';
  let win=-1,best=-1;
  room.players.forEach(p=>{const s=room.scores[p.slot]??0;if(s>best){best=s;win=p.slot;}else if(s===best){win=-1;}});
  room.players.forEach(p=>{wsend(p.ws,{...dSnap(room,{winnerSlot:win},p.slot)});});
  broadcastLobby();
}

wssDraw.on('connection',ws=>{
  makeWS(wssDraw).alive(ws);
  let myRoom = null;
  ws.on('close',()=>{
    makeWS(wssDraw).clear(ws);
    if(!myRoom)return;
    const idx=myRoom.players.findIndex(p=>p.ws===ws);if(idx<0)return;
    const name=myRoom.players[idx].name;
    myRoom.players.splice(idx,1);myRoom.players.forEach((p,i)=>p.slot=i);
    clearTimeout(myRoom.timer);myRoom.phase='WAITING';myRoom.scores=[0,0,0,0];myRoom.round=0;
    bcast(myRoom.players,{type:'player_left',name});
    if(myRoom.players.length===0){drawRooms.delete(myRoom.code);}
    broadcastLobby();
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    const player=myRoom?myRoom.players.find(p=>p.ws===ws):null;
    switch(d.type){
      case 'create_draw':{
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const code=genCode(drawRooms);
        const room=makeDrawRoom(code,name);
        drawRooms.set(code,room);
        myRoom=room;
        room.players.push({ws,name,slot:0});
        wsend(ws,{type:'created_draw',code,slot:0,name});
        wsend(ws,dSnap(room,{},0));
        broadcastLobby();
        break;
      }
      case 'join_draw':{
        const code=String(d.code||'').trim().toUpperCase();
        const room=drawRooms.get(code);
        if(!room){wsend(ws,{type:'error',msg:'Salle introuvable.'});return;}
        if(room.players.length>=4){wsend(ws,{type:'error',msg:'Partie pleine (4 joueurs max).'});return;}
        if(room.phase!=='WAITING'){wsend(ws,{type:'error',msg:'La partie a déjà commencé.'});return;}
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot=room.players.length;
        room.players.push({ws,name,slot});
        myRoom=room;
        wsend(ws,{type:'welcome_draw',slot,name,code});
        room.players.forEach(p=>wsend(p.ws,dSnap(room,{},p.slot)));
        broadcastLobby();
        break;
      }
      case 'start_draw':{
        if(!player||player.slot!==0)return;
        if(!myRoom||!['WAITING','READY','GAME_OVER'].includes(myRoom.phase))return;
        if(myRoom.players.length<2){wsend(ws,{type:'error',msg:'Il faut au moins 2 joueurs.'});return;}
        if(d.rounds)myRoom.maxRounds=Math.min(24,Math.max(2,Number(d.rounds)));
        myRoom.scores=[0,0,0,0];myRoom.round=0;myRoom.roundGuessers=new Set();
        dStartRound(myRoom);
        broadcastLobby();
        break;
      }
      case 'draw_pts':{
        if(!player||!myRoom||player.slot!==myRoom.drawerSlot||myRoom.phase!=='DRAWING')return;
        myRoom.strokeBatches.push(d.pts);
        // Broadcast to ALL players (including drawer for latency compensation on other devices)
        myRoom.players.forEach(p=>{if(p.slot!==myRoom.drawerSlot)wsend(p.ws,{type:'draw_pts',pts:d.pts});});
        break;
      }
      case 'draw_undo':{
        if(!player||!myRoom||player.slot!==myRoom.drawerSlot)return;
        if(myRoom.strokeBatches.length>0)myRoom.strokeBatches.pop();
        // Broadcast replay to all non-drawers
        myRoom.players.forEach(p=>{if(p.slot!==myRoom.drawerSlot)wsend(p.ws,{type:'draw_replay',batches:myRoom.strokeBatches});});
        break;
      }
      case 'draw_clear':{
        if(!player||!myRoom||player.slot!==myRoom.drawerSlot)return;
        myRoom.strokeBatches=[];bcast(myRoom.players,{type:'draw_clear'});
        break;
      }
      case 'draw_hint':{
        if(!player||!myRoom||player.slot!==myRoom.drawerSlot||myRoom.phase!=='DRAWING')return;
        const word=myRoom.word;
        const unrevealed=[];
        for(let i=0;i<word.length;i++){if(word[i]===' '||word[i]==='-')continue;if(!myRoom.revealedLetters.includes(i))unrevealed.push(i);}
        if(!unrevealed.length)return;
        const pos=unrevealed[Math.floor(Math.random()*unrevealed.length)];
        myRoom.revealedLetters.push(pos);
        myRoom.scores[myRoom.drawerSlot]=Math.max(0,myRoom.scores[myRoom.drawerSlot]-1);
        // Broadcast updated state with new hint to everyone
        myRoom.players.forEach(p=>{wsend(p.ws,dSnap(myRoom,{},p.slot));});
        break;
      }
      case 'guess':{
        if(!player||!myRoom||player.slot===myRoom.drawerSlot||myRoom.phase!=='DRAWING')return;
        if(!myRoom.roundGuessers)myRoom.roundGuessers=new Set();
        if(myRoom.roundGuessers.has(player.slot))return; // already guessed correctly
        const guess=String(d.word||'').trim().slice(0,60);if(!guess)return;
        const result=drawClose(guess,myRoom.word);
        // Always broadcast the guess result to everyone (so all see wrong guesses as chat)
        bcast(myRoom.players,{type:'guess_result',name:player.name,slot:player.slot,word:guess,result});
        if(result==='correct'){
          myRoom.roundGuessers.add(player.slot);
          myRoom.scores[player.slot]+=2;myRoom.scores[myRoom.drawerSlot]+=1;
          myRoom.guessedBy=player.slot;
          // Check if all non-drawers have guessed
          const numGuessers=myRoom.players.filter(p=>p.slot!==myRoom.drawerSlot).length;
          if(myRoom.roundGuessers.size>=numGuessers){dReveal(myRoom);}
          else{
            // Send updated state to everyone with new scores + guessedSlots
            myRoom.players.forEach(p=>{wsend(p.ws,dSnap(myRoom,{scores:[...myRoom.scores]},p.slot));});
          }
        }
        break;
      }
      case 'restart_draw':{
        if(!player||!myRoom||myRoom.phase!=='GAME_OVER')return;
        myRoom.phase='READY';myRoom.scores=[0,0,0,0];myRoom.round=0;
        myRoom.players.forEach(p=>wsend(p.ws,dSnap(myRoom,{},p.slot)));
        broadcastLobby();
        break;
      }
    }
  });
});

// ════════════════════════════════════════════════════════
//  PUISSANCE 4
// ════════════════════════════════════════════════════════

const p4Rooms = new Map();

function makeP4Room(code, host) {
  return { code, host, players:[], phase:'WAITING', board:null, turn:0, wins:[0,0], timer:null };
}
function p4Board(){return Array(6).fill(null).map(()=>Array(7).fill(0));}
function p4Snap(room,extra={}){return{type:'p4_state',phase:room.phase,players:room.players.map(p=>({name:p.name,slot:p.slot})),board:room.board,turn:room.turn,wins:[...room.wins],code:room.code,...extra};}

function p4CheckWin(board,v){
  for(let r=0;r<6;r++)for(let c=0;c<4;c++)if(board[r][c]===v&&board[r][c+1]===v&&board[r][c+2]===v&&board[r][c+3]===v)return[[r,c],[r,c+1],[r,c+2],[r,c+3]];
  for(let r=0;r<3;r++)for(let c=0;c<7;c++)if(board[r][c]===v&&board[r+1][c]===v&&board[r+2][c]===v&&board[r+3][c]===v)return[[r,c],[r+1,c],[r+2,c],[r+3,c]];
  for(let r=3;r<6;r++)for(let c=0;c<4;c++)if(board[r][c]===v&&board[r-1][c+1]===v&&board[r-2][c+2]===v&&board[r-3][c+3]===v)return[[r,c],[r-1,c+1],[r-2,c+2],[r-3,c+3]];
  for(let r=0;r<3;r++)for(let c=0;c<4;c++)if(board[r][c]===v&&board[r+1][c+1]===v&&board[r+2][c+2]===v&&board[r+3][c+3]===v)return[[r,c],[r+1,c+1],[r+2,c+2],[r+3,c+3]];
  return null;
}

wssP4.on('connection',ws=>{
  makeWS(wssP4).alive(ws);
  let myRoom = null;
  ws.on('close',()=>{
    makeWS(wssP4).clear(ws);
    if(!myRoom)return;
    const idx=myRoom.players.findIndex(p=>p.ws===ws);if(idx<0)return;
    const name=myRoom.players[idx].name;
    myRoom.players.splice(idx,1);myRoom.players.forEach((p,i)=>p.slot=i);
    myRoom.phase='WAITING';bcast(myRoom.players,{type:'player_left',name});
    if(myRoom.players.length===0){p4Rooms.delete(myRoom.code);}
    broadcastLobby();
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    const player=myRoom?myRoom.players.find(p=>p.ws===ws):null;
    switch(d.type){
      case 'create_p4':{
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const code=genCode(p4Rooms);
        const room=makeP4Room(code,name);
        p4Rooms.set(code,room);
        myRoom=room;
        room.players.push({ws,name,slot:0});
        wsend(ws,{type:'created_p4',code,slot:0,name});
        wsend(ws,p4Snap(room));
        broadcastLobby();
        break;
      }
      case 'join_p4':{
        const code=String(d.code||'').trim().toUpperCase();
        const room=p4Rooms.get(code);
        if(!room){wsend(ws,{type:'error',msg:'Salle introuvable.'});return;}
        if(room.players.length>=2){wsend(ws,{type:'error',msg:'Partie pleine (2 joueurs max).'});return;}
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot=room.players.length;room.players.push({ws,name,slot});
        myRoom=room;
        wsend(ws,{type:'welcome_p4',slot,name,code});
        bcast(room.players,p4Snap(room));
        broadcastLobby();
        break;
      }
      case 'start_p4':{
        if(!player||!myRoom||player.slot!==0||!['WAITING','READY','GAME_OVER'].includes(myRoom.phase))return;
        if(myRoom.players.length<2){wsend(ws,{type:'error',msg:'Il faut 2 joueurs.'});return;}
        myRoom.board=p4Board();myRoom.turn=0;myRoom.phase='PLAYING';bcast(myRoom.players,p4Snap(myRoom));
        broadcastLobby();
        break;
      }
      case 'drop':{
        if(!player||!myRoom||myRoom.phase!=='PLAYING'||player.slot!==myRoom.turn)return;
        const col=Number(d.col);if(col<0||col>6)return;
        let row=-1;
        for(let r=5;r>=0;r--){if(myRoom.board[r][col]===0){myRoom.board[r][col]=player.slot+1;row=r;break;}}
        if(row<0)return;
        const winLine=p4CheckWin(myRoom.board,player.slot+1);
        const isDraw=!winLine&&myRoom.board[0].every(c=>c!==0);
        if(winLine){
          myRoom.wins[player.slot]++;myRoom.phase='GAME_OVER';
          bcast(myRoom.players,{...p4Snap(myRoom),winLine,winnerSlot:player.slot});
          broadcastLobby();
        }else if(isDraw){
          myRoom.phase='GAME_OVER';bcast(myRoom.players,{...p4Snap(myRoom),isDraw:true,winnerSlot:-1});
          broadcastLobby();
        }else{
          myRoom.turn=myRoom.turn===0?1:0;bcast(myRoom.players,p4Snap(myRoom));
        }
        break;
      }
      case 'restart_p4':{
        if(!player||!myRoom||myRoom.phase!=='GAME_OVER')return;
        myRoom.board=p4Board();myRoom.turn=0;myRoom.phase='PLAYING';bcast(myRoom.players,p4Snap(myRoom));
        broadcastLobby();
        break;
      }
    }
  });
});

// ════════════════════════════════════════════════════════
//  MORPION
// ════════════════════════════════════════════════════════

const morpionRooms = new Map();
const MORPION_LINES=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

function makeMorpionRoom(code, host) {
  return { code, host, players:[], phase:'WAITING', board:Array(9).fill(0), turn:0, wins:[0,0], draws:0, gameWins:5, timer:null };
}
function mSnap(room,extra={}){return{type:'morpion_state',phase:room.phase,players:room.players.map(p=>({name:p.name,slot:p.slot})),board:[...room.board],turn:room.turn,wins:[...room.wins],draws:room.draws,gameWins:room.gameWins,code:room.code,...extra};}

wssMorpion.on('connection',ws=>{
  makeWS(wssMorpion).alive(ws);
  let myRoom = null;
  ws.on('close',()=>{
    makeWS(wssMorpion).clear(ws);
    if(!myRoom)return;
    const idx=myRoom.players.findIndex(p=>p.ws===ws);if(idx<0)return;
    const name=myRoom.players[idx].name;
    myRoom.players.splice(idx,1);myRoom.players.forEach((p,i)=>p.slot=i);
    myRoom.phase='WAITING';bcast(myRoom.players,{type:'player_left',name});
    if(myRoom.players.length===0){morpionRooms.delete(myRoom.code);}
    broadcastLobby();
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    const player=myRoom?myRoom.players.find(p=>p.ws===ws):null;
    switch(d.type){
      case 'create_morpion':{
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const code=genCode(morpionRooms);
        const room=makeMorpionRoom(code,name);
        morpionRooms.set(code,room);
        myRoom=room;
        room.players.push({ws,name,slot:0});
        wsend(ws,{type:'created_morpion',code,slot:0,name});
        wsend(ws,mSnap(room));
        broadcastLobby();
        break;
      }
      case 'join_morpion':{
        const code=String(d.code||'').trim().toUpperCase();
        const room=morpionRooms.get(code);
        if(!room){wsend(ws,{type:'error',msg:'Salle introuvable.'});return;}
        if(room.players.length>=2){wsend(ws,{type:'error',msg:'Partie pleine (2 joueurs max).'});return;}
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot=room.players.length;morpionRooms.get(code).players.push({ws,name,slot});
        myRoom=room;
        wsend(ws,{type:'welcome_morpion',slot,name,code});
        bcast(room.players,mSnap(room));
        broadcastLobby();
        break;
      }
      case 'start_morpion':{
        if(!player||!myRoom||player.slot!==0||!['WAITING','READY','ROUNDOVER'].includes(myRoom.phase))return;
        if(myRoom.players.length<2){wsend(ws,{type:'error',msg:'Il faut 2 joueurs.'});return;}
        myRoom.board=Array(9).fill(0);myRoom.phase='PLAYING';
        const roundNum=myRoom.wins[0]+myRoom.wins[1]+myRoom.draws;
        myRoom.turn=roundNum%2;
        bcast(myRoom.players,mSnap(myRoom));
        break;
      }
      case 'play':{
        if(!player||!myRoom||myRoom.phase!=='PLAYING'||player.slot!==myRoom.turn)return;
        const cell=Number(d.cell);if(cell<0||cell>8||myRoom.board[cell]!==0)return;
        myRoom.board[cell]=player.slot+1;
        const winLine=MORPION_LINES.find(l=>l.every(i=>myRoom.board[i]===player.slot+1))||null;
        const isDraw=!winLine&&myRoom.board.every(c=>c!==0);
        if(winLine){
          myRoom.wins[player.slot]++;
          myRoom.phase=myRoom.wins[player.slot]>=myRoom.gameWins?'GAME_OVER':'ROUNDOVER';
          bcast(myRoom.players,{...mSnap(myRoom),winLine,winnerSlot:player.slot});
          if(myRoom.phase==='GAME_OVER')broadcastLobby();
        }else if(isDraw){
          myRoom.draws++;myRoom.phase='ROUNDOVER';
          bcast(myRoom.players,{...mSnap(myRoom),isDraw:true});
        }else{
          myRoom.turn=myRoom.turn===0?1:0;bcast(myRoom.players,mSnap(myRoom));
        }
        break;
      }
      case 'next_morpion':{
        if(!player||!myRoom||myRoom.phase!=='ROUNDOVER')return;
        myRoom.board=Array(9).fill(0);myRoom.phase='PLAYING';
        myRoom.turn=(myRoom.wins[0]+myRoom.wins[1]+myRoom.draws)%2;
        bcast(myRoom.players,mSnap(myRoom));
        break;
      }
      case 'restart_morpion':{
        if(!player||!myRoom||myRoom.phase!=='GAME_OVER')return;
        myRoom.board=Array(9).fill(0);myRoom.wins=[0,0];myRoom.draws=0;
        myRoom.phase='PLAYING';myRoom.turn=0;bcast(myRoom.players,mSnap(myRoom));
        broadcastLobby();
        break;
      }
    }
  });
});

// ════════════════════════════════════════════════════════
//  TABOO (MOTS INTERDITS)
// ════════════════════════════════════════════════════════

const TABOO_CARDS=[
  {word:'CHAT',forbidden:['animal','poil','miaou','griffes','ronron']},
  {word:'VOITURE',forbidden:['conduire','roue','moteur','route','véhicule']},
  {word:'PLAGE',forbidden:['mer','sable','soleil','vacances','bronzer']},
  {word:'PIZZA',forbidden:['manger','fromage','italie','tomate','pain']},
  {word:'ÉCOLE',forbidden:['apprendre','professeur','cours','élève','étudier']},
  {word:'MONTAGNE',forbidden:['ski','neige','altitude','escalader','sommet']},
  {word:'MUSIQUE',forbidden:['chanter','instrument','son','mélodie','rythme']},
  {word:'AVION',forbidden:['voler','aéroport','voyage','pilote','ciel']},
  {word:'MÉDECIN',forbidden:['malade','hôpital','soigner','ordonnance','santé']},
  {word:'MARIAGE',forbidden:['épouser','bague','amour','cérémonie','noces']},
  {word:'CHOCOLAT',forbidden:['sucre','délicieux','noir','cacao','gourmandise']},
  {word:'PARIS',forbidden:['France','capitale','tour Eiffel','ville','parisien']},
  {word:'REQUIN',forbidden:['poisson','mer','dents','attaque','nager']},
  {word:'NUIT',forbidden:['sombre','dormir','étoile','lune','obscurité']},
  {word:'FOOTBALL',forbidden:['ballon','sport','équipe','but','jouer']},
  {word:'BANANE',forbidden:['fruit','jaune','singe','manger','tropical']},
  {word:'NUAGE',forbidden:['ciel','pluie','blanc','flotter','météo']},
  {word:'TÉLÉPHONE',forbidden:['appeler','portable','écran','internet','communication']},
  {word:'CINÉMA',forbidden:['film','acteur','regarder','salle','popcorn']},
  {word:'ROBOT',forbidden:['machine','métal','programme','futur','intelligence']},
  {word:'VAMPIRE',forbidden:['sang','nuit','cape','mordre','château']},
  {word:'ASTRONAUTE',forbidden:['espace','fusée','lune','planète','flotter']},
  {word:'DINOSAURE',forbidden:['préhistoire','extinction','grand','reptile','fossile']},
  {word:'PIRATE',forbidden:['navire','trésor','mer','crochet','île']},
  {word:'MAGIE',forbidden:['magicien','baguette','illusionniste','tour','disparaître']},
  {word:'CHÂTEAU',forbidden:['roi','moyen âge','tour','chevalier','forteresse']},
  {word:'BIBLIOTHÈQUE',forbidden:['livre','lire','emprunter','silence','étagère']},
  {word:'JARDIN',forbidden:['fleur','plante','herbe','arroser','nature']},
  {word:'ORDINATEUR',forbidden:['écran','clavier','internet','programme','souris']},
  {word:'ANNIVERSAIRE',forbidden:['gâteau','bougie','cadeau','fête','âge']},
  {word:'NATATION',forbidden:['eau','piscine','nager','sport','maillot']},
  {word:'CUISINE',forbidden:['manger','préparer','repas','four','chef']},
  {word:'SOLEIL',forbidden:['chaud','lumière','jaune','été','rayons']},
  {word:'VOYAGE',forbidden:['partir','tourisme','valise','pays','découvrir']},
];

const tabooRooms = new Map();

function makeTabooRoom(code, host) {
  return { code, host, players:[], phase:'WAITING', describerSlot:0, round:0, maxRounds:8, card:null, scores:[0,0], timer:null, usedCards:[] };
}
function tSnap(room,extra={}){return{type:'taboo_state',phase:room.phase,players:room.players.map(p=>({name:p.name,slot:p.slot})),scores:[...room.scores],describerSlot:room.describerSlot,round:room.round,maxRounds:room.maxRounds,code:room.code,...extra};}

function tStartRound(room){
  if(room.round>=room.maxRounds){tEnd(room);return;}
  room.round++;room.describerSlot=(room.round-1)%2;
  const available=TABOO_CARDS.filter((_,i)=>!room.usedCards.includes(i));
  if(!available.length){room.usedCards=[];}
  const pool=room.usedCards.length?TABOO_CARDS.filter((_,i)=>!room.usedCards.includes(i)):TABOO_CARDS;
  const idx=Math.floor(Math.random()*pool.length);
  room.card=pool[idx];
  room.usedCards.push(TABOO_CARDS.indexOf(room.card));
  room.phase='PLAYING';
  const describer=room.players[room.describerSlot];
  const guesser=room.players[room.describerSlot===0?1:0];
  const base=tSnap(room,{timerSeconds:60,round:room.round,maxRounds:room.maxRounds});
  if(describer)wsend(describer.ws,{...base,card:{word:room.card.word,forbidden:room.card.forbidden}});
  if(guesser)wsend(guesser.ws,{...base,wordLen:room.card.word.length});
  clearTimeout(room.timer);
  room.timer=setTimeout(()=>{if(room.phase==='PLAYING')tReveal(room,false);},60000);
}

function tReveal(room,guessed){
  clearTimeout(room.timer);room.phase='REVEAL';
  bcast(room.players,{...tSnap(room),revealWord:room.card.word,guessed});
  room.timer=setTimeout(()=>{if(room.players.length===2)tStartRound(room);},3500);
}
function tEnd(room){clearTimeout(room.timer);room.phase='GAME_OVER';const win=room.scores[0]>room.scores[1]?0:room.scores[1]>room.scores[0]?1:-1;bcast(room.players,{...tSnap(room),winnerSlot:win});broadcastLobby();}

wssTaboo.on('connection',ws=>{
  makeWS(wssTaboo).alive(ws);
  let myRoom = null;
  ws.on('close',()=>{
    makeWS(wssTaboo).clear(ws);
    if(!myRoom)return;
    const idx=myRoom.players.findIndex(p=>p.ws===ws);if(idx<0)return;
    const name=myRoom.players[idx].name;
    myRoom.players.splice(idx,1);myRoom.players.forEach((p,i)=>p.slot=i);
    myRoom.phase='WAITING';myRoom.scores=[0,0];myRoom.round=0;
    bcast(myRoom.players,{type:'player_left',name});
    if(myRoom.players.length===0){tabooRooms.delete(myRoom.code);}
    broadcastLobby();
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    const player=myRoom?myRoom.players.find(p=>p.ws===ws):null;
    switch(d.type){
      case 'create_taboo':{
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const code=genCode(tabooRooms);
        const room=makeTabooRoom(code,name);
        tabooRooms.set(code,room);
        myRoom=room;
        room.players.push({ws,name,slot:0});
        wsend(ws,{type:'created_taboo',code,slot:0,name});
        wsend(ws,tSnap(room));
        broadcastLobby();
        break;
      }
      case 'join_taboo':{
        const code=String(d.code||'').trim().toUpperCase();
        const room=tabooRooms.get(code);
        if(!room){wsend(ws,{type:'error',msg:'Salle introuvable.'});return;}
        if(room.players.length>=4){wsend(ws,{type:'error',msg:'Partie pleine (4 joueurs max).'});return;}
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot=room.players.length;room.players.push({ws,name,slot});
        myRoom=room;
        wsend(ws,{type:'welcome_taboo',slot,name,code});
        bcast(room.players,tSnap(room));
        broadcastLobby();
        break;
      }
      case 'start_taboo':{
        if(!player||!myRoom||player.slot!==0||!['WAITING','READY','GAME_OVER'].includes(myRoom.phase))return;
        if(myRoom.players.length<2){wsend(ws,{type:'error',msg:'Il faut au moins 2 joueurs.'});return;}
        myRoom.scores=[0,0];myRoom.round=0;myRoom.usedCards=[];tStartRound(myRoom);
        broadcastLobby();
        break;
      }
      case 'guess_taboo':{
        if(!player||!myRoom||player.slot===myRoom.describerSlot||myRoom.phase!=='PLAYING')return;
        const guess=String(d.word||'').trim().slice(0,60);if(!guess)return;
        const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
        if(norm(guess)===norm(myRoom.card.word)){
          myRoom.scores[player.slot]+=2;myRoom.scores[myRoom.describerSlot]+=1;
          bcast(myRoom.players,{type:'taboo_correct',guesser:player.name,word:myRoom.card.word});
          tReveal(myRoom,true);
        }else{
          bcast(myRoom.players,{type:'taboo_guess',name:player.name,word:guess});
        }
        break;
      }
      case 'grille':{
        if(!player||!myRoom||player.slot===myRoom.describerSlot||myRoom.phase!=='PLAYING')return;
        myRoom.scores[myRoom.describerSlot]=Math.max(0,myRoom.scores[myRoom.describerSlot]-1);
        bcast(myRoom.players,{type:'taboo_grille',name:player.name,scores:[...myRoom.scores]});
        tReveal(myRoom,false);
        break;
      }
      case 'restart_taboo':{
        if(!player||!myRoom||myRoom.phase!=='GAME_OVER')return;
        myRoom.scores=[0,0];myRoom.round=0;myRoom.usedCards=[];myRoom.phase='READY';bcast(myRoom.players,tSnap(myRoom));
        broadcastLobby();
        break;
      }
    }
  });
});

// ════════════════════════════════════════════════════════
//  EMOJI DEVINETTE
// ════════════════════════════════════════════════════════

const EMOJI_PUZZLES=[
  {emojis:'🦁👑',answer:'Le Roi Lion',cat:'Film'},
  {emojis:'🧊❄️👸',answer:'La Reine des Neiges',cat:'Film'},
  {emojis:'🕷️👨',answer:'Spider-Man',cat:'Film'},
  {emojis:'🚢❄️💑',answer:'Titanic',cat:'Film'},
  {emojis:'🐠🔍🌊',answer:'Le Monde de Nemo',cat:'Film'},
  {emojis:'🧙‍♂️💍🔥🗻',answer:'Le Seigneur des Anneaux',cat:'Film'},
  {emojis:'🤖❤️🌱',answer:'WALL-E',cat:'Film'},
  {emojis:'🦖🏝️🔬',answer:'Jurassic Park',cat:'Film'},
  {emojis:'🐭👨‍🍳🍽️',answer:'Ratatouille',cat:'Film'},
  {emojis:'🦸‍♂️🏙️🦇',answer:'Batman',cat:'Film'},
  {emojis:'🌌⚔️👨‍👧',answer:'Star Wars',cat:'Film'},
  {emojis:'🏴‍☠️🗺️💰',answer:'Pirates des Caraïbes',cat:'Film'},
  {emojis:'🎮🦑💀',answer:'Squid Game',cat:'Série'},
  {emojis:'🏫👻🌀🔴',answer:'Stranger Things',cat:'Série'},
  {emojis:'🐉⚔️👑❄️',answer:'Game of Thrones',cat:'Série'},
  {emojis:'🧪💊💰🔫',answer:'Breaking Bad',cat:'Série'},
  {emojis:'📄💼🏢😬',answer:'The Office',cat:'Série'},
  {emojis:'🎵💃🕺🌙',answer:'Thriller',cat:'Chanson'},
  {emojis:'❤️🔥💃🎶',answer:'Despacito',cat:'Chanson'},
  {emojis:'🍰🎂🎉🕯️',answer:'Joyeux Anniversaire',cat:'Expression'},
  {emojis:'🌹❤️💌',answer:'Je t\'aime',cat:'Expression'},
  {emojis:'🍀🌟✨',answer:'Bonne Chance',cat:'Expression'},
  {emojis:'😴💤🛌🌙',answer:'Bonne Nuit',cat:'Expression'},
  {emojis:'🌅☕😊',answer:'Bonjour',cat:'Expression'},
  {emojis:'🦸‍♀️🌟⭐💫',answer:'Wonder Woman',cat:'Film'},
  {emojis:'🐝👑💪💎',answer:'Beyoncé',cat:'Célébrité'},
  {emojis:'🎩🐇✨🪄',answer:'Harry Potter',cat:'Film'},
  {emojis:'🦊🌲🍄',answer:'Zootopie',cat:'Film'},
  {emojis:'🚀👨‍🚀🌑',answer:'Interstellar',cat:'Film'},
  {emojis:'🧟‍♂️🏃💉',answer:'The Walking Dead',cat:'Série'},
];

function emojiNorm(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();}

const emojiRooms = new Map();

function makeEmojiRoom(code, host) {
  return { code, host, players:[], phase:'WAITING', puzzles:[], qIndex:0, scores:[0,0,0,0], wins:[0,0,0,0], timer:null, firstAnswerTime:null, answeredSlots:new Set() };
}
function eSnap(room,extra={}){return{type:'emoji_state',phase:room.phase,players:room.players.map(p=>({name:p.name,slot:p.slot})),scores:[...room.scores],wins:[...room.wins],answeredSlots:[...( room.answeredSlots||new Set())],qIndex:room.qIndex,total:room.puzzles.length,puzzle:room.puzzles[room.qIndex]?{emojis:room.puzzles[room.qIndex].emojis,cat:room.puzzles[room.qIndex].cat}:null,code:room.code,...extra};}

function eStartQ(room){
  if(room.qIndex>=room.puzzles.length){eEnd(room);return;}
  room.phase='QUESTION';room.firstAnswerTime=null;room.answeredSlots=new Set();
  bcast(room.players,{...eSnap(room),timerSeconds:20});
  clearTimeout(room.timer);
  room.timer=setTimeout(()=>{if(room.phase==='QUESTION')eReveal(room,[]);},20000);
}
function eReveal(room,correctSlots){
  clearTimeout(room.timer);
  const p=room.puzzles[room.qIndex];
  room.phase='REVEAL';
  bcast(room.players,{...eSnap(room),reveal:{answer:p.answer,correctSlots}});
  room.qIndex++;room.timer=setTimeout(()=>eStartQ(room),3500);
}
function eEnd(room){
  clearTimeout(room.timer);room.phase='GAME_OVER';
  let win=-1,best=-1;
  room.players.forEach(p=>{const s=room.scores[p.slot]??0;if(s>best){best=s;win=p.slot;}else if(s===best){win=-1;}});
  if(win>=0)room.wins[win]++;
  bcast(room.players,{...eSnap(room),winnerSlot:win});
  broadcastLobby();
}

wssEmoji.on('connection',ws=>{
  makeWS(wssEmoji).alive(ws);
  let myRoom = null;
  ws.on('close',()=>{
    makeWS(wssEmoji).clear(ws);
    if(!myRoom)return;
    const idx=myRoom.players.findIndex(p=>p.ws===ws);if(idx<0)return;
    const name=myRoom.players[idx].name;
    myRoom.players.splice(idx,1);myRoom.players.forEach((p,i)=>p.slot=i);
    myRoom.phase='WAITING';bcast(myRoom.players,{type:'player_left',name});
    if(myRoom.players.length===0){emojiRooms.delete(myRoom.code);}
    broadcastLobby();
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    const player=myRoom?myRoom.players.find(p=>p.ws===ws):null;
    switch(d.type){
      case 'create_emoji':{
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const code=genCode(emojiRooms);
        const room=makeEmojiRoom(code,name);
        emojiRooms.set(code,room);
        myRoom=room;
        room.players.push({ws,name,slot:0});
        wsend(ws,{type:'created_emoji',code,slot:0,name});
        wsend(ws,eSnap(room));
        broadcastLobby();
        break;
      }
      case 'join_emoji':{
        const code=String(d.code||'').trim().toUpperCase();
        const room=emojiRooms.get(code);
        if(!room){wsend(ws,{type:'error',msg:'Salle introuvable.'});return;}
        if(room.players.length>=4){wsend(ws,{type:'error',msg:'Partie pleine (4 joueurs max).'});return;}
        if(room.phase!=='WAITING'){wsend(ws,{type:'error',msg:'La partie a déjà commencé.'});return;}
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot=room.players.length;room.players.push({ws,name,slot});
        myRoom=room;
        wsend(ws,{type:'welcome_emoji',slot,name,code});
        bcast(room.players,eSnap(room));
        broadcastLobby();
        break;
      }
      case 'start_emoji':{
        if(!player||!myRoom||player.slot!==0||!['WAITING','READY','GAME_OVER'].includes(myRoom.phase))return;
        if(myRoom.players.length<2){wsend(ws,{type:'error',msg:'Il faut au moins 2 joueurs.'});return;}
        myRoom.scores=[0,0,0,0];myRoom.qIndex=0;
        myRoom.puzzles=shuffle(EMOJI_PUZZLES).slice(0,Math.min(15,EMOJI_PUZZLES.length));
        myRoom.phase='COUNTDOWN';bcast(myRoom.players,{type:'countdown',seconds:3});
        clearTimeout(myRoom.timer);myRoom.timer=setTimeout(()=>eStartQ(myRoom),3000);
        broadcastLobby();
        break;
      }
      case 'answer_emoji':{
        if(!myRoom||myRoom.phase!=='QUESTION'||!player)return;
        if(!myRoom.answeredSlots)myRoom.answeredSlots=new Set();
        if(myRoom.answeredSlots.has(player.slot))return; // already answered
        const text=String(d.text||'').trim();if(!text)return;
        const p=myRoom.puzzles[myRoom.qIndex];
        const correct=emojiNorm(text)===emojiNorm(p.answer);
        if(correct){
          myRoom.answeredSlots.add(player.slot);
          const now=Date.now();
          if(myRoom.firstAnswerTime===null){
            // First correct: 3pts, start 5s window
            myRoom.firstAnswerTime=now;
            myRoom.scores[player.slot]+=3;
            bcast(myRoom.players,{type:'emoji_correct',name:player.name,slot:player.slot,pts:3,answeredSlots:[...myRoom.answeredSlots]});
            clearTimeout(myRoom.timer);
            myRoom.timer=setTimeout(()=>{eReveal(myRoom,[...myRoom.answeredSlots]);},5000);
          } else if(now-myRoom.firstAnswerTime<=5000){
            // Within 5s: 1pt
            myRoom.scores[player.slot]+=1;
            bcast(myRoom.players,{type:'emoji_correct',name:player.name,slot:player.slot,pts:1,answeredSlots:[...myRoom.answeredSlots]});
            // Check if all players answered
            if(myRoom.answeredSlots.size>=myRoom.players.length){
              clearTimeout(myRoom.timer);eReveal(myRoom,[...myRoom.answeredSlots]);
            }
          }
          // After 5s window (shouldn't happen since timer fires)
        } else {
          wsend(player.ws,{type:'emoji_wrong',name:player.name,text});
        }
        break;
      }
      case 'restart_emoji':{
        if(!player||!myRoom||myRoom.phase!=='GAME_OVER')return;
        myRoom.scores=[0,0,0,0];myRoom.phase='READY';bcast(myRoom.players,eSnap(myRoom));
        broadcastLobby();
        break;
      }
    }
  });
});

// ════════════════════════════════════════════════════════
//  VÉRITÉ OU DÉFI
// ════════════════════════════════════════════════════════

const VERITE_CARTES=[
  {type:'verite',text:'Quelle est ta peur secrète ?',cat:'facile'},
  {type:'verite',text:'Quelle est la chose la plus embarrassante que tu aies jamais faite ?',cat:'facile'},
  {type:'verite',text:'Quel est ton souvenir préféré avec moi ?',cat:'romantique'},
  {type:'verite',text:'Qu\'est-ce qui te fait le plus rire ?',cat:'facile'},
  {type:'verite',text:'Si tu pouvais changer une chose dans ta vie, ce serait quoi ?',cat:'facile'},
  {type:'verite',text:'Quelle est ton émission de télé honteuse préférée ?',cat:'facile'},
  {type:'verite',text:'Quel est le moment où tu as réalisé que tu étais amoureux(se) de moi ?',cat:'romantique'},
  {type:'verite',text:'Quelle est la chose que tu trouves la plus belle chez moi ?',cat:'romantique'},
  {type:'verite',text:'Quel est ton rêve pour notre futur ensemble ?',cat:'romantique'},
  {type:'verite',text:'Quel talent secret voudrais-tu avoir ?',cat:'facile'},
  {type:'verite',text:'Quelle est ta chanson honteuse à chanter sous la douche ?',cat:'facile'},
  {type:'verite',text:'Qu\'est-ce que tu aimes le plus dans notre relation ?',cat:'romantique'},
  {type:'verite',text:'Si tu étais un super-héros, quel serait ton pouvoir ?',cat:'facile'},
  {type:'verite',text:'Quelle est la chose la plus stupide que tu aies jamais crue ?',cat:'facile'},
  {type:'verite',text:'Quel compliment veux-tu entendre plus souvent ?',cat:'romantique'},
  {type:'defi',text:'Imite un animal pendant 30 secondes !',cat:'facile'},
  {type:'defi',text:'Chante le refrain d\'une chanson de ton choix !',cat:'facile'},
  {type:'defi',text:'Fais rire l\'autre joueur en 30 secondes !',cat:'facile'},
  {type:'defi',text:'Dis "Je t\'aime" dans 3 langues différentes !',cat:'romantique'},
  {type:'defi',text:'Danse pendant 20 secondes !',cat:'facile'},
  {type:'defi',text:'Donne 3 raisons pour lesquelles tu aimes l\'autre !',cat:'romantique'},
  {type:'defi',text:'Écris un poème de 4 vers pour l\'autre !',cat:'romantique'},
  {type:'defi',text:'Parle avec un accent anglais pendant 2 minutes !',cat:'fun'},
  {type:'defi',text:'Dessine un portrait de l\'autre joueur en 1 minute !',cat:'facile'},
  {type:'defi',text:'Nomme 10 pays en 20 secondes !',cat:'facile'},
  {type:'defi',text:'Dis la chose que tu admires le plus chez ton partenaire !',cat:'romantique'},
  {type:'defi',text:'Imite l\'autre joueur le mieux possible !',cat:'fun'},
  {type:'defi',text:'Racontez un souvenir heureux ensemble !',cat:'romantique'},
  {type:'defi',text:'Fais 10 pompes ou 20 sauts !',cat:'facile'},
  {type:'defi',text:'Envoie un message trop mignon à l\'autre sans explication !',cat:'romantique'},
  {type:'defi',text:'Fais le bruit le plus bizarre possible pendant 10 secondes !',cat:'fun'},
  {type:'defi',text:'Décris ta journée idéale avec l\'autre joueur !',cat:'romantique'},
  {type:'verite',text:'Quelle est la chose dont tu es le plus fier(e) dans ta vie ?',cat:'facile'},
  {type:'verite',text:'Si tu avais 1 million d\'euros, que ferais-tu ?',cat:'facile'},
  {type:'verite',text:'Quelle est ta plus grande qualité selon toi ?',cat:'facile'},
  {type:'verite',text:'Quel est le meilleur voyage que tu aies fait ?',cat:'facile'},
  {type:'defi',text:'Pose 3 questions originales à l\'autre joueur !',cat:'romantique'},
  {type:'defi',text:'Mime ton film préféré sans parler !',cat:'facile'},
  {type:'defi',text:'Invente un surnom affectueux pour l\'autre !',cat:'romantique'},
  {type:'defi',text:'Complimente l\'autre joueur pendant 1 minute sans s\'arrêter !',cat:'romantique'},
];

const veriteRooms = new Map();

function makeVeriteRoom(code, host) {
  return { code, host, players:[], phase:'WAITING', turn:0, turnNum:0, maxTurns:20, card:null, scores:[0,0,0,0], deck:[], timer:null };
}
function vSnap(room,extra={}){return{type:'verite_state',phase:room.phase,players:room.players.map(p=>({name:p.name,slot:p.slot})),scores:[...room.scores],turn:room.turn,turnNum:room.turnNum,maxTurns:room.maxTurns,card:room.card,code:room.code,...extra};}

wssVerite.on('connection',ws=>{
  makeWS(wssVerite).alive(ws);
  let myRoom = null;
  ws.on('close',()=>{
    makeWS(wssVerite).clear(ws);
    if(!myRoom)return;
    const idx=myRoom.players.findIndex(p=>p.ws===ws);if(idx<0)return;
    const name=myRoom.players[idx].name;
    myRoom.players.splice(idx,1);myRoom.players.forEach((p,i)=>p.slot=i);
    myRoom.phase='WAITING';bcast(myRoom.players,{type:'player_left',name});
    if(myRoom.players.length===0){veriteRooms.delete(myRoom.code);}
    broadcastLobby();
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    const player=myRoom?myRoom.players.find(p=>p.ws===ws):null;
    switch(d.type){
      case 'create_verite':{
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const code=genCode(veriteRooms);
        const room=makeVeriteRoom(code,name);
        veriteRooms.set(code,room);
        myRoom=room;
        room.players.push({ws,name,slot:0});
        wsend(ws,{type:'created_verite',code,slot:0,name});
        wsend(ws,vSnap(room));
        broadcastLobby();
        break;
      }
      case 'join_verite':{
        const code=String(d.code||'').trim().toUpperCase();
        const room=veriteRooms.get(code);
        if(!room){wsend(ws,{type:'error',msg:'Salle introuvable.'});return;}
        if(room.players.length>=4){wsend(ws,{type:'error',msg:'Partie pleine (4 joueurs max).'});return;}
        if(room.phase!=='WAITING'){wsend(ws,{type:'error',msg:'La partie a déjà commencé.'});return;}
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot=room.players.length;room.players.push({ws,name,slot});
        myRoom=room;
        wsend(ws,{type:'welcome_verite',slot,name,code});
        bcast(room.players,vSnap(room));
        broadcastLobby();
        break;
      }
      case 'start_verite':{
        if(!player||!myRoom||player.slot!==0||!['WAITING','READY','GAME_OVER'].includes(myRoom.phase))return;
        if(myRoom.players.length<2){wsend(ws,{type:'error',msg:'Il faut au moins 2 joueurs.'});return;}
        myRoom.scores=[0,0,0,0];myRoom.turn=0;myRoom.turnNum=0;myRoom.card=null;
        myRoom.deck=shuffle([...VERITE_CARTES]);
        myRoom.phase='CHOOSING';bcast(myRoom.players,vSnap(myRoom));
        broadcastLobby();
        break;
      }
      case 'choose':{
        if(!player||!myRoom||player.slot!==myRoom.turn||myRoom.phase!=='CHOOSING')return;
        const cat=d.choice;
        const pool=myRoom.deck.filter(c=>cat==='random'?true:c.type===cat);
        const cards=pool.length?pool:myRoom.deck;
        myRoom.card=cards[Math.floor(Math.random()*cards.length)];
        myRoom.phase='CARD';bcast(myRoom.players,vSnap(myRoom));
        break;
      }
      case 'done':{
        if(!player||!myRoom||player.slot!==myRoom.turn||myRoom.phase!=='CARD')return;
        if(d.completed)myRoom.scores[myRoom.turn]+=1;
        myRoom.turnNum++;
        if(myRoom.turnNum>=myRoom.maxTurns){
          myRoom.phase='GAME_OVER';
          let win=-1,best=-1;
          myRoom.players.forEach(p=>{const s=myRoom.scores[p.slot]??0;if(s>best){best=s;win=p.slot;}else if(s===best){win=-1;}});
          bcast(myRoom.players,{...vSnap(myRoom),winnerSlot:win});broadcastLobby();
        } else{
          myRoom.turn=(myRoom.turn+1)%myRoom.players.length;
          myRoom.card=null;myRoom.phase='CHOOSING';bcast(myRoom.players,vSnap(myRoom));
        }
        break;
      }
      case 'restart_verite':{
        if(!player||!myRoom||myRoom.phase!=='GAME_OVER')return;
        myRoom.scores=[0,0,0,0];myRoom.turn=0;myRoom.turnNum=0;myRoom.card=null;
        myRoom.deck=shuffle([...VERITE_CARTES]);myRoom.phase='CHOOSING';bcast(myRoom.players,vSnap(myRoom));
        broadcastLobby();
        break;
      }
    }
  });
});

// ════════════════════════════════════════════════════════
//  LOUP-GAROU
// ════════════════════════════════════════════════════════

const loupRooms = new Map();

function makeLoupRoom(code, host) {
  return { code, host, players:[], phase:'LOBBY',
           votes:{}, nightKill:null, savedSlot:null, witchKillSlot:null,
           witchUsedSave:false, witchUsedKill:false,
           timer:null, round:0 };
}

function loupSnap(room, forSlot) {
  const players = room.players.map(p => {
    const obj = { name:p.name, slot:p.slot, alive:p.alive };
    // reveal role only to the player themselves, or if dead
    if (p.slot === forSlot || !p.alive || room.phase === 'GAME_OVER') obj.role = p.role;
    return obj;
  });
  return { type:'loup_state', phase:room.phase, players, round:room.round,
           code:room.code, host:room.host, nightPhase:room.nightPhase||null };
}

function loupBcastAll(room) {
  room.players.forEach(p => {
    if (p.ws.readyState === WebSocket.OPEN) wsend(p.ws, loupSnap(room, p.slot));
  });
}

function loupCountWin(room) {
  const alive = room.players.filter(p => p.alive);
  const loups = alive.filter(p => p.role === 'loup-garou').length;
  const village = alive.filter(p => p.role !== 'loup-garou').length;
  if (loups === 0) return 'village';
  if (loups >= village) return 'loups';
  return null;
}

function loupStartNight(room) {
  room.phase = 'NIGHT';
  room.nightPhase = 'NIGHT_LOUPS';
  room.votes = {};
  room.nightKill = null;
  room.savedSlot = null;
  room.witchKillSlot = null;
  room.round++;
  loupBcastAll(room);
  // 30s timer for loups
  clearTimeout(room.timer);
  room.timer = setTimeout(() => loupResolveLoups(room), 30000);
}

function loupResolveLoups(room) {
  clearTimeout(room.timer);
  // tally votes
  const tally = {};
  Object.values(room.votes).forEach(t => { tally[t] = (tally[t]||0)+1; });
  let max = 0, victim = null;
  for (const [slot, cnt] of Object.entries(tally)) {
    if (cnt > max) { max = cnt; victim = Number(slot); }
    else if (cnt === max) { victim = null; } // tie = no kill
  }
  room.nightKill = victim;
  room.votes = {};
  room.nightPhase = 'NIGHT_VOYANTE';
  loupBcastAll(room);
  clearTimeout(room.timer);
  room.timer = setTimeout(() => loupResolveSorciere(room), 15000);
}

function loupResolveSorciere(room) {
  clearTimeout(room.timer);
  room.nightPhase = 'NIGHT_SORCIERE';
  loupBcastAll(room);
  // Send attacked info to sorciere
  const sorciere = room.players.find(p => p.role === 'sorciere' && p.alive);
  if (sorciere) {
    wsend(sorciere.ws, { type:'sorciere_info', attackedSlot: room.nightKill,
      usedSave: room.witchUsedSave, usedKill: room.witchUsedKill });
  }
  clearTimeout(room.timer);
  room.timer = setTimeout(() => loupDayReveal(room), 20000);
}

function loupDayReveal(room) {
  clearTimeout(room.timer);
  // Apply night results
  let killed = null;
  if (room.nightKill !== null && room.savedSlot !== room.nightKill) {
    const p = room.players[room.nightKill];
    if (p) { p.alive = false; killed = p.name; }
  }
  if (room.witchKillSlot !== null) {
    const p = room.players[room.witchKillSlot];
    if (p && p.alive) { p.alive = false; killed = (killed ? killed + ', ' : '') + p.name; }
  }
  room.phase = 'DAY_REVEAL';
  room.nightPhase = null;
  loupBcastAll(room);
  bcast(room.players, { type:'night_result', killed });

  const win = loupCountWin(room);
  if (win) { return loupGameOver(room, win); }

  clearTimeout(room.timer);
  room.timer = setTimeout(() => loupStartDayVote(room), 4000);
}

function loupStartDayVote(room) {
  room.phase = 'DAY_VOTE';
  room.votes = {};
  loupBcastAll(room);
  clearTimeout(room.timer);
  room.timer = setTimeout(() => loupResolveDayVote(room), 60000);
}

function loupResolveDayVote(room) {
  clearTimeout(room.timer);
  const tally = {};
  Object.values(room.votes).forEach(t => { if(t>=0) tally[t] = (tally[t]||0)+1; });
  let max = 0, eliminated = null;
  for (const [slot, cnt] of Object.entries(tally)) {
    if (cnt > max) { max = cnt; eliminated = Number(slot); }
    else if (cnt === max) { eliminated = null; }
  }
  if (eliminated !== null) {
    const p = room.players[eliminated];
    if (p) p.alive = false;
  }
  const elimName = eliminated !== null ? room.players[eliminated]?.name : null;
  bcast(room.players, { type:'day_vote_result', eliminated: elimName, votes: room.votes });

  const win = loupCountWin(room);
  if (win) return loupGameOver(room, win);

  clearTimeout(room.timer);
  room.timer = setTimeout(() => loupStartNight(room), 3000);
}

function loupGameOver(room, winner) {
  room.phase = 'GAME_OVER';
  const reason = winner === 'loups' ? 'Les loups ont mangé le village !' : 'Tous les loups sont éliminés !';
  bcast(room.players, { type:'loup_over', winner, reason });
  loupBcastAll(room);
  broadcastLobby();
}

wssLoup.on('connection', ws => {
  makeWS(wssLoup).alive(ws);
  let myRoom = null;
  ws.on('close', () => {
    makeWS(wssLoup).clear(ws);
    if (!myRoom) return;
    const idx = myRoom.players.findIndex(p => p.ws === ws); if (idx < 0) return;
    const name = myRoom.players[idx].name;
    myRoom.players.splice(idx, 1);
    myRoom.players.forEach((p, i) => p.slot = i);
    if (myRoom.players.length === 0) { clearTimeout(myRoom.timer); loupRooms.delete(myRoom.code); }
    else { myRoom.phase = 'LOBBY'; bcast(myRoom.players, { type:'player_left', name }); loupBcastAll(myRoom); }
    broadcastLobby();
  });
  ws.on('message', raw => {
    let d; try { d = JSON.parse(raw); } catch { return; }
    const player = myRoom ? myRoom.players.find(p => p.ws === ws) : null;
    switch (d.type) {
      case 'create': {
        const name = String(d.name||'').trim().slice(0,20)||'Joueur';
        const code = genCode(loupRooms);
        const room = makeLoupRoom(code, name);
        loupRooms.set(code, room);
        myRoom = room;
        room.players.push({ ws, name, slot:0, alive:true, role:null });
        wsend(ws, { type:'created_loup', code, slot:0, name });
        loupBcastAll(room);
        broadcastLobby();
        break;
      }
      case 'join_loup': {
        const code = String(d.code||'').trim().toUpperCase();
        const room = loupRooms.get(code);
        if (!room) { wsend(ws, { type:'error', msg:'Salle introuvable.' }); return; }
        if (room.players.length >= 10) { wsend(ws, { type:'error', msg:'Salle pleine (10 max).' }); return; }
        if (room.phase !== 'LOBBY') { wsend(ws, { type:'error', msg:'Partie déjà en cours.' }); return; }
        const name = String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot = room.players.length;
        room.players.push({ ws, name, slot, alive:true, role:null });
        myRoom = room;
        wsend(ws, { type:'joined_loup', slot, name, code });
        loupBcastAll(room);
        broadcastLobby();
        break;
      }
      case 'start_loup': {
        if (!player || !myRoom || player.slot !== 0 || myRoom.phase !== 'LOBBY') return;
        if (myRoom.players.length < 4) { wsend(ws, { type:'error', msg:'Il faut au moins 4 joueurs.' }); return; }
        // Assign roles
        const n = myRoom.players.length;
        const nLoups = Math.min(3, Math.max(1, Math.floor(n/3)));
        const roles = [];
        for (let i = 0; i < nLoups; i++) roles.push('loup-garou');
        roles.push('voyante');
        roles.push('sorciere');
        while (roles.length < n) roles.push('villageois');
        const shuffled = shuffle(roles);
        myRoom.players.forEach((p, i) => p.role = shuffled[i]);
        // Send each player their role
        myRoom.players.forEach(p => wsend(p.ws, { type:'role_assigned', role:p.role, slot:p.slot }));
        // Send loups list to all loups
        const loupsList = myRoom.players.filter(p => p.role === 'loup-garou').map(p => ({ name:p.name, slot:p.slot }));
        myRoom.players.filter(p => p.role === 'loup-garou').forEach(p => wsend(p.ws, { type:'loups_list', loups:loupsList }));
        myRoom.phase = 'NIGHT';
        loupBcastAll(myRoom);
        clearTimeout(myRoom.timer);
        myRoom.timer = setTimeout(() => loupStartNight(myRoom), 4000);
        broadcastLobby();
        break;
      }
      case 'loup_vote': {
        if (!player || !myRoom || myRoom.phase !== 'NIGHT' || myRoom.nightPhase !== 'NIGHT_LOUPS') return;
        if (player.role !== 'loup-garou' || !player.alive) return;
        const target = Number(d.target);
        const tp = myRoom.players[target];
        if (!tp || !tp.alive || tp.role === 'loup-garou') return;
        myRoom.votes[player.slot] = target;
        // Check if all alive loups voted
        const aliveLoups = myRoom.players.filter(p => p.role === 'loup-garou' && p.alive);
        if (aliveLoups.every(p => myRoom.votes[p.slot] !== undefined)) loupResolveLoups(myRoom);
        break;
      }
      case 'voyante_check': {
        if (!player || !myRoom || myRoom.phase !== 'NIGHT' || myRoom.nightPhase !== 'NIGHT_VOYANTE') return;
        if (player.role !== 'voyante' || !player.alive) return;
        const target = Number(d.target);
        const tp = myRoom.players[target];
        if (!tp) return;
        wsend(ws, { type:'voyante_result', slot:target, name:tp.name, role:tp.role });
        // Move to sorciere
        loupResolveSorciere(myRoom);
        break;
      }
      case 'sorciere_action': {
        if (!player || !myRoom || myRoom.phase !== 'NIGHT' || myRoom.nightPhase !== 'NIGHT_SORCIERE') return;
        if (player.role !== 'sorciere' || !player.alive) return;
        if (d.action === 'save' && !myRoom.witchUsedSave && myRoom.nightKill !== null) {
          myRoom.savedSlot = myRoom.nightKill;
          myRoom.witchUsedSave = true;
        } else if (d.action === 'kill' && !myRoom.witchUsedKill) {
          const target = Number(d.target);
          const tp = myRoom.players[target];
          if (tp && tp.alive) { myRoom.witchKillSlot = target; myRoom.witchUsedKill = true; }
        }
        loupDayReveal(myRoom);
        break;
      }
      case 'day_vote': {
        if (!player || !myRoom || myRoom.phase !== 'DAY_VOTE' || !player.alive) return;
        const target = Number(d.target);
        if (target >= 0) {
          const tp = myRoom.players[target];
          if (!tp || !tp.alive) return;
        }
        myRoom.votes[player.slot] = target;
        // Check if all alive voted
        const alivePlayers = myRoom.players.filter(p => p.alive);
        if (alivePlayers.every(p => myRoom.votes[p.slot] !== undefined)) loupResolveDayVote(myRoom);
        break;
      }
    }
  });
});

// ════════════════════════════════════════════════════════
//  UNO
// ════════════════════════════════════════════════════════

const unoRooms = new Map();

function makeUnoRoom(code, host) {
  return { code, host, players:[], phase:'LOBBY',
           deck:[], pile:[], hands:{},
           turn:0, direction:1, drawStack:0,
           currentColor:'rouge',
           unoAlert:{},   // slot -> bool (announced UNO)
           unoCatchWindow:{}, // slot -> timeout handle
           timer:null };
}

function buildUnoDeck() {
  const colors = ['rouge','bleu','vert','jaune'];
  const deck = [];
  for (const c of colors) {
    deck.push({ color:c, value:'0' });
    for (const v of ['1','2','3','4','5','6','7','8','9','skip','reverse','+2']) {
      deck.push({ color:c, value:v });
      deck.push({ color:c, value:v });
    }
  }
  for (let i = 0; i < 4; i++) deck.push({ color:'noir', value:'wild' });
  for (let i = 0; i < 4; i++) deck.push({ color:'noir', value:'+4' });
  return shuffle(deck); // 108 cards total
}

function unoSnap(room, forSlot) {
  const top = room.pile[room.pile.length-1] || null;
  const displayTop = top ? { ...top, color: room.currentColor } : null;
  return {
    type:'uno_state', phase:room.phase, code:room.code, mySlot:forSlot,
    players: room.players.map(p => ({
      name:p.name, slot:p.slot,
      cardCount:(room.hands[p.slot]||[]).length,
      unoAlert:!!(room.unoAlert[p.slot])
    })),
    turn: room.turn, topCard: displayTop,
    currentColor: room.currentColor,
    hand: forSlot >= 0 ? (room.hands[forSlot]||[]) : [],
    direction: room.direction, drawStack: room.drawStack,
  };
}

function unoBcastAll(room) {
  room.players.forEach(p => {
    if (p.ws.readyState === WebSocket.OPEN) wsend(p.ws, unoSnap(room, p.slot));
  });
}

// Advance turn index (room.turn is an index into room.players array)
function unoNextTurn(room, skip=false) {
  const n = room.players.length;
  if (n === 0) return;
  let steps = skip ? 2 : 1;
  for (let i = 0; i < steps; i++) {
    room.turn = ((room.turn + room.direction) % n + n) % n;
  }
}

function unoDrawCards(room, slot, count) {
  if (!room.hands[slot]) room.hands[slot] = [];
  for (let i = 0; i < count; i++) {
    if (room.deck.length === 0) {
      if (room.pile.length <= 1) break; // nothing to reshuffle
      const top = room.pile.pop();
      room.deck = shuffle(room.pile);
      room.pile = [top];
    }
    if (room.deck.length > 0) {
      room.hands[slot].push(room.deck.pop());
    }
  }
}

function unoCanPlay(card, topCard, currentColor, drawStack) {
  if (drawStack > 0) {
    // Must play +2 or +4 to chain, otherwise must draw
    return card.value === '+2' || card.value === '+4';
  }
  if (card.color === 'noir') return true; // wilds always playable
  return card.color === currentColor || card.value === topCard.value;
}

wssUno.on('connection', ws => {
  makeWS(wssUno).alive(ws);
  let myRoom = null;
  ws.on('close', () => {
    makeWS(wssUno).clear(ws);
    if (!myRoom) return;
    const idx = myRoom.players.findIndex(p => p.ws === ws); if (idx < 0) return;
    const name = myRoom.players[idx].name;
    // Clear any catch window timer for this slot
    const slot = myRoom.players[idx].slot;
    if (myRoom.unoCatchWindow[slot]) { clearTimeout(myRoom.unoCatchWindow[slot]); delete myRoom.unoCatchWindow[slot]; }
    myRoom.players.splice(idx, 1);
    myRoom.players.forEach((p, i) => p.slot = i);
    if (myRoom.players.length === 0) { clearTimeout(myRoom.timer); unoRooms.delete(myRoom.code); }
    else { myRoom.phase = 'LOBBY'; bcast(myRoom.players, { type:'player_left', name }); unoBcastAll(myRoom); }
    broadcastLobby();
  });
  ws.on('message', raw => {
    let d; try { d = JSON.parse(raw); } catch { return; }
    const player = myRoom ? myRoom.players.find(p => p.ws === ws) : null;
    switch (d.type) {
      case 'create_uno': {
        const name = String(d.name||'').trim().slice(0,20)||'Joueur';
        const code = genCode(unoRooms);
        const room = makeUnoRoom(code, name);
        unoRooms.set(code, room);
        myRoom = room;
        room.players.push({ ws, name, slot:0 });
        wsend(ws, { type:'uno_created', code, slot:0, name });
        wsend(ws, unoSnap(room, 0));
        broadcastLobby();
        break;
      }
      case 'join_uno': {
        const code = String(d.code||'').trim().toUpperCase();
        const room = unoRooms.get(code);
        if (!room) { wsend(ws, { type:'uno_error', msg:'Salle introuvable.' }); return; }
        if (room.players.length >= 4) { wsend(ws, { type:'uno_error', msg:'Salle pleine (4 max).' }); return; }
        if (room.phase !== 'LOBBY') { wsend(ws, { type:'uno_error', msg:'Partie déjà en cours.' }); return; }
        const name = String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot = room.players.length;
        room.players.push({ ws, name, slot });
        myRoom = room;
        wsend(ws, { type:'uno_joined', slot, name, code });
        unoBcastAll(room);
        broadcastLobby();
        break;
      }
      case 'start_uno': {
        if (!player || !myRoom || player.slot !== 0 || myRoom.phase !== 'LOBBY') return;
        if (myRoom.players.length < 2) { wsend(ws, { type:'uno_error', msg:'Il faut au moins 2 joueurs.' }); return; }
        myRoom.deck = buildUnoDeck();
        myRoom.hands = {};
        myRoom.players.forEach(p => { myRoom.hands[p.slot] = []; });
        myRoom.players.forEach(p => unoDrawCards(myRoom, p.slot, 7));
        // First card on pile — skip action cards and wilds
        let first;
        do { first = myRoom.deck.pop(); } while (!first || first.color === 'noir' || ['skip','reverse','+2'].includes(first.value));
        myRoom.pile = [first];
        myRoom.currentColor = first.color;
        myRoom.turn = 0; myRoom.direction = 1; myRoom.drawStack = 0; myRoom.unoAlert = {}; myRoom.unoCatchWindow = {};
        myRoom.phase = 'PLAYING';
        unoBcastAll(myRoom);
        broadcastLobby();
        break;
      }
      case 'play_uno': {
        if (!player || !myRoom || myRoom.phase !== 'PLAYING') return;
        if (myRoom.players[myRoom.turn]?.slot !== player.slot) {
          wsend(ws, { type:'uno_error', msg:"Ce n'est pas ton tour." }); return;
        }
        const hand = myRoom.hands[player.slot] || [];
        const ci = Number(d.cardIndex);
        if (ci < 0 || ci >= hand.length) { wsend(ws, { type:'uno_error', msg:'Carte invalide.' }); return; }
        const card = hand[ci];
        const top = myRoom.pile[myRoom.pile.length-1];
        if (!unoCanPlay(card, top, myRoom.currentColor, myRoom.drawStack)) {
          wsend(ws, { type:'uno_error', msg:'Carte non jouable.' }); return;
        }

        // Remove card from hand
        hand.splice(ci, 1);

        // Determine active color for wild
        let playedColor = card.color;
        if (card.color === 'noir') {
          const chosen = String(d.chosenColor||'rouge');
          playedColor = ['rouge','bleu','vert','jaune'].includes(chosen) ? chosen : 'rouge';
        }
        // Push to pile (store original card)
        myRoom.pile.push({ ...card });
        myRoom.currentColor = playedColor;

        // UNO detection: player now has 1 card — open catch window
        if (hand.length === 1) {
          myRoom.unoAlert[player.slot] = false; // not yet announced
          // Start 2s catch window
          if (myRoom.unoCatchWindow[player.slot]) clearTimeout(myRoom.unoCatchWindow[player.slot]);
          myRoom.unoCatchWindow[player.slot] = setTimeout(() => {
            // Window expired without catch — safe (player didn't say UNO but no one caught)
            delete myRoom.unoCatchWindow[player.slot];
          }, 2000);
        }

        // Broadcast play event
        bcast(myRoom.players, { type:'uno_played', slot:player.slot, name:player.name,
          card: { ...card, color:playedColor }, nextTurn:myRoom.turn });

        // Check win
        if (hand.length === 0) {
          myRoom.phase = 'GAME_OVER';
          bcast(myRoom.players, { type:'uno_over', winnerSlot:player.slot, winnerName:player.name });
          unoBcastAll(myRoom);
          broadcastLobby();
          return;
        }

        // Apply effects
        let skipNext = false;
        if (card.value === 'reverse') {
          myRoom.direction *= -1;
          if (myRoom.players.length === 2) skipNext = true; // reverse = skip in 2p
        } else if (card.value === 'skip') {
          skipNext = true;
        } else if (card.value === '+2') {
          myRoom.drawStack += 2;
        } else if (card.value === '+4') {
          myRoom.drawStack += 4;
        } else {
          myRoom.drawStack = 0;
        }

        unoNextTurn(myRoom, skipNext);
        unoBcastAll(myRoom);
        break;
      }
      case 'draw_uno': {
        if (!player || !myRoom || myRoom.phase !== 'PLAYING') return;
        if (myRoom.players[myRoom.turn]?.slot !== player.slot) {
          wsend(ws, { type:'uno_error', msg:"Ce n'est pas ton tour." }); return;
        }
        const drawCount = myRoom.drawStack > 0 ? myRoom.drawStack : 1;
        unoDrawCards(myRoom, player.slot, drawCount);
        myRoom.drawStack = 0;
        bcast(myRoom.players, { type:'uno_drew', slot:player.slot, name:player.name, count:drawCount });
        unoNextTurn(myRoom);
        unoBcastAll(myRoom);
        break;
      }
      case 'uno_said': {
        if (!player || !myRoom || myRoom.phase !== 'PLAYING') return;
        const hand = myRoom.hands[player.slot] || [];
        if (hand.length === 1) {
          myRoom.unoAlert[player.slot] = true;
          // Cancel catch window since they said UNO
          if (myRoom.unoCatchWindow[player.slot]) {
            clearTimeout(myRoom.unoCatchWindow[player.slot]);
            delete myRoom.unoCatchWindow[player.slot];
          }
          bcast(myRoom.players, { type:'uno_said', slot:player.slot, name:player.name });
          unoBcastAll(myRoom);
        }
        break;
      }
      case 'catch_uno': {
        if (!player || !myRoom || myRoom.phase !== 'PLAYING') return;
        const targetSlot = Number(d.targetSlot);
        const target = myRoom.players.find(p => p.slot === targetSlot);
        if (!target) return;
        const targetHand = myRoom.hands[targetSlot] || [];
        // Can catch if: target has 1 card, hasn't said UNO, catch window still open
        if (targetHand.length === 1 && !myRoom.unoAlert[targetSlot] && myRoom.unoCatchWindow[targetSlot]) {
          clearTimeout(myRoom.unoCatchWindow[targetSlot]);
          delete myRoom.unoCatchWindow[targetSlot];
          unoDrawCards(myRoom, targetSlot, 2);
          bcast(myRoom.players, { type:'uno_caught', catcher:player.name, target:target.name, targetSlot });
          unoBcastAll(myRoom);
        }
        break;
      }
    }
  });
});

// ════════════════════════════════════════════════════════
//  CHAT GLOBAL
// ════════════════════════════════════════════════════════
const chatClients = new Set();
wssChat.on('connection', ws => {
  chatClients.add(ws);
  ws.on('message', raw => {
    let d; try { d = JSON.parse(raw); } catch { return; }
    if (d.type === 'chat') {
      const name = String(d.name || 'Anonyme').trim().slice(0, 20);
      const text = String(d.text || '').trim().slice(0, 200);
      if (!text) return;
      const out = JSON.stringify({ type: 'chat', name, text, time: Date.now() });
      chatClients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(out); });
    }
    if (d.type === 'join_chat') {
      const name = String(d.name || 'Anonyme').trim().slice(0, 20);
      const out = JSON.stringify({ type: 'system', text: `${name} a rejoint le chat`, time: Date.now() });
      chatClients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(out); });
    }
  });
  ws.on('close', () => chatClients.delete(ws));
});

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT,'0.0.0.0',()=>{
  const ip=getLocalIP();
  console.log('\n╔══════════════════════════════════╗');
  console.log('║    ZapPlay v5.0 — Salles !       ║');
  console.log('╠══════════════════════════════════╣');
  console.log(`║  PC  : http://localhost:${PORT}   ║`);
  console.log(`║  Tel : http://${ip}:${PORT}║`);
  console.log('╚══════════════════════════════════╝\n');
});
