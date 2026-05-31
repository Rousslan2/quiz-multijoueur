/* FP_USER — état utilisateur partagé via localStorage */
window.FP_USER = (function () {
  const KEY = 'fp_user';
  const HIST = 'fp_history';
  const ACCTS = 'fp_accounts';
  const DEF = { name: 'Mon Compte', initials: 'FP', balance: 0, tier: 'STANDARD', points: 0, cashback: 0, recharges: 0, saved: 0 };

  function load(k, def) {
    try { const v = JSON.parse(localStorage.getItem(k)); return v !== null ? v : def; } catch { return def; }
  }

  return {
    get() { return Object.assign({}, DEF, load(KEY, {})); },
    save(u) { localStorage.setItem(KEY, JSON.stringify(u)); },
    patch(delta) { const u = Object.assign(this.get(), delta); this.save(u); return u; },
    fmt(v) { return Math.abs(v).toFixed(2).replace('.', ',') + ' €'; },
    updateBalance(amount, note) {
      const u = this.get();
      u.balance = Math.round(((u.balance || 0) + amount) * 100) / 100;
      if (amount > 0) {
        u.recharges = (u.recharges || 0) + 1;
        u.cashback = Math.round(((u.cashback || 0) + amount * 0.08) * 100) / 100;
      }
      if (amount < 0) {
        u.saved = Math.round(((u.saved || 0) + Math.abs(amount)) * 100) / 100;
      }
      this.save(u);
      const hist = load(HIST, []);
      hist.unshift({ date: new Date().toISOString(), note, amount, balance: u.balance });
      localStorage.setItem(HIST, JSON.stringify(hist.slice(0, 80)));
      return u;
    },
    getHistory() { return load(HIST, []); },
    getAccounts() { return load(ACCTS, []); },
    addAccount(a) { const list = this.getAccounts(); list.unshift(a); localStorage.setItem(ACCTS, JSON.stringify(list)); },
    wireNav() {
      const u = this.get();
      const bal = (u.balance || 0).toFixed(2).replace('.', ',') + ' €';
      document.querySelectorAll('.bal b').forEach(el => (el.textContent = bal));
      document.querySelectorAll('a.avatar').forEach(el => (el.textContent = u.initials || 'FP'));
    },
  };
})();

(function () {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => FP_USER.wireNav());
  else FP_USER.wireNav();
})();
