/* FoodPlug — catalogue partagé (tranches de points + prix par enseigne)
   Utilisé par produit.html et admin.html. Les prix édités dans l'admin
   sont persistés dans localStorage et appliqués partout. */
window.FP_CATALOGUE = {
  kfc: {
    name: 'Points KFC', tag: 'KFC · Points', cls: 'kfc', food: 'assets/logos/kfc.png',
    tint: 'rgba(228,0,43,.16)', def: 2,
    desc: "Tu reçois un compte KFC déjà chargé avec les points sélectionnés, livré instantanément. Choisis ta tranche, paie avec ton wallet — le compte arrive prêt à l'emploi en moins de 2 minutes.",
    tr: [['600–799',3.49],['800–999',4.99],['1000–1299',5.99],['1300–1599',7.49],['1600–1799',7.99],['1800–1999',8.99],['2000–2399',10.99]]
  },
  mcdo: {
    name: "Points McDonald's", tag: "McDonald's · Points", cls: 'mcdo', food: 'assets/logos/mcdo.png',
    tint: 'rgba(255,199,44,.15)', def: 4,
    desc: "Tu reçois un compte McDonald's déjà chargé avec les points sélectionnés, livré instantanément. Choisis ta tranche, paie avec ton wallet — le compte arrive prêt à l'emploi en moins de 2 minutes.",
    tr: [['50–74',1.50],['75–99',3.50],['100–124',4.50],['125–149',5.50],['150–174',6.50],['175–199',8.50],['200–249',9.50],['250–299',11.00],['300–349',12.00],['350–399',14.00],['400–499',16.50],['500–599',22.00],['600–699',30.00],['700–899',40.00],['900–1199',52.00],['1200–1399',59.00],['1400–1599',70.00],['1600–1800',76.00],['1800–2100',95.00]]
  },
  otacos: {
    name: "Points O'Tacos", tag: "O'Tacos · Points", cls: 'otacos', food: 'assets/logos/otacos.png',
    tint: 'rgba(255,65,51,.15)', def: 1,
    desc: "Tu reçois un compte O'Tacos déjà chargé avec les points sélectionnés, livré instantanément. Choisis ta tranche, paie avec ton wallet — le compte arrive prêt à l'emploi en moins de 2 minutes.",
    tr: [['74',5.00],['109',7.00],['180',8.00]]
  }
};

window.FP_PRICES = {
  KEY: 'fp_prices',
  load() { try { return JSON.parse(localStorage.getItem(this.KEY) || '{}'); } catch (e) { return {}; } },
  save(o) { try { localStorage.setItem(this.KEY, JSON.stringify(o)); } catch (e) {} },
  // apply persisted overrides onto FP_CATALOGUE prices
  apply() {
    const o = this.load();
    for (const b in o) {
      if (!FP_CATALOGUE[b] || !Array.isArray(o[b])) continue;
      o[b].forEach((p, i) => { if (FP_CATALOGUE[b].tr[i] && typeof p === 'number' && !isNaN(p)) FP_CATALOGUE[b].tr[i][1] = p; });
    }
  },
  reset() { try { localStorage.removeItem(this.KEY); } catch (e) {} }
};
