/**
 * ZapPlay — barre unifiée, règles, titre d’onglet, overlay fin, préférences son (effets de jeu uniquement).
 * Requiert : theme.css (variables), zp-shell.css, shared.js (ZapPlay), data-zp-game sur <html>
 */
(function () {
  'use strict';

  function ensureShellCriticalCss() {
    if (document.getElementById('zp-shell-critical-css')) return;
    const s = document.createElement('style');
    s.id = 'zp-shell-critical-css';
    s.textContent =
      '#zp-nav-global{position:fixed!important;top:0!important;left:0!important;right:0!important;' +
      'z-index:2147483000!important;pointer-events:none!important;box-sizing:border-box!important;' +
      'background:linear-gradient(180deg,rgba(3,3,18,.96),rgba(3,3,18,.55) 70%,transparent)!important;}' +
      '#zp-nav-global .zp-nav-global-inner{pointer-events:auto!important;}';
    (document.head || document.documentElement).appendChild(s);
  }

  const GAME_META = {
    home: {
      title: 'Accueil',
      rules: [
        'Choisis un jeu sur la grille puis crée une salle ou rejoins avec un code.',
        'Le lobby affiche les parties en cours ; invite tes amis avec le lien.',
        'Crée un compte pour l’historique et les badges sur tous tes appareils.'
      ]
    },
    quiz: {
      title: 'Quiz',
      rules: [
        'Réponds le plus vite possible quand tu peux buzzer.',
        'Bonnes réponses = points ; manche après manche jusqu’à la fin.',
        'L’hôte lance la partie ; spectateurs possibles (pas de buzz).'
      ]
    },
    draw: {
      title: 'Dessin',
      rules: [
        'Un joueur dessine, les autres devinent le mot dans le chat.',
        'Chaque manche change de dessinateur selon les règles de la salle.',
        'Reste fair-play : pas de mots triche dans le dessin.'
      ]
    },
    debat: {
      title: 'Débat express',
      rules: [
        'Deux camps s’affrontent, les autres votent pour le meilleur argument.',
        'Les rôles tournent : tout le monde passe par Pour / Contre / juge.',
        'Respecte le temps de parole affiché à l’écran.'
      ]
    },
    imposteur: {
      title: 'Imposteur',
      rules: [
        'Chacun reçoit un mot secret — sauf l’imposteur, qui a un mot proche.',
        'Décris sans donner le mot ; votez pour éliminer le suspect.',
        'L’imposteur peut tenter de deviner le mot à la fin si besoin.'
      ]
    },
    wordbomb: {
      title: 'Word Bomb',
      rules: [
        'À ton tour, propose un mot français qui contient la syllabe affichée.',
        'Mot invalide ou trop tard = une vie en moins.',
        'Dernier joueur avec des vies gagne la manche.'
      ]
    },
    typer: {
      title: 'Typer Race',
      rules: [
        'Retape le texte affiché le plus vite possible.',
        'Classement à la fin de chaque manche selon l’ordre d’arrivée.',
        'Reste sur le même clavier : pas de copier-coller.'
      ]
    },
    anagramme: {
      title: 'Anagramme',
      rules: [
        'Retrouve le mot caché à partir des lettres mélangées.',
        'Le premier qui trouve marque des points pour la manche.',
        'Réponds en un seul mot valide.'
      ]
    },
    justeprix: {
      title: 'Juste Prix',
      rules: [
        'Chaque joueur propose un nombre pour approcher la vraie réponse.',
        'Plus tu es proche, plus tu marques de points.',
        'Une seule réponse par question : valide avant la fin du chrono.'
      ]
    },
    timeline: {
      title: 'Timeline',
      rules: [
        'Choisis l’événement qui s’est produit le plus tôt parmi les 4.',
        'Bonne réponse = points ; à la fin le plus haut score gagne.',
        'Réfléchis vite : le temps est limité.'
      ]
    },
    memoire: {
      title: 'Mémoire',
      rules: [
        'Retourne deux cartes pour former des paires identiques.',
        'À chaque paire trouvée, tu marques un point ; sinon c’est au suivant.',
        'Le joueur avec le plus de paires à la fin gagne.'
      ]
    },
    taboo: {
      title: 'Mots interdits',
      rules: [
        'Le descripteur fait deviner un mot sans dire les mots interdits.',
        'Les autres proposent des réponses ; « Grille » si le descripteur triche.',
        'Les scores s’affichent en haut à chaque manche.'
      ]
    },
    p4: {
      title: 'Puissance 4',
      rules: [
        'Aligne 4 jetons de ta couleur verticalement, horizontalement ou en diagonale.',
        'Chaque joueur joue à tour de rôle en choisissant une colonne.',
        'La partie peut se terminer par une manche ou un match au choix de l’hôte.'
      ]
    },
    morpion: {
      title: 'Morpion',
      rules: [
        'Aligne 3 symboles sur la grille pour gagner la manche.',
        'Match en plusieurs manches : le score s’affiche en haut.',
        'Joue quand c’est ton tour.'
      ]
    },
    emoji: {
      title: 'Devinette emoji',
      rules: [
        'Devine le mot ou la phrase à partir des émojis affichés.',
        'Réponds dans le temps imparti pour marquer des points.',
        'Le plus rapide et le plus juste l’emporte.'
      ]
    },
    loup: {
      title: 'Loup-Garou',
      rules: [
        'Chaque rôle a un objectif : village ou loups.',
        'Suis les phases jour/nuit et vote avec ta faction.',
        'Ne révèle pas ton rôle si les règles de la table l’interdisent.'
      ]
    },
    uno: {
      title: 'Uno',
      rules: [
        'Joue une carte de la même couleur ou du même numéro que la pile.',
        'Cartes spéciales : changement de sens, +2, etc.',
        'Crie « Uno » quand il te reste une carte.'
      ]
    },
    sumo: {
      title: 'Sumo Arena',
      rules: [
        'Pousse tes adversaires hors du ring pour les éliminer.',
        'Dernier sur l’arène remporte la manche.',
        'Utilise les boosts avec parcimonie.'
      ]
    },
    paint: {
      title: 'Paint.io',
      rules: [
        'Occupe le terrain avec ta couleur en fermant des zones.',
        'Évite les collisions avec les autres joueurs selon les règles du mode.',
        'Le plus grand territoire gagne.'
      ]
    },
    naval: {
      title: 'Bataille navale',
      rules: [
        'Place tes bateaux puis tire sur la grille adverse.',
        'Coule tous les navires ennemis pour gagner.',
        'Un tir par tour : viser juste.'
      ]
    },
    skyline: {
      title: 'Skyline',
      rules: [
        'Type Stack Tower : le bloc rebondit en haut — clic ou Espace pour le lâcher. Mal aligné il se coupe ; complètement à côté c’est la chute (fin du tour).',
        'Prévisualisation 3D à côté du terrain : tu vois la tour grandir étage par étage. À chaque manche : objectif d’étages et bonus si tu l’atteins ; la vitesse augmente.',
        'À la fin du temps (ou après la chute), ton meilleur score d’étages part au serveur. Le plus de points gagne la partie.'
      ]
    },
    lobby: {
      title: 'Lobby',
      rules: [
        'Crée une salle ou rejoins avec un code à 4 caractères.',
        'Filtre par jeu ou par statut pour trouver une partie.',
        'Le ping affiché est indicatif de la latence vers le serveur.'
      ]
    },
    account: {
      title: 'Compte',
      rules: [
        'Crée un compte pour sauvegarder ton pseudo et ton historique.',
        'Tu peux te connecter sur un autre appareil avec les mêmes identifiants.',
        'Les badges reflètent ton activité sur ZapPlay.'
      ]
    },
    admin: {
      title: 'Admin',
      rules: [
        'Réservé aux opérateurs : mot de passe requis.',
        'Tu peux consulter les stats et options de configuration.',
        'Ne partage jamais le mot de passe admin.'
      ]
    },
    default: {
      title: 'ZapPlay',
      rules: [
        'Crée ou rejoins une salle avec un code.',
        'Respecte les autres joueurs dans le chat.',
        'Amuse-toi et relance une partie quand tu veux.'
      ]
    }
  };

  let baseTitle = '';

  function getGameKey() {
    return (document.documentElement.getAttribute('data-zp-game') || 'default').trim() || 'default';
  }

  function getMeta() {
    const k = getGameKey();
    return GAME_META[k] || GAME_META.default;
  }

  function isSoundMuted() {
    try {
      return localStorage.getItem('zapplay_sound_muted') === '1';
    } catch {
      return false;
    }
  }

  function setSoundMuted(v) {
    try {
      if (v) localStorage.setItem('zapplay_sound_muted', '1');
      else localStorage.removeItem('zapplay_sound_muted');
    } catch (_) {}
    updateMuteButton();
  }

  function updateMuteButton() {
    const btn = document.getElementById('zp-nav-sound');
    if (!btn) return;
    const muted = isSoundMuted();
    btn.classList.toggle('muted', muted);
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    btn.title = muted
      ? 'Effets sonores désactivés (cliquer pour activer)'
      : 'Effets sonores activés (cliquer pour couper)';
    btn.textContent = muted ? '🔇' : '🔊';
  }

  function setDocumentTitle(extra) {
    const meta = getMeta();
    const game = meta.title || 'ZapPlay';
    if (!extra) {
      document.title = 'ZapPlay — ' + game;
      return;
    }
    document.title = 'ZapPlay · ' + game + ' — ' + extra;
  }

  function injectNav() {
    if (document.getElementById('zp-nav-global')) return;
    /* Accueil : barre locale riche (Lobby, Jeux, compte) dans index.html — pas de doublon */
    if (getGameKey() === 'home') return;
    const nav = document.createElement('header');
    nav.id = 'zp-nav-global';
    nav.className = 'zp-nav-global';
    nav.setAttribute('role', 'navigation');
    /* Secours si zp-shell.css est en retard ou bloqué : la barre reste au premier plan */
    nav.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:2147483000;pointer-events:none;';
    nav.innerHTML =
      '<div class="zp-nav-global-inner">' +
      '<a class="zp-nav-global-back" href="/lobby.html" id="zp-nav-back-lobby" title="Lobby des salons">← Lobby</a>' +
      '<a class="zp-nav-global-brand" href="/index.html">ZapPlay</a>' +
      '<nav class="zp-nav-global-links" aria-label="Liens">' +
      '<a href="/index.html">Accueil</a>' +
      '<a href="/lobby.html">Salons</a>' +
      '<a href="/account.html" id="zp-nav-global-account-link">Compte</a>' +
      '</nav>' +
      '<span id="zp-nav-account-chip" class="zp-nav-account-chip" hidden></span>' +
      '<div class="zp-nav-global-actions">' +
      (typeof Notification !== 'undefined'
        ? '<button type="button" class="zp-nav-global-icon" id="zp-nav-notify" title="Notifications navigateur" aria-label="Notifications">🔔</button>'
        : '') +
      '<button type="button" class="zp-nav-global-icon" id="zp-nav-rules" title="Règles du jeu" aria-label="Règles">📖</button>' +
      '<button type="button" class="zp-nav-global-icon" id="zp-nav-sound" title="Effets sonores" aria-label="Effets sonores">🔊</button>' +
      '</div>' +
      '</div>';
    /* Hors de <body> : évite tout empilement / blend bizarre avec body::before */
    document.documentElement.appendChild(nav);
    try {
      nav.scrollIntoView({ block: 'nearest' });
    } catch (_) {}
    document.body.classList.add('zp-has-shell');

    document.getElementById('zp-nav-rules').addEventListener('click', openRules);
    document.getElementById('zp-nav-sound').addEventListener('click', function () {
      setSoundMuted(!isSoundMuted());
    });
    const nbtn = document.getElementById('zp-nav-notify');
    if (nbtn) initNotifyButton(nbtn);
    updateMuteButton();
  }

  function injectHomeNotifyButton() {
    if (typeof Notification === 'undefined') return;
    if (document.getElementById('zp-home-notify')) return;
    const inner = document.querySelector('body.home-page .zp-nav-inner');
    if (!inner) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'zp-home-notify';
    btn.className = 'zp-home-notify-btn';
    btn.setAttribute('aria-label', 'Notifications navigateur');
    btn.title = 'Activer les alertes (parties, salons)';
    btn.textContent = Notification.permission === 'granted' ? '🔔' : '🔕';
    inner.insertBefore(btn, inner.firstChild.nextSibling);
    initNotifyButton(btn);
  }

  function initNotifyButton(btn) {
    function sync() {
      if (!('Notification' in window)) {
        btn.hidden = true;
        return;
      }
      var p = Notification.permission;
      if (p === 'granted') {
        btn.textContent = '🔔';
        btn.classList.add('on');
        btn.title = 'Notifications activées';
      } else if (p === 'denied') {
        btn.hidden = true;
      } else {
        btn.textContent = '🔕';
        btn.classList.remove('on');
        btn.title = 'Activer les alertes (tour, salon…)';
      }
    }
    sync();
    btn.addEventListener('click', function () {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'granted') return;
      Notification.requestPermission().then(function (perm) {
        sync();
        if (perm === 'granted' && window.ZapPlay && typeof window.ZapPlay.notifyIfAllowed === 'function') {
          window.ZapPlay.notifyIfAllowed('ZapPlay', 'Tu recevras des alertes quand une action t’attend (onglet en arrière-plan).');
        }
      });
    });
  }

  function injectRulesPanel() {
    if (document.getElementById('zp-rules-panel')) return;
    const back = document.createElement('div');
    back.id = 'zp-rules-backdrop';
    back.addEventListener('click', closeRules);
    const panel = document.createElement('div');
    panel.id = 'zp-rules-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'zp-rules-title');
    panel.innerHTML =
      '<h2 id="zp-rules-title">Règles</h2>' +
      '<ul id="zp-rules-list"></ul>' +
      '<button type="button" id="zp-rules-close">OK</button>';
    document.body.appendChild(back);
    document.body.appendChild(panel);
    document.getElementById('zp-rules-close').addEventListener('click', closeRules);
  }

  function openRules() {
    injectRulesPanel();
    const meta = getMeta();
    document.getElementById('zp-rules-title').textContent = 'Règles — ' + meta.title;
    const ul = document.getElementById('zp-rules-list');
    ul.innerHTML = '';
    (meta.rules || []).forEach(function (line) {
      const li = document.createElement('li');
      li.textContent = line;
      ul.appendChild(li);
    });
    document.getElementById('zp-rules-backdrop').classList.add('on');
    document.getElementById('zp-rules-panel').classList.add('on');
    var closeBtn = document.getElementById('zp-rules-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeRules() {
    const b = document.getElementById('zp-rules-backdrop');
    const p = document.getElementById('zp-rules-panel');
    if (b) b.classList.remove('on');
    if (p) p.classList.remove('on');
    var rulesBtn = document.getElementById('zp-nav-rules');
    if (rulesBtn) rulesBtn.focus();
  }

  function injectEndOverlay() {
    if (document.getElementById('zp-end-backdrop')) return;
    const el = document.createElement('div');
    el.id = 'zp-end-backdrop';
    el.innerHTML =
      '<div id="zp-end-card">' +
      '<h2 id="zp-end-title">Partie terminée</h2>' +
      '<p id="zp-end-msg"></p>' +
      '<div class="zp-end-actions">' +
      '<button type="button" id="zp-end-primary">Rejouer</button>' +
      '<button type="button" id="zp-end-secondary">Accueil</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(el);
    document.getElementById('zp-end-secondary').addEventListener('click', function () {
      location.href = '/index.html';
    });
  }

  /**
   * @param {{ title?: string, message?: string, onReplay?: function, replayLabel?: string }} opts
   */
  function showGameOver(opts) {
    opts = opts || {};
    injectEndOverlay();
    const title = opts.title || 'Partie terminée';
    const msg = opts.message || '';
    document.getElementById('zp-end-title').textContent = title;
    document.getElementById('zp-end-msg').textContent = msg;
    const primary = document.getElementById('zp-end-primary');
    primary.textContent = opts.replayLabel || 'Rejouer';
    primary.onclick = function () {
      document.getElementById('zp-end-backdrop').classList.remove('on');
      if (typeof opts.onReplay === 'function') opts.onReplay();
    };
    document.getElementById('zp-end-backdrop').classList.add('on');
  }

  function hideGameOver() {
    const el = document.getElementById('zp-end-backdrop');
    if (el) el.classList.remove('on');
  }

  function init() {
    if (document.body.getAttribute('data-zp-no-shell') === '1') return;

    ensureShellCriticalCss();

    if (!document.querySelector('link[href*="Orbitron"]')) {
      const lf = document.createElement('link');
      lf.rel = 'stylesheet';
      lf.href =
        'https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap';
      document.head.appendChild(lf);
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/zp-shell.css';
    if (!document.querySelector('link[href="/zp-shell.css"]')) document.head.appendChild(link);

    baseTitle = document.title;
    setDocumentTitle();

    injectNav();
    initAccountChip();
    if (window.ZapPlay && typeof window.ZapPlay.updateNavAccountUI === 'function') {
      window.ZapPlay.updateNavAccountUI();
    }
    if (getGameKey() === 'home') injectHomeNotifyButton();

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeRules();
    });

    if (window.ZapPlay) {
      window.ZapPlay.isSoundMuted = isSoundMuted;
      window.ZapPlay.setSoundMuted = setSoundMuted;
      window.ZapPlay.setDocumentTitle = setDocumentTitle;
      window.ZapPlay.showGameOver = showGameOver;
      window.ZapPlay.hideGameOver = hideGameOver;
      window.ZapPlay.notifyIfAllowed =
        window.ZapPlay.notifyIfAllowed ||
        function (title, body) {
          try {
            if (!('Notification' in window) || Notification.permission !== 'granted') return;
            new Notification(title || 'ZapPlay', { body: body || '', icon: '/favicon.svg' });
          } catch (_) {}
        };
    }
  }

  function initAccountChip() {
    /* Libellés « Compte / Mon compte » gérés par ZapPlay.updateNavAccountUI() */
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
