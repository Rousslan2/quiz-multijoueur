/* FP_AUTH — auth + état utilisateur depuis le serveur */
window.FP_AUTH = (function () {
  let _user = null;

  return {
    user: null,

    /* Initialise la session. redirectIfNotAuth=true → masque la page et redirige vers /login si 401 */
    async init(redirectIfNotAuth = true) {
      if (redirectIfNotAuth) {
        // Masque immédiatement le contenu pour éviter le flash sur pages protégées
        document.documentElement.style.visibility = 'hidden';
      }
      try {
        const r = await fetch('/api/me');
        if (r.status === 401) {
          this.wireNav(null);
          if (redirectIfNotAuth) {
            window.location.href = '/login?next=' + encodeURIComponent(location.pathname);
          } else {
            document.documentElement.style.visibility = '';
          }
          return null;
        }
        const u = await r.json();
        this.user = u;
        _user = u;
        this.wireNav(u);
        document.documentElement.style.visibility = '';
        return u;
      } catch {
        this.wireNav(null);
        if (redirectIfNotAuth) {
          window.location.href = '/login';
        } else {
          document.documentElement.style.visibility = '';
        }
        return null;
      }
    },

    /* Met à jour la nav (balance + avatar) */
    wireNav(u) {
      if (u === undefined) u = this.user;
      const bal = u ? (u.balance || 0).toFixed(2).replace('.', ',') + ' €' : '—';
      const avi = u ? (u.initials || 'FP') : '?';
      document.querySelectorAll('.bal b').forEach(el => (el.textContent = bal));
      document.querySelectorAll('a.avatar').forEach(el => (el.textContent = avi));
    },

    /* Démarre un paiement Stripe — renvoie l'URL de la page de paiement */
    async checkout(amount, bonus) {
      const r = await fetch('/api/me/wallet/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, bonus }) });
      return r.json();
    },

    /* Confirme un paiement Stripe au retour (crédite le wallet côté serveur) */
    async confirmPayment(sessionId) {
      const r = await fetch('/api/me/wallet/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }) });
      return r.json();
    },

    /* Déduit du wallet (achat) */
    async deduct(amount, note) {
      const r = await fetch('/api/me/wallet/deduct', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, note }) });
      return r.json();
    },

    /* Récupère les infos wallet + transactions */
    async getWallet() {
      const r = await fetch('/api/me/wallet');
      if (!r.ok) return null;
      return r.json();
    },

    /* Récupère les comptes achetés */
    async getAccounts() {
      const r = await fetch('/api/me/accounts');
      if (!r.ok) return [];
      return r.json();
    },

    /* Ajoute un compte acheté — retourne { ok, delivery } */
    async addAccount(data) {
      const r = await fetch('/api/me/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      return r.json();
    },

    /* Met à jour le profil */
    async updateName(name) {
      const r = await fetch('/api/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      const data = await r.json();
      if (data.ok && this.user) { this.user.name = data.name; this.user.initials = data.initials; }
      return data;
    },

    /* Déconnexion */
    async logout() {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    },

    /* Formatage montant */
    fmt(v) { return Math.abs(v).toFixed(2).replace('.', ',') + ' €'; },
  };
})();

// Backward compat
window.FP_USER = { get: () => FP_AUTH.user || {}, wireNav: () => FP_AUTH.wireNav(), fmt: v => FP_AUTH.fmt(v) };
