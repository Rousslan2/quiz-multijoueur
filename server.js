'use strict';
const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');
const path      = require('path');
const os        = require('os');
const frenchWordsPkg = require('an-array-of-french-words');
const adminLib = require('./lib/admin');
const profileLib = require('./lib/profile');
let QRCode; try { QRCode = require('qrcode'); } catch {}

/** Mot de passe admin (défaut + surcharge par ADMIN_PASSWORD sur le serveur) */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Rousslan2001';
let adminConfig = adminLib.loadAdminConfig();

function getAdminPassword(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return String(h.slice(7)).trim();
  const x = req.headers['x-admin-password'];
  if (x) return String(x).trim();
  if (req.body && typeof req.body.password === 'string') return req.body.password.trim();
  if (req.query && typeof req.query.password === 'string') return String(req.query.password).trim();
  return '';
}

function adminAuth(req, res, next) {
  if (getAdminPassword(req) !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }
  next();
}

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 3001;

// ── WebSocket servers (jeux + chat + lobby) ─────────────────────────────────
const wssQuiz    = new WebSocket.Server({ noServer: true });
const wssDraw    = new WebSocket.Server({ noServer: true });
const wssP4      = new WebSocket.Server({ noServer: true });
const wssMorpion = new WebSocket.Server({ noServer: true });
const wssTaboo   = new WebSocket.Server({ noServer: true });
const wssEmoji   = new WebSocket.Server({ noServer: true });
const wssBomb    = new WebSocket.Server({ noServer: true });
const wssSumo    = new WebSocket.Server({ noServer: true });
const wssPaint   = new WebSocket.Server({ noServer: true });
const wssChat    = new WebSocket.Server({ noServer: true });
const wssLobby   = new WebSocket.Server({ noServer: true });
const wssLoup    = new WebSocket.Server({ noServer: true });
const wssUno     = new WebSocket.Server({ noServer: true });
const wssNaval   = new WebSocket.Server({ noServer: true });
const wssTyper   = new WebSocket.Server({ noServer: true });
const wssAnagramme = new WebSocket.Server({ noServer: true });
const wssJustePrix = new WebSocket.Server({ noServer: true });
const wssTimeline  = new WebSocket.Server({ noServer: true });
const wssMemo      = new WebSocket.Server({ noServer: true });
const wssImposteur = new WebSocket.Server({ noServer: true });
const wssDebat = new WebSocket.Server({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const routes = {
    '/ws/quiz':wssQuiz,'/ws/draw':wssDraw,'/ws/p4':wssP4,
    '/ws/morpion':wssMorpion,'/ws/taboo':wssTaboo,'/ws/emoji':wssEmoji,
    '/ws/bomb':wssBomb,'/ws/sumo':wssSumo,'/ws/chat':wssChat,'/ws/lobby':wssLobby,
    '/ws/loup':wssLoup,'/ws/uno':wssUno,'/ws/paint':wssPaint,'/ws/naval':wssNaval,
    '/ws/typer':wssTyper,'/ws/anagramme':wssAnagramme,'/ws/justeprix':wssJustePrix,
    '/ws/timeline':wssTimeline,'/ws/memo':wssMemo,
    '/ws/imposteur':wssImposteur,
    '/ws/debat':wssDebat
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
  morpion:'Morpion', taboo:'Mots Interdits', emoji:'Devinette Emoji',
  loup:'Loup-Garou', uno:'Uno', bomb:'Word Bomb', sumo:'Sumo Arena', paint:'Paint.io',
  naval:'Bataille navale', typer:'Typer Race', anagramme:'Anagramme',
  justeprix:'Juste Prix', timeline:'Timeline', memo:'Mémoire', imposteur:'Imposteur',
  debat:'Débat express'
};

function getRoomsSnapshot() {
  const all = [];
  const maps = { quiz:quizRooms, draw:drawRooms, p4:p4Rooms, morpion:morpionRooms, taboo:tabooRooms, emoji:emojiRooms, loup:loupRooms, uno:unoRooms, bomb:bombRooms, sumo:sumoRooms, paint:paintRooms, naval:navalRooms, typer:typerRooms, anagramme:anagrammeRooms, justeprix:justeprixRooms, timeline:timelineRooms, memo:memoRooms, imposteur:imposteurRooms, debat:debatRooms };
  for (const [game, map] of Object.entries(maps)) {
    for (const [code, room] of map) {
      all.push({
        code,
        game,
        gameName: GAME_NAMES[game],
        host: room.host,
        players: room.players.map(p => p.name),
        maxPlayers: game==='loup'?10:game==='bomb'?6:game==='sumo'?4:game==='uno'?4:game==='paint'?4:game==='naval'?4:game==='imposteur'?8:game==='debat'?6:4,
        status: ['WAITING','SETUP','PLACING','COUNTDOWN'].includes(room.phase) ? 'waiting' : 'playing'
      });
    }
  }
  return all;
}

app.get('/api/rooms', (_, res) => res.json(getRoomsSnapshot()));

/** Liste des jeux masqués (menu / lobby) — lecture seule, sans secret */
app.get('/api/public/config', (_, res) => {
  res.json({ hiddenGames: adminConfig.hiddenGames || [] });
});

app.get('/api/admin/config', adminAuth, (_, res) => {
  res.json({ hiddenGames: adminConfig.hiddenGames || [] });
});

app.put('/api/admin/config', adminAuth, (req, res) => {
  try {
    const hidden = Array.isArray(req.body?.hiddenGames) ? req.body.hiddenGames : [];
    adminConfig = adminLib.saveAdminConfig({ hiddenGames: hidden });
    res.json(adminConfig);
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.post('/api/admin/bots', adminAuth, (req, res) => {
  try {
    const game = req.body?.game;
    const code = req.body?.code;
    const count = req.body?.count ?? 1;
    const prefix = req.body?.prefix || 'Bot';
    const host = req.body?.host || '127.0.0.1';
    const out = adminLib.spawnTestBots({
      game, code, count, prefix,
      port: PORT,
      host,
    });
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

// ── Lobby WebSocket ───────────────────────────────────────────────────────────
const lobbyClients = new Set();
wssLobby.on('connection', ws => {
  lobbyClients.add(ws);
  wsend(ws, { type: 'rooms', rooms: getRoomsSnapshot() });
  ws.on('message', raw => {
    try {
      const d = JSON.parse(String(raw));
      if (d.type === 'ping') wsend(ws, { type: 'pong', client: d.t, server: Date.now() });
    } catch {}
  });
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
function handleLoungeChat(room, ws, d){
  if(!room)return;
  const sender=room.players.find(p=>p.ws===ws);
  if(!sender)return;
  const text=String(d.text||'').trim().slice(0,200);
  if(!text)return;
  bcast(room.players,{type:'lounge_chat',name:sender.name,slot:sender.slot,text,time:Date.now(),code:room.code});
}

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
  // ── GÉO ──
  {text:"Quelle est la capitale de l'Argentine ?",opts:["Montevideo","Santiago","Lima","Buenos Aires"],ans:3,cat:'geo',diff:2},
  {text:"Quel est le plus grand pays d'Afrique ?",opts:["Soudan","Congo","Algérie","Libye"],ans:2,cat:'geo',diff:2},
  {text:"Combien de pays bordent la Suisse ?",opts:["3","4","5","6"],ans:2,cat:'geo',diff:3},
  {text:"Quelle est la capitale de l'Australie ?",opts:["Sydney","Melbourne","Brisbane","Canberra"],ans:3,cat:'geo',diff:2},
  {text:"Quel est le plus long fleuve d'Europe ?",opts:["Rhin","Danube","Volga","Sène"],ans:2,cat:'geo',diff:3},
  {text:"Dans quel pays se trouve le mont Fuji ?",opts:["Chine","Corée","Japon","Thaïlande"],ans:2,cat:'geo',diff:1},
  {text:"Quelle mer est la plus salée du monde ?",opts:["Mer Rouge","Mer Morte","Mer Méditerranée","Mer Caspienne"],ans:1,cat:'geo',diff:2},
  {text:"Quel pays possède le plus grand nombre d'îles ?",opts:["Finlande","Norvège","Suède","Indonésie"],ans:3,cat:'geo',diff:3},
  {text:"Quelle est la capitale de la Nouvelle-Zélande ?",opts:["Auckland","Christchurch","Wellington","Hamilton"],ans:2,cat:'geo',diff:2},
  {text:"Quel détroit sépare l'Europe de l'Afrique ?",opts:["Gibraltar","Magellan","Bosphore","Bab-el-Mandeb"],ans:0,cat:'geo',diff:2},
  {text:"Dans quel pays se trouve le Sahara le plus étendu ?",opts:["Maroc","Algérie","Libye","Mali"],ans:1,cat:'geo',diff:3},
  {text:"Quelle est la capitale de la Turquie ?",opts:["Istanbul","İzmir","Ankara","Bursa"],ans:2,cat:'geo',diff:2},
  {text:"Quel pays est traversé par le tropique du Cancer et le tropique du Capricorne ?",opts:["États-Unis","Brésil","Australie","Mexique"],ans:1,cat:'geo',diff:3},
  {text:"Quelle est la plus grande île du monde ?",opts:["Bornéo","Madagascar","Groenland","Nouvelle-Guinée"],ans:2,cat:'geo',diff:2},
  {text:"Quel pays a pour capitale Nairobi ?",opts:["Éthiopie","Tanzanie","Kenya","Uganda"],ans:2,cat:'geo',diff:2},
  {text:"Dans quel océan se trouve Madagascar ?",opts:["Atlantique","Pacifique","Arctique","Indien"],ans:3,cat:'geo',diff:1},
  {text:"Quelle ville est à la fois le plus grand port et la plus grande ville des Pays-Bas ?",opts:["La Haye","Utrecht","Rotterdam","Amsterdam"],ans:3,cat:'geo',diff:2},
  {text:"Quel pays d'Amérique centrale a pour capitale San José ?",opts:["Panama","Guatemala","Nicaragua","Costa Rica"],ans:3,cat:'geo',diff:2},
  {text:"Quel est le plus haut sommet d'Afrique ?",opts:["Mont Kenya","Rwenzori","Kilimandjaro","Ras Dashen"],ans:2,cat:'geo',diff:2},
  {text:"Quelle est la capitale de l'Inde ?",opts:["Mumbai","Kolkata","New Delhi","Chennai"],ans:2,cat:'geo',diff:1},
  // ── HISTOIRE ──
  {text:"Qui était le pharaon lors de la construction de la Grande Pyramide ?",opts:["Ramsès II","Toutânkhamon","Khéops","Akhenaton"],ans:2,cat:'histoire',diff:2},
  {text:"En quelle année Napoléon a-t-il été exilé à Sainte-Hélène ?",opts:["1812","1815","1820","1825"],ans:1,cat:'histoire',diff:2},
  {text:"Quel traité a mis fin à la Première Guerre mondiale ?",opts:["Traité de Paris","Traité de Versailles","Traité de Londres","Traité de Vienne"],ans:1,cat:'histoire',diff:2},
  {text:"En quelle année Christophe Colomb est-il né ?",opts:["1441","1451","1461","1471"],ans:1,cat:'histoire',diff:3},
  {text:"Quel empire a construit le Colisée de Rome ?",opts:["Grec","Byzantine","Romain","Ottoman"],ans:2,cat:'histoire',diff:1},
  {text:"Qui a été le premier homme dans l'espace ?",opts:["Neil Armstrong","John Glenn","Youri Gagarine","Alan Shepard"],ans:2,cat:'histoire',diff:1},
  {text:"En quelle année la Bastille a-t-elle été prise ?",opts:["1769","1779","1789","1799"],ans:2,cat:'histoire',diff:1},
  {text:"Quel général grec a conquis la Perse ?",opts:["Sparte","Jules César","Alexandre le Grand","Périclès"],ans:2,cat:'histoire',diff:1},
  {text:"Quel pays a lancé la première bombe atomique sur Hiroshima ?",opts:["URSS","Royaume-Uni","France","États-Unis"],ans:3,cat:'histoire',diff:1},
  {text:"Quelle civilisation a construit Machu Picchu ?",opts:["Aztèque","Maya","Inca","Olmèque"],ans:2,cat:'histoire',diff:2},
  {text:"En quelle année la guerre de Corée a-t-elle commencé ?",opts:["1948","1950","1952","1954"],ans:1,cat:'histoire',diff:3},
  {text:"Quel roi de France était surnommé 'le Roi Soleil' ?",opts:["Louis XIV","Louis XV","Louis XVI","Henri IV"],ans:0,cat:'histoire',diff:1},
  {text:"Quel empire était dirigé par Gengis Khan ?",opts:["Ottoman","Mongol","Perse","Timuride"],ans:1,cat:'histoire',diff:2},
  {text:"En quelle année la Tour de Pise a-t-elle commencé à être construite ?",opts:["1073","1173","1273","1373"],ans:1,cat:'histoire',diff:3},
  {text:"Qui a inventé l'imprimerie en Europe ?",opts:["Léonard de Vinci","Galilée","Gutenberg","Copernic"],ans:2,cat:'histoire',diff:2},
  {text:"Quel président américain a aboli l'esclavage ?",opts:["George Washington","Thomas Jefferson","Abraham Lincoln","Theodore Roosevelt"],ans:2,cat:'histoire',diff:1},
  {text:"En quelle année a eu lieu la bataille de Waterloo ?",opts:["1812","1813","1814","1815"],ans:3,cat:'histoire',diff:2},
  {text:"Qui était la reine d'Égypte célèbre pour sa beauté ?",opts:["Néfertiti","Cléopâtre","Hatchepsout","Nefertari"],ans:1,cat:'histoire',diff:1},
  {text:"En quelle année est tombé l'empire romain d'Occident ?",opts:["376","476","576","676"],ans:1,cat:'histoire',diff:3},
  {text:"Quel explorateur portugais a doublé le Cap de Bonne-Espérance ?",opts:["Christophe Colomb","Vasco de Gama","Bartolomeu Dias","Magellan"],ans:2,cat:'histoire',diff:3},
  // ── SCIENCES ──
  {text:"Quelle est la vitesse de la lumière en km/s ?",opts:["150 000","200 000","300 000","400 000"],ans:2,cat:'sciences',diff:2},
  {text:"Combien de planètes compte le système solaire ?",opts:["7","8","9","10"],ans:1,cat:'sciences',diff:1},
  {text:"Quel organe produit l'insuline ?",opts:["Foie","Rein","Pancréas","Rate"],ans:2,cat:'sciences',diff:2},
  {text:"Quel est le plus petit os du corps humain ?",opts:["Péroné","Étrier","Pisiforme","Malléole"],ans:1,cat:'sciences',diff:3},
  {text:"De combien de degrés la Terre est-elle inclinée sur son axe ?",opts:["17,5°","23,5°","30°","45°"],ans:1,cat:'sciences',diff:2},
  {text:"Quel élément chimique a le symbole Na ?",opts:["Nickel","Néon","Sodium","Niobium"],ans:2,cat:'sciences',diff:2},
  {text:"Combien de paires de chromosomes possède l'être humain ?",opts:["21","23","25","27"],ans:1,cat:'sciences',diff:2},
  {text:"Quelle est la formule chimique du sel de table ?",opts:["NaOH","KCl","NaCl","CaCl2"],ans:2,cat:'sciences',diff:2},
  {text:"Quel scientifique a découvert la pénicilline ?",opts:["Louis Pasteur","Marie Curie","Alexander Fleming","Edward Jenner"],ans:2,cat:'sciences',diff:1},
  {text:"Quel est le gaz le plus abondant dans l'atmosphère terrestre ?",opts:["Oxygène","CO2","Argon","Azote"],ans:3,cat:'sciences',diff:2},
  {text:"Quel phénomène provoque les marées ?",opts:["Rotation de la Terre","Gravité du Soleil","Gravité de la Lune","Vent solaire"],ans:2,cat:'sciences',diff:1},
  {text:"Combien de vertèbres a la colonne vertébrale humaine ?",opts:["28","33","38","43"],ans:1,cat:'sciences',diff:3},
  {text:"Quel est le point d'ébullition de l'eau à 0 altitude ?",opts:["90°C","95°C","100°C","105°C"],ans:2,cat:'sciences',diff:1},
  {text:"Quelle force maintient les planètes en orbite ?",opts:["Électromagnétisme","Gravitation","Force nucléaire","Friction"],ans:1,cat:'sciences',diff:1},
  {text:"Quel animal a le cerveau le plus gros par rapport à son corps ?",opts:["Dauphin","Chimpanzé","Fourmi","Pieuvre"],ans:0,cat:'sciences',diff:3},
  {text:"Combien de dents a un adulte (avec sagesse) ?",opts:["28","30","32","34"],ans:2,cat:'sciences',diff:2},
  {text:"Quelle est la température du noyau de la Terre ?",opts:["1 000°C","3 000°C","5 000°C","6 000°C"],ans:3,cat:'sciences',diff:3},
  {text:"Quel est le symbole chimique du potassium ?",opts:["P","Po","K","Pt"],ans:2,cat:'sciences',diff:2},
  {text:"Combien de litres de sang le cœur pompe-t-il par jour ?",opts:["3 000","5 000","7 000","10 000"],ans:2,cat:'sciences',diff:3},
  {text:"Quel est le nom de la couche externe de la Terre ?",opts:["Manteau","Noyau","Lithosphère","Croûte"],ans:3,cat:'sciences',diff:2},
  // ── CINÉMA / SÉRIES ──
  {text:"Dans quel film Bruce Willis joue-t-il un policier sans chaussures ?",opts:["Die Hard","Pulp Fiction","Sixième Sens","Armageddon"],ans:0,cat:'cinema',diff:2},
  {text:"Quel personnage dit 'Hasta la vista, baby' ?",opts:["Rambo","Terminator","RoboCop","John Wick"],ans:1,cat:'cinema',diff:1},
  {text:"Dans quelle série trouve-t-on les personnages Ross et Rachel ?",opts:["Seinfeld","How I Met Your Mother","Friends","The Big Bang Theory"],ans:2,cat:'cinema',diff:1},
  {text:"Qui réalise 'Pulp Fiction' ?",opts:["Martin Scorsese","David Fincher","Quentin Tarantino","Christopher Nolan"],ans:2,cat:'cinema',diff:1},
  {text:"Dans quel film voit-on un requin blanc géant ?",opts:["Deep Blue Sea","47 Meters Down","Jaws","The Reef"],ans:2,cat:'cinema',diff:1},
  {text:"Quelle série se déroule dans une prison pour femmes ?",opts:["Shameless","Orphan Black","Orange Is the New Black","Weeds"],ans:2,cat:'cinema',diff:1},
  {text:"Quel studio a créé Toy Story ?",opts:["DreamWorks","Warner","Disney","Pixar"],ans:3,cat:'cinema',diff:1},
  {text:"Qui joue le rôle de James Bond dans 'Casino Royale' (2006) ?",opts:["Pierce Brosnan","Roger Moore","Daniel Craig","Timothy Dalton"],ans:2,cat:'cinema',diff:1},
  {text:"Dans quel film parle-t-on du 'cercle des poètes disparus' ?",opts:["Good Will Hunting","Dead Poets Society","Freedom Writers","The Club"],ans:1,cat:'cinema',diff:2},
  {text:"Quel acteur joue Tony Montana dans Scarface ?",opts:["Robert De Niro","Al Pacino","Jack Nicholson","Dustin Hoffman"],ans:1,cat:'cinema',diff:1},
  {text:"Dans quelle série voit-on Walter White ?",opts:["Dexter","Better Call Saul","Breaking Bad","The Wire"],ans:2,cat:'cinema',diff:1},
  {text:"Quel film de Spielberg parle d'un extraterrestre laissé sur Terre ?",opts:["Close Encounters","E.T.","War of the Worlds","Contact"],ans:1,cat:'cinema',diff:1},
  {text:"Combien de films compte la trilogie originale Star Wars ?",opts:["2","3","4","6"],ans:1,cat:'cinema',diff:1},
  {text:"Dans quel film Meryl Streep joue-t-elle Miranda Priestly ?",opts:["Kramer vs. Kramer","Sophie's Choice","The Devil Wears Prada","Julie & Julia"],ans:2,cat:'cinema',diff:2},
  {text:"Quelle série Netflix se passe à Seoul et implique des jeux d'enfants mortels ?",opts:["Hellbound","All of Us Are Dead","Squid Game","Sweet Home"],ans:2,cat:'cinema',diff:1},
  {text:"Qui joue Black Panther dans le MCU ?",opts:["Idris Elba","Michael B. Jordan","Chadwick Boseman","Daniel Kaluuya"],ans:2,cat:'cinema',diff:1},
  {text:"Dans quel film voit-on la phrase 'Je vois des gens morts' ?",opts:["Saw","The Others","Sixième Sens","Ring"],ans:2,cat:'cinema',diff:2},
  {text:"Quel réalisateur a fait 'Avatar' ?",opts:["Steven Spielberg","Peter Jackson","J.J. Abrams","James Cameron"],ans:3,cat:'cinema',diff:1},
  {text:"Dans quelle série trouve-t-on les Avocats de la défense de 'Better Call Saul' ?",opts:["Suits","The Good Wife","Better Call Saul","Boston Legal"],ans:2,cat:'cinema',diff:1},
  {text:"Qui joue le Roi Leonidas dans '300' ?",opts:["Brad Pitt","Russell Crowe","Gerard Butler","Viggo Mortensen"],ans:2,cat:'cinema',diff:2},
  // ── MUSIQUE ──
  {text:"Quel artiste est surnommé 'The King of Rock and Roll' ?",opts:["Chuck Berry","Little Richard","Elvis Presley","Jerry Lee Lewis"],ans:2,cat:'musique',diff:1},
  {text:"Quel groupe chante 'Smells Like Teen Spirit' ?",opts:["Pearl Jam","Soundgarden","Alice in Chains","Nirvana"],ans:3,cat:'musique',diff:1},
  {text:"Combien d'octaves a un piano standard ?",opts:["6","7","8","9"],ans:1,cat:'musique',diff:3},
  {text:"Quel artiste français est connu pour 'La Vie en Rose' ?",opts:["Charles Aznavour","Édith Piaf","Jacques Brel","Serge Gainsbourg"],ans:1,cat:'musique',diff:1},
  {text:"Dans quel pays est né Bob Marley ?",opts:["Trinidad","Barbade","Jamaïque","Haiti"],ans:2,cat:'musique',diff:1},
  {text:"Quel instrument joue Miles Davis ?",opts:["Saxophone","Trompette","Trombone","Clarinette"],ans:1,cat:'musique',diff:2},
  {text:"Qui a composé la 9e Symphonie ?",opts:["Bach","Mozart","Brahms","Beethoven"],ans:3,cat:'musique',diff:1},
  {text:"Quel groupe chante 'Hotel California' ?",opts:["Fleetwood Mac","The Eagles","Aerosmith","Dire Straits"],ans:1,cat:'musique',diff:2},
  {text:"Qui est surnommé 'The Weeknd' ?",opts:["Drake","Abel Tesfaye","The Game","Travis Scott"],ans:1,cat:'musique',diff:2},
  {text:"Quel artiste a vendu le plus d'albums dans l'histoire ?",opts:["Michael Jackson","Elvis Presley","The Beatles","Madonna"],ans:1,cat:'musique',diff:3},
  {text:"Quel chanteur est connu pour 'Despacito' ?",opts:["J Balvin","Bad Bunny","Luis Fonsi","Daddy Yankee"],ans:2,cat:'musique',diff:2},
  {text:"Quel groupe britannique compte Mick Jagger et Keith Richards ?",opts:["The Who","Led Zeppelin","The Kinks","Rolling Stones"],ans:3,cat:'musique',diff:1},
  {text:"Combien de notes a une gamme musicale diatonique ?",opts:["5","7","8","12"],ans:1,cat:'musique',diff:3},
  {text:"Qui chante 'Bad Guy' ?",opts:["Dua Lipa","Ariana Grande","Billie Eilish","Olivia Rodrigo"],ans:2,cat:'musique',diff:1},
  {text:"Quel pays a inventé le tango ?",opts:["Brésil","Espagne","Argentine","Cuba"],ans:2,cat:'musique',diff:1},
  // ── SPORT ──
  {text:"Dans quel sport peut-on faire un 'smash' ?",opts:["Tennis de table","Badminton","Volleyball","Toutes ces réponses"],ans:3,cat:'sport',diff:2},
  {text:"Combien de médailles d'or Michael Phelps a-t-il remportées aux JO ?",opts:["18","21","23","27"],ans:2,cat:'sport',diff:3},
  {text:"Quel pays a remporté la Coupe du Monde 2022 ?",opts:["France","Brésil","Argentine","Portugal"],ans:2,cat:'sport',diff:1},
  {text:"Dans quel sport utilise-t-on un 'jokari' ?",opts:["Padel","Squash","Badminton","Pong"],ans:0,cat:'sport',diff:3},
  {text:"Quel est le record du monde du 100m ?",opts:["9,58s","9,69s","9,74s","9,81s"],ans:0,cat:'sport',diff:2},
  {text:"Quelle équipe de basketball est surnommée les 'Lakers' ?",opts:["New York","Chicago","Miami","Los Angeles"],ans:3,cat:'sport',diff:1},
  {text:"Dans quel sport parle-t-on de 'grand chelem' ?",opts:["Rugby et Tennis","Tennis et Golf","Seulement Tennis","Rugby, Tennis et Golf"],ans:3,cat:'sport',diff:3},
  {text:"Combien de joueurs y a-t-il dans une équipe de basketball ?",opts:["4","5","6","7"],ans:1,cat:'sport',diff:1},
  {text:"Qui a remporté le plus de Ballon d'Or ?",opts:["Cristiano Ronaldo","Lionel Messi","Zinedine Zidane","Michel Platini"],ans:1,cat:'sport',diff:2},
  {text:"Dans quel sport peut-on réaliser un 'ace' ?",opts:["Golf","Tennis","Badminton","Squash"],ans:1,cat:'sport',diff:1},
  {text:"Combien de km mesure le Tour de France en moyenne ?",opts:["2 500 km","3 000 km","3 500 km","4 000 km"],ans:2,cat:'sport',diff:3},
  {text:"Quel pays a le plus de médailles olympiques au total dans l'histoire ?",opts:["URSS","Chine","Russie","États-Unis"],ans:3,cat:'sport',diff:2},
  {text:"Dans quel sport dit-on 'Touché !' ?",opts:["Escrime","Boxe","Judo","Karaté"],ans:0,cat:'sport',diff:2},
  {text:"Combien de joueurs composent une équipe de rugby à XV ?",opts:["13","14","15","16"],ans:2,cat:'sport',diff:1},
  {text:"Quel est le vrai nom de Mohamed Ali ?",opts:["Cassius Clay","Michael Tyson","Floyd Patterson","Joe Frazier"],ans:0,cat:'sport',diff:2},
  // ── CUISINE ──
  {text:"Quelle épice provient du crocus ?",opts:["Safran","Curcuma","Paprika","Cumin"],ans:0,cat:'cuisine',diff:2},
  {text:"De quel pays viennent les tacos ?",opts:["Espagne","Colombie","Mexique","Guatemala"],ans:2,cat:'cuisine',diff:1},
  {text:"Quel fromage français est surnommé 'roi des fromages' ?",opts:["Camembert","Brie","Roquefort","Comté"],ans:2,cat:'cuisine',diff:2},
  {text:"Quelle boisson est fabriquée à partir de raisins fermentés ?",opts:["Bière","Cidre","Whisky","Vin"],ans:3,cat:'cuisine',diff:1},
  {text:"Quel ingrédient est indispensable dans un risotto ?",opts:["Pâtes","Riz arborio","Polenta","Quinoa"],ans:1,cat:'cuisine',diff:2},
  {text:"De quel pays vient le kimchi ?",opts:["Japon","Chine","Vietnam","Corée"],ans:3,cat:'cuisine',diff:1},
  {text:"Quelle est la base d'une sauce béarnaise ?",opts:["Crème","Beurre clarifié","Huile d'olive","Lait"],ans:1,cat:'cuisine',diff:3},
  {text:"Quel fruit exotique a une chair jaune et est riche en bromélaïne ?",opts:["Mangue","Papaye","Ananas","Kiwi"],ans:2,cat:'cuisine',diff:2},
  {text:"Dans quelle ville est née la fondue savoyarde ?",opts:["Lyon","Genève","Chambéry","Annecy"],ans:3,cat:'cuisine',diff:3},
  {text:"Quelle sauce accompagne traditionnellement les sushis ?",opts:["Sauce hoisin","Sauce soja","Sauce teriyaki","Sauce ponzu"],ans:1,cat:'cuisine',diff:1},
  {text:"Quel légume est la base du houmous ?",opts:["Lentilles","Pois chiches","Haricots blancs","Fèves"],ans:1,cat:'cuisine',diff:1},
  {text:"Quelle boisson alcoolisée est fabriquée avec du riz fermenté ?",opts:["Saké","Vodka","Rhum","Gin"],ans:0,cat:'cuisine',diff:1},
  // ── TECH ──
  {text:"Que signifie HTML ?",opts:["High Text Markup Language","HyperText Markup Language","Hyper Transfer Markup Language","Home Text Markup Language"],ans:1,cat:'tech',diff:1},
  {text:"Quel est le système d'exploitation mobile de Google ?",opts:["iOS","Windows Mobile","Android","HarmonyOS"],ans:2,cat:'tech',diff:1},
  {text:"En quelle année a été créé Twitter (X) ?",opts:["2004","2005","2006","2007"],ans:2,cat:'tech',diff:2},
  {text:"Combien de bits contient un octet ?",opts:["4","6","8","16"],ans:2,cat:'tech',diff:1},
  {text:"Qui a cofondé Microsoft avec Bill Gates ?",opts:["Paul Allen","Steve Jobs","Gordon Moore","Larry Page"],ans:0,cat:'tech',diff:2},
  {text:"Quel langage utilise la JVM (Java Virtual Machine) ?",opts:["Python","JavaScript","Java","Go"],ans:2,cat:'tech',diff:2},
  {text:"Que signifie URL ?",opts:["Universal Resource Locator","Uniform Resource Locator","Unified Resource Link","Universal Resource Link"],ans:1,cat:'tech',diff:2},
  {text:"Quelle entreprise a créé l'iPhone ?",opts:["Samsung","Sony","Apple","Google"],ans:2,cat:'tech',diff:1},
  {text:"Que signifie GPU ?",opts:["General Processing Unit","Graphics Processing Unit","Global Performance Unit","Graphical Power Unit"],ans:1,cat:'tech',diff:2},
  {text:"Quel est le nom du moteur de recherche de Microsoft ?",opts:["Edge","Cortana","Bing","Yahoo"],ans:2,cat:'tech',diff:1},
  {text:"En quelle année a été lancé l'iPhone original ?",opts:["2005","2006","2007","2008"],ans:2,cat:'tech',diff:2},
  {text:"Quel protocole sécurise les connexions web ?",opts:["FTP","HTTP","HTTPS","SMTP"],ans:2,cat:'tech',diff:1},
  {text:"Quel pays a inventé le Wi-Fi ?",opts:["États-Unis","Japon","Australie","Finlande"],ans:2,cat:'tech',diff:3},
  {text:"Quelle entreprise a créé le processeur Apple M1 ?",opts:["Intel","AMD","NVIDIA","Apple"],ans:3,cat:'tech',diff:2},
  // ── CULTURE GÉNÉRALE ──
  {text:"Combien de continents y a-t-il sur Terre ?",opts:["5","6","7","8"],ans:2,cat:'culture',diff:1},
  {text:"Quelle est la langue la plus parlée dans le monde ?",opts:["Anglais","Espagnol","Mandarin","Hindi"],ans:2,cat:'culture',diff:2},
  {text:"Combien de lettres y a-t-il dans l'alphabet français ?",opts:["24","25","26","27"],ans:2,cat:'culture',diff:1},
  {text:"Qui a écrit 'Les Misérables' ?",opts:["Balzac","Zola","Hugo","Flaubert"],ans:2,cat:'culture',diff:1},
  {text:"Quel est le nom du personnage principal de 'Don Quichotte' ?",opts:["Sancho Pança","Dulcinée","Don Quichotte","Cervantes"],ans:2,cat:'culture',diff:1},
  {text:"Combien de cases y a-t-il sur un échiquier ?",opts:["32","48","64","72"],ans:2,cat:'culture',diff:2},
  {text:"Qui a écrit 'Romeo et Juliette' ?",opts:["Molière","Dante","Shakespeare","Chaucer"],ans:2,cat:'culture',diff:1},
  {text:"Quel philosophe grec a été le précepteur d'Alexandre le Grand ?",opts:["Socrate","Platon","Aristote","Épicure"],ans:2,cat:'culture',diff:2},
  {text:"Combien de minutes dure un match de football réglementaire ?",opts:["80","85","90","95"],ans:2,cat:'culture',diff:1},
  {text:"Quelle est la monnaie du Japon ?",opts:["Yuan","Won","Baht","Yen"],ans:3,cat:'culture',diff:1},
  {text:"Qui a peint 'La Nuit étoilée' ?",opts:["Monet","Picasso","Van Gogh","Renoir"],ans:2,cat:'culture',diff:1},
  {text:"Combien y a-t-il de couleurs sur le drapeau français ?",opts:["2","3","4","5"],ans:1,cat:'culture',diff:1},
  {text:"Quel est le métal le plus précieux ?",opts:["Or","Argent","Platine","Palladium"],ans:2,cat:'culture',diff:2},
  {text:"Combien de joueurs y a-t-il dans une équipe de volley-ball ?",opts:["5","6","7","8"],ans:1,cat:'culture',diff:1},
  {text:"Qui a écrit 'L'Étranger' ?",opts:["Sartre","Camus","Simone de Beauvoir","Gide"],ans:1,cat:'culture',diff:2},
  {text:"Quel est le plus grand animal terrestre ?",opts:["Rhinocéros","Hippopotame","Girafe","Éléphant d'Afrique"],ans:3,cat:'culture',diff:1},
  {text:"Combien de zéros y a-t-il dans un million ?",opts:["4","5","6","7"],ans:2,cat:'culture',diff:1},
  {text:"Qui a peint 'Le Cri' ?",opts:["Klimt","Munch","Kandinsky","Schiele"],ans:1,cat:'culture',diff:2},
  {text:"Quelle est la capitale de l'Espagne ?",opts:["Barcelone","Valencia","Séville","Madrid"],ans:3,cat:'culture',diff:1},
  {text:"Quel est le symbole chimique du fer ?",opts:["Fe","Fi","Fr","Fa"],ans:0,cat:'culture',diff:2},
  // ── Extension banque (questions supplémentaires) ──
  {text:"Quelle est la capitale du Portugal ?",opts:["Lisbonne","Porto","Coimbra","Faro"],ans:0,cat:'geo',diff:1},
  {text:"Quel gaz constitue environ 78 % de l'air ?",opts:["Oxygène","Azote","Dioxyde de carbone","Hélium"],ans:1,cat:'sciences',diff:2},
  {text:"Combien de côtés a un hexagone régulier ?",opts:["5","6","7","8"],ans:1,cat:'culture',diff:1},
  {text:"Quel réseau social a racheté Instagram en 2012 ?",opts:["Google","Meta (Facebook)","Twitter","Snap"],ans:1,cat:'tech',diff:2},
  {text:"Quel est le plus petit pays d'Europe par superficie ?",opts:["Malte","Monaco","Vatican","Saint-Marin"],ans:2,cat:'geo',diff:3},
];

function getServerStats() {
  const rooms = getRoomsSnapshot();
  const byGame = {};
  let waiting = 0;
  let playing = 0;
  rooms.forEach(r => {
    if (!byGame[r.game]) byGame[r.game] = { waiting: 0, playing: 0 };
    if (r.status === 'waiting') {
      byGame[r.game].waiting++;
      waiting++;
    } else {
      byGame[r.game].playing++;
      playing++;
    }
  });
  return {
    roomsTotal: rooms.length,
    roomsWaiting: waiting,
    roomsPlaying: playing,
    byGame,
    gamesCatalog: Object.keys(GAME_NAMES).length,
    quizQuestions: ALL_Q.length,
    profilesCount: profileLib.countProfiles(),
  };
}

app.get('/api/public/stats', (_, res) => {
  res.json(getServerStats());
});

app.get('/api/profile/:deviceId', (req, res) => {
  const p = profileLib.getProfile(req.params.deviceId);
  if (!p) return res.status(404).json({ error: 'Profil introuvable' });
  res.json(p);
});

app.post('/api/profile/sync', (req, res) => {
  try {
    const body = req.body || {};
    const out = profileLib.syncProfile({
      deviceId: body.deviceId,
      displayName: body.displayName,
      history: body.history,
    });
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.get('/api/admin/stats', adminAuth, (_, res) => {
  res.json(getServerStats());
});

app.get('/api/admin/profiles', adminAuth, (req, res) => {
  const lim = Math.min(200, Math.max(1, Number(req.query.limit) || 40));
  res.json({ profiles: profileLib.listProfilesSummary(lim) });
});

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
    clearTimeout(myRoom.timer);
    if(myRoom.players.length===0){quizRooms.delete(myRoom.code);broadcastLobby();return;}
    bcast(myRoom.players,{type:'player_left',name});
    if(myRoom.players.length>=2 && ['QUESTION','BUZZED','SECOND_CHANCE','REVEAL'].includes(myRoom.phase)){
      // Continuer la partie avec les joueurs restants
      myRoom.streaks=[0,0,0,0];
      qStart(myRoom);
    } else {
      const wasInGame=['QUESTION','BUZZED','SECOND_CHANCE','REVEAL'].includes(myRoom.phase);
      if(wasInGame) bcast(myRoom.players,{type:'game_abandoned'});
      myRoom.phase='WAITING';myRoom.streaks=[0,0,0,0];
      bcast(myRoom.players,qSnap(myRoom));
    }
    broadcastLobby();
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    switch(d.type){
      case 'lounge_chat':{
        handleLoungeChat(myRoom,ws,d);
        break;
      }
      case 'create_quiz':{
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const code=genCode(quizRooms);
        const room=makeQuizRoom(code,name);
        room.phase='SETUP';
        quizRooms.set(code,room);
        myRoom=room;
        const slot=0;
        room.players.push({ws,name,score:0,slot,jokers:{fifty:true,pass:true}});
        wsend(ws,{type:'created_quiz',code,slot,name});
        wsend(ws,qSnap(room));
        broadcastLobby();
        break;
      }
      case 'join_quiz':{
        const code=String(d.code||'').trim().toUpperCase();
        const room=quizRooms.get(code);
        if(!room){wsend(ws,{type:'error',msg:'Salle introuvable.'});return;}
        if(room.players.length>=4){wsend(ws,{type:'error',msg:'Partie pleine (4 joueurs max).'});return;}
        if(!['WAITING','SETUP'].includes(room.phase)){wsend(ws,{type:'error',msg:'La partie a déjà commencé.'});return;}
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot=room.players.length;
        room.players.push({ws,name,score:0,slot,jokers:{fifty:true,pass:true}});
        myRoom=room;
        wsend(ws,{type:'welcome_quiz',slot,name,code});
        bcast(room.players,qSnap(room));
        broadcastLobby();
        break;
      }
      case 'start_quiz':{
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
        if(Date.now()-myRoom.questionStartTime<2500)return;
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
      case 'restart_quiz':{
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
  animaux:['chien','chat','lion','éléphant','girafe','singe','pingouin','requin','dauphin','papillon','renard','lapin','ours','tigre','zèbre','flamant rose','hibou','tortue','crocodile','poulpe','baleine','aigle','bison','loup','raton laveur','manchot','fennec','pangolin','axolotl','capybara','koala','panda','gorille','perroquet','kangourou','daim','phoque','lynx','jaguar','piranha'],
  objets:['avion','voiture','vélo','train','bateau','fusée','hélicoptère','moto','bus','camion','parapluie','horloge','bougie','ballon','cadeau','couronne','épée','bouclier','lunettes','chapeau','clé','marteau','loupe','seringue','jumelles','sablier','boussole','télescope','accordéon','harmonica','piano','guitare','trompette','violon','skateboard','trottinette','parachute','sous-marin','catapulte','igloo'],
  lieux:['maison','château','phare','igloo','pyramide','pont','escalier','grotte','volcan','île','désert','forêt','glacier','cimetière','stade','cirque','gare','aéroport','sous-marin','arc de triomphe','cathédrale','labyrinthie','marché','cirque','manège','plage','falaise','cascade','fjord','savane'],
  nourriture:['pizza','gâteau','glace','hamburger','sushi','baguette','croissant','fraise','ananas','champignon','taco','bento','fondue','ratatouille','crêpe','macaron','churros','boba','ramen','curry','donut','hot-dog','wok','paella','kebab','brioche','éclair','profiterole','salade','sushi'],
  nature:['soleil','lune','étoile','arc-en-ciel','montagne','mer','cactus','arbre','fleur','foudre','aurora','glacier','marécage','oasis','tourbillon','tornade','banquise','récif','mangrove','geyser','séisme','éruption','aurore','météorite','comète','tempête','brouillard','rosée','dune','falaise'],
  celebrites:['Einstein','Napoléon','Cléopâtre','Newton','Shakespeare','Picasso','Mozart','Darwin','Léonard de Vinci','Marie Curie','Sherlock Holmes','Dracula','Batman','Cendrillon','Merlin'],
  divers:['dragon','licorne','fantôme','robot','sorcière','alien','super-héros','vampire','sirène','astronaute','pirate','ninja','chevalier','pharaon','zombie','fée','cyclope','centaure','phoenix','yéti','sasquatch','momie','golem','titan','djinn','lutin','gnome','elfe','troll','enchanteur'],
  sport:['football','basketball','tennis','natation','cyclisme','ski','boxe','judo','surf','escalade','volleyball','hockey','golf','rugby','baseball','fléchettes','billard','bowling','escrime','triathlon'],
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
    word:null,scores:[0,0,0,0],wins:[0,0,0,0],timer:null,guessedBy:-1,
    strokeBatches:[],revealedLetters:[],roundGuessers:new Set(),
    roundStartTime:0,
  };
}

function dSnap(room, extra={}, forSlot=-1){
  const base={type:'draw_state',phase:room.phase,
    players:room.players.map(p=>({name:p.name,slot:p.slot})),
    scores:[...room.scores],wins:[...(room.wins||[0,0,0,0])],
    drawerSlot:room.drawerSlot,round:room.round,maxRounds:room.maxRounds,
    letterCount:room.word?room.word.length:0,
    hint:room.word?buildHint(room.word,room.revealedLetters):null,
    guessedBy:room.guessedBy,
    guessedSlots:room.roundGuessers?[...room.roundGuessers]:[],
    roundStartTime:room.roundStartTime||0,
    wordCategory:room.wordCategory||null,
    code:room.code,...extra};
  // Envoyer le mot seulement au dessinateur
  if(forSlot>=0 && forSlot===room.drawerSlot && room.word) base.word=room.word;
  return base;
}

function dStartRound(room){
  if(room.round>=room.maxRounds){dEnd(room);return;}
  room.round++;
  // Rotate drawer through ALL players
  room.drawerSlot=room.players[(room.round-1)%room.players.length]?.slot??0;
  // Choisir un mot aléatoire avec sa catégorie
  const cats=Object.keys(DRAW_WORDS);
  const cat=cats[Math.floor(Math.random()*cats.length)];
  const words=DRAW_WORDS[cat];
  room.word=words[Math.floor(Math.random()*words.length)];
  room.wordCategory=cat;
  room.phase='DRAWING';room.guessedBy=-1;room.strokeBatches=[];room.revealedLetters=[];
  room.roundGuessers=new Set();
  room.roundStartTime=Date.now();
  clearTimeout(room.timer);
  room.players.forEach(p=>{
    wsend(p.ws,dSnap(room,{timerSeconds:60},p.slot));
  });
  room.timer=setTimeout(()=>{if(room.phase==='DRAWING')dReveal(room);},60000);
}

function dReveal(room){
  if(room.phase==='ROUND_OVER')return; // prevent double-call
  clearTimeout(room.timer);room.phase='ROUND_OVER';
  const gs=room.roundGuessers?[...room.roundGuessers]:[];
  // Broadcast with revealWord to ALL players
  room.players.forEach(p=>{
    wsend(p.ws,{...dSnap(room,{revealWord:room.word},p.slot),revealWord:room.word,guessedBy:room.guessedBy,guessedSlots:gs});
  });
  room.timer=setTimeout(()=>{
    if(room.phase==='ROUND_OVER'&&room.players.length>=2)dStartRound(room);
  },4000);
}

function dEnd(room){
  clearTimeout(room.timer);room.phase='GAME_OVER';
  let win=-1,best=-1;
  room.players.forEach(p=>{const s=room.scores[p.slot]??0;if(s>best){best=s;win=p.slot;}else if(s===best){win=-1;}});
  if(!room.wins)room.wins=[0,0,0,0];
  if(win>=0)room.wins[win]++;
  room.players.forEach(p=>{wsend(p.ws,{...dSnap(room,{winnerSlot:win,wins:[...room.wins]},p.slot)});});
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
    const leavingSlot=myRoom.players[idx].slot;
    const wasDrawer=leavingSlot===myRoom.drawerSlot;
    myRoom.players.splice(idx,1);
    myRoom.players.forEach((p,i)=>p.slot=i);
    clearTimeout(myRoom.timer);
    if(myRoom.players.length===0){drawRooms.delete(myRoom.code);broadcastLobby();return;}
    bcast(myRoom.players,{type:'player_left',name});
    const inGame=['DRAWING','ROUND_OVER'].includes(myRoom.phase);
    if(myRoom.players.length<2){
      // Pas assez de joueurs pour continuer
      if(inGame) bcast(myRoom.players,{type:'game_abandoned'});
      myRoom.phase='WAITING';myRoom.scores=[0,0,0,0];myRoom.round=0;myRoom.roundGuessers=new Set();
      myRoom.players.forEach(p=>wsend(p.ws,dSnap(myRoom,{},p.slot)));
    } else if(inGame){
      // Recalculer le dessinateur avec les nouveaux slots
      myRoom.drawerSlot=myRoom.players[(myRoom.round-1)%myRoom.players.length]?.slot??0;
      // Reset roundGuessers car les slots ont changé
      myRoom.roundGuessers=new Set();
      if(myRoom.phase==='DRAWING'){
        if(wasDrawer){
          // Le dessinateur est parti : passer à la révélation
          dReveal(myRoom);
        } else {
          // Un devineur est parti : continuer avec les joueurs restants
          // Redémarrer le timer de 60s (approximatif)
          myRoom.players.forEach(p=>wsend(p.ws,dSnap(myRoom,{timerSeconds:60},p.slot)));
          myRoom.roundStartTime=Date.now();
          myRoom.timer=setTimeout(()=>{if(myRoom.phase==='DRAWING')dReveal(myRoom);},60000);
        }
      } else {
        // ROUND_OVER : relancer le timer de transition
        myRoom.timer=setTimeout(()=>{
          if(myRoom.phase==='ROUND_OVER'&&myRoom.players.length>=2)dStartRound(myRoom);
        },3000);
        myRoom.players.forEach(p=>wsend(p.ws,dSnap(myRoom,{},p.slot)));
      }
    } else {
      // WAITING / READY / GAME_OVER : mise à jour state
      if(myRoom.phase==='GAME_OVER'){myRoom.phase='READY';}
      myRoom.players.forEach(p=>wsend(p.ws,dSnap(myRoom,{},p.slot)));
    }
    broadcastLobby();
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    const player=myRoom?myRoom.players.find(p=>p.ws===ws):null;
    switch(d.type){
      case 'lounge_chat':{
        handleLoungeChat(myRoom,ws,d);
        break;
      }
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
        myRoom.strokeBatches=[];myRoom.revealedLetters=[];myRoom.guessedBy=-1;
        // Countdown avant le début
        bcast(myRoom.players,{type:'draw_countdown',seconds:3});
        clearTimeout(myRoom.timer);
        myRoom.timer=setTimeout(()=>dStartRound(myRoom),3000);
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
        myRoom.roundGuessers=new Set();myRoom.strokeBatches=[];myRoom.revealedLetters=[];myRoom.word=null;
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
    clearTimeout(myRoom.timer);
    if(myRoom.players.length===0){p4Rooms.delete(myRoom.code);broadcastLobby();return;}
    const p4WasInGame=['PLAYING','ROUNDOVER','GAME_OVER'].includes(myRoom.phase);
    bcast(myRoom.players,{type:'player_left',name});
    if(p4WasInGame) bcast(myRoom.players,{type:'game_abandoned'});
    myRoom.phase='WAITING';
    bcast(myRoom.players,p4Snap(myRoom));
    broadcastLobby();
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    const player=myRoom?myRoom.players.find(p=>p.ws===ws):null;
    switch(d.type){
      case 'lounge_chat':{
        handleLoungeChat(myRoom,ws,d);
        break;
      }
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
        if(room.phase!=='WAITING'){wsend(ws,{type:'error',msg:'La partie a déjà commencé.'});return;}
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
        myRoom.board=p4Board();myRoom.turn=0;
        myRoom.phase='COUNTDOWN';bcast(myRoom.players,{type:'countdown',seconds:3});
        clearTimeout(myRoom.timer);myRoom.timer=setTimeout(()=>{myRoom.phase='PLAYING';bcast(myRoom.players,p4Snap(myRoom));broadcastLobby();},3000);
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
    clearTimeout(myRoom.timer);
    if(myRoom.players.length===0){morpionRooms.delete(myRoom.code);broadcastLobby();return;}
    const mWasInGame=['PLAYING','ROUNDOVER','GAME_OVER'].includes(myRoom.phase);
    bcast(myRoom.players,{type:'player_left',name});
    if(mWasInGame) bcast(myRoom.players,{type:'game_abandoned'});
    myRoom.phase='WAITING';
    bcast(myRoom.players,mSnap(myRoom));
    broadcastLobby();
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    const player=myRoom?myRoom.players.find(p=>p.ws===ws):null;
    switch(d.type){
      case 'lounge_chat':{
        handleLoungeChat(myRoom,ws,d);
        break;
      }
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
        if(room.phase!=='WAITING'){wsend(ws,{type:'error',msg:'La partie a déjà commencé.'});return;}
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
        myRoom.board=Array(9).fill(0);
        const roundNum=myRoom.wins[0]+myRoom.wins[1]+myRoom.draws;
        myRoom.turn=roundNum%2;
        myRoom.phase='COUNTDOWN';bcast(myRoom.players,{type:'countdown',seconds:3});
        clearTimeout(myRoom.timer);myRoom.timer=setTimeout(()=>{myRoom.phase='PLAYING';bcast(myRoom.players,mSnap(myRoom));},3000);
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
  {word:'DRAGON',forbidden:['feu','ailes','fantaisie','cracher','légende']},
  {word:'PRISON',forbidden:['barreaux','peine','criminel','enfermé','garde']},
  {word:'BOULANGERIE',forbidden:['pain','croissant','four','baguette','vendre']},
  {word:'TEMPÊTE',forbidden:['vent','pluie','orage','météo','mer']},
  {word:'FANTÔME',forbidden:['mort','invisible','peur','hanter','esprit']},
  {word:'GUITARE',forbidden:['musique','corde','jouer','rock','instrument']},
  {word:'MONTAGNE RUSSE',forbidden:['parc','attraction','vitesse','rails','sensations']},
  {word:'CARTE',forbidden:['géographie','pays','jouer','plan','jeu']},
  {word:'MIROIR',forbidden:['reflet','verre','se voir','sorcière','brisé']},
  {word:'CLOWN',forbidden:['cirque','drôle','nez rouge','maquillage','peur']},
  {word:'DÉPENSE',forbidden:['argent','payer','achat','budget','consommer']},
  {word:'PISCINE',forbidden:['eau','nager','baigner','chlore','sport']},
  {word:'MONSTRE',forbidden:['peur','créature','horrible','attaque','imaginaire']},
  {word:'FORÊT',forbidden:['arbre','nature','bois','champignon','animaux']},
  {word:'MAGIE',forbidden:['magicien','baguette','illusionniste','tour','disparaître']},
  {word:'PYRAMIDE',forbidden:['Égypte','pharaon','sable','ancienne','tombe']},
  {word:'BIBLIOTHÈQUE',forbidden:['livre','lire','emprunter','silence','étagère']},
  {word:'BALLON',forbidden:['gonfler','jouer','air','fête','sport']},
  {word:'COUVERTURE',forbidden:['dormir','chaud','lit','tissu','froid']},
  {word:'ESCALIER',forbidden:['monter','descendre','marche','étage','immeuble']},
  {word:'FENÊTRE',forbidden:['verre','maison','regarder','ouvrir','mur']},
  {word:'SUPERMARCHÉ',forbidden:['acheter','caddie','alimentaire','magasin','rayon']},
  {word:'DANSEUR',forbidden:['mouvement','musique','scène','ballet','corps']},
  {word:'RÊVE',forbidden:['dormir','nuit','inconscient','imaginer','cauchemar']},
  {word:'CACTUS',forbidden:['désert','épines','plante','eau','sécher']},
  {word:'COUCHER DE SOLEIL',forbidden:['soir','rouge','horizon','ciel','beau']},
  {word:'ÉLECTRICITÉ',forbidden:['courant','lumière','tension','ampère','foudre']},
  {word:'DÉTECTIVE',forbidden:['enquête','crime','indice','résoudre','police']},
  {word:'VOLCAN',forbidden:['lave','éruption','roche','montagne','magma']},
  {word:'SANDWICH',forbidden:['pain','garniture','manger','jambon','déjeuner']},
  {word:'SERPENT',forbidden:['reptile','ramper','venin','peau','siffler']},
  {word:'AVOCATS',forbidden:['avocat','défense','justice','tribunal','plaidoyer']},
  {word:'CHAMPIGNON',forbidden:['forêt','cuisinier','toxique','chapeau','pied']},
  {word:'COFFRE',forbidden:['trésor','clé','argent','coffre-fort','secret']},
  {word:'POLLUTION',forbidden:['environnement','planète','gaz','déchets','industrie']},
  {word:'KANGOUROU',forbidden:['Australie','poche','marsupial','sauter','animal']},
  {word:'THÉÂTRE',forbidden:['acteur','scène','pièce','rideau','public']},
  {word:'SORCIÈRE',forbidden:['balai','magie','Halloween','chapeau','sort']},
  {word:'RECYCLAGE',forbidden:['trier','déchets','plastique','environnement','poubelle']},
  {word:'RÉFRIGÉRATEUR',forbidden:['froid','conserver','nourriture','cuisine','électroménager']},
  {word:'MICROSCOPE',forbidden:['lentille','voir','bactérie','laboratoire','grossir']},
  {word:'CYCLISTE',forbidden:['vélo','Tour de France','pédaler','course','roue']},
  {word:'PLANÈTE',forbidden:['espace','soleil','tourner','orbite','astronomie']},
  {word:'CATASTROPHE',forbidden:['désastre','accident','dommage','crise','grave']},
  {word:'TREMBLEMENT DE TERRE',forbidden:['séisme','sol','richter','secousse','dégâts']},
  {word:'POÈME',forbidden:['vers','rime','auteur','écriture','sentiment']},
  {word:'LABORATOIRE',forbidden:['expérience','scientifique','blouse','chimie','réactif']},
  {word:'BANQUE',forbidden:['argent','compte','prêt','dépôt','intérêts']},
  {word:'HÔTEL',forbidden:['chambre','dormir','voyager','service','étoile']},
  {word:'CONCERT',forbidden:['musique','scène','chanteur","public','ticket']},
  {word:'LABYRINTHE',forbidden:['chemin','sortie','mur','perdu','trouver']},
  {word:'STATUE',forbidden:['pierre','sculpture','monument","bronze','musée']},
  {word:'SATELLITE',forbidden:['orbite','espace','télévision','signal','GPS']},
  {word:'INSECTE',forbidden:['six pattes','petite','aile','larve','araignée']},
  {word:'PYJAMA',forbidden:['dormir','nuit','vêtement','confortable","tissu']},
  {word:'COLIS',forbidden:['envoyer','livraison','boîte','poste','emballage']},
  {word:'LÉGENDE',forbidden:['mythe','héros','récit','ancien','imaginaire']},
  {word:'GANTS',forbidden:['mains','froid','protection','boxe','chirurgien']},
  {word:'TROPHÉE',forbidden:['gagner','victoire','compétition','récompense','or']},
  {word:'DENTISTE',forbidden:['dent','soin","bouche','douleur','cabinet']},
  {word:'INFIRMIÈRE',forbidden:['hôpital','soigner','blouse','patient','santé']},
  {word:'DICTIONNAIRE',forbidden:['mots","définition','chercher','langue','alphabet']},
  {word:'SAUT EN PARACHUTE',forbidden:['avion','tomber','ciel','sensations','altitude']},
  {word:'CARNAVAL',forbidden:['masque','fête','costumes','musique','Venise']},
  {word:'MOSQUÉE',forbidden:['islam','prière','religion','minaret','Arabie']},
  {word:'BIBLIOTHÈQUE',forbidden:['livre','lire','emprunter','silence','étagère']},
  {word:'FUSÉE',forbidden:['espace','lancement','NASA','carburant','astronaute']},
  {word:'DAUPHIN',forbidden:['mer','intelligence","mammifère','jeu','poisson']},
  {word:'TORNADE',forbidden:['vent','spirale','destruction','États-Unis','danger']},
];

const tabooRooms = new Map();

function makeTabooRoom(code, host) {
  return { code, host, players:[], phase:'WAITING', describerSlot:0, round:0, maxRounds:8, card:null, scores:[0,0,0,0], timer:null, usedCards:[] };
}
function tSnap(room,extra={}){return{type:'taboo_state',phase:room.phase,players:room.players.map(p=>({name:p.name,slot:p.slot})),scores:[...room.scores],describerSlot:room.describerSlot,round:room.round,maxRounds:room.maxRounds,code:room.code,...extra};}

function tStartRound(room){
  if(room.round>=room.maxRounds){tEnd(room);return;}
  room.round++;
  // Rotation du descripteur parmi TOUS les joueurs
  room.describerSlot=room.players[(room.round-1)%room.players.length]?.slot??0;
  const available=TABOO_CARDS.filter((_,i)=>!room.usedCards.includes(i));
  if(!available.length){room.usedCards=[];}
  const pool=room.usedCards.length?TABOO_CARDS.filter((_,i)=>!room.usedCards.includes(i)):TABOO_CARDS;
  const idx=Math.floor(Math.random()*pool.length);
  room.card=pool[idx];
  room.usedCards.push(TABOO_CARDS.indexOf(room.card));
  room.phase='PLAYING';
  const base=tSnap(room,{timerSeconds:60,round:room.round,maxRounds:room.maxRounds});
  // Envoyer la carte au descripteur, le nb de lettres aux devineurs
  room.players.forEach(p=>{
    if(p.slot===room.describerSlot){wsend(p.ws,{...base,card:{word:room.card.word,forbidden:room.card.forbidden}});}
    else{wsend(p.ws,{...base,wordLen:room.card.word.length});}
  });
  clearTimeout(room.timer);
  room.timer=setTimeout(()=>{if(room.phase==='PLAYING')tReveal(room,false);},60000);
}

function tReveal(room,guessed){
  if(room.phase==='REVEAL')return; // prevent double-call
  clearTimeout(room.timer);room.phase='REVEAL';
  bcast(room.players,{...tSnap(room),revealWord:room.card.word,guessed});
  room.timer=setTimeout(()=>{
    if(room.phase==='REVEAL'&&room.players.length>=2)tStartRound(room);
  },3500);
}
function tEnd(room){
  clearTimeout(room.timer);room.phase='GAME_OVER';
  let win=-1,best=-1;
  room.players.forEach(p=>{const s=room.scores[p.slot]??0;if(s>best){best=s;win=p.slot;}else if(s===best){win=-1;}});
  bcast(room.players,{...tSnap(room),winnerSlot:win});
  broadcastLobby();
}

wssTaboo.on('connection',ws=>{
  makeWS(wssTaboo).alive(ws);
  let myRoom = null;
  ws.on('close',()=>{
    makeWS(wssTaboo).clear(ws);
    if(!myRoom)return;
    const idx=myRoom.players.findIndex(p=>p.ws===ws);if(idx<0)return;
    const name=myRoom.players[idx].name;
    myRoom.players.splice(idx,1);myRoom.players.forEach((p,i)=>p.slot=i);
    clearTimeout(myRoom.timer);
    if(myRoom.players.length===0){tabooRooms.delete(myRoom.code);broadcastLobby();return;}
    bcast(myRoom.players,{type:'player_left',name});
    if(myRoom.players.length<2){
      const tWasInGame=['PLAYING','REVEAL'].includes(myRoom.phase);
      if(tWasInGame) bcast(myRoom.players,{type:'game_abandoned'});
      myRoom.phase='WAITING';myRoom.scores=[0,0,0,0];myRoom.round=0;
    } else if(['PLAYING','REVEAL'].includes(myRoom.phase)){
      // Recalculer le descripteur et continuer
      myRoom.describerSlot=myRoom.players[(myRoom.round-1)%myRoom.players.length]?.slot??0;
      if(myRoom.phase==='REVEAL'){
        myRoom.timer=setTimeout(()=>{if(myRoom.phase==='REVEAL'&&myRoom.players.length>=2)tStartRound(myRoom);},2000);
      } else {
        tReveal(myRoom,false);
      }
    } else {
      if(myRoom.phase==='GAME_OVER')myRoom.phase='WAITING';
    }
    bcast(myRoom.players,tSnap(myRoom));
    broadcastLobby();
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    const player=myRoom?myRoom.players.find(p=>p.ws===ws):null;
    switch(d.type){
      case 'lounge_chat':{
        handleLoungeChat(myRoom,ws,d);
        break;
      }
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
        if(room.phase!=='WAITING'){wsend(ws,{type:'error',msg:'La partie a déjà commencé.'});return;}
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
        myRoom.scores=[0,0,0,0];myRoom.round=0;myRoom.usedCards=[];
        myRoom.phase='COUNTDOWN';bcast(myRoom.players,{type:'countdown',seconds:3});
        clearTimeout(myRoom.timer);myRoom.timer=setTimeout(()=>tStartRound(myRoom),3000);
        broadcastLobby();
        break;
      }
      case 'guess_taboo':{
        if(!player||!myRoom||player.slot===myRoom.describerSlot||myRoom.phase!=='PLAYING')return;
        const guess=String(d.word||'').trim().slice(0,60);if(!guess)return;
        const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
        if(norm(guess)===norm(myRoom.card.word)){
          myRoom.scores[player.slot]=(myRoom.scores[player.slot]||0)+2;
          myRoom.scores[myRoom.describerSlot]=(myRoom.scores[myRoom.describerSlot]||0)+1;
          bcast(myRoom.players,{type:'taboo_correct',guesser:player.name,word:myRoom.card.word});
          tReveal(myRoom,true);
        }else{
          bcast(myRoom.players,{type:'taboo_guess',name:player.name,word:guess});
        }
        break;
      }
      case 'grille':{
        if(!player||!myRoom||player.slot===myRoom.describerSlot||myRoom.phase!=='PLAYING')return;
        myRoom.scores[myRoom.describerSlot]=Math.max(0,(myRoom.scores[myRoom.describerSlot]||0)-1);
        bcast(myRoom.players,{type:'taboo_grille',name:player.name,scores:[...myRoom.scores]});
        tReveal(myRoom,false);
        break;
      }
      case 'restart_taboo':{
        if(!player||!myRoom||myRoom.phase!=='GAME_OVER')return;
        myRoom.scores=[0,0,0,0];myRoom.round=0;myRoom.usedCards=[];myRoom.phase='READY';bcast(myRoom.players,tSnap(myRoom));
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
  // Films ──
  {emojis:'🏹👧🌲🔥',answer:'Hunger Games',cat:'Film'},
  {emojis:'🦸‍♂️🔴⚡🌩️',answer:'Shazam',cat:'Film'},
  {emojis:'🐺🌕🏠',answer:'Loup-Garou',cat:'Film'},
  {emojis:'🧊🐻‍❄️🎪',answer:'Moi Moche et Méchant',cat:'Film'},
  {emojis:'👮‍♂️🚔💥🚗',answer:'Fast and Furious',cat:'Film'},
  {emojis:'🦈🎵🏊',answer:'Les Dents de la Mer',cat:'Film'},
  {emojis:'🤖🔫🌌',answer:'Star Wars',cat:'Film'},
  {emojis:'🧠💊🔴🔵',answer:'Matrix',cat:'Film'},
  {emojis:'🧊💎❤️🚢',answer:'Titanic',cat:'Film'},
  {emojis:'🔫💼🩸🎩',answer:'Pulp Fiction',cat:'Film'},
  {emojis:'🦸‍♀️🌟💪👸',answer:'Captain Marvel',cat:'Film'},
  {emojis:'🏔️💍🧙‍♂️🌋',answer:'Le Seigneur des Anneaux',cat:'Film'},
  {emojis:'🐝🍯🌸🏕️',answer:'Le Voyage de Chihiro',cat:'Film'},
  {emojis:'👻🍕🎒🚲',answer:'Ghostbusters',cat:'Film'},
  {emojis:'🏠🔑👴🎈',answer:'Là-Haut',cat:'Film'},
  {emojis:'🌊🐠🐙🗺️',answer:'Vaiana',cat:'Film'},
  {emojis:'🐻🍯🌲🏞️',answer:'L\'Ours',cat:'Film'},
  {emojis:'⚡🧙‍♂️🏰🦉',answer:'Harry Potter',cat:'Film'},
  {emojis:'🕸️🏙️📸🎓',answer:'Spider-Man',cat:'Film'},
  {emojis:'🐺🌾🧒🌽',answer:'Bambi',cat:'Film'},
  {emojis:'🐻‍❄️🌊🌏✈️',answer:'Ours Polaire',cat:'Film'},
  {emojis:'💀☠️🏝️🗺️💰',answer:'Pirates des Caraïbes',cat:'Film'},
  {emojis:'🎭🎪🤹🎩',answer:'Le Grand Cirque',cat:'Film'},
  {emojis:'👦🏠🏠🏠🎅',answer:'Maman j\'ai raté l\'avion',cat:'Film'},
  {emojis:'🧩🔴🔵🟡',answer:'Tétris',cat:'Film'},
  {emojis:'🦁👑🌍🐗',answer:'Le Roi Lion',cat:'Film'},
  {emojis:'🚀🌌👩‍🚀🔭',answer:'Interstellar',cat:'Film'},
  {emojis:'🐧🎬🎭❄️',answer:'La Reine des Neiges',cat:'Film'},
  // Séries ──
  {emojis:'🏫🕵️💀🔍',answer:'Riverdale',cat:'Série'},
  {emojis:'🧪🔬💵🌵',answer:'Breaking Bad',cat:'Série'},
  {emojis:'🐉🔥⚔️🏰',answer:'Game of Thrones',cat:'Série'},
  {emojis:'🌎👁️🔐💻',answer:'Black Mirror',cat:'Série'},
  {emojis:'👨‍💼💼🏢🖊️',answer:'Suits',cat:'Série'},
  {emojis:'🧛‍♂️🌧️🏫❤️',answer:'Vampire Diaries',cat:'Série'},
  {emojis:'🏝️🌴💀🐗',answer:'Lost',cat:'Série'},
  {emojis:'🦸‍♀️💪🌊🌍',answer:'Buffy',cat:'Série'},
  {emojis:'💊🔴💊🔵🤖',answer:'Westworld',cat:'Série'},
  {emojis:'🎻👓📚🏰',answer:'Downton Abbey',cat:'Série'},
  {emojis:'🐯🌿👶🎵',answer:'Le Livre de la Jungle',cat:'Série'},
  {emojis:'🕵️‍♀️💄🔫🌃',answer:'Alias',cat:'Série'},
  {emojis:'🌮🛸👾🤖',answer:'Rick et Morty',cat:'Série'},
  {emojis:'🏥💊🩺❤️',answer:'Grey\'s Anatomy',cat:'Série'},
  {emojis:'👨‍🦳🤙🌺🏖️',answer:'Magnum',cat:'Série'},
  // Chansons ──
  {emojis:'🕺🌃🎷🍸',answer:'Gangnam Style',cat:'Chanson'},
  {emojis:'💃🔥🌹❤️‍🔥',answer:'Shakira',cat:'Chanson'},
  {emojis:'💎🔵🌊🥶',answer:'Ice Ice Baby',cat:'Chanson'},
  {emojis:'🎸🔥🤘⚡',answer:'Highway to Hell',cat:'Chanson'},
  {emojis:'🌙✨⭐🌟',answer:'Starboy',cat:'Chanson'},
  {emojis:'👑💍💍💍',answer:'We Are the Champions',cat:'Chanson'},
  {emojis:'🚂💨🌾🤠',answer:'Country Roads',cat:'Chanson'},
  {emojis:'🧠💥🤯🎵',answer:'Mind Games',cat:'Chanson'},
  {emojis:'💃🕺🌺🌴',answer:'Macarena',cat:'Chanson'},
  {emojis:'😭💔🎹🌧️',answer:'Someone Like You',cat:'Chanson'},
  {emojis:'🎸🌪️⭕🔴',answer:'Rolling in the Deep',cat:'Chanson'},
  {emojis:'🤖💃🎶🕹️',answer:'Around the World',cat:'Chanson'},
  // Expressions ──
  {emojis:'🤞🙏🍀✨',answer:'Bonne Chance',cat:'Expression'},
  {emojis:'🎂🕯️🎁🎈',answer:'Joyeux Anniversaire',cat:'Expression'},
  {emojis:'😴🛌💤🌙',answer:'Bonne Nuit',cat:'Expression'},
  {emojis:'☕🌅😊🌤️',answer:'Bonjour',cat:'Expression'},
  {emojis:'🤝✅💼🏆',answer:'Bonne Chance',cat:'Expression'},
  {emojis:'❤️💌💑🌹',answer:'Je t\'aime',cat:'Expression'},
  {emojis:'🥳🎊🥂🎉',answer:'Félicitations',cat:'Expression'},
  {emojis:'🙏💛🌸🤗',answer:'Merci',cat:'Expression'},
  {emojis:'👋🏻✈️🌍',answer:'Au Revoir',cat:'Expression'},
  {emojis:'😤💪🔥🏋️',answer:'Courage',cat:'Expression'},
  // Célébrités ──
  {emojis:'🎤👑🌍🎵',answer:'Michael Jackson',cat:'Célébrité'},
  {emojis:'🧠💡⚡🔬',answer:'Einstein',cat:'Célébrité'},
  {emojis:'🍎💻🖥️📱',answer:'Steve Jobs',cat:'Célébrité'},
  {emojis:'⚽🐐🇦🇷',answer:'Messi',cat:'Célébrité'},
  {emojis:'⚽👑🇵🇹💪',answer:'Cristiano Ronaldo',cat:'Célébrité'},
  {emojis:'🎭🎬🍿🌟',answer:'Leonardo DiCaprio',cat:'Célébrité'},
  {emojis:'🚀🚗💰🌍',answer:'Elon Musk',cat:'Célébrité'},
  {emojis:'🎤🇫🇷❤️🌹',answer:'Édith Piaf',cat:'Célébrité'},
  {emojis:'🎨🌻😰🖼️',answer:'Van Gogh',cat:'Célébrité'},
  {emojis:'📱🔗🌐💻',answer:'Mark Zuckerberg',cat:'Célébrité'},
  {emojis:'🥊👊💪🏆',answer:'Mohamed Ali',cat:'Célébrité'},
  {emojis:'🔭🌌🪐⭐',answer:'Stephen Hawking',cat:'Célébrité'},
  {emojis:'🎸🎵🌟💀',answer:'Elvis Presley',cat:'Célébrité'},
  {emojis:'🇫🇷👑⚔️🏰',answer:'Napoléon',cat:'Célébrité'},
  {emojis:'🕊️✌️💪🌍',answer:'Nelson Mandela',cat:'Célébrité'},
];

function emojiNorm(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();}
function emojiLoose(s){
  return emojiNorm(s)
    .replace(/[''`´-]/g,'')
    .replace(/\s+/g,'')
    .replace(/[^a-z0-9]/g,'');
}
function levenshtein(a,b){
  const m=a.length,n=b.length;
  if(!m)return n;
  if(!n)return m;
  const dp=Array.from({length:m+1},()=>Array(n+1).fill(0));
  for(let i=0;i<=m;i++)dp[i][0]=i;
  for(let j=0;j<=n;j++)dp[0][j]=j;
  for(let i=1;i<=m;i++){
    for(let j=1;j<=n;j++){
      const cost=a[i-1]===b[j-1]?0:1;
      dp[i][j]=Math.min(
        dp[i-1][j]+1,
        dp[i][j-1]+1,
        dp[i-1][j-1]+cost
      );
    }
  }
  return dp[m][n];
}
function emojiIsCorrect(guess, answer){
  const g=emojiLoose(guess);
  const a=emojiLoose(answer);
  if(!g||!a)return false;
  if(g===a)return true;
  const maxLen=Math.max(g.length,a.length);
  const lenDiff=Math.abs(g.length-a.length);
  if(maxLen>=8){
    if(lenDiff>2)return false;
    return levenshtein(g,a)<=2;
  }
  if(maxLen>=5){
    if(lenDiff>1)return false;
    return levenshtein(g,a)<=1;
  }
  return false;
}

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
    clearTimeout(myRoom.timer);
    if(myRoom.players.length===0){emojiRooms.delete(myRoom.code);broadcastLobby();return;}
    bcast(myRoom.players,{type:'player_left',name});
    if(myRoom.players.length<2){
      const eWasInGame=['QUESTION','REVEAL'].includes(myRoom.phase);
      if(eWasInGame) bcast(myRoom.players,{type:'game_abandoned'});
      myRoom.phase='WAITING';myRoom.scores=[0,0,0,0];myRoom.qIndex=0;
    } else if(['QUESTION','REVEAL'].includes(myRoom.phase)){
      // Continuer la partie si assez de joueurs
      if(myRoom.phase==='QUESTION'){
        myRoom.answeredSlots=new Set();
        bcast(myRoom.players,{...eSnap(myRoom),timerSeconds:20});
        myRoom.timer=setTimeout(()=>{if(myRoom.phase==='QUESTION')eReveal(myRoom,[]);},20000);
      } else {
        myRoom.timer=setTimeout(()=>eStartQ(myRoom),2000);
      }
    } else {
      if(myRoom.phase==='GAME_OVER')myRoom.phase='WAITING';
    }
    bcast(myRoom.players,eSnap(myRoom));
    broadcastLobby();
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    const player=myRoom?myRoom.players.find(p=>p.ws===ws):null;
    switch(d.type){
      case 'lounge_chat':{
        handleLoungeChat(myRoom,ws,d);
        break;
      }
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
        const correct=emojiIsCorrect(text,p.answer);
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
//  LOUP-GAROU
// ════════════════════════════════════════════════════════

const loupRooms = new Map();

function makeLoupRoom(code, host) {
  return { code, host, players:[], phase:'WAITING',
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
    else { myRoom.phase = 'WAITING'; bcast(myRoom.players, { type:'player_left', name }); loupBcastAll(myRoom); }
    broadcastLobby();
  });
  ws.on('message', raw => {
    let d; try { d = JSON.parse(raw); } catch { return; }
    const player = myRoom ? myRoom.players.find(p => p.ws === ws) : null;
    switch (d.type) {
      case 'lounge_chat': {
        handleLoungeChat(myRoom, ws, d);
        break;
      }
      case 'create_loup': {
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
        if (room.phase !== 'WAITING') { wsend(ws, { type:'error', msg:'La partie a déjà commencé.' }); return; }
        const name = String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot = room.players.length;
        room.players.push({ ws, name, slot, alive:true, role:null });
        myRoom = room;
        wsend(ws, { type:'welcome_loup', slot, name, code });
        loupBcastAll(room);
        broadcastLobby();
        break;
      }
      case 'start_loup': {
        if (!player || !myRoom || player.slot !== 0 || myRoom.phase !== 'WAITING') return;
        if (myRoom.players.length < 4) { wsend(ws, { type:'error', msg:'Il faut au moins 4 joueurs.' }); return; }
        bcast(myRoom.players, { type:'countdown', seconds:3 });
        clearTimeout(myRoom.timer);
        myRoom.timer = setTimeout(() => {
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
        }, 3000);
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
  return { code, host, players:[], phase:'WAITING',
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
    else { myRoom.phase = 'WAITING'; bcast(myRoom.players, { type:'player_left', name }); unoBcastAll(myRoom); }
    broadcastLobby();
  });
  ws.on('message', raw => {
    let d; try { d = JSON.parse(raw); } catch { return; }
    const player = myRoom ? myRoom.players.find(p => p.ws === ws) : null;
    switch (d.type) {
      case 'lounge_chat': {
        handleLoungeChat(myRoom, ws, d);
        break;
      }
      case 'create_uno': {
        const name = String(d.name||'').trim().slice(0,20)||'Joueur';
        const code = genCode(unoRooms);
        const room = makeUnoRoom(code, name);
        unoRooms.set(code, room);
        myRoom = room;
        room.players.push({ ws, name, slot:0 });
        wsend(ws, { type:'created_uno', code, slot:0, name });
        wsend(ws, unoSnap(room, 0));
        broadcastLobby();
        break;
      }
      case 'join_uno': {
        const code = String(d.code||'').trim().toUpperCase();
        const room = unoRooms.get(code);
        if (!room) { wsend(ws, { type:'error', msg:'Salle introuvable.' }); return; }
        if (room.players.length >= 4) { wsend(ws, { type:'error', msg:'Salle pleine (4 max).' }); return; }
        if (room.phase !== 'WAITING') { wsend(ws, { type:'error', msg:'La partie a déjà commencé.' }); return; }
        const name = String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot = room.players.length;
        room.players.push({ ws, name, slot });
        myRoom = room;
        wsend(ws, { type:'welcome_uno', slot, name, code });
        unoBcastAll(room);
        broadcastLobby();
        break;
      }
      case 'start_uno': {
        if (!player || !myRoom || player.slot !== 0 || myRoom.phase !== 'WAITING') return;
        if (myRoom.players.length < 2) { wsend(ws, { type:'error', msg:'Il faut au moins 2 joueurs.' }); return; }
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
        myRoom.phase = 'COUNTDOWN';
        bcast(myRoom.players, { type:'countdown', seconds:3 });
        clearTimeout(myRoom.timer);
        myRoom.timer = setTimeout(() => { myRoom.phase = 'PLAYING'; unoBcastAll(myRoom); broadcastLobby(); }, 3000);
        broadcastLobby();
        break;
      }
      case 'play_uno': {
        if (!player || !myRoom || myRoom.phase !== 'PLAYING') return;
        if (myRoom.players[myRoom.turn]?.slot !== player.slot) {
          wsend(ws, { type:'error', msg:"Ce n'est pas ton tour." }); return;
        }
        const hand = myRoom.hands[player.slot] || [];
        const ci = Number(d.cardIndex);
        if (ci < 0 || ci >= hand.length) { wsend(ws, { type:'error', msg:'Carte invalide.' }); return; }
        const card = hand[ci];
        const top = myRoom.pile[myRoom.pile.length-1];
        if (!unoCanPlay(card, top, myRoom.currentColor, myRoom.drawStack)) {
          wsend(ws, { type:'error', msg:'Carte non jouable.' }); return;
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
          wsend(ws, { type:'error', msg:"Ce n'est pas ton tour." }); return;
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
//  WORD BOMB
// ════════════════════════════════════════════════════════
const bombRooms = new Map();
const BOMB_SYLLABLES_EASY = [
  'an','on','ou','in','re','ra','ro','ta','te','to','ma','me','mi','mo',
  'la','le','li','lo','cha','che','chi','cho','tra','tri','tro','pro','pre',
  'bra','ble','bar','bel','ver','vou','jeu','air','eur','son','sur','mont'
];
const BOMB_SYLLABLES_HARD = ['tion','ment','ette','able','ique','eur','isme','oire','ence','ance','eau'];

function bombNorm(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
}
function bombWordKey(s){
  let v = bombNorm(s)
    .replace(/œ/g,'oe')
    .replace(/æ/g,'ae')
    // Accepte les élisions fréquentes côté joueur: l'amour, d'accord, qu'on...
    .replace(/^(?:l|d|j|m|n|s|t|c|qu)['']/,'');
  return v.replace(/[^a-z]/g,'');
}
const FRENCH_WORDS_ARRAY = Array.isArray(frenchWordsPkg)
  ? frenchWordsPkg
  : (Array.isArray(frenchWordsPkg?.default) ? frenchWordsPkg.default : []);
const BOMB_DICT = new Set(FRENCH_WORDS_ARRAY.map(w=>bombWordKey(w)).filter(Boolean));
function bombIsRealWord(word){
  const key = bombWordKey(word);
  return key.length >= 3 && BOMB_DICT.has(key);
}
function makeBombRoom(code, host){
  return {
    code, host, players:[], phase:'WAITING',
    turn:0, syllable:'', used:new Set(), recentWords:[],
    timer:null, turnEndsAt:0, turnMs:12000, successfulWords:0
  };
}
function bombLivePlayers(room){ return room.players.filter(p=>p.alive); }
function bombNextAliveSlot(room, fromSlot){
  const alive = bombLivePlayers(room);
  if(!alive.length)return -1;
  let idx = room.players.findIndex(p=>p.slot===fromSlot);
  if(idx<0)idx=0;
  for(let i=1;i<=room.players.length;i++){
    const p = room.players[(idx+i)%room.players.length];
    if(p && p.alive)return p.slot;
  }
  return alive[0].slot;
}
function bombSnap(room){
  return {
    type:'bomb_state',
    phase:room.phase, code:room.code, turn:room.turn, syllable:room.syllable,
    serverNow: Date.now(),
    turnEndsAt:room.turnEndsAt||0, turnMs:room.turnMs,
    recentWords:room.recentWords.slice(-10),
    players:room.players.map(p=>({name:p.name,slot:p.slot,alive:p.alive,lives:p.lives,score:p.score}))
  };
}
function bombBcast(room, extra={}){
  bcast(room.players, {...bombSnap(room), ...extra});
}
function bombCurrentTurnMs(room){
  const solved = Number(room?.successfulWords||0);
  const alive = bombLivePlayers(room).length;
  const steps = Math.floor(solved / 2);
  let ms = 12000 - (steps * 800);
  if(alive<=2) ms = Math.min(ms, 6000);
  return Math.max(5500, ms);
}
function bombPickSyllable(room){
  const solved = Number(room?.successfulWords||0);
  const easyWeight = solved < 6 ? 3 : (solved < 12 ? 2 : 1);
  const hardWeight = solved < 6 ? 1 : (solved < 12 ? 2 : 3);
  const pool = [];
  for(let i=0;i<easyWeight;i++) pool.push(...BOMB_SYLLABLES_EASY);
  for(let i=0;i<hardWeight;i++) pool.push(...BOMB_SYLLABLES_HARD);
  return pool[Math.floor(Math.random()*pool.length)];
}
function bombCheckGameOver(room){
  const alive = bombLivePlayers(room);
  if(alive.length<=1){
    room.phase='GAME_OVER';
    clearTimeout(room.timer);
    const winner = alive[0] || null;
    bombBcast(room, { winnerSlot:winner?winner.slot:-1, winnerName:winner?winner.name:null });
    broadcastLobby();
    return true;
  }
  return false;
}
function bombStartTurn(room){
  if(room.phase!=='PLAYING')return;
  if(bombCheckGameOver(room))return;
  room.turnMs = bombCurrentTurnMs(room);
  room.syllable = bombPickSyllable(room);
  room.turnEndsAt = Date.now() + room.turnMs;
  clearTimeout(room.timer);
  room.timer = setTimeout(()=>bombTimeout(room), room.turnMs);
  bombBcast(room);
}
function bombTimeout(room){
  if(room.phase!=='PLAYING')return;
  const p = room.players.find(x=>x.slot===room.turn);
  if(!p || !p.alive)return;
  p.lives = Math.max(0, (p.lives||0) - 1);
  if(p.lives===0)p.alive=false;
  bombBcast(room, { timeoutSlot:p.slot, timeoutName:p.name });
  if(bombCheckGameOver(room))return;
  room.turn = bombNextAliveSlot(room, p.slot);
  bombStartTurn(room);
}

wssBomb.on('connection', ws => {
  makeWS(wssBomb).alive(ws);
  let myRoom = null;
  ws.on('close', () => {
    makeWS(wssBomb).clear(ws);
    if(!myRoom)return;
    const idx=myRoom.players.findIndex(p=>p.ws===ws); if(idx<0)return;
    const left=myRoom.players[idx];
    myRoom.players.splice(idx,1);
    myRoom.players.forEach((p,i)=>p.slot=i);
    if(myRoom.players.length===0){
      clearTimeout(myRoom.timer); bombRooms.delete(myRoom.code); broadcastLobby(); return;
    }
    if(myRoom.phase==='PLAYING' || myRoom.phase==='COUNTDOWN'){
      const turnWasLeft = myRoom.turn===left.slot;
      if(turnWasLeft) myRoom.turn = 0;
      myRoom.turn = bombNextAliveSlot(myRoom, myRoom.turn);
      if(myRoom.phase==='PLAYING') bombStartTurn(myRoom);
    }
    bcast(myRoom.players,{type:'player_left',name:left.name});
    if(myRoom.phase!=='PLAYING') bombBcast(myRoom);
    if(myRoom.phase==='GAME_OVER') bombCheckGameOver(myRoom);
    if(myRoom.phase==='WAITING' && myRoom.players[0]) myRoom.host=myRoom.players[0].name;
    broadcastLobby();
  });
  ws.on('message', raw => {
    let d; try { d = JSON.parse(raw); } catch { return; }
    const player = myRoom ? myRoom.players.find(p=>p.ws===ws) : null;
    switch (d.type) {
      case 'lounge_chat': {
        handleLoungeChat(myRoom, ws, d);
        break;
      }
      case 'create_bomb': {
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const code=genCode(bombRooms);
        const room=makeBombRoom(code,name);
        room.players.push({ws,name,slot:0,alive:true,lives:3,score:0});
        bombRooms.set(code,room);
        myRoom=room;
        wsend(ws,{type:'created_bomb',code,slot:0,name});
        bombBcast(room);
        broadcastLobby();
        break;
      }
      case 'join_bomb': {
        const code=String(d.code||'').trim().toUpperCase();
        const room=bombRooms.get(code);
        if(!room){wsend(ws,{type:'error',msg:'Salle introuvable.'});return;}
        if(room.players.length>=6){wsend(ws,{type:'error',msg:'Salle pleine (6 max).'});return;}
        if(room.phase!=='WAITING'){wsend(ws,{type:'error',msg:'La partie a déjà commencé.'});return;}
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot=room.players.length;
        room.players.push({ws,name,slot,alive:true,lives:3,score:0});
        myRoom=room;
        wsend(ws,{type:'welcome_bomb',code,slot,name});
        bombBcast(room);
        broadcastLobby();
        break;
      }
      case 'start_bomb': {
        if(!myRoom||!player||player.slot!==0||myRoom.phase!=='WAITING')return;
        if(myRoom.players.length<2){wsend(ws,{type:'error',msg:'Il faut au moins 2 joueurs.'});return;}
        myRoom.players.forEach(p=>{p.lives=3;p.score=0;p.alive=true;});
        myRoom.used.clear(); myRoom.recentWords=[]; myRoom.turn=0; myRoom.successfulWords=0; myRoom.turnMs=12000;
        myRoom.phase='COUNTDOWN';
        bcast(myRoom.players,{type:'countdown',seconds:3});
        clearTimeout(myRoom.timer);
        myRoom.timer=setTimeout(()=>{
          myRoom.phase='PLAYING';
          myRoom.turn = bombNextAliveSlot(myRoom, -1);
          bombStartTurn(myRoom);
          broadcastLobby();
        },3000);
        broadcastLobby();
        break;
      }
      case 'bomb_word': {
        if(!myRoom||!player||myRoom.phase!=='PLAYING')return;
        if(!player.alive){wsend(ws,{type:'error',msg:'Tu es éliminé pour cette manche.'});return;}
        if(myRoom.turn!==player.slot){wsend(ws,{type:'error',msg:"Ce n'est pas ton tour."});return;}
        const rawWord=String(d.word||'').trim().slice(0,40);
        if(!/^[A-Za-zÀ-ÿŒœ''-]+$/.test(rawWord)){wsend(ws,{type:'error',msg:'Entre un seul vrai mot (lettres uniquement).'});return;}
        const norm=bombNorm(rawWord);
        const syll=bombNorm(myRoom.syllable);
        if(norm.length<3){wsend(ws,{type:'error',msg:'Mot trop court.'});return;}
        if(!norm.includes(syll)){wsend(ws,{type:'error',msg:`Le mot doit contenir "${myRoom.syllable}".`});return;}
        if(!bombIsRealWord(rawWord)){wsend(ws,{type:'error',msg:"Mot inconnu du dictionnaire (essaie sans article: l', d')."});return;}
        if(myRoom.used.has(norm)){wsend(ws,{type:'error',msg:'Mot déjà utilisé.'});return;}
        myRoom.used.add(norm);
        myRoom.recentWords.push({name:player.name,word:rawWord});
        if(myRoom.recentWords.length>16) myRoom.recentWords.shift();
        myRoom.successfulWords = (myRoom.successfulWords||0) + 1;
        player.score=(player.score||0)+1;
        myRoom.turn = bombNextAliveSlot(myRoom, player.slot);
        bombStartTurn(myRoom);
        break;
      }
      case 'restart_bomb': {
        if(!myRoom||!player||myRoom.phase!=='GAME_OVER')return;
        myRoom.phase='WAITING';
        myRoom.used.clear(); myRoom.recentWords=[]; myRoom.syllable=''; myRoom.turn=0; myRoom.turnEndsAt=0;
        myRoom.successfulWords=0; myRoom.turnMs=12000;
        myRoom.players.forEach(p=>{p.lives=3;p.score=0;p.alive=true;});
        clearTimeout(myRoom.timer);
        bombBcast(myRoom);
        broadcastLobby();
        break;
      }
    }
  });
});

// ════════════════════════════════════════════════════════
//  SUMO ARENA
// ════════════════════════════════════════════════════════
const sumoRooms = new Map();
const SUMO_RING_R = 164;
const SUMO_PLAYER_R = 18;
const SUMO_TICK_MS = 40;
const SUMO_MAX_SPEED = 8.5;
const SUMO_ACCEL = 1.2;
const SUMO_FRICTION = 0.85;
const SUMO_DASH_BOOST = 8.5;
const SUMO_DASH_CD_MS = 900;
const SUMO_COLLISION_PUSH = 1.8;
const SUMO_PUNCH_RANGE = 85;
const SUMO_PUNCH_DOT = 0.15;
const SUMO_PUNCH_FORCE = 24.0;
const SUMO_PUNCH_CD_MS = 600;

function makeSumoRoom(code, host){
  return {
    code, host, players:[], phase:'WAITING',
    tick:null, winnerSlot:-1, winnerName:null, startedAt:0, items:[]
  };
}
function sumoSpawnPos(slot, total){
  const a = (Math.PI*2*(slot%Math.max(total,1)))/Math.max(total,1);
  const r = 85;
  return { x:Math.cos(a)*r, y:Math.sin(a)*r };
}
function sumoResetPlayers(room){
  const total = room.players.length || 1;
  room.players.forEach((p,i)=>{
    const sp = sumoSpawnPos(i,total);
    p.slot=i;
    p.x=sp.x; p.y=sp.y; p.vx=0; p.vy=0;
    p.alive=true; p.lives=3; p.score=0;
    p.input={x:0,y:0}; p.dash=false; p.lastDashAt=0;
    p.punch=false; p.lastPunchAt=0; p.punchUntil=0;
    p.faceX=1; p.faceY=0;
    p.buff=null; p.buffUntil=0;
  });
}
function sumoAlive(room){ return room.players.filter(p=>p.alive); }
function sumoSnap(room){
  return {
    type:'sumo_state',
    phase:room.phase, code:room.code, ringR:SUMO_RING_R, playerR:SUMO_PLAYER_R,
    winnerSlot:room.winnerSlot??-1, winnerName:room.winnerName||null,
    items:room.items||[],
    players:room.players.map(p=>({
      name:p.name, slot:p.slot, alive:p.alive, lives:p.lives, score:p.score,
      x:Math.round((p.x||0)*10)/10, y:Math.round((p.y||0)*10)/10,
      vx:Math.round((p.vx||0)*10)/10, vy:Math.round((p.vy||0)*10)/10,
      faceX:Math.round((p.faceX||0)*100)/100, faceY:Math.round((p.faceY||0)*100)/100,
      punching: (p.punchUntil||0) > Date.now(),
      hit: (p.hitUntil||0) > Date.now(),
      buff: p.buff
    }))
  };
}
function sumoBcast(room, extra={}){
  bcast(room.players, { ...sumoSnap(room), ...extra });
}
function sumoStop(room){
  if(room.tick){ clearInterval(room.tick); room.tick=null; }
}
function sumoCheckEnd(room){
  const alive = sumoAlive(room);
  if(alive.length<=1){
    room.phase='GAME_OVER';
    room.winnerSlot = alive[0]?.slot ?? -1;
    room.winnerName = alive[0]?.name ?? null;
    sumoStop(room);
    sumoBcast(room);
    broadcastLobby();
    return true;
  }
  return false;
}
function sumoStart(room){
  room.phase='PLAYING';
  room.winnerSlot=-1; room.winnerName=null; room.startedAt=Date.now();
  room.items=[];
  sumoResetPlayers(room);
  sumoStop(room);
  room.tick = setInterval(()=>sumoTick(room), SUMO_TICK_MS);
  sumoBcast(room);
  broadcastLobby();
}
function sumoTick(room){
  if(room.phase!=='PLAYING')return;
  const now = Date.now();
  
  if(Math.random() < 0.015 && room.items.length < 3){
    const a = Math.random()*Math.PI*2;
    const r = Math.random()*(SUMO_RING_R-30);
    room.items.push({
      id: Math.random().toString(36).slice(2),
      x: Math.cos(a)*r, y: Math.sin(a)*r,
      type: ['mass','speed','power'][Math.floor(Math.random()*3)]
    });
  }
  
  room.players.forEach(p=>{
    if(!p.alive)return;
    if(p.buff && now > p.buffUntil) p.buff = null;
    
    const isSpeed = p.buff === 'speed';
    const isMass = p.buff === 'mass';
    const isPower = p.buff === 'power';
    
    const accel = isSpeed ? SUMO_ACCEL*1.5 : SUMO_ACCEL;
    const maxSpd = isSpeed ? SUMO_MAX_SPEED*1.4 : SUMO_MAX_SPEED;
    const dashB = isSpeed ? SUMO_DASH_BOOST*1.4 : SUMO_DASH_BOOST;
    const pForce = isPower ? SUMO_PUNCH_FORCE*1.8 : SUMO_PUNCH_FORCE;
    const prA = isMass ? SUMO_PLAYER_R*1.4 : SUMO_PLAYER_R;
    
    for(let i=room.items.length-1; i>=0; i--){
      const it = room.items[i];
      if(Math.hypot(p.x-it.x, p.y-it.y) < prA + 15){
        p.buff = it.type;
        p.buffUntil = now + 6000;
        room.items.splice(i,1);
      }
    }
    
    const ix = Math.max(-1, Math.min(1, Number(p.input?.x||0)));
    const iy = Math.max(-1, Math.min(1, Number(p.input?.y||0)));
    p.vx = (p.vx||0) + ix*accel;
    p.vy = (p.vy||0) + iy*accel;
    if(Math.hypot(ix,iy)>0.15){
      const m=Math.hypot(ix,iy)||1;
      p.faceX=ix/m; p.faceY=iy/m;
    }else if(Math.hypot(p.vx||0,p.vy||0)>0.35){
      const m=Math.hypot(p.vx||0,p.vy||0)||1;
      p.faceX=(p.vx||0)/m; p.faceY=(p.vy||0)/m;
    }
    if(p.dash && (now-(p.lastDashAt||0))>=SUMO_DASH_CD_MS){
      const mag = Math.hypot(ix,iy)||1;
      p.vx += (ix/mag)*dashB;
      p.vy += (iy/mag)*dashB;
      p.lastDashAt=now;
      p.dash=false;
    }
    if(p.punch && (now-(p.lastPunchAt||0))>=SUMO_PUNCH_CD_MS){
      p.lastPunchAt = now;
      p.punchUntil = now + 170;
      room.players.forEach(t=>{
        if(!t.alive || t===p) return;
        const dx=(t.x||0)-(p.x||0), dy=(t.y||0)-(p.y||0);
        const dist=Math.hypot(dx,dy)||0.0001;
        const range = isPower ? SUMO_PUNCH_RANGE*1.3 : SUMO_PUNCH_RANGE;
        if(dist > range) return;
        const nx=dx/dist, ny=dy/dist;
        const dot = nx*(p.faceX||1) + ny*(p.faceY||0);
        if(dot < SUMO_PUNCH_DOT) return;
        const force = pForce * Math.max(0.5, dot);
        const massT = t.buff==='mass'?2:1;
        t.vx = (t.vx||0) + (nx*force)/massT;
        t.vy = (t.vy||0) + (ny*force)/massT;
        p.vx = (p.vx||0) - nx*2.0;
        p.vy = (p.vy||0) - ny*2.0;
        p.score = (p.score||0) + 1;
        t.hitUntil = now + 300;
      });
      p.punch=false;
    }
    p.vx *= SUMO_FRICTION;
    p.vy *= SUMO_FRICTION;
    const sp = Math.hypot(p.vx,p.vy);
    if(sp>maxSpd){
      const k = maxSpd/sp;
      p.vx*=k; p.vy*=k;
    }
    p.x += p.vx||0;
    p.y += p.vy||0;
  });
  for(let i=0;i<room.players.length;i++){
    const a = room.players[i];
    if(!a?.alive)continue;
    const prA = (a.buff==='mass'?1.4:1)*SUMO_PLAYER_R;
    for(let j=i+1;j<room.players.length;j++){
      const b = room.players[j];
      if(!b?.alive)continue;
      const prB = (b.buff==='mass'?1.4:1)*SUMO_PLAYER_R;
      const dx=(b.x||0)-(a.x||0), dy=(b.y||0)-(a.y||0);
      const dist=Math.hypot(dx,dy)||0.0001;
      const minDist=prA+prB;
      if(dist<minDist){
        const nx=dx/dist, ny=dy/dist;
        const overlap=minDist-dist;
        a.x -= nx*(overlap/2); a.y -= ny*(overlap/2);
        b.x += nx*(overlap/2); b.y += ny*(overlap/2);
        const avx=a.vx||0, avy=a.vy||0, bvx=b.vx||0, bvy=b.vy||0;
        const massA = a.buff==='mass'?2:1;
        const massB = b.buff==='mass'?2:1;
        const pushA = SUMO_COLLISION_PUSH * (massB/massA);
        const pushB = SUMO_COLLISION_PUSH * (massA/massB);
        a.vx = avx - nx*pushA; a.vy = avy - ny*pushA;
        b.vx = bvx + nx*pushB; b.vy = bvy + ny*pushB;
      }
    }
  }
  const outNow = [];
  room.players.forEach((p,idx)=>{
    if(!p?.alive)return;
    const d=Math.hypot(p.x||0,p.y||0);
    if(d > (SUMO_RING_R + SUMO_PLAYER_R)){
      p.lives = Math.max(0, (p.lives||0)-1);
      if(p.lives<=0){ p.alive=false; outNow.push({slot:p.slot,name:p.name,ko:true}); }
      else{
        const sp = sumoSpawnPos(idx, room.players.length||1);
        p.x=sp.x; p.y=sp.y; p.vx=0; p.vy=0;
        outNow.push({slot:p.slot,name:p.name,ko:false});
      }
    }
  });
  if(sumoCheckEnd(room))return;
  sumoBcast(room, outNow.length?{sumoOut:outNow}:{} );
}

wssSumo.on('connection', ws => {
  makeWS(wssSumo).alive(ws);
  let myRoom = null;
  ws.on('close', () => {
    makeWS(wssSumo).clear(ws);
    if(!myRoom)return;
    const idx = myRoom.players.findIndex(p=>p.ws===ws);
    if(idx<0)return;
    const left = myRoom.players[idx];
    myRoom.players.splice(idx,1);
    myRoom.players.forEach((p,i)=>p.slot=i);
    if(myRoom.players.length===0){
      sumoStop(myRoom);
      sumoRooms.delete(myRoom.code);
      broadcastLobby();
      return;
    }
    if(myRoom.phase==='PLAYING'){
      if(sumoCheckEnd(myRoom))return;
      sumoBcast(myRoom,{type:'player_left',name:left.name});
    }else{
      if(myRoom.phase==='WAITING' && myRoom.players[0]) myRoom.host=myRoom.players[0].name;
      sumoBcast(myRoom,{type:'player_left',name:left.name});
    }
    broadcastLobby();
  });
  ws.on('message', raw => {
    let d; try{ d=JSON.parse(raw); }catch{ return; }
    const player = myRoom ? myRoom.players.find(p=>p.ws===ws) : null;
    switch(d.type){
      case 'lounge_chat': {
        handleLoungeChat(myRoom, ws, d);
        break;
      }
      case 'create_sumo': {
        const name = String(d.name||'').trim().slice(0,20)||'Joueur';
        const code = genCode(sumoRooms);
        const room = makeSumoRoom(code,name);
        room.players.push({ws,name,slot:0,alive:true,lives:3,score:0,x:0,y:0,vx:0,vy:0,input:{x:0,y:0},dash:false,lastDashAt:0,punch:false,lastPunchAt:0,punchUntil:0,faceX:1,faceY:0});
        sumoRooms.set(code,room);
        myRoom=room;
        wsend(ws,{type:'created_sumo',code,slot:0,name});
        sumoBcast(room);
        broadcastLobby();
        break;
      }
      case 'join_sumo': {
        const code = String(d.code||'').trim().toUpperCase();
        const room = sumoRooms.get(code);
        if(!room){wsend(ws,{type:'error',msg:'Salle introuvable.'});return;}
        if(room.players.length>=4){wsend(ws,{type:'error',msg:'Salle pleine (4 max).'});return;}
        if(room.phase!=='WAITING'){wsend(ws,{type:'error',msg:'La partie a déjà commencé.'});return;}
        const name = String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot = room.players.length;
        room.players.push({ws,name,slot,alive:true,lives:3,score:0,x:0,y:0,vx:0,vy:0,input:{x:0,y:0},dash:false,lastDashAt:0,punch:false,lastPunchAt:0,punchUntil:0,faceX:1,faceY:0});
        myRoom=room;
        wsend(ws,{type:'welcome_sumo',code,slot,name});
        sumoBcast(room);
        broadcastLobby();
        break;
      }
      case 'start_sumo': {
        if(!myRoom||!player||player.slot!==0||myRoom.phase!=='WAITING')return;
        if(myRoom.players.length<2){wsend(ws,{type:'error',msg:'Il faut au moins 2 joueurs.'});return;}
        bcast(myRoom.players,{type:'countdown',seconds:3});
        myRoom.phase='COUNTDOWN';
        broadcastLobby();
        setTimeout(()=>{
          if(!myRoom || myRoom.phase!=='COUNTDOWN')return;
          sumoStart(myRoom);
        },3000);
        break;
      }
      case 'sumo_input': {
        if(!myRoom||!player||myRoom.phase!=='PLAYING')return;
        player.input = {
          x: Math.max(-1,Math.min(1,Number(d.x||0))),
          y: Math.max(-1,Math.min(1,Number(d.y||0)))
        };
        if(d.dash) player.dash = true;
        if(d.punch) player.punch = true;
        break;
      }
      case 'restart_sumo': {
        if(!myRoom||!player||myRoom.phase!=='GAME_OVER')return;
        myRoom.phase='WAITING';
        myRoom.winnerSlot=-1; myRoom.winnerName=null;
        sumoStop(myRoom);
        sumoResetPlayers(myRoom);
        sumoBcast(myRoom);
        broadcastLobby();
        break;
      }
    }
  });
});

// ════════════════════════════════════════════════════════
//  PAINT.IO
// ════════════════════════════════════════════════════════
const paintRooms = new Map();
const PAINT_W = 96;
const PAINT_H = 96;
const PAINT_TICK_MS = 100;

function makePaintRoom(code, host){
  return {
    code, host, phase:'WAITING',
    players:[],
    winnerSlot:-1,
    tick:null,
    grid:new Int8Array(PAINT_W * PAINT_H).fill(-1),
    _trailOcc: new Int8Array(PAINT_W * PAINT_H),
    _capBlocked: new Uint8Array(PAINT_W * PAINT_H),
    _capVisited: new Uint8Array(PAINT_W * PAINT_H),
  };
}

function paintInside(x,y){ return x>=0 && y>=0 && x<PAINT_W && y<PAINT_H; }
function paintIdx(x,y){ return y * PAINT_W + x; }
function paintDir(dir){
  if(dir==='up') return {x:0,y:-1};
  if(dir==='down') return {x:0,y:1};
  if(dir==='left') return {x:-1,y:0};
  if(dir==='right') return {x:1,y:0};
  return {x:0,y:0};
}
function paintOpp(a,b){
  return (a==='up'&&b==='down') || (a==='down'&&b==='up') || (a==='left'&&b==='right') || (a==='right'&&b==='left');
}
function paintSpawn(slot){
  const m = Math.max(8, Math.floor(Math.min(PAINT_W, PAINT_H) * 0.08));
  const pts = [
    {x:m, y:m, dir:'right'},
    {x:PAINT_W-m-1, y:m, dir:'left'},
    {x:m, y:PAINT_H-m-1, dir:'right'},
    {x:PAINT_W-m-1, y:PAINT_H-m-1, dir:'left'},
  ];
  return pts[slot % 4];
}
function paintClaimStart(room, p){
  for(let dy=-1; dy<=1; dy++){
    for(let dx=-1; dx<=1; dx++){
      const x = p.x + dx, y = p.y + dy;
      if(paintInside(x,y)) room.grid[paintIdx(x,y)] = p.slot;
    }
  }
}
function paintScore(room, slot){
  let n = 0;
  for(let i=0;i<room.grid.length;i++) if(room.grid[i]===slot) n++;
  return n;
}
function paintRecount(room){
  room.players.forEach(p => { p.score = paintScore(room, p.slot); });
}
function paintResetPlayers(room){
  room.grid.fill(-1);
  room.players.forEach((p, i) => {
    const sp = paintSpawn(i);
    p.slot = i;
    p.alive = true;
    p.x = sp.x;
    p.y = sp.y;
    p.dir = sp.dir;
    p.nextDir = sp.dir;
    p.outside = false;
    p.trail = [];
    p.score = 0;
    paintClaimStart(room, p);
  });
  paintRecount(room);
}

function paintCapture(room, slot, trail){
  if(!trail || !trail.length) return;
  if(!room._capBlocked || room._capBlocked.length !== PAINT_W * PAINT_H){
    room._capBlocked = new Uint8Array(PAINT_W * PAINT_H);
    room._capVisited = new Uint8Array(PAINT_W * PAINT_H);
  }
  const blocked = room._capBlocked;
  const visited = room._capVisited;
  blocked.fill(0);
  visited.fill(0);
  for(let i=0;i<room.grid.length;i++) if(room.grid[i]===slot) blocked[i]=1;
  trail.forEach(t => { if(paintInside(t.x,t.y)) blocked[paintIdx(t.x,t.y)] = 1; });
  const q = [];
  function push(x,y){
    if(!paintInside(x,y)) return;
    const id = paintIdx(x,y);
    if(visited[id] || blocked[id]) return;
    visited[id] = 1;
    q.push(id);
  }
  for(let x=0;x<PAINT_W;x++){ push(x,0); push(x,PAINT_H-1); }
  for(let y=0;y<PAINT_H;y++){ push(0,y); push(PAINT_W-1,y); }
  for(let qi=0;qi<q.length;qi++){
    const id = q[qi];
    const x = id % PAINT_W;
    const y = (id / PAINT_W) | 0;
    push(x+1,y); push(x-1,y); push(x,y+1); push(x,y-1);
  }
  const players = room.players;
  for(let i=0;i<room.grid.length;i++){
    const g = room.grid[i];
    let nv = g;
    if(blocked[i] && g!==slot) nv = slot;
    else if(!visited[i] && g!==slot) nv = slot;
    if(nv !== g){
      room.grid[i] = nv;
      if(g >= 0 && players[g]) players[g].score = Math.max(0, (players[g].score || 0) - 1);
      if(nv >= 0 && players[nv]) players[nv].score = (players[nv].score || 0) + 1;
    }
  }
}

function paintAlive(room){ return room.players.filter(p=>p.alive); }
function paintEndIfNeeded(room){
  const alive = paintAlive(room);
  if(alive.length > 1) return false;
  room.phase = 'GAME_OVER';
  if(alive.length===1) room.winnerSlot = alive[0].slot;
  else{
    let best = -1, bestSlot = -1;
    room.players.forEach(p => {
      if(p.score > best){ best = p.score; bestSlot = p.slot; }
    });
    room.winnerSlot = bestSlot;
  }
  paintStop(room);
  paintBcast(room);
  broadcastLobby();
  return true;
}
function paintSnap(room, extra={}){
  const chars = new Array(room.grid.length);
  for(let i=0;i<room.grid.length;i++){
    const v = room.grid[i];
    chars[i] = v<0 ? '.' : String(v);
  }
  return {
    type:'paint_state',
    phase:room.phase,
    code:room.code,
    W:PAINT_W,
    H:PAINT_H,
    winnerSlot:room.winnerSlot,
    gridStr:chars.join(''),
    players:room.players.map(p=>({
      slot:p.slot,
      name:p.name,
      alive:!!p.alive,
      score:p.score||0,
      x:p.x, y:p.y,
      trail:p.trail||[],
    })),
    ...extra,
  };
}
function paintBcast(room, extra={}){ bcast(room.players, paintSnap(room, extra)); }
function paintStop(room){ if(room.tick){ clearInterval(room.tick); room.tick=null; } }

function paintTick(room){
  if(room.phase!=='PLAYING') return;
  if(!room._trailOcc || room._trailOcc.length !== PAINT_W * PAINT_H) room._trailOcc = new Int8Array(PAINT_W * PAINT_H);
  const kills = [];
  const dieSet = new Set();
  const trailOcc = room._trailOcc;
  trailOcc.fill(-1);
  for(const o of room.players){
    if(!o.alive || !Array.isArray(o.trail) || !o.trail.length) continue;
    for(const t of o.trail){
      if(paintInside(t.x,t.y)) trailOcc[paintIdx(t.x, t.y)] = o.slot;
    }
  }

  for(const p of room.players){
    if(!p.alive) continue;
    if(p.nextDir && !paintOpp(p.dir, p.nextDir)) p.dir = p.nextDir;
    const d = paintDir(p.dir);
    if(!d.x && !d.y) continue;
    const nx = p.x + d.x;
    const ny = p.y + d.y;
    if(!paintInside(nx, ny)){
      dieSet.add(p.slot);
      continue;
    }

    const hit = paintInside(nx, ny) ? trailOcc[paintIdx(nx, ny)] : -1;
    if(hit >= 0){
      if(hit === p.slot) dieSet.add(p.slot);
      else dieSet.add(hit);
    }

    p.x = nx; p.y = ny;
    const owner = room.grid[paintIdx(nx,ny)];
    if(owner===p.slot){
      if(p.outside && p.trail.length){
        paintCapture(room, p.slot, p.trail);
      }
      p.outside = false;
      p.trail = [];
    }else{
      p.outside = true;
      if(!p.trail.some(t => t.x===nx && t.y===ny)) p.trail.push({x:nx,y:ny});
    }
  }

  for(let i=0;i<room.players.length;i++){
    for(let j=i+1;j<room.players.length;j++){
      const a = room.players[i], b = room.players[j];
      if(!a.alive || !b.alive) continue;
      if(a.x===b.x && a.y===b.y){
        dieSet.add(a.slot);
        dieSet.add(b.slot);
      }
    }
  }

  if(dieSet.size){
    for(const slot of dieSet){
      const p = room.players[slot];
      if(!p || !p.alive) continue;
      p.alive = false;
      p.trail = [];
      kills.push({victimSlot:slot,victim:p.name});
    }
  }

  if(paintEndIfNeeded(room)) return;
  paintBcast(room, { kills });
}

wssPaint.on('connection', ws => {
  makeWS(wssPaint).alive(ws);
  let myRoom = null;
  ws.on('close', () => {
    makeWS(wssPaint).clear(ws);
    if(!myRoom) return;
    const idx = myRoom.players.findIndex(p => p.ws===ws);
    if(idx<0) return;
    const left = myRoom.players[idx];
    myRoom.players.splice(idx, 1);
    myRoom.players.forEach((p,i)=>p.slot=i);
    if(myRoom.players.length===0){
      paintStop(myRoom);
      paintRooms.delete(myRoom.code);
      broadcastLobby();
      return;
    }
    if(myRoom.phase==='WAITING'){
      myRoom.host = myRoom.players[0].name;
      paintBcast(myRoom, { type:'player_left', name:left.name });
    }else{
      paintResetPlayers(myRoom);
      if(myRoom.phase==='PLAYING'){
        myRoom.phase='GAME_OVER';
        myRoom.winnerSlot=myRoom.players[0].slot;
      }
      paintBcast(myRoom, { type:'player_left', name:left.name });
    }
    broadcastLobby();
  });

  ws.on('message', raw => {
    let d; try{ d = JSON.parse(raw); }catch{ return; }
    const player = myRoom ? myRoom.players.find(p => p.ws===ws) : null;
    switch(d.type){
      case 'lounge_chat':{
        handleLoungeChat(myRoom, ws, d);
        break;
      }
      case 'create_paint':{
        const name = String(d.name||'').trim().slice(0,20) || 'Joueur';
        const code = genCode(paintRooms);
        const room = makePaintRoom(code, name);
        room.players.push({ ws, name, slot:0, alive:true, x:0, y:0, dir:'right', nextDir:'right', outside:false, trail:[], score:0 });
        paintRooms.set(code, room);
        myRoom = room;
        wsend(ws, { type:'created_paint', code, slot:0, name });
        paintBcast(room);
        broadcastLobby();
        break;
      }
      case 'join_paint':{
        const code = String(d.code||'').trim().toUpperCase();
        const room = paintRooms.get(code);
        if(!room){ wsend(ws,{type:'error',msg:'Salle introuvable.'}); return; }
        if(room.players.length>=4){ wsend(ws,{type:'error',msg:'Salle pleine (4 max).'}); return; }
        if(room.phase!=='WAITING'){ wsend(ws,{type:'error',msg:'La partie a déjà commencé.'}); return; }
        const name = String(d.name||'').trim().slice(0,20) || 'Joueur';
        const slot = room.players.length;
        room.players.push({ ws, name, slot, alive:true, x:0, y:0, dir:'right', nextDir:'right', outside:false, trail:[], score:0 });
        myRoom = room;
        wsend(ws, { type:'welcome_paint', code, slot, name });
        paintBcast(room);
        broadcastLobby();
        break;
      }
      case 'start_paint':{
        if(!myRoom || !player || player.slot!==0 || myRoom.phase!=='WAITING') return;
        if(myRoom.players.length<2){ wsend(ws,{type:'error',msg:'Il faut au moins 2 joueurs.'}); return; }
        bcast(myRoom.players, {type:'countdown',seconds:3});
        myRoom.phase='COUNTDOWN';
        broadcastLobby();
        setTimeout(() => {
          if(!myRoom || myRoom.phase!=='COUNTDOWN') return;
          paintResetPlayers(myRoom);
          myRoom.phase='PLAYING';
          myRoom.winnerSlot=-1;
          paintStop(myRoom);
          myRoom.tick = setInterval(() => paintTick(myRoom), PAINT_TICK_MS);
          paintBcast(myRoom);
          broadcastLobby();
        }, 3000);
        break;
      }
      case 'paint_input':{
        if(!myRoom || !player || myRoom.phase!=='PLAYING' || !player.alive) return;
        const dir = String(d.dir||'');
        if(dir==='up' || dir==='down' || dir==='left' || dir==='right') player.nextDir = dir;
        break;
      }
      case 'restart_paint':{
        if(!myRoom || !player || myRoom.phase!=='GAME_OVER') return;
        myRoom.phase='WAITING';
        myRoom.winnerSlot=-1;
        paintStop(myRoom);
        myRoom.players.forEach(p => { p.alive=true; p.trail=[]; p.outside=false; p.score=0; });
        paintBcast(myRoom);
        broadcastLobby();
        break;
      }
    }
  });
});

// ════════════════════════════════════════════════════════
//  BATAILLE NAVALE (2 à 4 joueurs)
// ════════════════════════════════════════════════════════
const navalRooms = new Map();
const NAVAL_W = 10;
const NAVAL_MAX_P = 4;
const NAVAL_MIN_P = 2;
const NAVAL_SHIPS = [5, 4, 3, 3, 2];

function makeNavalRoom(code, host){
  return {
    code, host, phase:'WAITING', players:[],
    boards:[null],
    placementReady:[false],
    volleys:[[]],
    eliminated:[false],
    turn:0,
    winnerSlot:-1,
    timer:null,
  };
}

function navalEnsureArrays(room){
  const n = room.players.length;
  const oldE = Array.isArray(room.eliminated) ? room.eliminated : [];
  if(!Array.isArray(room.boards)) room.boards = [];
  while(room.boards.length < n) room.boards.push(null);
  while(room.boards.length > n) room.boards.pop();
  if(!Array.isArray(room.placementReady)) room.placementReady = [];
  while(room.placementReady.length < n) room.placementReady.push(false);
  while(room.placementReady.length > n) room.placementReady.pop();
  room.eliminated = Array.from({ length:n }, (_, i) => !!oldE[i]);
  if(!Array.isArray(room.volleys) || room.volleys.length !== n) room.volleys = Array.from({ length:n }, () => []);
}

function navalExpectedLensSorted(){
  return [...NAVAL_SHIPS].sort((a, b) => a - b);
}

function navalValidateShipCells(cells){
  if(!cells || !cells.length) return false;
  const n = cells.length;
  for(const c of cells){
    if(typeof c.x !== 'number' || typeof c.y !== 'number') return false;
    if(c.x !== (c.x | 0) || c.y !== (c.y | 0)) return false;
    if(c.x < 0 || c.x >= NAVAL_W || c.y < 0 || c.y >= NAVAL_W) return false;
  }
  const xs = cells.map(c => c.x);
  const ys = cells.map(c => c.y);
  const uniqX = new Set(xs);
  const uniqY = new Set(ys);
  if(uniqX.size > 1 && uniqY.size > 1) return false;
  if(uniqX.size === 1){
    const arr = [...new Set(ys)].sort((a, b) => a - b);
    return arr.length === n && arr[n - 1] - arr[0] === n - 1;
  }
  const arr = [...new Set(xs)].sort((a, b) => a - b);
  return arr.length === n && arr[n - 1] - arr[0] === n - 1;
}

function navalValidateAndBuild(ships){
  if(!Array.isArray(ships) || ships.length !== 5) return null;
  const lens = ships.map(s => (Array.isArray(s) ? s.length : 0)).slice().sort((a, b) => a - b);
  const exp = navalExpectedLensSorted();
  if(lens.some((l, i) => l !== exp[i])) return null;
  const used = new Set();
  const b = new Int8Array(NAVAL_W * NAVAL_W);
  b.fill(-1);
  for(let sIdx = 0; sIdx < 5; sIdx++){
    const cells = ships[sIdx];
    if(!navalValidateShipCells(cells)) return null;
    for(const c of cells){
      const k = c.y * NAVAL_W + c.x;
      if(used.has(k)) return null;
      used.add(k);
      b[k] = sIdx;
    }
  }
  return used.size === 17 ? b : null;
}

function navalShotOnDefender(room, defender, x, y){
  const n = room.players.length;
  for(let atk = 0; atk < n; atk++){
    for(const v of room.volleys[atk] || []){
      if(v.def === defender && v.x === x && v.y === y) return true;
    }
  }
  return false;
}

/** Après un tir touché : tous les segments de ce navire sont-ils touchés ? */
function navalSunkShipCells(room, defender, x, y){
  const b = room.boards[defender];
  if(!b) return { sunk:false, cells:[] };
  const idx = y * NAVAL_W + x;
  const sid = b[idx];
  if(sid < 0) return { sunk:false, cells:[] };
  const cells = [];
  for(let i = 0; i < b.length; i++){
    if(b[i] !== sid) continue;
    const cx = i % NAVAL_W;
    const cy = (i / NAVAL_W) | 0;
    cells.push({ x:cx, y:cy });
  }
  for(const c of cells){
    if(!navalShotOnDefender(room, defender, c.x, c.y)) return { sunk:false, cells:[] };
  }
  return { sunk:true, cells };
}

function navalBuildLastShot(room, defender, attacker, x, y, hit){
  let sunk = false;
  let sunkCells = [];
  if(hit){
    const r = navalSunkShipCells(room, defender, x, y);
    if(r.sunk){
      sunk = true;
      sunkCells = r.cells;
    }
  }
  return { x, y, hit:!!hit, target:defender, from:attacker, sunk, sunkCells };
}

function navalSnapFor(room, slot, extra = {}){
  navalEnsureArrays(room);
  const n = room.players.length;
  const myB = room.boards[slot];
  const myBoard = myB ? Array.from(myB) : Array(NAVAL_W * NAVAL_W).fill(-1);
  const incoming = [];
  for(let atk = 0; atk < n; atk++){
    if(atk === slot) continue;
    for(const v of room.volleys[atk] || []){
      if(v.def === slot) incoming.push({ x:v.x, y:v.y, hit:!!v.hit, from:atk });
    }
  }
  const oppBoards = [];
  for(let def = 0; def < n; def++){
    if(def === slot){ oppBoards.push(null); continue; }
    const arr = Array(NAVAL_W * NAVAL_W).fill(-2);
    for(const v of room.volleys[slot] || []){
      if(v.def !== def) continue;
      const i = v.y * NAVAL_W + v.x;
      arr[i] = v.hit ? 2 : -1;
    }
    oppBoards.push(arr);
  }
  return {
    type:'naval_state',
    phase:room.phase,
    code:room.code,
    players:room.players.map(p => ({ name:p.name, slot:p.slot })),
    turn:room.turn,
    winnerSlot:room.winnerSlot,
    shipLengths:[...NAVAL_SHIPS],
    placementReady:[...room.placementReady],
    eliminated:[...room.eliminated],
    myBoard,
    oppBoards,
    incoming,
    ...extra,
  };
}

function navalBcast(room, extra = {}){
  room.players.forEach(p => { wsend(p.ws, navalSnapFor(room, p.slot, extra)); });
}

function navalAllShipsSunk(room, defender){
  const b = room.boards[defender];
  if(!b) return false;
  for(let i = 0; i < b.length; i++){
    if(b[i] < 0) continue;
    const x = i % NAVAL_W;
    const y = (i / NAVAL_W) | 0;
    if(!navalShotOnDefender(room, defender, x, y)) return false;
  }
  return true;
}

function navalNextTurn(room, afterSlot){
  const n = room.players.length;
  for(let k = 1; k <= n; k++){
    const s = (afterSlot + k) % n;
    if(!room.eliminated[s]) return s;
  }
  return -1;
}

function navalSoleSurvivor(room){
  let out = -1, c = 0;
  for(let i = 0; i < room.players.length; i++){
    if(room.eliminated[i]) continue;
    c++;
    out = i;
  }
  return c === 1 ? out : -1;
}

wssNaval.on('connection', ws => {
  makeWS(wssNaval).alive(ws);
  let myRoom = null;
  ws.on('close', () => {
    makeWS(wssNaval).clear(ws);
    if(!myRoom) return;
    const idx = myRoom.players.findIndex(p => p.ws === ws);
    if(idx < 0) return;
    const name = myRoom.players[idx].name;
    myRoom.players.splice(idx, 1);
    myRoom.players.forEach((p, i) => { p.slot = i; });
    clearTimeout(myRoom.timer);
    if(myRoom.players.length === 0){
      navalRooms.delete(myRoom.code);
      broadcastLobby();
      return;
    }
    const wasGame = ['PLACING', 'COUNTDOWN', 'PLAYING', 'GAME_OVER'].includes(myRoom.phase);
    bcast(myRoom.players, { type:'player_left', name });
    if(wasGame) bcast(myRoom.players, { type:'game_abandoned' });
    myRoom.phase = 'WAITING';
    navalEnsureArrays(myRoom);
    myRoom.boards = myRoom.players.map(() => null);
    myRoom.placementReady = myRoom.players.map(() => false);
    myRoom.volleys = myRoom.players.map(() => []);
    myRoom.eliminated = myRoom.players.map(() => false);
    myRoom.winnerSlot = -1;
    navalBcast(myRoom);
    broadcastLobby();
  });
  ws.on('message', raw => {
    let d; try{ d = JSON.parse(raw); }catch{ return; }
    const player = myRoom ? myRoom.players.find(p => p.ws === ws) : null;
    switch(d.type){
      case 'lounge_chat':{
        handleLoungeChat(myRoom, ws, d);
        break;
      }
      case 'create_naval':{
        const name = String(d.name || '').trim().slice(0, 20) || 'Joueur';
        const code = genCode(navalRooms);
        const room = makeNavalRoom(code, name);
        navalRooms.set(code, room);
        myRoom = room;
        room.players.push({ ws, name, slot:0 });
        navalEnsureArrays(room);
        wsend(ws, { type:'created_naval', code, slot:0, name });
        navalBcast(room);
        broadcastLobby();
        break;
      }
      case 'join_naval':{
        const code = String(d.code || '').trim().toUpperCase();
        const room = navalRooms.get(code);
        if(!room){ wsend(ws, { type:'error', msg:'Salle introuvable.' }); return; }
        if(room.players.length >= NAVAL_MAX_P){ wsend(ws, { type:'error', msg:`Salle pleine (${NAVAL_MAX_P} joueurs max).` }); return; }
        if(room.phase !== 'WAITING'){ wsend(ws, { type:'error', msg:'La partie a déjà commencé.' }); return; }
        const name = String(d.name || '').trim().slice(0, 20) || 'Joueur';
        const slot = room.players.length;
        room.players.push({ ws, name, slot });
        navalEnsureArrays(room);
        myRoom = room;
        wsend(ws, { type:'welcome_naval', code, slot, name });
        navalBcast(room);
        broadcastLobby();
        break;
      }
      case 'start_naval':{
        if(!player || !myRoom || player.slot !== 0 || myRoom.phase !== 'WAITING') return;
        const np = myRoom.players.length;
        if(np < NAVAL_MIN_P || np > NAVAL_MAX_P){
          wsend(ws, { type:'error', msg:`Il faut entre ${NAVAL_MIN_P} et ${NAVAL_MAX_P} joueurs.` });
          return;
        }
        navalEnsureArrays(myRoom);
        myRoom.phase = 'PLACING';
        myRoom.boards = myRoom.players.map(() => null);
        myRoom.placementReady = myRoom.players.map(() => false);
        myRoom.volleys = myRoom.players.map(() => []);
        myRoom.eliminated = myRoom.players.map(() => false);
        myRoom.winnerSlot = -1;
        navalBcast(myRoom);
        broadcastLobby();
        break;
      }
      case 'naval_place':{
        if(!player || !myRoom || myRoom.phase !== 'PLACING') return;
        const slot = player.slot;
        if(myRoom.placementReady[slot]) return;
        const built = navalValidateAndBuild(d.ships);
        if(!built){
          wsend(ws, { type:'error', msg:'Placement invalide (bateaux 5-4-3-3-2, lignes droites, sans chevauchement).' });
          return;
        }
        myRoom.boards[slot] = built;
        myRoom.placementReady[slot] = true;
        const n = myRoom.players.length;
        if(n && myRoom.placementReady.length === n && myRoom.placementReady.every(Boolean)){
          bcast(myRoom.players, { type:'countdown', seconds:3 });
          myRoom.phase = 'COUNTDOWN';
          clearTimeout(myRoom.timer);
          myRoom.timer = setTimeout(() => {
            if(!myRoom || myRoom.phase !== 'COUNTDOWN') return;
            myRoom.phase = 'PLAYING';
            const n2 = myRoom.players.length;
            myRoom.turn = Math.floor(Math.random() * n2);
            navalBcast(myRoom);
            broadcastLobby();
          }, 3000);
        }
        navalBcast(myRoom);
        broadcastLobby();
        break;
      }
      case 'naval_shot':{
        if(!player || !myRoom || myRoom.phase !== 'PLAYING') return;
        navalEnsureArrays(myRoom);
        if(myRoom.eliminated[player.slot]){
          wsend(ws, { type:'error', msg:'Tu es éliminé.' });
          return;
        }
        if(player.slot !== myRoom.turn){
          wsend(ws, { type:'error', msg:"Ce n'est pas ton tour." });
          return;
        }
        const def = Number(d.target);
        const n = myRoom.players.length;
        if(def !== (def | 0) || def < 0 || def >= n || def === player.slot || myRoom.eliminated[def]){
          wsend(ws, { type:'error', msg:'Cible invalide.' });
          return;
        }
        const x = Number(d.x);
        const y = Number(d.y);
        if(x !== (x | 0) || y !== (y | 0) || x < 0 || x >= NAVAL_W || y < 0 || y >= NAVAL_W) return;
        const atk = player.slot;
        const dup = myRoom.volleys[atk].some(v => v.def === def && v.x === x && v.y === y);
        if(dup) return;
        const b = myRoom.boards[def];
        const idx = y * NAVAL_W + x;
        const hit = b && b[idx] >= 0;
        myRoom.volleys[atk].push({ x, y, hit:!!hit, def });
        const lastShot = navalBuildLastShot(myRoom, def, atk, x, y, hit);
        if(navalAllShipsSunk(myRoom, def)){
          myRoom.eliminated[def] = true;
          const surv = navalSoleSurvivor(myRoom);
          if(surv >= 0){
            myRoom.phase = 'GAME_OVER';
            myRoom.winnerSlot = surv;
            navalBcast(myRoom, { lastShot });
            broadcastLobby();
            return;
          }
        }
        myRoom.turn = navalNextTurn(myRoom, atk);
        if(myRoom.turn < 0){
          myRoom.phase = 'GAME_OVER';
          myRoom.winnerSlot = navalSoleSurvivor(myRoom);
        }
        navalBcast(myRoom, { lastShot });
        if(myRoom.phase === 'GAME_OVER') broadcastLobby();
        break;
      }
      case 'restart_naval':{
        if(!player || !myRoom || myRoom.phase !== 'GAME_OVER') return;
        navalEnsureArrays(myRoom);
        myRoom.phase = 'PLACING';
        myRoom.boards = myRoom.players.map(() => null);
        myRoom.placementReady = myRoom.players.map(() => false);
        myRoom.volleys = myRoom.players.map(() => []);
        myRoom.eliminated = myRoom.players.map(() => false);
        myRoom.winnerSlot = -1;
        navalBcast(myRoom);
        broadcastLobby();
        break;
      }
    }
  });
});

// ════════════════════════════════════════════════════════
//  TYPER RACE
// ════════════════════════════════════════════════════════
const TYPER_TEXTS = [
  "Le renard brun saute par dessus le chien paresseux.",
  "La technologie avance plus vite que notre capacité à l absorber.",
  "Chaque jour est une nouvelle occasion de progresser ensemble.",
  "Les étoiles brillent le plus fort dans une obscurité totale.",
  "La patience est souvent la clé de toutes les portes fermées.",
  "Un voyage de mille lieues commence toujours par un seul pas.",
  "La connaissance est le seul trésor que personne ne peut voler.",
  "La musique est un art qui atteint directement notre âme profonde.",
  "Apprendre à écrire rapidement est une compétence très précieuse.",
  "Le soleil se lève chaque matin pour illuminer un monde nouveau.",
  "Les grandes réussites commencent toujours par une petite idée.",
  "Travailler en équipe permet d accomplir des choses extraordinaires.",
];

const typerRooms = new Map();
function makeTyperRoom(c,h){return{code:c,host:h,players:[],phase:'WAITING',round:0,totalRounds:5,currentText:null,scores:{},finishers:[],timer:null,usedTexts:[]};}
function typerSnap(room,extra={}){return{type:'typer_state',phase:room.phase,code:room.code,players:room.players.map(p=>({name:p.name,slot:p.slot,score:room.scores[p.slot]||0,progress:p.progress||0})),round:room.round,totalRounds:room.totalRounds,finishers:[...room.finishers],...extra};}

function typerStartRound(room){
  room.finishers=[];
  room.players.forEach(p=>{p.progress=0;});
  const avail=TYPER_TEXTS.map((_,i)=>i).filter(i=>!room.usedTexts.includes(i));
  const pool=avail.length?avail:TYPER_TEXTS.map((_,i)=>i);
  const idx=pool[Math.floor(Math.random()*pool.length)];
  room.usedTexts.push(idx);
  room.currentText=TYPER_TEXTS[idx];
  room.phase='PLAYING';
  bcast(room.players,{type:'typer_round',round:room.round,totalRounds:room.totalRounds,text:room.currentText});
  clearTimeout(room.timer);
  room.timer=setTimeout(()=>typerEndRound(room),60000);
  broadcastLobby();
}
function typerEndRound(room){
  clearTimeout(room.timer);
  const pts=[4,3,2,1];
  room.finishers.forEach((slot,i)=>{room.scores[slot]=(room.scores[slot]||0)+(pts[i]||1);});
  room.phase='ROUNDOVER';
  bcast(room.players,{...typerSnap(room),type:'typer_roundover'});
  clearTimeout(room.timer);
  room.timer=setTimeout(()=>{
    if(room.round>=room.totalRounds){room.phase='GAME_OVER';bcast(room.players,typerSnap(room));broadcastLobby();}
    else{room.round++;typerStartRound(room);}
  },3500);
}
wssTyper.on('connection',ws=>{
  makeWS(wssTyper).alive(ws);
  let myRoom=null;
  ws.on('close',()=>{
    makeWS(wssTyper).clear(ws);
    if(!myRoom)return;
    const idx=myRoom.players.findIndex(p=>p.ws===ws);if(idx<0)return;
    const name=myRoom.players[idx].name;
    myRoom.players.splice(idx,1);myRoom.players.forEach((p,i)=>p.slot=i);
    clearTimeout(myRoom.timer);
    if(!myRoom.players.length){typerRooms.delete(myRoom.code);broadcastLobby();return;}
    bcast(myRoom.players,{type:'player_left',name});
    if(['PLAYING','ROUNDOVER'].includes(myRoom.phase))bcast(myRoom.players,{type:'game_abandoned'});
    myRoom.phase='WAITING';bcast(myRoom.players,typerSnap(myRoom));broadcastLobby();
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    const player=myRoom?myRoom.players.find(p=>p.ws===ws):null;
    switch(d.type){
      case 'lounge_chat':handleLoungeChat(myRoom,ws,d);break;
      case 'create_typer':{
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const code=genCode(typerRooms);const room=makeTyperRoom(code,name);
        typerRooms.set(code,room);myRoom=room;
        room.players.push({ws,name,slot:0,progress:0});room.scores[0]=0;
        wsend(ws,{type:'created_typer',code,slot:0,name});wsend(ws,typerSnap(room));broadcastLobby();break;
      }
      case 'join_typer':{
        const code=String(d.code||'').trim().toUpperCase();const room=typerRooms.get(code);
        if(!room){wsend(ws,{type:'error',msg:'Salle introuvable.'});return;}
        if(room.players.length>=4){wsend(ws,{type:'error',msg:'Partie pleine.'});return;}
        if(room.phase!=='WAITING'){wsend(ws,{type:'error',msg:'Partie déjà en cours.'});return;}
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot=room.players.length;room.players.push({ws,name,slot,progress:0});room.scores[slot]=0;
        myRoom=room;wsend(ws,{type:'welcome_typer',slot,name,code});bcast(room.players,typerSnap(room));broadcastLobby();break;
      }
      case 'start_typer':{
        if(!player||!myRoom||player.slot!==0||myRoom.phase!=='WAITING')return;
        if(myRoom.players.length<2){wsend(ws,{type:'error',msg:'Il faut au moins 2 joueurs.'});return;}
        myRoom.round=1;myRoom.scores={};myRoom.usedTexts=[];
        myRoom.players.forEach(p=>{myRoom.scores[p.slot]=0;p.progress=0;});
        bcast(myRoom.players,{type:'countdown',seconds:3});
        clearTimeout(myRoom.timer);myRoom.timer=setTimeout(()=>typerStartRound(myRoom),3000);broadcastLobby();break;
      }
      case 'typer_progress':{
        if(!player||!myRoom||myRoom.phase!=='PLAYING')return;
        player.progress=Math.min(100,Math.max(0,Number(d.progress)||0));
        bcast(myRoom.players,{type:'typer_positions',players:myRoom.players.map(p=>({slot:p.slot,progress:p.progress||0}))});break;
      }
      case 'typer_done':{
        if(!player||!myRoom||myRoom.phase!=='PLAYING')return;
        if(myRoom.finishers.includes(player.slot))return;
        myRoom.finishers.push(player.slot);player.progress=100;
        bcast(myRoom.players,{type:'typer_finish',slot:player.slot,name:player.name,rank:myRoom.finishers.length});
        bcast(myRoom.players,{type:'typer_positions',players:myRoom.players.map(p=>({slot:p.slot,progress:p.progress||0}))});
        if(myRoom.finishers.length>=myRoom.players.length)typerEndRound(myRoom);break;
      }
      case 'restart_typer':{
        if(!player||!myRoom||myRoom.phase!=='GAME_OVER')return;
        myRoom.phase='WAITING';myRoom.round=0;myRoom.scores={};myRoom.usedTexts=[];
        myRoom.players.forEach(p=>{myRoom.scores[p.slot]=0;p.progress=0;});
        bcast(myRoom.players,typerSnap(myRoom));broadcastLobby();break;
      }
    }
  });
});

// ════════════════════════════════════════════════════════
//  ANAGRAMME
// ════════════════════════════════════════════════════════
const ANAGRAMME_WORDS=[
  'maison','jardin','soleil','musique','voyage','plante','balcon','fenetre','bureau','lampe',
  'chaise','livre','crayon','stylo','nuage','fleuve','dessin','couleur','canard','souris',
  'lapin','poisson','dragon','pirate','chateau','tresor','lumiere','miroir','bougie','parfum',
  'rideau','tapis','casque','marteau','valise','billet','montre','bague','collier','bouton',
  'cravate','manteau','chapeau','voiture','bateau','avion','fusee','etoile','planete','guitare',
  'trompette','violon','tableau','musee','jardin','tigre','girafe','serpent','tortue','mouton',
];
function scrambleWord(w){let a=w.split('');let t=0;do{a.sort(()=>Math.random()-.5);t++;}while(a.join('')===w&&t<30);return a.join('');}

const anagrammeRooms=new Map();
function makeAnagrammeRoom(c,h){return{code:c,host:h,players:[],phase:'WAITING',round:0,totalRounds:8,currentWord:null,scrambled:null,scores:{},roundOver:false,timer:null,usedIdx:[]};}
function anagrammeSnap(room,extra={}){return{type:'anagramme_state',phase:room.phase,code:room.code,players:room.players.map(p=>({name:p.name,slot:p.slot,score:room.scores[p.slot]||0})),round:room.round,totalRounds:room.totalRounds,scrambled:room.scrambled,wordLen:room.currentWord?room.currentWord.length:0,...extra};}

function anagrammeStartRound(room){
  room.roundOver=false;
  const avail=ANAGRAMME_WORDS.filter((_,i)=>!room.usedIdx.includes(i));
  const pool=avail.length?avail:ANAGRAMME_WORDS;
  const pick=pool[Math.floor(Math.random()*pool.length)];
  room.usedIdx.push(ANAGRAMME_WORDS.indexOf(pick));
  room.currentWord=pick;room.scrambled=scrambleWord(pick);
  room.phase='PLAYING';
  bcast(room.players,{type:'anagramme_round',round:room.round,totalRounds:room.totalRounds,scrambled:room.scrambled,wordLen:pick.length});
  clearTimeout(room.timer);
  room.timer=setTimeout(()=>{
    if(room.roundOver)return;room.roundOver=true;
    bcast(room.players,{type:'anagramme_timeout',word:room.currentWord,round:room.round});
    anagrammeNextRound(room);
  },20000);
  broadcastLobby();
}
function anagrammeNextRound(room){
  clearTimeout(room.timer);
  room.timer=setTimeout(()=>{
    if(room.round>=room.totalRounds){room.phase='GAME_OVER';bcast(room.players,anagrammeSnap(room));broadcastLobby();}
    else{room.round++;anagrammeStartRound(room);}
  },3000);
}
wssAnagramme.on('connection',ws=>{
  makeWS(wssAnagramme).alive(ws);
  let myRoom=null;
  ws.on('close',()=>{
    makeWS(wssAnagramme).clear(ws);
    if(!myRoom)return;
    const idx=myRoom.players.findIndex(p=>p.ws===ws);if(idx<0)return;
    const name=myRoom.players[idx].name;
    myRoom.players.splice(idx,1);myRoom.players.forEach((p,i)=>p.slot=i);
    clearTimeout(myRoom.timer);
    if(!myRoom.players.length){anagrammeRooms.delete(myRoom.code);broadcastLobby();return;}
    bcast(myRoom.players,{type:'player_left',name});
    if(myRoom.phase==='PLAYING')bcast(myRoom.players,{type:'game_abandoned'});
    myRoom.phase='WAITING';bcast(myRoom.players,anagrammeSnap(myRoom));broadcastLobby();
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    const player=myRoom?myRoom.players.find(p=>p.ws===ws):null;
    switch(d.type){
      case 'lounge_chat':handleLoungeChat(myRoom,ws,d);break;
      case 'create_anagramme':{
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const code=genCode(anagrammeRooms);const room=makeAnagrammeRoom(code,name);
        anagrammeRooms.set(code,room);myRoom=room;
        room.players.push({ws,name,slot:0});room.scores[0]=0;
        wsend(ws,{type:'created_anagramme',code,slot:0,name});wsend(ws,anagrammeSnap(room));broadcastLobby();break;
      }
      case 'join_anagramme':{
        const code=String(d.code||'').trim().toUpperCase();const room=anagrammeRooms.get(code);
        if(!room){wsend(ws,{type:'error',msg:'Salle introuvable.'});return;}
        if(room.players.length>=4){wsend(ws,{type:'error',msg:'Partie pleine.'});return;}
        if(room.phase!=='WAITING'){wsend(ws,{type:'error',msg:'Partie déjà en cours.'});return;}
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot=room.players.length;room.players.push({ws,name,slot});room.scores[slot]=0;
        myRoom=room;wsend(ws,{type:'welcome_anagramme',slot,name,code});bcast(room.players,anagrammeSnap(room));broadcastLobby();break;
      }
      case 'start_anagramme':{
        if(!player||!myRoom||player.slot!==0||myRoom.phase!=='WAITING')return;
        if(myRoom.players.length<2){wsend(ws,{type:'error',msg:'Il faut au moins 2 joueurs.'});return;}
        myRoom.round=1;myRoom.scores={};myRoom.usedIdx=[];myRoom.currentWord=null;
        myRoom.players.forEach(p=>{myRoom.scores[p.slot]=0;});
        bcast(myRoom.players,{type:'countdown',seconds:3});
        clearTimeout(myRoom.timer);myRoom.timer=setTimeout(()=>anagrammeStartRound(myRoom),3000);broadcastLobby();break;
      }
      case 'anagramme_guess':{
        if(!player||!myRoom||myRoom.phase!=='PLAYING'||myRoom.roundOver)return;
        const guess=String(d.word||'').trim().toLowerCase();if(!guess)return;
        if(guess===myRoom.currentWord){
          myRoom.roundOver=true;clearTimeout(myRoom.timer);
          myRoom.scores[player.slot]=(myRoom.scores[player.slot]||0)+3;
          bcast(myRoom.players,{type:'anagramme_won',winner:player.name,slot:player.slot,word:myRoom.currentWord});
          anagrammeNextRound(myRoom);
        }else{wsend(ws,{type:'anagramme_wrong',guess});}
        break;
      }
      case 'restart_anagramme':{
        if(!player||!myRoom||myRoom.phase!=='GAME_OVER')return;
        myRoom.phase='WAITING';myRoom.round=0;myRoom.scores={};myRoom.usedIdx=[];myRoom.currentWord=null;myRoom.scrambled=null;
        myRoom.players.forEach(p=>{myRoom.scores[p.slot]=0;});
        bcast(myRoom.players,anagrammeSnap(myRoom));broadcastLobby();break;
      }
    }
  });
});

// ════════════════════════════════════════════════════════
//  JUSTE PRIX
// ════════════════════════════════════════════════════════
const JUSTE_PRIX_QS=[
  {q:"Prix d'un Big Mac en France (€)",answer:5.3},
  {q:"Prix d'une baguette tradition en boulangerie (€)",answer:1.2},
  {q:"Prix d'un iPhone 15 128Go neuf (€)",answer:969},
  {q:"Prix d'un ticket de métro à Paris (€)",answer:2.1},
  {q:"Année de sortie du 1er iPhone",answer:2007},
  {q:"Vitesse maximale d'un guépard (km/h)",answer:120},
  {q:"Nombre de pays dans l'Union Européenne",answer:27},
  {q:"Profondeur max de la fosse des Mariannes (km)",answer:11},
  {q:"Prix d'une Tesla Model 3 neuve en France (€)",answer:42990},
  {q:"Poids moyen d'un éléphant adulte mâle (kg)",answer:5000},
  {q:"Distance Terre-Lune (km)",answer:384400},
  {q:"Année de fondation de Google",answer:1998},
  {q:"Prix d'un expresso dans un café parisien (€)",answer:2.5},
  {q:"Nombre de muscles dans le corps humain",answer:650},
  {q:"Vitesse du son dans l'air (m/s)",answer:343},
  {q:"Température de surface du Soleil (°C)",answer:5500},
  {q:"Population mondiale (milliards d'humains)",answer:8},
  {q:"Hauteur de la Tour Eiffel en mètres",answer:330},
  {q:"Année de sortie de Minecraft",answer:2011},
  {q:"Prix moyen d'un croissant à Paris (€)",answer:1.4},
  // ── Nourriture / quotidien ───────────────────────────────────────────────
  {q:"Prix d'une pizza Margherita au restaurant (€)",answer:11},
  {q:"Prix d'un menu kebab + frites (€)",answer:10},
  {q:"Prix d'un paquet de pâtes 500g (€)",answer:1.4},
  {q:"Prix d'une tablette de chocolat 100g (€)",answer:1.6},
  {q:"Prix d'un litre de lait (€)",answer:1.2},
  {q:"Prix d'un kilo de pommes (€)",answer:2.4},
  {q:"Prix d'un kilo de bananes (€)",answer:2.0},
  {q:"Prix d'un kilo de tomates (€)",answer:3.5},
  {q:"Prix d'un kilo de riz (€)",answer:2.1},
  {q:"Prix d'une bouteille d'eau 1,5L (€)",answer:0.7},
  {q:"Prix d'un pack de 6 œufs (€)",answer:2.2},
  {q:"Prix d'un kilo de poulet (filet) (€)",answer:12},
  {q:"Prix d'un kilo de fromage type emmental (€)",answer:11},
  {q:"Prix d'une crêpe sucre en crêperie (€)",answer:4},
  {q:"Prix d'un bubble tea (€)",answer:6.5},
  {q:"Prix d'un menu fast-food (burger + frites + boisson) (€)",answer:12},
  {q:"Prix d'une canette 33cl (€)",answer:1.2},
  {q:"Prix d'un paquet de chips 150g (€)",answer:2.0},
  {q:"Prix d'un pot de yaourt (x1) (€)",answer:0.6},
  // ── Transports / voyages ─────────────────────────────────────────────────
  {q:"Prix d'un plein d'essence (50L) (€)",answer:90},
  {q:"Prix d'un ticket de bus en ville (€)",answer:1.8},
  {q:"Prix d'un aller simple TER court trajet (€)",answer:8},
  {q:"Prix d'un aller Paris-Lyon en TGV (moyenne €)",answer:65},
  {q:"Prix d'un Uber de 5 km en ville (€)",answer:12},
  {q:"Prix d'un billet d'avion low-cost Europe (moyenne €)",answer:80},
  {q:"Vitesse maximale d'un TGV (km/h)",answer:320},
  {q:"Vitesse maximale sur autoroute en France (km/h)",answer:130},
  // ── Tech / divertissement ────────────────────────────────────────────────
  {q:"Prix d'une Nintendo Switch neuve (€)",answer:299},
  {q:"Prix d'une PS5 (standard) neuve (€)",answer:549},
  {q:"Prix d'une manette PS5 (€)",answer:70},
  {q:"Prix d'une paire d'AirPods (moyenne €)",answer:149},
  {q:"Prix d'un abonnement Netflix standard (€/mois)",answer:13.5},
  {q:"Prix d'un abonnement Spotify Premium (€/mois)",answer:11},
  {q:"Prix d'un jeu vidéo AAA neuf (€)",answer:70},
  {q:"Prix d'un clavier mécanique entrée de gamme (€)",answer:60},
  {q:"Prix d'une souris gaming (€)",answer:45},
  // ── Maison / services ────────────────────────────────────────────────────
  {q:"Prix d'une coupe de cheveux homme (€)",answer:20},
  {q:"Prix d'une coupe de cheveux femme (€)",answer:35},
  {q:"Prix d'une place de cinéma (€)",answer:12},
  {q:"Prix d'un billet de concert (moyenne €)",answer:45},
  {q:"Prix d'une paire de baskets (moyenne €)",answer:80},
  {q:"Prix d'un jean (moyenne €)",answer:60},
  {q:"Prix d'un t-shirt (moyenne €)",answer:15},
  {q:"Prix d'un livre poche (€)",answer:9},
  {q:"Prix d'un menu au restaurant (plat + boisson) (€)",answer:18},
  {q:"Prix d'un mois de salle de sport (moyenne €)",answer:30},
  // ── Culture générale (nombres “fixes”) ────────────────────────────────────
  {q:"Nombre de minutes dans une journée",answer:1440},
  {q:"Nombre de secondes dans une heure",answer:3600},
  {q:"Nombre de continents sur Terre",answer:7},
  {q:"Nombre de jours dans une année bissextile",answer:366},
  {q:"Nombre de touches sur un clavier AZERTY (approx.)",answer:105},
  {q:"Nombre de dents chez l'adulte",answer:32},
  {q:"Nombre de joueurs sur un terrain de football (total)",answer:22},
  {q:"Hauteur du Mont Blanc (m)",answer:4808},
  {q:"Longueur d'un marathon (km)",answer:42.195},
  {q:"Nombre de litres dans 1 m³",answer:1000},
];

const justeprixRooms=new Map();
function makeJusteprixRoom(c,h){return{code:c,host:h,players:[],phase:'WAITING',round:0,totalRounds:8,currentQ:null,guesses:{},scores:{},timer:null,usedIdx:[]};}
function justeprixSnap(room,extra={}){return{type:'justeprix_state',phase:room.phase,code:room.code,players:room.players.map(p=>({name:p.name,slot:p.slot,score:room.scores[p.slot]||0})),round:room.round,totalRounds:room.totalRounds,question:room.currentQ?room.currentQ.q:null,...extra};}

function justeprixStartRound(room){
  room.guesses={};
  const avail=JUSTE_PRIX_QS.filter((_,i)=>!room.usedIdx.includes(i));
  const pool=avail.length?avail:JUSTE_PRIX_QS;
  const pick=pool[Math.floor(Math.random()*pool.length)];
  room.usedIdx.push(JUSTE_PRIX_QS.indexOf(pick));
  room.currentQ=pick;room.phase='PLAYING';
  bcast(room.players,{type:'justeprix_round',round:room.round,totalRounds:room.totalRounds,question:pick.q});
  clearTimeout(room.timer);
  room.timer=setTimeout(()=>justeprixReveal(room),15000);
  broadcastLobby();
}
function justeprixReveal(room){
  clearTimeout(room.timer);
  const answer=room.currentQ.answer;
  const guessArr=room.players.map(p=>({slot:p.slot,name:p.name,guess:room.guesses[p.slot]!==undefined?room.guesses[p.slot]:null,diff:room.guesses[p.slot]!==undefined?Math.abs(room.guesses[p.slot]-answer):Infinity}));
  guessArr.sort((a,b)=>a.diff-b.diff);
  const pts=[4,2,1,0];
  guessArr.forEach((g,i)=>{if(g.guess!==null)room.scores[g.slot]=(room.scores[g.slot]||0)+(pts[i]||0);});
  room.phase='ROUNDOVER';
  bcast(room.players,{...justeprixSnap(room),type:'justeprix_reveal',answer,guesses:guessArr});
  clearTimeout(room.timer);
  room.timer=setTimeout(()=>{
    if(room.round>=room.totalRounds){room.phase='GAME_OVER';bcast(room.players,justeprixSnap(room));broadcastLobby();}
    else{room.round++;justeprixStartRound(room);}
  },5000);
}
wssJustePrix.on('connection',ws=>{
  makeWS(wssJustePrix).alive(ws);
  let myRoom=null;
  ws.on('close',()=>{
    makeWS(wssJustePrix).clear(ws);
    if(!myRoom)return;
    const idx=myRoom.players.findIndex(p=>p.ws===ws);if(idx<0)return;
    const name=myRoom.players[idx].name;
    myRoom.players.splice(idx,1);myRoom.players.forEach((p,i)=>p.slot=i);
    clearTimeout(myRoom.timer);
    if(!myRoom.players.length){justeprixRooms.delete(myRoom.code);broadcastLobby();return;}
    bcast(myRoom.players,{type:'player_left',name});
    if(['PLAYING','ROUNDOVER'].includes(myRoom.phase))bcast(myRoom.players,{type:'game_abandoned'});
    myRoom.phase='WAITING';bcast(myRoom.players,justeprixSnap(myRoom));broadcastLobby();
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    const player=myRoom?myRoom.players.find(p=>p.ws===ws):null;
    switch(d.type){
      case 'lounge_chat':handleLoungeChat(myRoom,ws,d);break;
      case 'create_justeprix':{
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const code=genCode(justeprixRooms);const room=makeJusteprixRoom(code,name);
        justeprixRooms.set(code,room);myRoom=room;
        room.players.push({ws,name,slot:0});room.scores[0]=0;
        wsend(ws,{type:'created_justeprix',code,slot:0,name});wsend(ws,justeprixSnap(room));broadcastLobby();break;
      }
      case 'join_justeprix':{
        const code=String(d.code||'').trim().toUpperCase();const room=justeprixRooms.get(code);
        if(!room){wsend(ws,{type:'error',msg:'Salle introuvable.'});return;}
        if(room.players.length>=4){wsend(ws,{type:'error',msg:'Partie pleine.'});return;}
        if(room.phase!=='WAITING'){wsend(ws,{type:'error',msg:'Partie déjà en cours.'});return;}
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot=room.players.length;room.players.push({ws,name,slot});room.scores[slot]=0;
        myRoom=room;wsend(ws,{type:'welcome_justeprix',slot,name,code});bcast(room.players,justeprixSnap(room));broadcastLobby();break;
      }
      case 'start_justeprix':{
        if(!player||!myRoom||player.slot!==0||myRoom.phase!=='WAITING')return;
        if(myRoom.players.length<2){wsend(ws,{type:'error',msg:'Il faut au moins 2 joueurs.'});return;}
        myRoom.round=1;myRoom.scores={};myRoom.usedIdx=[];
        myRoom.players.forEach(p=>{myRoom.scores[p.slot]=0;});
        bcast(myRoom.players,{type:'countdown',seconds:3});
        clearTimeout(myRoom.timer);myRoom.timer=setTimeout(()=>justeprixStartRound(myRoom),3000);broadcastLobby();break;
      }
      case 'justeprix_guess':{
        if(!player||!myRoom||myRoom.phase!=='PLAYING')return;
        if(myRoom.guesses[player.slot]!==undefined)return;
        const val=parseFloat(d.value);if(isNaN(val))return;
        myRoom.guesses[player.slot]=val;
        wsend(ws,{type:'justeprix_guess_ack'});
        if(Object.keys(myRoom.guesses).length>=myRoom.players.length)justeprixReveal(myRoom);
        break;
      }
      case 'restart_justeprix':{
        if(!player||!myRoom||myRoom.phase!=='GAME_OVER')return;
        myRoom.phase='WAITING';myRoom.round=0;myRoom.scores={};myRoom.usedIdx=[];
        myRoom.players.forEach(p=>{myRoom.scores[p.slot]=0;});
        bcast(myRoom.players,justeprixSnap(myRoom));broadcastLobby();break;
      }
    }
  });
});

// ════════════════════════════════════════════════════════
//  TIMELINE
// ════════════════════════════════════════════════════════
const TIMELINE_EVENTS=[
  {e:"Construction de la Tour Eiffel",y:1889},
  {e:"Invention de l'imprimerie (Gutenberg)",y:1440},
  {e:"Découverte de l'Amérique par Colomb",y:1492},
  {e:"Chute du mur de Berlin",y:1989},
  {e:"Premier homme sur la Lune",y:1969},
  {e:"Invention du téléphone (Bell)",y:1876},
  {e:"Début de la Seconde Guerre Mondiale",y:1939},
  {e:"Sortie de Star Wars (1er film)",y:1977},
  {e:"Fondation d'Apple",y:1976},
  {e:"Chute de Constantinople",y:1453},
  {e:"Révolution française",y:1789},
  {e:"Traité de Versailles",y:1919},
  {e:"Naissance de Mozart",y:1756},
  {e:"Premier vol des frères Wright",y:1903},
  {e:"Découverte de la pénicilline",y:1928},
  {e:"Sortie de Minecraft",y:2011},
  {e:"Fondation de Facebook",y:2004},
  {e:"Sortie du premier iPhone",y:2007},
  {e:"Naissance de Napoléon Bonaparte",y:1769},
  {e:"Fin de la Seconde Guerre Mondiale",y:1945},
  {e:"Premiers JO modernes (Athènes)",y:1896},
  {e:"Naissance d'Albert Einstein",y:1879},
  {e:"Fondation de Microsoft",y:1975},
  {e:"Lancement de Spoutnik",y:1957},
  {e:"Création de YouTube",y:2005},
  {e:"Sortie de Harry Potter (1er livre)",y:1997},
  {e:"Naissance de Léonard de Vinci",y:1452},
  {e:"Fondation de Google",y:1998},
  {e:"Invention de la radio (Marconi)",y:1895},
  {e:"Naissance de Charles Darwin",y:1809},
];

const timelineRooms=new Map();
function makeTimelineRoom(c,h){return{code:c,host:h,players:[],phase:'WAITING',round:0,totalRounds:10,options:null,answer:-1,answerEvent:null,scores:{},locked:[],timer:null,usedIdx:[]};}
function timelineSnap(room,extra={}){return{type:'timeline_state',phase:room.phase,code:room.code,players:room.players.map(p=>({name:p.name,slot:p.slot,score:room.scores[p.slot]||0})),round:room.round,totalRounds:room.totalRounds,options:room.options,...extra};}

function timelineStartRound(room){
  room.locked=[];
  const avail=TIMELINE_EVENTS.filter((_,i)=>!room.usedIdx.includes(i));
  const pool=avail.length>=4?avail:TIMELINE_EVENTS;
  const chosen=shuffle(pool).slice(0,4);
  chosen.forEach(ev=>room.usedIdx.push(TIMELINE_EVENTS.indexOf(ev)));
  chosen.sort((a,b)=>a.y-b.y);
  const earliest=chosen[0];
  const shuffled=shuffle(chosen);
  room.options=shuffled.map(ev=>ev.e);
  room.answer=shuffled.findIndex(ev=>ev===earliest);
  room.answerEvent=earliest;
  room.phase='PLAYING';
  bcast(room.players,{type:'timeline_round',round:room.round,totalRounds:room.totalRounds,options:room.options,question:"Quel événement s'est produit EN PREMIER ?"});
  clearTimeout(room.timer);
  room.timer=setTimeout(()=>timelineReveal(room,-1),12000);
  broadcastLobby();
}
function timelineReveal(room,winnerSlot){
  clearTimeout(room.timer);room.phase='ROUNDOVER';
  bcast(room.players,{...timelineSnap(room),type:'timeline_reveal',answer:room.answer,answerYear:room.answerEvent.y,answerEvent:room.answerEvent.e,winnerSlot});
  clearTimeout(room.timer);
  room.timer=setTimeout(()=>{
    if(room.round>=room.totalRounds){room.phase='GAME_OVER';bcast(room.players,timelineSnap(room));broadcastLobby();}
    else{room.round++;timelineStartRound(room);}
  },4500);
}
wssTimeline.on('connection',ws=>{
  makeWS(wssTimeline).alive(ws);
  let myRoom=null;
  ws.on('close',()=>{
    makeWS(wssTimeline).clear(ws);
    if(!myRoom)return;
    const idx=myRoom.players.findIndex(p=>p.ws===ws);if(idx<0)return;
    const name=myRoom.players[idx].name;
    myRoom.players.splice(idx,1);myRoom.players.forEach((p,i)=>p.slot=i);
    clearTimeout(myRoom.timer);
    if(!myRoom.players.length){timelineRooms.delete(myRoom.code);broadcastLobby();return;}
    bcast(myRoom.players,{type:'player_left',name});
    if(myRoom.phase==='PLAYING')bcast(myRoom.players,{type:'game_abandoned'});
    myRoom.phase='WAITING';bcast(myRoom.players,timelineSnap(myRoom));broadcastLobby();
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    const player=myRoom?myRoom.players.find(p=>p.ws===ws):null;
    switch(d.type){
      case 'lounge_chat':handleLoungeChat(myRoom,ws,d);break;
      case 'create_timeline':{
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const code=genCode(timelineRooms);const room=makeTimelineRoom(code,name);
        timelineRooms.set(code,room);myRoom=room;
        room.players.push({ws,name,slot:0});room.scores[0]=0;
        wsend(ws,{type:'created_timeline',code,slot:0,name});wsend(ws,timelineSnap(room));broadcastLobby();break;
      }
      case 'join_timeline':{
        const code=String(d.code||'').trim().toUpperCase();const room=timelineRooms.get(code);
        if(!room){wsend(ws,{type:'error',msg:'Salle introuvable.'});return;}
        if(room.players.length>=4){wsend(ws,{type:'error',msg:'Partie pleine.'});return;}
        if(room.phase!=='WAITING'){wsend(ws,{type:'error',msg:'Partie déjà en cours.'});return;}
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot=room.players.length;room.players.push({ws,name,slot});room.scores[slot]=0;
        myRoom=room;wsend(ws,{type:'welcome_timeline',slot,name,code});bcast(room.players,timelineSnap(room));broadcastLobby();break;
      }
      case 'start_timeline':{
        if(!player||!myRoom||player.slot!==0||myRoom.phase!=='WAITING')return;
        if(myRoom.players.length<2){wsend(ws,{type:'error',msg:'Il faut au moins 2 joueurs.'});return;}
        myRoom.round=1;myRoom.scores={};myRoom.usedIdx=[];
        myRoom.players.forEach(p=>{myRoom.scores[p.slot]=0;});
        bcast(myRoom.players,{type:'countdown',seconds:3});
        clearTimeout(myRoom.timer);myRoom.timer=setTimeout(()=>timelineStartRound(myRoom),3000);broadcastLobby();break;
      }
      case 'timeline_answer':{
        if(!player||!myRoom||myRoom.phase!=='PLAYING')return;
        if(myRoom.locked.includes(player.slot))return;
        const pick=Number(d.index);if(pick!==Math.floor(pick)||pick<0||pick>3)return;
        myRoom.locked.push(player.slot);
        if(pick===myRoom.answer){
          myRoom.scores[player.slot]=(myRoom.scores[player.slot]||0)+3;
          timelineReveal(myRoom,player.slot);
        }else{
          wsend(ws,{type:'timeline_wrong'});
          if(myRoom.locked.length>=myRoom.players.length)timelineReveal(myRoom,-1);
        }
        break;
      }
      case 'restart_timeline':{
        if(!player||!myRoom||myRoom.phase!=='GAME_OVER')return;
        myRoom.phase='WAITING';myRoom.round=0;myRoom.scores={};myRoom.usedIdx=[];myRoom.options=null;myRoom.answer=-1;
        myRoom.players.forEach(p=>{myRoom.scores[p.slot]=0;});
        bcast(myRoom.players,timelineSnap(myRoom));broadcastLobby();break;
      }
    }
  });
});

// ════════════════════════════════════════════════════════
//  MÉMOIRE
// ════════════════════════════════════════════════════════
const MEMO_ICONS=['🎯','🎪','🎨','🎭','🎮','🎲','🎸','🎺','🏆','🌟','🦁','🦊','🐬','🦋','🍕','🍦','🌈','⚡','🔮','🎃','🚀','🎀','🎁','💎'];

const memoRooms=new Map();
function makeMemoRoom(c,h){return{code:c,host:h,players:[],phase:'WAITING',cards:[],matched:[],scores:{},turn:0,flipped:[],timer:null};}
function memoSnap(room,extra={}){return{type:'memo_state',phase:room.phase,code:room.code,players:room.players.map(p=>({name:p.name,slot:p.slot,score:room.scores[p.slot]||0})),turn:room.turn,cards:room.cards.map((c,i)=>({id:i,face:(room.matched.includes(i)||room.flipped.includes(i))?c.icon:null,matched:room.matched.includes(i),flipped:room.flipped.includes(i)})),matched:[...room.matched],...extra};}
function memoSetup(room){
  const pairCount=room.players.length<=2?8:12;
  const icons=shuffle(MEMO_ICONS).slice(0,pairCount);
  const deck=shuffle([...icons,...icons]);
  room.cards=deck.map((icon,i)=>({id:i,icon}));
  room.matched=[];room.flipped=[];room.turn=0;
  room.scores={};room.players.forEach(p=>{room.scores[p.slot]=0;});
}
wssMemo.on('connection',ws=>{
  makeWS(wssMemo).alive(ws);
  let myRoom=null;
  ws.on('close',()=>{
    makeWS(wssMemo).clear(ws);
    if(!myRoom)return;
    const idx=myRoom.players.findIndex(p=>p.ws===ws);if(idx<0)return;
    const name=myRoom.players[idx].name;
    myRoom.players.splice(idx,1);myRoom.players.forEach((p,i)=>p.slot=i);
    clearTimeout(myRoom.timer);
    if(!myRoom.players.length){memoRooms.delete(myRoom.code);broadcastLobby();return;}
    bcast(myRoom.players,{type:'player_left',name});
    if(myRoom.phase==='PLAYING')bcast(myRoom.players,{type:'game_abandoned'});
    myRoom.phase='WAITING';bcast(myRoom.players,memoSnap(myRoom));broadcastLobby();
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    const player=myRoom?myRoom.players.find(p=>p.ws===ws):null;
    switch(d.type){
      case 'lounge_chat':handleLoungeChat(myRoom,ws,d);break;
      case 'create_memo':{
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const code=genCode(memoRooms);const room=makeMemoRoom(code,name);
        memoRooms.set(code,room);myRoom=room;
        room.players.push({ws,name,slot:0});room.scores[0]=0;
        wsend(ws,{type:'created_memo',code,slot:0,name});wsend(ws,memoSnap(room));broadcastLobby();break;
      }
      case 'join_memo':{
        const code=String(d.code||'').trim().toUpperCase();const room=memoRooms.get(code);
        if(!room){wsend(ws,{type:'error',msg:'Salle introuvable.'});return;}
        if(room.players.length>=4){wsend(ws,{type:'error',msg:'Partie pleine.'});return;}
        if(room.phase!=='WAITING'){wsend(ws,{type:'error',msg:'Partie déjà en cours.'});return;}
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot=room.players.length;room.players.push({ws,name,slot});room.scores[slot]=0;
        myRoom=room;wsend(ws,{type:'welcome_memo',slot,name,code});bcast(room.players,memoSnap(room));broadcastLobby();break;
      }
      case 'start_memo':{
        if(!player||!myRoom||player.slot!==0||myRoom.phase!=='WAITING')return;
        if(myRoom.players.length<2){wsend(ws,{type:'error',msg:'Il faut au moins 2 joueurs.'});return;}
        memoSetup(myRoom);
        bcast(myRoom.players,{type:'countdown',seconds:3});
        clearTimeout(myRoom.timer);
        myRoom.timer=setTimeout(()=>{myRoom.phase='PLAYING';bcast(myRoom.players,memoSnap(myRoom));broadcastLobby();},3000);
        broadcastLobby();break;
      }
      case 'memo_flip':{
        if(!player||!myRoom||myRoom.phase!=='PLAYING')return;
        if(myRoom.turn!==player.slot)return;
        const id=Number(d.id);
        if(id!==Math.floor(id)||id<0||id>=myRoom.cards.length)return;
        if(myRoom.matched.includes(id)||myRoom.flipped.includes(id))return;
        if(myRoom.flipped.length>=2)return;
        myRoom.flipped.push(id);
        bcast(myRoom.players,memoSnap(myRoom));
        if(myRoom.flipped.length===2){
          const[a,b]=myRoom.flipped;
          if(myRoom.cards[a].icon===myRoom.cards[b].icon){
            myRoom.matched.push(a,b);
            myRoom.scores[player.slot]=(myRoom.scores[player.slot]||0)+1;
            myRoom.flipped=[];
            if(myRoom.matched.length>=myRoom.cards.length){
              myRoom.phase='GAME_OVER';bcast(myRoom.players,memoSnap(myRoom));broadcastLobby();
            }else{
              bcast(myRoom.players,memoSnap(myRoom));
            }
          }else{
            clearTimeout(myRoom.timer);
            myRoom.timer=setTimeout(()=>{
              myRoom.flipped=[];
              myRoom.turn=(myRoom.turn+1)%myRoom.players.length;
              bcast(myRoom.players,memoSnap(myRoom));
            },1500);
          }
        }
        break;
      }
      case 'restart_memo':{
        if(!player||!myRoom||myRoom.phase!=='GAME_OVER')return;
        myRoom.phase='WAITING';memoSetup(myRoom);
        bcast(myRoom.players,memoSnap(myRoom));broadcastLobby();break;
      }
    }
  });
});

// ════════════════════════════════════════════════════════
//  CHAT GLOBAL
// ════════════════════════════════════════════════════════
// ── IMPOSTEUR ─────────────────────────────────────────────────────────────────
const IMPOSTEUR_WORDS = {
  animaux:  ['chien','chat','lion','éléphant','girafe','singe','pingouin','requin','dauphin','renard','lapin','ours','tigre','zèbre','flamant rose','hibou','tortue','crocodile','baleine','aigle','koala','panda','gorille','perroquet','kangourou','lynx','jaguar','phoque','bison','loup'],
  objets:   ['avion','guitare','parapluie','horloge','bougie','ballon','couronne','épée','bouclier','lunettes','chapeau','clé','marteau','loupe','sablier','boussole','télescope','accordéon','piano','skateboard','trottinette','parachute','sous-marin','catapulte','igloo','microscope','sarbacane','trampoline','mitraillette','kaleidoscope'],
  lieux:    ['plage','montagne','bibliothèque','musée','cirque','prison','château','volcan','désert','jungle','igloo','phare','port','stade','mosquée','cathédrale','pyramide','grotte','marché','aéroport','cimetière','aquarium','zoo','université','laboratoire','serre','refuge','caverne','manoir','île déserte'],
  actions:  ['nager','cuisiner','danser','grimper','chuchoter','éternuer','bâiller','siffler','ronfler','ricaner','trébucher','applaudir','boxer','jongler','méditer','peindre','souder','scier','bricoler','coudre','jardiner','photographier','sculpter','tricoter','ramer','sauter','voler','ramper','glisser','balancer'],
  aliments: ['pizza','chocolat','pastèque','sushi','croissant','fromage','ananas','pieuvre','escargot','chou-fleur','framboise','noix de coco','piment','ratatouille','fondue','crêpe','guacamole','kimchi','pho','tacos','churros','waffle','bagel','mochi','tiramisu','baklava','choucroute','hummus','lasagne','couscous']
};

// Paires "à l'envers" pour le mot imposteur (fallback: mot différent)
const IMPOSTEUR_OPPOSITES = [
  ['fraise','cerise'],
  ['pomme','poire'],
  ['chocolat','vanille'],
  ['pizza','burger'],
  ['sushi','tacos'],
  ['croissant','bagel'],
  ['ananas','pastèque'],
  ['fromage','chocolat'],
  ['chien','chat'],
  ['lion','tigre'],
  ['renard','loup'],
  ['panda','koala'],
  ['hibou','aigle'],
  ['plage','montagne'],
  ['désert','jungle'],
  ['bibliothèque','musée'],
  ['château','prison'],
  ['avion','sous-marin'],
  ['épée','bouclier'],
  ['loupe','télescope'],
  ['nager','courir'],
  ['danser','méditer'],
  ['chuchoter','applaudir']
].map(([a,b])=>[String(a).toLowerCase(),String(b).toLowerCase()]);

function imposteurAllWordsFlat() {
  return Object.values(IMPOSTEUR_WORDS).flat();
}

function imposteurPickDifferentWord(notWord) {
  const flat = imposteurAllWordsFlat();
  if (!flat.length) return '???';
  const target = String(notWord||'').toLowerCase();
  for (let i = 0; i < 20; i++) {
    const w = flat[Math.floor(Math.random() * flat.length)];
    if (String(w).toLowerCase() !== target) return w;
  }
  return flat[0];
}

function imposteurPickOpposite(word) {
  const w = String(word||'').trim().toLowerCase();
  if (!w) return imposteurPickDifferentWord(word);
  const pair = IMPOSTEUR_OPPOSITES.find(([a,b]) => a === w || b === w);
  if (pair) return pair[0] === w ? pair[1] : pair[0];
  return imposteurPickDifferentWord(word);
}

function imposteurPickWord() {
  const cats = Object.keys(IMPOSTEUR_WORDS);
  const cat  = cats[Math.floor(Math.random() * cats.length)];
  const words = IMPOSTEUR_WORDS[cat];
  return words[Math.floor(Math.random() * words.length)];
}

function imposteurGenCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c = '';
  for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return imposteurRooms.has(c) ? imposteurGenCode() : c;
}

const imposteurRooms = new Map();

function makeImposteurRoom(code, host) {
  return { code, host, players:[], phase:'WAITING',
           round:0, totalRounds:5, nbImposteurs:1,
           word:null, imposteurSlots:[], descOrder:[], descIndex:0,
           imposteurWord:null,
           descriptions:[], votes:{}, scores:{}, guessResult:null, timer:null };
}

function imposteurSnap(room, forSlot) {
  const isImposteur = room.imposteurSlots.includes(forSlot);
  const players = room.players.map(p => {
    const o = { name:p.name, slot:p.slot, score:room.scores[p.slot]||0 };
    if (['REVEAL','GUESS','SCORES','GAME_OVER'].includes(room.phase))
      o.isImposteur = room.imposteurSlots.includes(p.slot);
    return o;
  });
  const showRoleToPlayer = room.phase !== 'WAITING';
  return {
    type:'imposteur_state', phase:room.phase,
    round:room.round, totalRounds:room.totalRounds, nbImposteurs:room.nbImposteurs,
    players, code:room.code, host:room.host,
    myRole: showRoleToPlayer ? (isImposteur ? 'imposteur' : 'civil') : null,
    word: (room.phase==='DESCRIBE'||room.phase==='VOTE')
      ? (isImposteur ? room.imposteurWord : room.word)
      : (['REVEAL','GUESS','SCORES','GAME_OVER'].includes(room.phase) ? room.word : null),
    descOrder:room.descOrder, descIndex:room.descIndex,
    descriptions:room.descriptions,
    votes: ['REVEAL','GUESS','SCORES','GAME_OVER'].includes(room.phase) ? room.votes : {},
    eliminated:room.eliminated||null, guessResult:room.guessResult,
    scores:room.scores
  };
}

function imposteurBcast(room) {
  room.players.forEach(p => {
    if (p.ws.readyState === WebSocket.OPEN) wsend(p.ws, imposteurSnap(room, p.slot));
  });
}

function imposteurStartRound(room) {
  room.round++;
  room.word = imposteurPickWord();
  room.imposteurWord = imposteurPickOpposite(room.word);
  room.descriptions = [];
  room.votes = {};
  room.eliminated = null;
  room.guessResult = null;
  // pick imposteurs
  const slots = room.players.map(p => p.slot);
  const shuffled = [...slots].sort(() => Math.random() - .5);
  const nb = Math.min(room.nbImposteurs, room.players.length > 4 ? 2 : 1);
  room.imposteurSlots = shuffled.slice(0, nb);
  // description order = shuffled
  room.descOrder = [...slots].sort(() => Math.random() - .5);
  room.descIndex = 0;
  room.phase = 'DESCRIBE';
  imposteurBcast(room);
  imposteurDescribeTimer(room);
}

function imposteurDescribeTimer(room) {
  clearTimeout(room.timer);
  room.timer = setTimeout(() => {
    // auto-fill empty description
    const activeSlot = room.descOrder[room.descIndex];
    const already = room.descriptions.find(d => d.slot === activeSlot);
    if (!already) {
      const p = room.players.find(p => p.slot === activeSlot);
      room.descriptions.push({ slot:activeSlot, name:p?p.name:'', text:'...' });
    }
    imposteurNextDescribe(room);
  }, 22000);
}

function imposteurNextDescribe(room) {
  room.descIndex++;
  if (room.descIndex >= room.descOrder.length) {
    imposteurStartVote(room);
  } else {
    imposteurBcast(room);
    imposteurDescribeTimer(room);
  }
}

function imposteurStartVote(room) {
  clearTimeout(room.timer);
  room.phase = 'VOTE';
  imposteurBcast(room);
  room.timer = setTimeout(() => imposteurResolveVote(room), 32000);
}

function imposteurResolveVote(room) {
  clearTimeout(room.timer);
  // auto-vote: players who didn't vote vote for themselves
  room.players.forEach(p => {
    if (room.votes[p.slot] === undefined) room.votes[p.slot] = p.slot;
  });
  // count votes
  const tally = {};
  room.players.forEach(p => { tally[p.slot] = 0; });
  Object.values(room.votes).forEach(target => { if (tally[target]!==undefined) tally[target]++; });
  const max = Math.max(...Object.values(tally));
  const top = Object.keys(tally).filter(s => tally[s] === max).map(Number);
  const eliminatedSlot = top.length === 1 ? top[0] : null; // ex-aequo = no elimination
  room.eliminated = null;
  if (eliminatedSlot !== null) {
    const ep = room.players.find(p => p.slot === eliminatedSlot);
    if (ep) room.eliminated = { slot:eliminatedSlot, name:ep.name, isImposteur: room.imposteurSlots.includes(eliminatedSlot) };
    // score update
    if (room.imposteurSlots.includes(eliminatedSlot)) {
      // civils win this round
      room.players.filter(p => !room.imposteurSlots.includes(p.slot)).forEach(p => { room.scores[p.slot] = (room.scores[p.slot]||0) + 1; });
    } else {
      // imposteur wins this round
      room.imposteurSlots.forEach(s => { room.scores[s] = (room.scores[s]||0) + 1; });
    }
  } else {
    // ex-aequo = imposteur wins
    room.imposteurSlots.forEach(s => { room.scores[s] = (room.scores[s]||0) + 1; });
  }
  room.phase = 'REVEAL';
  imposteurBcast(room);
  room.timer = setTimeout(() => imposteurStartGuess(room), 5000);
}

function imposteurStartGuess(room) {
  clearTimeout(room.timer);
  // only if imposteur is still a player (not eliminated) or was eliminated
  room.phase = 'GUESS';
  imposteurBcast(room);
  room.timer = setTimeout(() => imposteurEndGuess(room, null), 22000);
}

function imposteurEndGuess(room, guessWord) {
  clearTimeout(room.timer);
  if (guessWord !== null) {
    const correct = guessWord.trim().toLowerCase() === room.word.toLowerCase();
    room.guessResult = correct ? 'correct' : 'wrong';
    if (correct) {
      room.imposteurSlots.forEach(s => { room.scores[s] = (room.scores[s]||0) + 1; });
    }
  } else {
    room.guessResult = 'skip';
  }
  room.phase = 'SCORES';
  imposteurBcast(room);
  broadcastLobby();
}

function imposteurNextRound(room) {
  if (room.round >= room.totalRounds) {
    room.phase = 'GAME_OVER';
    imposteurBcast(room);
    broadcastLobby();
  } else {
    imposteurStartRound(room);
    broadcastLobby();
  }
}

wssImposteur.on('connection', ws => {
  makeWS(wssImposteur).alive(ws);
  let room = null;

  ws.on('message', raw => {
    let d; try { d = JSON.parse(raw); } catch { return; }

    if (d.type === 'create') {
      const name = String(d.name||'').trim().slice(0,20);
      if (!name) return;
      const code = imposteurGenCode();
      room = makeImposteurRoom(code, name);
      room.scores[0] = 0;
      room.players.push({ ws, name, slot:0, score:0 });
      imposteurRooms.set(code, room);
      wsend(ws, imposteurSnap(room, 0));
      broadcastLobby();
    }

    else if (d.type === 'join') {
      const name = String(d.name||'').trim().slice(0,20);
      const code = String(d.code||'').toUpperCase().trim();
      if (!name || !code) return;
      room = imposteurRooms.get(code);
      if (!room) { wsend(ws, {type:'error', msg:'Salle introuvable'}); return; }
      if (room.phase !== 'WAITING') { wsend(ws, {type:'error', msg:'Partie déjà commencée'}); return; }
      if (room.players.length >= 8) { wsend(ws, {type:'error', msg:'Salle pleine'}); return; }
      const slot = room.players.length;
      room.scores[slot] = 0;
      room.players.push({ ws, name, slot });
      imposteurBcast(room);
      broadcastLobby();
    }

    else if (d.type === 'start_setup') {
      if (!room || room.host !== room.players.find(p=>p.ws===ws)?.name) return;
      if (room.players.length < 3) { wsend(ws, {type:'error', msg:'Minimum 3 joueurs'}); return; }
      room.phase = 'SETUP';
      imposteurBcast(room);
    }

    else if (d.type === 'configure') {
      if (!room) return;
      const p = room.players.find(p=>p.ws===ws);
      if (!p || p.name !== room.host) return;
      room.totalRounds = [3,5,7].includes(Number(d.totalRounds)) ? Number(d.totalRounds) : 5;
      room.nbImposteurs = room.players.length < 5 ? 1 : Math.min(Number(d.nbImposteurs)||1, 2);
      imposteurStartRound(room);
      broadcastLobby();
    }

    else if (d.type === 'describe') {
      if (!room || room.phase !== 'DESCRIBE') return;
      const p = room.players.find(p=>p.ws===ws);
      if (!p) return;
      if (room.descOrder[room.descIndex] !== p.slot) return; // not your turn
      const text = String(d.text||'').trim().slice(0,120);
      if (!text) return;
      if (room.descriptions.find(x => x.slot === p.slot)) return; // already described
      room.descriptions.push({ slot:p.slot, name:p.name, text });
      clearTimeout(room.timer);
      imposteurNextDescribe(room);
    }

    else if (d.type === 'vote') {
      if (!room || room.phase !== 'VOTE') return;
      const p = room.players.find(p=>p.ws===ws);
      if (!p) return;
      if (room.votes[p.slot] !== undefined) return; // already voted
      const target = Number(d.targetSlot);
      if (target === p.slot) return; // can't vote for yourself
      if (!room.players.find(x => x.slot === target)) return;
      room.votes[p.slot] = target;
      imposteurBcast(room);
      if (Object.keys(room.votes).length === room.players.length) {
        imposteurResolveVote(room);
      }
    }

    else if (d.type === 'guess') {
      if (!room || room.phase !== 'GUESS') return;
      const p = room.players.find(p=>p.ws===ws);
      if (!p || !room.imposteurSlots.includes(p.slot)) return;
      imposteurEndGuess(room, String(d.word||''));
    }

    else if (d.type === 'next_round') {
      if (!room || room.phase !== 'SCORES') return;
      const p = room.players.find(p=>p.ws===ws);
      if (!p || p.name !== room.host) return;
      imposteurNextRound(room);
    }

    else if (d.type === 'restart_imposteur') {
      if (!room) return;
      const isFinalScores = (room.phase === 'SCORES' && room.round >= room.totalRounds);
      if (!(room.phase === 'GAME_OVER' || isFinalScores)) return;
      const p = room.players.find(p=>p.ws===ws);
      if (!p || p.name !== room.host) return;
      room.phase = 'WAITING';
      room.round = 0;
      room.totalRounds = 5;
      room.nbImposteurs = 1;
      room.word = null;
      room.imposteurSlots = [];
      room.imposteurWord = null;
      room.descOrder = [];
      room.descIndex = 0;
      room.descriptions = [];
      room.votes = {};
      room.eliminated = null;
      room.guessResult = null;
      room.scores = {};
      room.players.forEach(pl => { room.scores[pl.slot] = 0; });
      clearTimeout(room.timer);
      room.timer = null;
      imposteurBcast(room);
      broadcastLobby();
    }

    else if (d.type === 'lounge_chat') {
      handleLoungeChat(room, ws, d);
    }
  });

  ws.on('close', () => {
    makeWS(wssImposteur).clear(ws);
    if (!room) return;
    room.players = room.players.filter(p => p.ws !== ws);
    if (room.players.length === 0) { imposteurRooms.delete(room.code); broadcastLobby(); return; }
    if (room.host === room.players.find(p=>p.ws===ws)?.name && room.players.length > 0)
      room.host = room.players[0].name;
    imposteurBcast(room);
    broadcastLobby();
  });
});

// ════════════════════════════════════════════════════════
//  DÉBAT EXPRESS (pour / contre, vote public)
// ════════════════════════════════════════════════════════
const DEBAT_TOPICS = [
  // Food & boissons
  "La pizza : ananas ou jamais ?",
  "Café ou thé le matin ?",
  "Chocolat noir ou chocolat au lait ?",
  "Ketchup ou moutarde : lequel mérite sa place dans le frigo ?",
  "Les sushis sont-ils surévalués ?",
  "Fast-food : plaisir coupable assumé ou habitude à bannir ?",
  "Petit-déjeuner salé ou sucré ?",
  "Le végétarisme devrait-il être la norme ?",
  "Cuisiner soi-même ou commander à livrer ?",
  "L'eau du robinet est-elle meilleure qu'en bouteille ?",
  "Glace vanille ou chocolat : laquelle gagne ?",
  "Manger épicé : torture ou plaisir ?",
  // Tech & numérique
  "Le streaming remplace-t-il le cinéma ?",
  "Les réseaux sociaux font plus de mal que de bien.",
  "L'intelligence artificielle va-t-elle détruire des emplois ?",
  "Les jeux vidéo sont un art à part entière.",
  "Le télétravail est meilleur que le bureau.",
  "Les smartphones rendent-ils les gens plus stupides ?",
  "Internet devrait-il être une liberté fondamentale gratuite ?",
  "Les voitures électriques sont-elles vraiment écologiques ?",
  "TikTok est plus néfaste qu'utile.",
  "La réalité virtuelle remplacera les voyages.",
  // Lifestyle & société
  "Semaine de 4 jours : pour ou contre ?",
  "Sport ou études : qu'est-ce qui construit le plus ?",
  "Téléphone au lit : toléré ou interdit ?",
  "Écouter de la musique en travaillant : aide ou distraction ?",
  "Vacances à la mer ou à la montagne ?",
  "Ville animée ou campagne calme pour vivre ?",
  "Écrans pour les enfants : limite stricte ou souple ?",
  "L'école devrait-elle commencer plus tard ?",
  "Sport individuel ou sport collectif ?",
  "Chien ou chat comme animal de compagnie ?",
  "Films ou livres pour s'évader ?",
  "Mieux vaut être riche et malheureux que pauvre et heureux.",
  "Le mariage est-il encore une institution utile ?",
  "Faut-il interdire les voitures en centre-ville ?",
  "Les selfies sont un signe de narcissisme.",
  "Le tatouage devrait être accepté dans tous les milieux professionnels.",
  "Mieux vaut avoir beaucoup d'amis superficiels ou peu d'amis proches ?",
  "Le bonheur s'achète-t-il avec de l'argent ?",
  // Débats classiques
  "L'oeuf ou la poule : lequel est venu en premier ?",
  "Le père Noël fait-il plus de bien que de mal aux enfants ?",
  "Faut-il interdire les devoirs à l'école primaire ?",
  "Le vote devrait-il être obligatoire ?",
  "La peine de mort est-elle jamais justifiable ?",
  "Les animaux devraient-ils avoir les mêmes droits que les humains ?",
  "Le sport de haut niveau devrait-il être financé par l'État ?",
  "L'art moderne est-il vraiment de l'art ?",
  "Les super-héros sont-ils un bon modèle pour les enfants ?",
  "La censure sur Internet est-elle acceptable ?",
  // Pop culture & divertissement
  "Marvel ou DC : qui a les meilleurs super-héros ?",
  "Star Wars ou Star Trek ?",
  "Harry Potter ou Le Seigneur des Anneaux ?",
  "Les remakes de films sont-ils une bonne idée ?",
  "La musique d'aujourd'hui est-elle moins bonne qu'avant ?",
  "Le rap est-il la poésie du XXIe siècle ?",
  "Les émissions de téléréalité sont-elles néfastes ?",
  "Les jeux de plateau sont-ils meilleurs que les jeux vidéo ?",
  "Faut-il préférer lire le livre avant de voir le film ?",
  "Les dessins animés sont faits pour les enfants uniquement.",
  // Travail & argent
  "L'argent fait-il le bonheur ?",
  "Faut-il faire le travail qu'on aime ou celui qui paie bien ?",
  "Le salaire minimum devrait être doublé.",
  "Les grandes entreprises sont-elles plus néfastes qu'utiles ?",
  "L'entrepreneuriat est-il la voie du succès ?",
  "Le chômage est-il toujours une question de volonté ?",
  // Environnement
  "L'écologie devrait-elle primer sur l'économie ?",
  "Faut-il taxer les voyages en avion ?",
  "La viande de synthèse sauvera-t-elle la planète ?",
  "Les humains sont-ils condamnés à détruire la Terre ?",
  "L'énergie nucléaire est-elle une solution d'avenir ?",
  // Éducation & jeunesse
  "L'uniforme scolaire : bonne ou mauvaise idée ?",
  "Les notes à l'école devraient être supprimées.",
  "Internet a-t-il remplacé les professeurs ?",
  "Faut-il apprendre le code dès le primaire ?",
  "Les études universitaires sont-elles encore nécessaires ?",
  // Bonus fun
  "Le pizza-ananas est la meilleure pizza qui soit.",
  "Dormir est une perte de temps.",
  "Les lundis devraient être bannis.",
  "Les chats sont supérieurs aux chiens en tout point.",
  "Le printemps est la meilleure saison de l'année.",
];
const DEBAT_MS_DEBATE = 40000;
const DEBAT_MS_VOTE = 25000;
const DEBAT_MIN_PLAYERS = 3;
const DEBAT_MAX_PLAYERS = 6;
const debatRooms = new Map();

function makeDebatRoom(code, host) {
  return {
    code, host, players: [], phase: 'WAITING', round: 0, totalRounds: 6,
    topic: '', forSlot: null, againstSlot: null,
    topicDeck: [], votes: {}, timer: null, scores: {},
    roundWinner: null, votesTally: null,
    debateEndsAt: 0, voteEndsAt: 0
  };
}

/** N joueurs : forSlot=(round-1)%N, againstSlot=round%N, reste=juges */
function debatRolesForRound(round1, n) {
  const forSlot = (round1 - 1) % n;
  const againstSlot = round1 % n;
  return { forSlot, againstSlot };
}

function debatSnap(room) {
  return {
    type: 'debat_state', phase: room.phase, code: room.code, host: room.host,
    round: room.round, totalRounds: room.totalRounds,
    topic: room.topic, forSlot: room.forSlot, againstSlot: room.againstSlot,
    votes: room.votes,
    roundWinner: room.roundWinner,
    votesTally: room.votesTally,
    serverNow: Date.now(),
    debateEndsAt: room.debateEndsAt || 0,
    voteEndsAt: room.voteEndsAt || 0,
    players: room.players.map(p => ({ name: p.name, slot: p.slot, score: room.scores[p.slot] || 0 }))
  };
}

function debatBcast(room) {
  bcast(room.players, debatSnap(room));
}

function debatEndVote(room) {
  clearTimeout(room.timer);
  room.voteEndsAt = 0;
  let forVotes = 0, againstVotes = 0;
  Object.values(room.votes).forEach(v => {
    if (v === 'for') forVotes++;
    else if (v === 'against') againstVotes++;
  });
  room.votesTally = { for: forVotes, against: againstVotes };
  if (forVotes > againstVotes && room.forSlot !== null) {
    room.scores[room.forSlot] = (room.scores[room.forSlot] || 0) + 2;
    // juges qui ont bien voté
    Object.entries(room.votes).forEach(([slot, v]) => {
      if (v === 'for') room.scores[Number(slot)] = (room.scores[Number(slot)] || 0) + 1;
    });
    room.roundWinner = room.forSlot;
  } else if (againstVotes > forVotes && room.againstSlot !== null) {
    room.scores[room.againstSlot] = (room.scores[room.againstSlot] || 0) + 2;
    Object.entries(room.votes).forEach(([slot, v]) => {
      if (v === 'against') room.scores[Number(slot)] = (room.scores[Number(slot)] || 0) + 1;
    });
    room.roundWinner = room.againstSlot;
  } else {
    room.roundWinner = null;
  }
  room.phase = 'ROUND_RESULT';
  debatBcast(room);
  room.timer = setTimeout(() => debatNextRound(room), 5000);
}

function debatNextRound(room) {
  clearTimeout(room.timer);
  room.round++;
  if (room.round > room.totalRounds) {
    room.phase = 'GAME_OVER';
    room.debateEndsAt = 0;
    room.voteEndsAt = 0;
    debatBcast(room);
    broadcastLobby();
    return;
  }
  if (!room.topicDeck || !room.topicDeck.length) {
    room.topicDeck = shuffle(DEBAT_TOPICS.map((_, i) => i));
  }
  const ti = room.topicDeck[(room.round - 1) % room.topicDeck.length];
  room.topic = DEBAT_TOPICS[ti];
  const n = room.players.length;
  const roles = debatRolesForRound(room.round, n);
  room.forSlot = roles.forSlot;
  room.againstSlot = roles.againstSlot;
  room.phase = 'DEBATE';
  room.votes = {};
  room.roundWinner = null;
  room.votesTally = null;
  const now = Date.now();
  room.debateEndsAt = now + DEBAT_MS_DEBATE;
  room.voteEndsAt = 0;
  debatBcast(room);
  room.timer = setTimeout(() => {
    if (room.phase === 'DEBATE') {
      room.phase = 'VOTE';
      room.debateEndsAt = 0;
      room.voteEndsAt = Date.now() + DEBAT_MS_VOTE;
      debatBcast(room);
      // auto-end vote when all judges voted
      const judgeCount = room.players.length - 2;
      if (judgeCount <= 0) { debatEndVote(room); return; }
      room.timer = setTimeout(() => debatEndVote(room), DEBAT_MS_VOTE);
    }
  }, DEBAT_MS_DEBATE);
}

wssDebat.on('connection', ws => {
  makeWS(wssDebat).alive(ws);
  let room = null;
  ws.on('close', () => {
    makeWS(wssDebat).clear(ws);
    if (!room) return;
    const idx = room.players.findIndex(p => p.ws === ws);
    if (idx < 0) return;
    const name = room.players[idx].name;
    const leavingSlot = room.players[idx].slot;
    room.players.splice(idx, 1);
    // Ne pas renuméroter les slots pendant une partie active pour éviter de casser forSlot/againstSlot
    if (room.phase === 'WAITING' || room.phase === 'GAME_OVER') {
      room.players.forEach((p, i) => { p.slot = i; });
    }
    if (room.players.length === 0) { debatRooms.delete(room.code); broadcastLobby(); return; }
    if (room.host === name && room.players.length) room.host = room.players[0].name;
    bcast(room.players, { type: 'player_left', name });
    if (room.phase !== 'WAITING' && room.phase !== 'GAME_OVER' && room.players.length < DEBAT_MIN_PLAYERS) {
      clearTimeout(room.timer);
      room.phase = 'WAITING';
    }
    debatBcast(room);
    broadcastLobby();
  });
  ws.on('message', raw => {
    let d; try { d = JSON.parse(raw); } catch { return; }
    const player = room ? room.players.find(p => p.ws === ws) : null;
    if (d.type === 'lounge_chat') { handleLoungeChat(room, ws, d); return; }
    switch (d.type) {
      case 'create_debat': {
        const name = String(d.name || '').trim().slice(0, 20) || 'Joueur';
        const code = genCode(debatRooms);
        room = makeDebatRoom(code, name);
        room.players.push({ ws, name, slot: 0 });
        room.scores[0] = 0;
        debatRooms.set(code, room);
        wsend(ws, { type: 'created_debat', code, slot: 0, name });
        wsend(ws, debatSnap(room));
        broadcastLobby();
        break;
      }
      case 'join_debat': {
        const code = String(d.code || '').trim().toUpperCase();
        const r = debatRooms.get(code);
        if (!r) { wsend(ws, { type: 'error', msg: 'Salle introuvable.' }); return; }
        if (r.phase !== 'WAITING') { wsend(ws, { type: 'error', msg: 'Partie déjà commencée.' }); return; }
        if (r.players.length >= DEBAT_MAX_PLAYERS) { wsend(ws, { type: 'error', msg: `Salle pleine (max ${DEBAT_MAX_PLAYERS} joueurs).` }); return; }
        const name = String(d.name || '').trim().slice(0, 20) || 'Joueur';
        const slot = r.players.length;
        r.players.push({ ws, name, slot });
        r.scores[slot] = 0;
        room = r;
        wsend(ws, { type: 'welcome_debat', code, slot, name });
        debatBcast(r);
        broadcastLobby();
        break;
      }
      case 'start_debat': {
        if (!room || !player || player.slot !== 0 || room.phase !== 'WAITING') return;
        const n = room.players.length;
        if (n < DEBAT_MIN_PLAYERS) { wsend(ws, { type: 'error', msg: `Il faut au moins ${DEBAT_MIN_PLAYERS} joueurs.` }); return; }
        room.totalRounds = n * 2;
        room.round = 0;
        room.topicDeck = [];
        room.players.forEach(p => { room.scores[p.slot] = 0; });
        debatNextRound(room);
        broadcastLobby();
        break;
      }
      case 'debat_vote': {
        if (!room || room.phase !== 'VOTE' || !player) return;
        const side = d.side === 'for' ? 'for' : d.side === 'against' ? 'against' : null;
        if (!side) return;
        if (player.slot === room.forSlot || player.slot === room.againstSlot) return;
        if (room.votes[player.slot] !== undefined) return;
        room.votes[player.slot] = side;
        debatBcast(room);
        // si tous les juges ont voté, fin immédiate
        const judgeSlots = room.players
          .map(p => p.slot)
          .filter(s => s !== room.forSlot && s !== room.againstSlot);
        const allVoted = judgeSlots.every(s => room.votes[s] !== undefined);
        if (allVoted) { clearTimeout(room.timer); debatEndVote(room); }
        break;
      }
      case 'restart_debat': {
        if (!room || !player || player.slot !== 0 || room.phase !== 'GAME_OVER') return;
        room.phase = 'WAITING';
        room.round = 0;
        room.topic = '';
        room.topicDeck = [];
        room.votes = {};
        room.roundWinner = null;
        room.votesTally = null;
        room.debateEndsAt = 0;
        room.voteEndsAt = 0;
        room.players.forEach(p => { room.scores[p.slot] = 0; });
        clearTimeout(room.timer);
        debatBcast(room);
        broadcastLobby();
        break;
      }
    }
  });
});

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
