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

// ── 7 WebSocket servers ───────────────────────────────────────────────────────
const wssQuiz    = new WebSocket.Server({ noServer: true });
const wssDraw    = new WebSocket.Server({ noServer: true });
const wssP4      = new WebSocket.Server({ noServer: true });
const wssMorpion = new WebSocket.Server({ noServer: true });
const wssTaboo   = new WebSocket.Server({ noServer: true });
const wssEmoji   = new WebSocket.Server({ noServer: true });
const wssVerite  = new WebSocket.Server({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const routes = { '/ws/quiz':wssQuiz,'/ws/draw':wssDraw,'/ws/p4':wssP4,'/ws/morpion':wssMorpion,'/ws/taboo':wssTaboo,'/ws/emoji':wssEmoji,'/ws/verite':wssVerite };
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

const quiz = {
  players:[], phase:'WAITING', questions:[], qIndex:0,
  buzzedSlot:-1, secondChanceSlot:-1, firstWrongAns:-1,
  streaks:[0,0], wins:[0,0], timer:null, questionStartTime:0,
};

function qSnap(extra={}) {
  return {
    type:'state', phase:quiz.phase,
    players:quiz.players.map(p=>({name:p.name,score:p.score,slot:p.slot,streak:quiz.streaks[p.slot]||0,jokers:p.jokers})),
    wins:[...quiz.wins], qIndex:quiz.qIndex, total:quiz.questions.length,
    question:quiz.questions[quiz.qIndex]?{text:quiz.questions[quiz.qIndex].text,opts:quiz.questions[quiz.qIndex].opts}:null,
    buzzedSlot:quiz.buzzedSlot, secondChanceSlot:quiz.secondChanceSlot, firstWrongAns:quiz.firstWrongAns,
    ...extra,
  };
}
function qBcast(d){bcast(quiz.players,d);}
function qSend(ws,d){wsend(ws,d);}

function qStart() {
  if(quiz.qIndex>=quiz.questions.length){qEnd();return;}
  quiz.phase='QUESTION'; quiz.buzzedSlot=-1; quiz.secondChanceSlot=-1; quiz.firstWrongAns=-1;
  quiz.questionStartTime=Date.now();
  qBcast({...qSnap(),timerSeconds:15});
  clearTimeout(quiz.timer);
  quiz.timer=setTimeout(()=>{if(quiz.phase==='QUESTION')qReveal(-1,-1);},15000);
}

function qReveal(answererSlot,selectedIndex,isSecondChance=false) {
  clearTimeout(quiz.timer);
  const q=quiz.questions[quiz.qIndex];
  const correct=selectedIndex>=0&&selectedIndex===q.ans;
  let pts=0,streakBonus=false,timeBonus=false;
  if(correct&&answererSlot>=0){
    pts=isSecondChance?1:2;
    quiz.streaks[answererSlot]++;
    if(quiz.streaks[answererSlot]>0&&quiz.streaks[answererSlot]%3===0){pts++;streakBonus=true;}
    const elapsed=Date.now()-quiz.questionStartTime;
    if(!isSecondChance&&elapsed<5000){pts++;timeBonus=true;}
    quiz.players[answererSlot].score+=pts;
  }else if(answererSlot>=0&&!correct){quiz.streaks[answererSlot]=0;}
  quiz.phase='REVEAL';
  qBcast({...qSnap(),reveal:{correct:q.ans,selected:selectedIndex,isCorrect:correct,answererSlot,isSecondChance,pts,streakBonus,timeBonus,firstWrongAns:quiz.firstWrongAns}});
  quiz.qIndex++;
  quiz.timer=setTimeout(qStart,3000);
}

function qWrong(wrongSlot,selectedIndex) {
  quiz.streaks[wrongSlot]=0; quiz.firstWrongAns=selectedIndex;
  if(quiz.players.length===2){
    const other=wrongSlot===0?1:0;
    quiz.phase='SECOND_CHANCE'; quiz.secondChanceSlot=other;
    qBcast({...qSnap(),timerSeconds:5});
    clearTimeout(quiz.timer);
    quiz.timer=setTimeout(()=>{if(quiz.phase==='SECOND_CHANCE')qReveal(-1,-1);},5000);
  }else qReveal(-1,-1);
}

function qEnd() {
  clearTimeout(quiz.timer); quiz.phase='GAME_OVER';
  let win=-1;
  if(quiz.players.length===2){
    if(quiz.players[0].score>quiz.players[1].score)win=0;
    else if(quiz.players[1].score>quiz.players[0].score)win=1;
  }
  if(win>=0)quiz.wins[win]++;
  qBcast({...qSnap(),winnerSlot:win,wins:[...quiz.wins]});
}

wssQuiz.on('connection',ws=>{
  makeWS(wssQuiz).alive(ws);
  ws.on('close',()=>{
    makeWS(wssQuiz).clear(ws);
    const idx=quiz.players.findIndex(p=>p.ws===ws);if(idx<0)return;
    const name=quiz.players[idx].name;
    quiz.players.splice(idx,1);quiz.players.forEach((p,i)=>p.slot=i);
    clearTimeout(quiz.timer);quiz.phase='WAITING';quiz.streaks=[0,0];
    qBcast({type:'player_left',name});
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    switch(d.type){
      case 'join':{
        if(quiz.players.length>=2){qSend(ws,{type:'error',msg:'Partie pleine.'});return;}
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot=quiz.players.length;
        quiz.players.push({ws,name,score:0,slot,jokers:{fifty:true,pass:true}});
        qSend(ws,{type:'welcome',slot,name});
        if(quiz.players.length===2){quiz.phase='SETUP';qBcast(qSnap());}
        else qSend(ws,qSnap());
        break;
      }
      case 'start':{
        const p=quiz.players.find(x=>x.ws===ws);if(!p||p.slot!==0)return;
        if(!['SETUP','GAME_OVER'].includes(quiz.phase))return;
        const cats=Array.isArray(d.categories)&&d.categories.length?new Set(d.categories):null;
        const diff=Number(d.difficulty)||0;
        const count=Number(d.count)||15;
        let pool=ALL_Q.filter(q=>{if(cats&&!cats.has(q.cat))return false;if(diff>0&&q.diff>diff)return false;return true;});
        if(Array.isArray(d.custom)&&d.custom.length)d.custom.forEach(cq=>{if(cq.text&&Array.isArray(cq.opts)&&cq.opts.length===4&&cq.ans>=0&&cq.ans<=3)pool.push({...cq,cat:'custom',diff:2});});
        if(!pool.length){qSend(ws,{type:'error',msg:'Aucune question avec ces filtres.'});return;}
        quiz.players.forEach(x=>{x.score=0;x.jokers={fifty:true,pass:true};});
        quiz.streaks=[0,0];
        quiz.questions=shuffle(pool).slice(0,Math.min(count,pool.length));quiz.qIndex=0;
        quiz.phase='COUNTDOWN';qBcast({type:'countdown',seconds:3});
        clearTimeout(quiz.timer);quiz.timer=setTimeout(qStart,3000);
        break;
      }
      case 'buzz':{
        if(quiz.phase!=='QUESTION')return;
        const p=quiz.players.find(x=>x.ws===ws);if(!p)return;
        clearTimeout(quiz.timer);quiz.phase='BUZZED';quiz.buzzedSlot=p.slot;
        qBcast({...qSnap(),timerSeconds:10});
        quiz.timer=setTimeout(()=>{if(quiz.phase==='BUZZED')qWrong(p.slot,-1);},10000);
        break;
      }
      case 'answer':{
        const p=quiz.players.find(x=>x.ws===ws);if(!p)return;
        const idx=Number(d.index);if(idx<0||idx>3)return;
        if(quiz.phase==='BUZZED'&&p.slot===quiz.buzzedSlot){
          if(idx===quiz.questions[quiz.qIndex].ans)qReveal(p.slot,idx,false);
          else qWrong(p.slot,idx);
        }else if(quiz.phase==='SECOND_CHANCE'&&p.slot===quiz.secondChanceSlot){
          qReveal(p.slot,idx,true);
        }
        break;
      }
      case 'joker':{
        const p=quiz.players.find(x=>x.ws===ws);if(!p)return;
        if(d.kind==='fifty'&&p.jokers.fifty&&quiz.phase==='QUESTION'){
          p.jokers.fifty=false;
          const q=quiz.questions[quiz.qIndex];
          const wrongs=[];for(let i=0;i<4;i++)if(i!==q.ans)wrongs.push(i);
          const hide=shuffle(wrongs).slice(0,2);
          qBcast({...qSnap(),joker50:{hide}});
        }else if(d.kind==='pass'&&p.jokers.pass&&quiz.phase==='QUESTION'){
          p.jokers.pass=false;
          clearTimeout(quiz.timer);
          qBcast({...qSnap(),jokerPass:{by:p.name}});
          quiz.qIndex++;
          quiz.timer=setTimeout(qStart,1500);
        }
        break;
      }
      case 'restart':{
        const p=quiz.players.find(x=>x.ws===ws);if(!p||quiz.phase!=='GAME_OVER')return;
        quiz.phase='SETUP';qBcast(qSnap());
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

const draw={
  players:[],phase:'WAITING',drawerSlot:0,round:0,maxRounds:6,
  word:null,scores:[0,0],timer:null,guessedBy:-1,
  strokeBatches:[],revealedLetters:[],
};

function dSnap(extra={}){
  return{type:'draw_state',phase:draw.phase,players:draw.players.map(p=>({name:p.name,slot:p.slot})),
    scores:[...draw.scores],drawerSlot:draw.drawerSlot,round:draw.round,maxRounds:draw.maxRounds,
    letterCount:draw.word?draw.word.length:0,hint:draw.word?buildHint(draw.word,draw.revealedLetters):null,
    guessedBy:draw.guessedBy,...extra};
}
function dBcast(d){bcast(draw.players,d);}
function dSend(ws,d){wsend(ws,d);}

function dStartRound(){
  if(draw.round>=draw.maxRounds){dEnd();return;}
  draw.round++;draw.drawerSlot=(draw.round-1)%2;
  const allWords=Object.values(DRAW_WORDS).flat();
  draw.word=shuffle(allWords)[0];
  draw.phase='DRAWING';draw.guessedBy=-1;draw.strokeBatches=[];draw.revealedLetters=[];
  const base=dSnap({timerSeconds:60});
  const drawer=draw.players[draw.drawerSlot];
  const guesser=draw.players[draw.drawerSlot===0?1:0];
  if(drawer)dSend(drawer.ws,{...base,word:draw.word});
  if(guesser)dSend(guesser.ws,base);
  clearTimeout(draw.timer);
  draw.timer=setTimeout(()=>{if(draw.phase==='DRAWING')dReveal(false);},60000);
}

function dReveal(){
  clearTimeout(draw.timer);draw.phase='REVEAL';
  dBcast({...dSnap({revealWord:draw.word}),guessedBy:draw.guessedBy});
  draw.timer=setTimeout(()=>{if(draw.players.length===2)dStartRound();},4000);
}

function dEnd(){
  clearTimeout(draw.timer);draw.phase='GAME_OVER';
  const win=draw.scores[0]>draw.scores[1]?0:draw.scores[1]>draw.scores[0]?1:-1;
  dBcast({...dSnap(),winnerSlot:win});
}

wssDraw.on('connection',ws=>{
  makeWS(wssDraw).alive(ws);
  ws.on('close',()=>{
    makeWS(wssDraw).clear(ws);
    const idx=draw.players.findIndex(p=>p.ws===ws);if(idx<0)return;
    const name=draw.players[idx].name;
    draw.players.splice(idx,1);draw.players.forEach((p,i)=>p.slot=i);
    clearTimeout(draw.timer);draw.phase='WAITING';draw.scores=[0,0];draw.round=0;
    dBcast({type:'player_left',name});
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    const player=draw.players.find(p=>p.ws===ws);
    switch(d.type){
      case 'join_draw':{
        if(draw.players.length>=2){dSend(ws,{type:'error',msg:'Partie pleine.'});return;}
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot=draw.players.length;
        draw.players.push({ws,name,slot});
        dSend(ws,{type:'welcome_draw',slot,name});
        if(draw.players.length===2){draw.phase='READY';draw.scores=[0,0];draw.round=0;dBcast(dSnap());}
        else dSend(ws,dSnap());
        break;
      }
      case 'start_draw':{
        if(!player||player.slot!==0)return;
        if(!['READY','GAME_OVER'].includes(draw.phase))return;
        if(d.rounds)draw.maxRounds=Math.min(18,Math.max(2,Number(d.rounds)));
        draw.scores=[0,0];draw.round=0;dStartRound();
        break;
      }
      case 'draw_pts':{
        if(!player||player.slot!==draw.drawerSlot||draw.phase!=='DRAWING')return;
        draw.strokeBatches.push(d.pts);
        const guesser=draw.players[draw.drawerSlot===0?1:0];
        if(guesser)dSend(guesser.ws,{type:'draw_pts',pts:d.pts});
        break;
      }
      case 'draw_undo':{
        if(!player||player.slot!==draw.drawerSlot)return;
        if(draw.strokeBatches.length>0)draw.strokeBatches.pop();
        const guesser=draw.players[draw.drawerSlot===0?1:0];
        if(guesser)dSend(guesser.ws,{type:'draw_replay',batches:draw.strokeBatches});
        break;
      }
      case 'draw_clear':{
        if(!player||player.slot!==draw.drawerSlot)return;
        draw.strokeBatches=[];dBcast({type:'draw_clear'});
        break;
      }
      case 'draw_hint':{
        if(!player||player.slot!==draw.drawerSlot||draw.phase!=='DRAWING')return;
        const word=draw.word;
        const unrevealed=[];
        for(let i=0;i<word.length;i++){if(word[i]===' '||word[i]==='-')continue;if(!draw.revealedLetters.includes(i))unrevealed.push(i);}
        if(!unrevealed.length)return;
        const pos=unrevealed[Math.floor(Math.random()*unrevealed.length)];
        draw.revealedLetters.push(pos);
        draw.scores[draw.drawerSlot]=Math.max(0,draw.scores[draw.drawerSlot]-1);
        const hint=buildHint(word,draw.revealedLetters);
        const guesser=draw.players[draw.drawerSlot===0?1:0];
        if(guesser)dSend(guesser.ws,{type:'draw_hint_update',hint,scores:[...draw.scores]});
        dSend(player.ws,{type:'draw_scores_update',scores:[...draw.scores]});
        break;
      }
      case 'guess':{
        if(!player||player.slot===draw.drawerSlot||draw.phase!=='DRAWING')return;
        const guess=String(d.word||'').trim().slice(0,60);if(!guess)return;
        const result=drawClose(guess,draw.word);
        dBcast({type:'guess_result',name:player.name,word:guess,result});
        if(result==='correct'){
          draw.scores[player.slot]+=2;draw.scores[draw.drawerSlot]+=1;
          draw.guessedBy=player.slot;dReveal();
        }
        break;
      }
      case 'restart_draw':{
        if(!player||draw.phase!=='GAME_OVER')return;
        draw.phase='READY';draw.scores=[0,0];draw.round=0;dBcast(dSnap());
        break;
      }
    }
  });
});

// ════════════════════════════════════════════════════════
//  PUISSANCE 4
// ════════════════════════════════════════════════════════

const p4={players:[],phase:'WAITING',board:null,turn:0,wins:[0,0],timer:null};
function p4Board(){return Array(6).fill(null).map(()=>Array(7).fill(0));}
function p4Snap(extra={}){return{type:'p4_state',phase:p4.phase,players:p4.players.map(p=>({name:p.name,slot:p.slot})),board:p4.board,turn:p4.turn,wins:[...p4.wins],...extra};}
function p4Bcast(d){bcast(p4.players,d);}

function p4CheckWin(board,v){
  for(let r=0;r<6;r++)for(let c=0;c<4;c++)if(board[r][c]===v&&board[r][c+1]===v&&board[r][c+2]===v&&board[r][c+3]===v)return[[r,c],[r,c+1],[r,c+2],[r,c+3]];
  for(let r=0;r<3;r++)for(let c=0;c<7;c++)if(board[r][c]===v&&board[r+1][c]===v&&board[r+2][c]===v&&board[r+3][c]===v)return[[r,c],[r+1,c],[r+2,c],[r+3,c]];
  for(let r=3;r<6;r++)for(let c=0;c<4;c++)if(board[r][c]===v&&board[r-1][c+1]===v&&board[r-2][c+2]===v&&board[r-3][c+3]===v)return[[r,c],[r-1,c+1],[r-2,c+2],[r-3,c+3]];
  for(let r=0;r<3;r++)for(let c=0;c<4;c++)if(board[r][c]===v&&board[r+1][c+1]===v&&board[r+2][c+2]===v&&board[r+3][c+3]===v)return[[r,c],[r+1,c+1],[r+2,c+2],[r+3,c+3]];
  return null;
}

wssP4.on('connection',ws=>{
  makeWS(wssP4).alive(ws);
  ws.on('close',()=>{
    makeWS(wssP4).clear(ws);
    const idx=p4.players.findIndex(p=>p.ws===ws);if(idx<0)return;
    const name=p4.players[idx].name;
    p4.players.splice(idx,1);p4.players.forEach((p,i)=>p.slot=i);
    p4.phase='WAITING';p4Bcast({type:'player_left',name});
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    const player=p4.players.find(p=>p.ws===ws);
    switch(d.type){
      case 'join_p4':{
        if(p4.players.length>=2){wsend(ws,{type:'error',msg:'Partie pleine.'});return;}
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot=p4.players.length;p4.players.push({ws,name,slot});
        wsend(ws,{type:'welcome_p4',slot,name});
        if(p4.players.length===2){p4.phase='READY';p4Bcast(p4Snap());}
        else wsend(ws,p4Snap());
        break;
      }
      case 'start_p4':{
        if(!player||player.slot!==0||!['READY','GAME_OVER'].includes(p4.phase))return;
        p4.board=p4Board();p4.turn=0;p4.phase='PLAYING';p4Bcast(p4Snap());
        break;
      }
      case 'drop':{
        if(!player||p4.phase!=='PLAYING'||player.slot!==p4.turn)return;
        const col=Number(d.col);if(col<0||col>6)return;
        let row=-1;
        for(let r=5;r>=0;r--){if(p4.board[r][col]===0){p4.board[r][col]=player.slot+1;row=r;break;}}
        if(row<0)return;
        const winLine=p4CheckWin(p4.board,player.slot+1);
        const isDraw=!winLine&&p4.board[0].every(c=>c!==0);
        if(winLine){
          p4.wins[player.slot]++;p4.phase='GAME_OVER';
          p4Bcast({...p4Snap(),winLine,winnerSlot:player.slot});
        }else if(isDraw){
          p4.phase='GAME_OVER';p4Bcast({...p4Snap(),isDraw:true,winnerSlot:-1});
        }else{
          p4.turn=p4.turn===0?1:0;p4Bcast(p4Snap());
        }
        break;
      }
      case 'restart_p4':{
        if(!player||p4.phase!=='GAME_OVER')return;
        p4.board=p4Board();p4.turn=0;p4.phase='PLAYING';p4Bcast(p4Snap());
        break;
      }
    }
  });
});

// ════════════════════════════════════════════════════════
//  MORPION
// ════════════════════════════════════════════════════════

const morpion={players:[],phase:'WAITING',board:Array(9).fill(0),turn:0,wins:[0,0],draws:0,gameWins:5,timer:null};
const MORPION_LINES=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function mSnap(extra={}){return{type:'morpion_state',phase:morpion.phase,players:morpion.players.map(p=>({name:p.name,slot:p.slot})),board:[...morpion.board],turn:morpion.turn,wins:[...morpion.wins],draws:morpion.draws,gameWins:morpion.gameWins,...extra};}
function mBcast(d){bcast(morpion.players,d);}

wssMorpion.on('connection',ws=>{
  makeWS(wssMorpion).alive(ws);
  ws.on('close',()=>{
    makeWS(wssMorpion).clear(ws);
    const idx=morpion.players.findIndex(p=>p.ws===ws);if(idx<0)return;
    const name=morpion.players[idx].name;
    morpion.players.splice(idx,1);morpion.players.forEach((p,i)=>p.slot=i);
    morpion.phase='WAITING';mBcast({type:'player_left',name});
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    const player=morpion.players.find(p=>p.ws===ws);
    switch(d.type){
      case 'join_morpion':{
        if(morpion.players.length>=2){wsend(ws,{type:'error',msg:'Partie pleine.'});return;}
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot=morpion.players.length;morpion.players.push({ws,name,slot});
        wsend(ws,{type:'welcome_morpion',slot,name});
        if(morpion.players.length===2){morpion.phase='READY';mBcast(mSnap());}
        else wsend(ws,mSnap());
        break;
      }
      case 'start_morpion':{
        if(!player||player.slot!==0||!['READY','ROUNDOVER'].includes(morpion.phase))return;
        morpion.board=Array(9).fill(0);morpion.phase='PLAYING';
        // Alternate who goes first
        const roundNum=morpion.wins[0]+morpion.wins[1]+morpion.draws;
        morpion.turn=roundNum%2;
        mBcast(mSnap());
        break;
      }
      case 'play':{
        if(!player||morpion.phase!=='PLAYING'||player.slot!==morpion.turn)return;
        const cell=Number(d.cell);if(cell<0||cell>8||morpion.board[cell]!==0)return;
        morpion.board[cell]=player.slot+1;
        const winLine=MORPION_LINES.find(l=>l.every(i=>morpion.board[i]===player.slot+1))||null;
        const isDraw=!winLine&&morpion.board.every(c=>c!==0);
        if(winLine){
          morpion.wins[player.slot]++;
          morpion.phase=morpion.wins[player.slot]>=morpion.gameWins?'GAME_OVER':'ROUNDOVER';
          mBcast({...mSnap(),winLine,winnerSlot:player.slot});
        }else if(isDraw){
          morpion.draws++;morpion.phase='ROUNDOVER';
          mBcast({...mSnap(),isDraw:true});
        }else{
          morpion.turn=morpion.turn===0?1:0;mBcast(mSnap());
        }
        break;
      }
      case 'next_morpion':{
        if(!player||morpion.phase!=='ROUNDOVER')return;
        morpion.board=Array(9).fill(0);morpion.phase='PLAYING';
        morpion.turn=(morpion.wins[0]+morpion.wins[1]+morpion.draws)%2;
        mBcast(mSnap());
        break;
      }
      case 'restart_morpion':{
        if(!player||morpion.phase!=='GAME_OVER')return;
        morpion.board=Array(9).fill(0);morpion.wins=[0,0];morpion.draws=0;
        morpion.phase='PLAYING';morpion.turn=0;mBcast(mSnap());
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
  {word:'FOOTBALL',forbidden:['ballon','sport','équipe','but','terrain']},
  {word:'ORDINATEUR',forbidden:['écran','clavier','internet','programme','souris']},
  {word:'ANNIVERSAIRE',forbidden:['gâteau','bougie','cadeau','fête','âge']},
  {word:'NATATION',forbidden:['eau','piscine','nager','sport','maillot']},
  {text:'word',word:'CUISINE',forbidden:['manger','préparer','repas','four','chef']},
  {word:'SOLEIL',forbidden:['chaud','lumière','jaune','été','rayons']},
  {word:'VOYAGE',forbidden:['partir','tourisme','valise','pays','découvrir']},
];

const taboo={players:[],phase:'WAITING',describerSlot:0,round:0,maxRounds:8,card:null,scores:[0,0],timer:null,usedCards:[]};
function tSnap(extra={}){return{type:'taboo_state',phase:taboo.phase,players:taboo.players.map(p=>({name:p.name,slot:p.slot})),scores:[...taboo.scores],describerSlot:taboo.describerSlot,round:taboo.round,maxRounds:taboo.maxRounds,...extra};}
function tBcast(d){bcast(taboo.players,d);}

function tStartRound(){
  if(taboo.round>=taboo.maxRounds){tEnd();return;}
  taboo.round++;taboo.describerSlot=(taboo.round-1)%2;
  const available=TABOO_CARDS.filter((_,i)=>!taboo.usedCards.includes(i));
  if(!available.length){taboo.usedCards=[];}
  const pool=taboo.usedCards.length?TABOO_CARDS.filter((_,i)=>!taboo.usedCards.includes(i)):TABOO_CARDS;
  const idx=Math.floor(Math.random()*pool.length);
  taboo.card=pool[idx];
  taboo.usedCards.push(TABOO_CARDS.indexOf(taboo.card));
  taboo.phase='PLAYING';
  const describer=taboo.players[taboo.describerSlot];
  const guesser=taboo.players[taboo.describerSlot===0?1:0];
  const base=tSnap({timerSeconds:60,round:taboo.round,maxRounds:taboo.maxRounds});
  if(describer)wsend(describer.ws,{...base,card:{word:taboo.card.word,forbidden:taboo.card.forbidden}});
  if(guesser)wsend(guesser.ws,{...base,wordLen:taboo.card.word.length});
  clearTimeout(taboo.timer);
  taboo.timer=setTimeout(()=>{if(taboo.phase==='PLAYING')tReveal(false);},60000);
}

function tReveal(guessed){
  clearTimeout(taboo.timer);taboo.phase='REVEAL';
  tBcast({...tSnap(),revealWord:taboo.card.word,guessed});
  taboo.timer=setTimeout(()=>{if(taboo.players.length===2)tStartRound();},3500);
}
function tEnd(){clearTimeout(taboo.timer);taboo.phase='GAME_OVER';const win=taboo.scores[0]>taboo.scores[1]?0:taboo.scores[1]>taboo.scores[0]?1:-1;tBcast({...tSnap(),winnerSlot:win});}

wssTaboo.on('connection',ws=>{
  makeWS(wssTaboo).alive(ws);
  ws.on('close',()=>{
    makeWS(wssTaboo).clear(ws);
    const idx=taboo.players.findIndex(p=>p.ws===ws);if(idx<0)return;
    const name=taboo.players[idx].name;
    taboo.players.splice(idx,1);taboo.players.forEach((p,i)=>p.slot=i);
    taboo.phase='WAITING';taboo.scores=[0,0];taboo.round=0;
    tBcast({type:'player_left',name});
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    const player=taboo.players.find(p=>p.ws===ws);
    switch(d.type){
      case 'join_taboo':{
        if(taboo.players.length>=2){wsend(ws,{type:'error',msg:'Partie pleine.'});return;}
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot=taboo.players.length;taboo.players.push({ws,name,slot});
        wsend(ws,{type:'welcome_taboo',slot,name});
        if(taboo.players.length===2){taboo.phase='READY';taboo.scores=[0,0];taboo.round=0;tBcast(tSnap());}
        else wsend(ws,tSnap());
        break;
      }
      case 'start_taboo':{
        if(!player||player.slot!==0||!['READY','GAME_OVER'].includes(taboo.phase))return;
        taboo.scores=[0,0];taboo.round=0;taboo.usedCards=[];tStartRound();
        break;
      }
      case 'guess_taboo':{
        if(!player||player.slot===taboo.describerSlot||taboo.phase!=='PLAYING')return;
        const guess=String(d.word||'').trim().slice(0,60);if(!guess)return;
        const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
        if(norm(guess)===norm(taboo.card.word)){
          taboo.scores[player.slot]+=2;taboo.scores[taboo.describerSlot]+=1;
          tBcast({type:'taboo_correct',guesser:player.name,word:taboo.card.word});
          tReveal(true);
        }else{
          tBcast({type:'taboo_guess',name:player.name,word:guess});
        }
        break;
      }
      case 'grille':{
        // Guesser spotted a forbidden word — penalty for describer
        if(!player||player.slot===taboo.describerSlot||taboo.phase!=='PLAYING')return;
        taboo.scores[taboo.describerSlot]=Math.max(0,taboo.scores[taboo.describerSlot]-1);
        tBcast({type:'taboo_grille',name:player.name,scores:[...taboo.scores]});
        tReveal(false);
        break;
      }
      case 'restart_taboo':{
        if(!player||taboo.phase!=='GAME_OVER')return;
        taboo.scores=[0,0];taboo.round=0;taboo.usedCards=[];taboo.phase='READY';tBcast(tSnap());
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

const emoji={players:[],phase:'WAITING',puzzles:[],qIndex:0,buzzedSlot:-1,scores:[0,0],wins:[0,0],timer:null};
function eSnap(extra={}){return{type:'emoji_state',phase:emoji.phase,players:emoji.players.map(p=>({name:p.name,slot:p.slot})),scores:[...emoji.scores],wins:[...emoji.wins],buzzedSlot:emoji.buzzedSlot,qIndex:emoji.qIndex,total:emoji.puzzles.length,puzzle:emoji.puzzles[emoji.qIndex]?{emojis:emoji.puzzles[emoji.qIndex].emojis,cat:emoji.puzzles[emoji.qIndex].cat}:null,...extra};}
function eBcast(d){bcast(emoji.players,d);}

function eStartQ(){
  if(emoji.qIndex>=emoji.puzzles.length){eEnd();return;}
  emoji.phase='QUESTION';emoji.buzzedSlot=-1;
  eBcast({...eSnap(),timerSeconds:20});
  clearTimeout(emoji.timer);
  emoji.timer=setTimeout(()=>{if(emoji.phase==='QUESTION')eReveal(-1,'');},20000);
}
function eReveal(slot,text){
  clearTimeout(emoji.timer);
  const p=emoji.puzzles[emoji.qIndex];
  const correct=slot>=0&&emojiNorm(text)===emojiNorm(p.answer);
  if(correct){emoji.scores[slot]+=2;}
  emoji.phase='REVEAL';
  eBcast({...eSnap(),reveal:{answer:p.answer,isCorrect:correct,answererSlot:slot,answeredText:text}});
  emoji.qIndex++;emoji.timer=setTimeout(eStartQ,3000);
}
function eEnd(){clearTimeout(emoji.timer);emoji.phase='GAME_OVER';const win=emoji.scores[0]>emoji.scores[1]?0:emoji.scores[1]>emoji.scores[0]?1:-1;if(win>=0)emoji.wins[win]++;eBcast({...eSnap(),winnerSlot:win});}

wssEmoji.on('connection',ws=>{
  makeWS(wssEmoji).alive(ws);
  ws.on('close',()=>{
    makeWS(wssEmoji).clear(ws);
    const idx=emoji.players.findIndex(p=>p.ws===ws);if(idx<0)return;
    const name=emoji.players[idx].name;
    emoji.players.splice(idx,1);emoji.players.forEach((p,i)=>p.slot=i);
    emoji.phase='WAITING';eBcast({type:'player_left',name});
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    const player=emoji.players.find(p=>p.ws===ws);
    switch(d.type){
      case 'join_emoji':{
        if(emoji.players.length>=2){wsend(ws,{type:'error',msg:'Partie pleine.'});return;}
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot=emoji.players.length;emoji.players.push({ws,name,slot});
        wsend(ws,{type:'welcome_emoji',slot,name});
        if(emoji.players.length===2){emoji.phase='READY';emoji.scores=[0,0];eBcast(eSnap());}
        else wsend(ws,eSnap());
        break;
      }
      case 'start_emoji':{
        if(!player||player.slot!==0||!['READY','GAME_OVER'].includes(emoji.phase))return;
        emoji.scores=[0,0];emoji.qIndex=0;
        emoji.puzzles=shuffle(EMOJI_PUZZLES).slice(0,Math.min(15,EMOJI_PUZZLES.length));
        emoji.phase='COUNTDOWN';eBcast({type:'countdown',seconds:3});
        clearTimeout(emoji.timer);emoji.timer=setTimeout(eStartQ,3000);
        break;
      }
      case 'buzz_emoji':{
        if(emoji.phase!=='QUESTION')return;
        if(!player)return;
        clearTimeout(emoji.timer);emoji.phase='BUZZED';emoji.buzzedSlot=player.slot;
        eBcast({...eSnap(),timerSeconds:15});
        emoji.timer=setTimeout(()=>{if(emoji.phase==='BUZZED')eReveal(player.slot,'');},15000);
        break;
      }
      case 'answer_emoji':{
        if(emoji.phase!=='BUZZED'||!player||player.slot!==emoji.buzzedSlot)return;
        eReveal(player.slot,String(d.text||'').trim());
        break;
      }
      case 'restart_emoji':{
        if(!player||emoji.phase!=='GAME_OVER')return;
        emoji.scores=[0,0];emoji.phase='READY';eBcast(eSnap());
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

const verite={players:[],phase:'WAITING',turn:0,turnNum:0,maxTurns:20,card:null,scores:[0,0],deck:[],timer:null};
function vSnap(extra={}){return{type:'verite_state',phase:verite.phase,players:verite.players.map(p=>({name:p.name,slot:p.slot})),scores:[...verite.scores],turn:verite.turn,turnNum:verite.turnNum,maxTurns:verite.maxTurns,card:verite.card,...extra};}
function vBcast(d){bcast(verite.players,d);}

wssVerite.on('connection',ws=>{
  makeWS(wssVerite).alive(ws);
  ws.on('close',()=>{
    makeWS(wssVerite).clear(ws);
    const idx=verite.players.findIndex(p=>p.ws===ws);if(idx<0)return;
    const name=verite.players[idx].name;
    verite.players.splice(idx,1);verite.players.forEach((p,i)=>p.slot=i);
    verite.phase='WAITING';vBcast({type:'player_left',name});
  });
  ws.on('message',raw=>{
    let d;try{d=JSON.parse(raw);}catch{return;}
    const player=verite.players.find(p=>p.ws===ws);
    switch(d.type){
      case 'join_verite':{
        if(verite.players.length>=2){wsend(ws,{type:'error',msg:'Partie pleine.'});return;}
        const name=String(d.name||'').trim().slice(0,20)||'Joueur';
        const slot=verite.players.length;verite.players.push({ws,name,slot});
        wsend(ws,{type:'welcome_verite',slot,name});
        if(verite.players.length===2){verite.phase='READY';verite.scores=[0,0];verite.deck=shuffle([...VERITE_CARTES]);vBcast(vSnap());}
        else wsend(ws,vSnap());
        break;
      }
      case 'start_verite':{
        if(!player||player.slot!==0||!['READY','GAME_OVER'].includes(verite.phase))return;
        verite.scores=[0,0];verite.turn=0;verite.turnNum=0;verite.card=null;
        verite.deck=shuffle([...VERITE_CARTES]);
        verite.phase='CHOOSING';vBcast(vSnap());
        break;
      }
      case 'choose':{
        if(!player||player.slot!==verite.turn||verite.phase!=='CHOOSING')return;
        const cat=d.choice; // 'verite'|'defi'|'random'
        const pool=verite.deck.filter(c=>cat==='random'?true:c.type===cat);
        const cards=pool.length?pool:verite.deck;
        verite.card=cards[Math.floor(Math.random()*cards.length)];
        verite.phase='CARD';vBcast(vSnap());
        break;
      }
      case 'done':{
        if(!player||player.slot!==verite.turn||verite.phase!=='CARD')return;
        if(d.completed)verite.scores[verite.turn]+=1;
        verite.turnNum++;
        if(verite.turnNum>=verite.maxTurns){verite.phase='GAME_OVER';const win=verite.scores[0]>verite.scores[1]?0:verite.scores[1]>verite.scores[0]?1:-1;vBcast({...vSnap(),winnerSlot:win});}
        else{verite.turn=verite.turn===0?1:0;verite.card=null;verite.phase='CHOOSING';vBcast(vSnap());}
        break;
      }
      case 'restart_verite':{
        if(!player||verite.phase!=='GAME_OVER')return;
        verite.scores=[0,0];verite.turn=0;verite.turnNum=0;verite.card=null;
        verite.deck=shuffle([...VERITE_CARTES]);verite.phase='CHOOSING';vBcast(vSnap());
        break;
      }
    }
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT,'0.0.0.0',()=>{
  const ip=getLocalIP();
  console.log('\n╔══════════════════════════════════╗');
  console.log('║    Quiz Duo v3.0 — 7 jeux !      ║');
  console.log('╠══════════════════════════════════╣');
  console.log(`║  PC  : http://localhost:${PORT}   ║`);
  console.log(`║  Tel : http://${ip}:${PORT}║`);
  console.log('╚══════════════════════════════════╝\n');
});
