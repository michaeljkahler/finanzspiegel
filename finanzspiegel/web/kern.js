/* ── Finanzspiegel: Kern ─────────────────────────────────────────────────
   Gemeinsam für alle Unterseiten: Daten laden, Formate, Zustand in der Adresse,
   Seitenliste, aufklappbare Abschnitte, Auswahl der Jahre, Baum der Konten,
   Woher und wohin, Entwicklung, Vergleich (Icicle, Ebene, Baum), Prüfhinweise.
   Jede Unterseite trägt in <body data-seite="…" data-daten="…"> ihren Namen und
   die Dateien, die sie braucht; gezeichnet wird nur, was auf der Seite steht. */
const BASIS = document.body.dataset.basis || '';
const SEITE = document.body.dataset.seite || 'start';
const VERSION = document.body.dataset.version || '';
let D = null, DS = [], IDX = {}, JI = {}, KZ = {}, BF = [];
const $ = (s, e) => (e || document).querySelector(s);
const $$ = (s, e) => [...(e || document).querySelectorAll(s)];
const esc = t => String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const farbe = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const rampe = n => farbe(n).split(',').map(s => s.trim());
const tausender = s => { const [g, d] = String(s).split('.'); return g.replace(/\B(?=(\d{3})+(?!\d))/g, "'") + (d !== undefined ? '.' + d : ''); };
const fr = v => { const r = Math.round(v); return (r < 0 ? '−' : '') + tausender(Math.abs(r)); };
const frS = v => { const r = Math.round(v); return (r > 0 ? '+' : r < 0 ? '−' : '±') + tausender(Math.abs(r)); };
const mio = (v, s) => (v < 0 ? '−' : '') + tausender((Math.abs(v) / 1e6).toFixed(s === undefined ? 1 : s));
const mioVz = (v, s) => { const t = (Math.abs(v) / 1e6).toFixed(s === undefined ? 1 : s); return (+t === 0 ? '±' : v > 0 ? '+' : '−') + tausender(t); };
const pct = (d, b) => Math.abs(b) >= 1 ? ((d >= 0 ? '+' : '−') + Math.abs(100 * d / Math.abs(b)).toFixed(1) + ' %') : '';
const kurz = (t, n) => t.length <= n ? t : t.slice(0, Math.max(n - 1, 1)).trimEnd() + '…';
const standText = () => D.stand.split('-').reverse().join('.');
const SLOT = ['A', 'B', 'C'];
const slotFarbe = s => farbe(['--s1', '--s2', '--s3'][s]);
const slotHell = s => farbe(['--s1-hell', '--s2-hell', '--s3-hell'][s]);
function lum(hex){ const h = hex.replace('#', ''); const c = [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
const textAuf = hex => { const L = lum(hex); return (1.05 / (L + .05)) >= ((L + .05) / (lum('#12161C') + .05)) ? '#FFFFFF' : '#12161C'; };
function el(tag, attrs, kids){ const n = document.createElement(tag); if(attrs) for(const [k, v] of Object.entries(attrs)){ if(v === null || v === undefined) continue; if(k === 'text') n.textContent = v; else if(k === 'class') n.className = v; else n.setAttribute(k, v); } (kids || []).forEach(c => c && n.append(c)); return n; }
const ORDENTLICH = g => (g[0] === '3' || g[0] === '4') && !['38', '39', '48', '49'].includes(g);
const norm = t => String(t).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[éèê]/g, 'e').replace(/[àâ]/g, 'a');
const speicher = {
  lies(k){ try{ return window.localStorage.getItem('fs-' + k); }catch(e){ return null; } },
  setze(k, v){ try{ window.localStorage.setItem('fs-' + k, v); }catch(e){} },
};

/* ── Daten laden ─────────────────────────────────────────────────────── */
const GELADEN = {};
function ladeDatei(name){
  if(!GELADEN[name]) GELADEN[name] = fetch(`${BASIS}daten/${name}.json?v=${VERSION}`).then(r => { if(!r.ok) throw new Error(name + ': ' + r.status); return r.json(); });
  return GELADEN[name];
}
function datenSetzen(teile){
  if(teile.kern){
    D = teile.kern;
    DS = D.jahre.concat(D.plan); IDX = Object.fromEntries(DS.map((d, i) => [d.k, i]));
    JI = Object.fromEntries(D.jahre.map((d, i) => [d.k, i]));
    KZ = D.kz;
  }
  if(teile.er) D.z = teile.er.z;
  if(teile.ir){ D.ir = teile.ir.ir; D.irk = teile.ir.irk; D.irp = teile.ir.irp; }
  if(teile.komm) D.komm = teile.komm;
  if(teile.befunde){ D.befunde = teile.befunde.befunde; D.typen = teile.befunde.typen; BF = D.befunde; bfIndex(); }
}

/* ── Datensätze ──────────────────────────────────────────────────────── */
const dsT = k => DS[IDX[k]].t;
const dsLang = k => DS[IDX[k]].t + (DS[IDX[k]].vorlage ? ' (Vorlage)' : '');
const dsDok = k => k[0] === 'r' ? 'Staatsrechnung ' + DS[IDX[k]].j : dsLang(k);
const istPlan = k => DS[IDX[k]].a === 'p';
const J_MIN = 2021, J_MAX = 2030;
const VORGABE_SEL = ['b27', 'b26', 'r25'];
const st = {sel: VORGABE_SEL.slice(), rechnung: 'er', gl: 'inst', ansicht: 'A', umfang: 'ord', pfad: [], markiert: null, tab: 'ebene', offen: new Set(), kommOffen: new Set(),
            kz: 'gesamt', bereich: null, ea: 'N', bf: {typ: 'alle', ds: 'alle', min: 0, nurAuswahl: false, q: '', dep: ''}, bfOffen: new Set(), bfZahl: 30};
const gesperrt = () => st.sel.some(istPlan);

const GRUPPEN = {};
function gruppenVon(k){
  if(GRUPPEN[k]) return GRUPPEN[k];
  return GRUPPEN[k] = istPlan(k) ? Object.assign({}, D.agg[k]) : Object.assign({}, D.g2[k]);
}
const kennzahlenVon = k => KZ[k];

/* ── Baum für die gewählten Datensätze ───────────────────────────────── */
let BAUM = null, KNOTEN = null;
function seiten(konto, v){ const c = konto[0]; return c === '3' || c === '5' ? [v, 0] : c === '4' || c === '6' ? [0, -v] : v >= 0 ? [v, 0] : [0, -v]; }
function neuerKnoten(id, name, code, eltern, blatt){ return {id, name, code, v: st.sel.map(() => [0, 0]), kinder: new Map(), eltern, tiefe: eltern ? eltern.tiefe + 1 : 0, blatt: !!blatt}; }
function einhaengen(pfad, s, a, e){
  let n = BAUM; n.v[s][0] += a; n.v[s][1] += e;
  for(const [id, name, code, blatt, komm] of pfad){
    let c = n.kinder.get(id);
    if(!c){ c = neuerKnoten(id, name, code, n, blatt); if(komm) c.komm = komm; n.kinder.set(id, c); KNOTEN.set(id, c); n.blatt = false; }
    c.v[s][0] += a; c.v[s][1] += e; n = c;
  }
}
function pfadER(z){
  const [dep, dst, spz, konto, bez] = z;
  if(st.gl === 'inst'){
    const p = [['d' + dep, D.dep[dep] || dep, '', false], ['s' + dst, D.dst[dst] || ('Dienststelle ' + dst), dst, false, `${dst}||`]];
    if(spz) p.push(['f' + spz, D.spz[spz] || spz, spz, false]);
    p.push([`k${dst}|${spz}|${konto}`, bez, konto, true, `${dst}|${spz}|${konto}`]);
    return p;
  }
  const a = konto.slice(0, 2), b = konto.slice(0, 3);
  return [['a' + a, D.sg[a] || ('Sachgruppe ' + a), a, false], ['b' + b, D.sg[b] || ('Sachgruppe ' + b), b, false], ['k' + konto, bez, konto, true]];
}
function pfadIR(z){
  const [dep, dst, spz, konto, pr] = z;
  const kn = D.irk[konto] || konto, pn = D.irp[pr] || pr;
  if(st.gl === 'inst'){
    const p = [['d' + dep, D.dep[dep] || dep, '', false], ['s' + dst, D.dst[dst] || ('Dienststelle ' + dst), dst, false]];
    if(spz) p.push(['f' + spz, D.spz[spz] || spz, spz, false]);
    p.push([`v${dst}|${spz}|${pr}`, pn || 'ohne Vorhaben', pr, false], [`k${dst}|${spz}|${pr}|${konto}`, kn, konto, true]);
    return p;
  }
  const a = konto.slice(0, 2);
  return [['a' + a, D.sg[a] || ('Sachgruppe ' + a), a, false], ['k' + konto, kn, konto, false], [`v${konto}|${pr}`, pn || 'ohne Vorhaben', pr, true]];
}
function baum(){
  if(!D.z) return;
  const ir = st.rechnung === 'ir';
  if(gesperrt() && !ir) st.gl = 'art';
  BAUM = neuerKnoten('root', ir ? 'Investitionsrechnung' : 'Erfolgsrechnung', '', null, false);
  KNOTEN = new Map([['root', BAUM]]);
  st.sel.forEach((k, s) => {
    if(!ir){
      if(istPlan(k)){
        for(const [sg, v] of Object.entries(D.agg[k])){
          if(!v || (st.umfang === 'ord' && !ORDENTLICH(sg))) continue;
          const [a, e] = seiten(sg, v);
          einhaengen([['a' + sg, D.sg[sg] || sg, sg, false]], s, a, e);
        }
        return;
      }
      const i = 5 + JI[k];
      for(const z of D.z){
        const v = z[i]; if(!v) continue;
        if(st.umfang === 'ord' && !ORDENTLICH(z[3].slice(0, 2))) continue;
        const [a, e] = seiten(z[3], v);
        einhaengen(pfadER(z), s, a, e);
      }
    } else {
      if(istPlan(k)){ const [a, e] = D.aggir[k]; BAUM.v[s][0] += a; BAUM.v[s][1] += e; return; }
      if(!D.ir) return;
      const j = JI[k];
      for(const z of D.ir){
        const a = z[5][2 * j], e = z[5][2 * j + 1]; if(!a && !e) continue;
        einhaengen(pfadIR(z), s, a, e);
      }
    }
  });
}
const wert = (n, s) => { const v = n.v[s]; return st.ansicht === 'A' ? v[0] : st.ansicht === 'E' ? v[1] : v[0] - v[1]; };
const sichtbar = (c, s) => st.ansicht === 'A' ? Math.abs(c.v[s][0]) > .004 : st.ansicht === 'E' ? Math.abs(c.v[s][1]) > .004 : Math.abs(c.v[s][0]) + Math.abs(c.v[s][1]) > .004;
const pos = v => Math.max(0, v);
function kinderSortiert(n){
  const arr = [...n.kinder.values()];
  arr.sort((a, b) => { const ma = Math.max(...st.sel.map((_, s) => wert(a, s))), mb = Math.max(...st.sel.map((_, s) => wert(b, s))); return mb - ma || a.id.localeCompare(b.id); });
  return arr;
}
function aktuellerKnoten(){
  let n = BAUM; const weg = [n], pf = [];
  for(const id of st.pfad){ const c = n.kinder.get(id); if(!c) break; n = c; weg.push(n); pf.push(id); }
  st.pfad = pf;
  return weg;
}
function setzePfad(n){ const p = []; let x = n; while(x && x.id !== 'root'){ p.unshift(x.id); x = x.eltern; } st.pfad = p; }
const ansichtName = () => st.rechnung === 'ir' ? {A:'Ausgaben', E:'Einnahmen', N:'Nettoinvestitionen'}[st.ansicht] : {A:'Aufwand', E:'Ertrag', N:'Nettoaufwand'}[st.ansicht];
const knotenName = n => (n.code ? n.code + ' ' : '') + n.name;

/* ── Prüfhinweise: Index nach Knoten ─────────────────────────────────── */
const BF_DIREKT = new Map(), BF_INDIREKT = new Map();
function bfIndex(){
  BF_DIREKT.clear(); BF_INDIREKT.clear();
  BF.forEach((b, i) => {
    const ziel = b.markiert || b.pfad[b.pfad.length - 1];
    const kette = [ziel, ...b.pfad.filter(p => p !== ziel).reverse()];
    for(const ds of b.ds) kette.forEach((id, t) => {
      const key = ds + '|' + b.rechnung + '|' + id, map = t === 0 ? BF_DIREKT : BF_INDIREKT;
      if(!map.has(key)) map.set(key, new Set());
      map.get(key).add(i);
    });
  });
}
function befundeFuer(id){
  const d = new Set(), ind = new Set();
  if(st.gl !== 'inst' || !BF.length) return {d: [], i: []};
  for(const k of st.sel){
    const key = k + '|' + st.rechnung + '|' + id;
    (BF_DIREKT.get(key) || []).forEach(i => d.add(i));
    (BF_INDIREKT.get(key) || []).forEach(i => ind.add(i));
  }
  d.forEach(i => ind.delete(i));
  return {d: [...d], i: [...ind]};
}
/* Kommentare der Dienststellen zu einem Knoten, je gewähltem Datensatz */
function kommentareFuer(n){
  if(!n.komm || st.rechnung !== 'er' || !D.komm) return [];
  return st.sel.map((k, s) => [k, s, (D.komm[k] || {})[n.komm]]).filter(x => x[2]);
}

/* ── Adresse (Hash): Ansicht teilen, Seiten verbinden ────────────────── */
function hashParameter(){ try{ return new URLSearchParams(location.hash.slice(1)); }catch(e){ return new URLSearchParams(); } }
function hashLesen(){
  const h = hashParameter();
  const d = (h.get('d') || '').split(',').filter(k => IDX[k] !== undefined).slice(0, 3);
  if(d.length) st.sel = d;
  if(['er', 'ir'].includes(h.get('r'))) st.rechnung = h.get('r');
  if(['inst', 'art'].includes(h.get('g'))) st.gl = h.get('g');
  if(['A', 'E', 'N'].includes(h.get('a'))) st.ansicht = h.get('a');
  if(['ord', 'alle'].includes(h.get('u'))) st.umfang = h.get('u');
  if(h.get('p')) st.pfad = h.get('p').split('/').filter(Boolean);
  if(h.get('m')) st.markiert = h.get('m');
  if(['ebene', 'baum'].includes(h.get('t'))) st.tab = h.get('t');
  if(h.get('kz')) st.kz = h.get('kz');
  if(h.get('b')) st.bereich = h.get('b');
  if(['A', 'E', 'N'].includes(h.get('ea'))) st.ea = h.get('ea');
  if(h.get('ds')) st.bf.ds = h.get('ds');
  if(h.get('typ')) st.bf.typ = h.get('typ');
  if(h.get('q')) st.bf.q = h.get('q');
  if(h.get('dep')) st.bf.dep = h.get('dep');
}
function hashSchreiben(){
  const h = new URLSearchParams();
  h.set('d', st.sel.join(','));
  if(SEITE === 'vergleich'){
    h.set('r', st.rechnung); h.set('g', st.gl); h.set('a', st.ansicht); h.set('u', st.umfang);
    if(st.pfad.length) h.set('p', st.pfad.join('/'));
    if(st.markiert) h.set('m', st.markiert);
    if(st.tab !== 'ebene') h.set('t', st.tab);
  } else if(SEITE === 'entwicklung'){
    if(st.bereich) { h.set('b', st.bereich); h.set('ea', st.ea); } else h.set('kz', st.kz);
  } else if(SEITE === 'pruefhinweise'){
    if(st.bf.ds !== 'alle') h.set('ds', st.bf.ds);
    if(st.bf.typ !== 'alle') h.set('typ', st.bf.typ);
    if(st.bf.dep) h.set('dep', st.bf.dep);
    if(st.bf.q) h.set('q', st.bf.q);
  }
  history.replaceState(null, '', '#' + h.toString());
  verweiseNachfuehren();
}
/* Die Seitenliste trägt die gewählten Jahre mit, damit die Auswahl beim Wechseln bleibt */
function verweiseNachfuehren(){
  $$('a[data-mit-auswahl]').forEach(a => { a.href = a.dataset.ziel + '#d=' + st.sel.join(','); });
}
function zuSeite(seite, params){
  const h = new URLSearchParams(params || {});
  location.href = BASIS + (seite === 'start' ? '' : seite + '/') + (h.toString() ? '#' + h.toString() : '');
}

/* ── Rahmen: Menü, Abschnitte ────────────────────────────────────────── */
/* Hell oder dunkel: ohne Wahl gilt die Einstellung des Geräts */
function themaAktuell(){
  const t = document.documentElement.getAttribute('data-theme');
  if(t === 'light' || t === 'dark') return t;
  return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
}
function themaKnopf(){
  const b = $('#themaKnopf'); if(!b) return;
  const dunkel = themaAktuell() === 'dark';
  b.classList.toggle('zu-dunkel', !dunkel);
  b.querySelector('span').textContent = dunkel ? 'Hell' : 'Dunkel';
  b.title = dunkel ? 'Auf hellen Hintergrund umschalten' : 'Auf dunklen Hintergrund umschalten';
  b.setAttribute('aria-label', b.title);
}
function rahmenInit(){
  const tk = $('#themaKnopf');
  if(tk){
    themaKnopf();
    tk.addEventListener('click', () => {
      const neu = themaAktuell() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', neu);
      speicher.setze('thema', neu);
      themaKnopf();
      try{ if(typeof allesZeichnen === 'function') allesZeichnen(); }catch(e){}
    });
    if(window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themaKnopf);
  }
  const knopf = $('#menuKnopf');
  if(knopf){
    const zu = () => { document.body.classList.remove('menu-offen'); knopf.setAttribute('aria-expanded', 'false'); };
    knopf.addEventListener('click', () => { const auf = !document.body.classList.contains('menu-offen'); document.body.classList.toggle('menu-offen', auf); knopf.setAttribute('aria-expanded', String(auf)); });
    $('#schleier').addEventListener('click', zu);
    $$('#seitenleiste a').forEach(a => a.addEventListener('click', zu));
    document.addEventListener('keydown', ev => { if(ev.key === 'Escape' && document.body.classList.contains('menu-offen')) zu(); });
  }
  // Abschnitte: offen oder zu, je Leser gemerkt; ein Sprung auf einen Abschnitt öffnet ihn
  $$('details.abschnitt[id]').forEach(d => {
    const gemerkt = speicher.lies(`offen-${SEITE}-${d.id}`);
    if(gemerkt === '1') d.open = true; else if(gemerkt === '0') d.open = false;
    d.addEventListener('toggle', () => { speicher.setze(`offen-${SEITE}-${d.id}`, d.open ? '1' : '0'); if(d.open) nachOeffnen(d.id); });
  });
  const oeffneZiel = () => {
    const id = location.hash.slice(1);
    if(!id || id.includes('=')) return;
    const z = document.getElementById(id);
    if(z){ const d = z.closest('details'); if(d) d.open = true; }
  };
  oeffneZiel(); window.addEventListener('hashchange', oeffneZiel);
  $$('.seitenliste ol a').forEach(a => a.addEventListener('click', () => { const z = document.getElementById(a.getAttribute('href').slice(1)); if(z && z.tagName === 'DETAILS') z.open = true; }));
}
/* Zeichnungen, die in einem geschlossenen Abschnitt keine Breite hatten, nachholen */
const NACH_OEFFNEN = {};
function nachOeffnen(id){ (NACH_OEFFNEN[id] || []).forEach(f => f()); }
function oeffne(id){ const d = document.getElementById(id); if(d && d.tagName === 'DETAILS') d.open = true; }

/* ── Auswahl der Jahre ───────────────────────────────────────────────── */
function zeichneRaster(){
  const tb = $('#raster'); if(!tb) return;
  const jahre = []; for(let j = J_MIN; j <= J_MAX; j++) jahre.push(j);
  tb.innerHTML = '';
  const zelle = k => {
    const d = DS[IDX[k]], s = st.sel.indexOf(k), erg = KZ[k].gesamt;
    const b = el('button', {type: 'button', class: 'zelle', 'data-k': k, 'aria-pressed': s >= 0 ? 'true' : 'false',
      title: `${dsLang(k)}: Gesamtergebnis ${mioVz(erg)} Mio. Franken` + (s >= 0 ? `, gewählt als ${SLOT[s]}` : '')});
    b.append(el('span', {class: 'erg', text: mioVz(erg)}));
    if(d.vorlage) b.append(el('span', {class: 'vl', text: 'Vorlage'}));
    b.append(el('span', {class: 'bst', text: s >= 0 ? SLOT[s] : ''}));
    if(s >= 0){ b.style.background = slotFarbe(s); b.style.color = textAuf(slotFarbe(s)); }
    return b;
  };
  const reihe = (titel, art) => el('tr', null, [el('th', {class: 'zeile', text: titel}), ...jahre.map(j => {
    const td = el('td'), k = art + String(j).slice(2);
    if(IDX[k] !== undefined) td.append(zelle(k));
    return td;
  })]);
  tb.append(el('colgroup', null, [el('col', {class: 'kopfspalte'}), ...jahre.map(() => el('col'))]),
            el('thead', null, [el('tr', null, [el('th', {class: 'zeile'}), ...jahre.map(j => el('th', {text: String(j)}))])]),
            el('tbody', null, [reihe('Rechnung', 'r'), reihe('Budget', 'b'), reihe('Finanzplan', 'p')]));
  $$('.zelle', tb).forEach(b => b.addEventListener('click', () => waehle(b.dataset.k)));
  const rs = tb.closest('.raster'); if(rs && !rs._gescrollt){ rs.scrollLeft = rs.scrollWidth; rs._gescrollt = true; }
  const aw = $('#auswahl'); aw.innerHTML = '';
  st.sel.forEach((k, s) => {
    const c = el('span', {class: 'chip' + (s === 0 ? ' bezug' : ''), role: 'button', tabindex: '0', title: s === 0 ? 'Bezug für die Differenzen' : 'Als Bezug (A) setzen'});
    const sw = el('i'); sw.style.background = slotFarbe(s);
    const weg = el('button', {type: 'button', class: 'weg', 'aria-label': dsT(k) + ' entfernen', text: '×'});
    weg.addEventListener('click', ev => { ev.stopPropagation(); if(st.sel.length > 1){ st.sel = st.sel.filter(x => x !== k); neu(); } });
    c.append(sw, el('b', {text: SLOT[s]}), document.createTextNode(dsT(k)));
    if(DS[IDX[k]].vorlage) c.append(el('span', {class: 'marke-vorlage', text: 'Vorlage', title: DS[IDX[k]].fassung}));
    c.append(weg);
    const bezug = () => { if(s > 0){ st.sel = [k, ...st.sel.filter(x => x !== k)]; neu(); } };
    c.addEventListener('click', bezug); c.addEventListener('keydown', ev => { if(ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); bezug(); } });
    aw.append(c);
  });
  if(st.sel.length > 1) aw.append(el('span', {class: 'leise klein', text: 'Differenzen gegenüber A. Klick auf einen Eintrag macht ihn zu A.'}));
  // Zusammenfassung im Kopf des zugeklappten Abschnitts
  const zus = $('#wahlZus');
  if(zus){
    zus.innerHTML = '';
    st.sel.forEach((k, s) => { const p = el('span', {class: 'pill'}); const i = el('i'); i.style.background = slotFarbe(s); p.append(i, document.createTextNode(SLOT[s] + ' ' + dsT(k) + (DS[IDX[k]].vorlage ? ' (Vorlage)' : ''))); zus.append(p); });
  }
}
function waehle(k){
  const i = st.sel.indexOf(k);
  if(i >= 0){ if(st.sel.length > 1) st.sel.splice(i, 1); }
  else if(st.sel.length < 3) st.sel.push(k);
  else st.sel[2] = k;
  neu();
}
function neu(pfadBehalten){
  if(!pfadBehalten && gesperrt()) st.pfad = [];
  baum();
  zeichneRaster(); zeichneHinweis(); zeichneUeberblick(); zeichneKennzahlen(); zeichneVerlauf(); zeichneDrill(); zeichneBefunde(); hashSchreiben();
}
function zeichneHinweis(){
  const h = $('#planhinweis'); if(!h) return;
  h.hidden = !gesperrt() || SEITE !== 'vergleich';
  h.textContent = gesperrt() ? 'Der Finanzplan 2028 bis 2030 liegt nur nach Sachgruppen vor (Ziffer 2.1 des Berichts), die Investitionen nur als Total. Mit einem Finanzplanjahr in der Auswahl zeigt der Vergleich deshalb die Sachgruppen; tiefer geht es mit Budget und Rechnung.' : '';
}

/* ── Woher, wohin: Datensatz A ───────────────────────────────────────── */
function zeichneUeberblick(){
  if(!$('#ww')) return;
  const kA = st.sel[0], kB = st.sel[1] || null;
  const K = KZ[kA], V = kB ? KZ[kB] : null, g = gruppenVon(kA);
  const tJ = dsLang(kA), tV = kB ? dsLang(kB) : '';
  $('#wwTitel').textContent = `${tJ}, ordentlicher Ertrag und Aufwand`;
  const vgl = (v, w) => V ? `<div class="s">${esc(tV)}: ${mio(w)} Mio., also ${mioVz(v - w)}</div>` : '';
  $('#kacheln').innerHTML =
    `<div class="kachel ert"><div class="z">${mio(K.ert)} Mio.</div><div class="l">Ertrag ${esc(tJ)}</div>${vgl(K.ert, V && V.ert)}</div>
     <div class="kachel auf"><div class="z">${mio(K.auf)} Mio.</div><div class="l">Aufwand ${esc(tJ)}</div>${vgl(K.auf, V && V.auf)}</div>
     <div class="kachel"><div class="z">${mioVz(K.gesamt)} Mio.</div><div class="l">${K.gesamt < 0 ? 'Defizit' : 'Überschuss'} ${esc(tJ)}</div>${V ? `<div class="s">${esc(tV)}: ${mioVz(V.gesamt)} Mio.</div>` : ''}</div>`;
  const RA = rampe('--auf'), RE = rampe('--ert');
  const reihe = (p, ramp) => Object.entries(g).filter(([c, v]) => c[0] === p && ORDENTLICH(c) && Math.abs(v) > 0)
    .map(([c, v]) => ({c, v: Math.abs(v)})).sort((a, b) => b.v - a.v)
    .map((x, i) => ({...x, f: ramp[Math.min(i, ramp.length - 1)], hell: i >= 3}));
  const E = reihe('4', RE), A = reihe('3', RA);
  const skala = Math.max(K.auf, K.ert);
  const W = Math.max(300, Math.round($('#ww').clientWidth || 1000)), R = W;
  const schmal = W < 640, H = schmal ? 40 : 44, Y1 = 22, Y2 = schmal ? 132 : 108;
  const bar = (liste, y, total) => {
    let x = 0, s = '';
    for(const seg of liste){
      const b = R * seg.v / skala;
      const tx = seg.hell ? '#12161C' : '#FFFFFF';
      s += `<rect class="seg" x="${x.toFixed(1)}" y="${y}" width="${Math.max(b - 2, .5).toFixed(1)}" height="${H}" fill="${seg.f}" rx="3" data-sg="${seg.c}" tabindex="0" role="button" aria-label="${esc((D.sg[seg.c] || seg.c) + ': ' + mio(seg.v) + ' Mio. Franken')}"><title>${esc((seg.c + ' ' + (D.sg[seg.c] || '')).trim())}: ${mio(seg.v)} Mio. Fr., ${(100 * seg.v / total).toFixed(1)} %</title></rect>`;
      if(b > 64){
        s += `<text class="in" x="${(x + 7).toFixed(1)}" y="${y + 17}" fill="${tx}">${esc(kurz(D.sg[seg.c] || seg.c, Math.floor(b / 7)))}</text>`;
        s += `<text class="in" x="${(x + 7).toFixed(1)}" y="${y + H - 9}" fill="${tx}" opacity=".8" style="font-weight:400">${(100 * seg.v / total).toFixed(0)} %</text>`;
      } else if(b > 28){
        s += `<text class="in" x="${(x + 6).toFixed(1)}" y="${y + H / 2 + 4}" fill="${tx}" opacity=".9" style="font-weight:400">${(100 * seg.v / total).toFixed(0)} %</text>`;
      }
      x += b;
    }
    return s;
  };
  const xE = R * K.ert / skala, xA = R * K.auf / skala, diff = K.ert - K.auf;
  const dx = Math.min(xE, xA), dw = Math.abs(xE - xA);
  let s = `<svg viewBox="0 0 ${W} ${Y2 + H + 6}" width="${W}" role="img" aria-label="Ertrag und Aufwand ${esc(tJ)}">`;
  s += `<text class="beschr" x="0" y="13">Woher · Ertrag ${mio(K.ert)} Mio.</text>` + bar(E, Y1, K.ert);
  s += `<text class="beschr" x="0" y="${Y2 - 9}">Wohin · Aufwand ${mio(K.auf)} Mio.</text>` + bar(A, Y2, K.auf);
  if(dw > 2){
    const lab = (diff < 0 ? `Operatives Defizit ${mio(-diff)}` : `Operativer Überschuss ${mio(diff)}`) + ' Mio.';
    if(schmal){
      const yb = Y1 + H + 4, hb = 18;
      s += `<rect x="${dx.toFixed(1)}" y="${yb}" width="${dw.toFixed(1)}" height="${hb}" fill="none" stroke="${farbe('--text-leise')}" stroke-dasharray="3 3"/>`;
      s += `<text class="diffz" x="${R - 4}" y="${yb + hb + 20}" text-anchor="end">${lab}</text>`;
    } else {
      const yb = Y1 + H + 6, hb = Y2 - 14 - yb;
      s += `<rect x="${dx.toFixed(1)}" y="${yb}" width="${dw.toFixed(1)}" height="${hb}" fill="none" stroke="${farbe('--text-leise')}" stroke-dasharray="3 3"/>`;
      const breit = dw > 190, tx = breit ? dx + dw / 2 : Math.max(dx - 6, 0);
      s += `<text class="diffz" x="${tx.toFixed(1)}" y="${yb + hb / 2 + 5}" text-anchor="${breit ? 'middle' : 'end'}">${lab}</text>`;
    }
  }
  $('#ww').innerHTML = s + '</svg>';
  $$('#ww rect.seg').forEach(r => { r.addEventListener('click', () => springeSachgruppe(r.dataset.sg)); r.addEventListener('keydown', ev => { if(ev.key === 'Enter') springeSachgruppe(r.dataset.sg); }); });
  const leg = (liste, total) => `<ol>` + liste.map(x =>
    `<li data-sg="${x.c}"><i style="background:${x.f}"></i>
       <span>${esc(D.sg[x.c] || x.c)}${D.erkl[x.c] ? `<small>${esc(D.erkl[x.c])}</small>` : ''}</span>
       <b>${mio(x.v)}<em>${(100 * x.v / total).toFixed(1)} %</em></b></li>`).join('') + `</ol>`;
  $('#legenden').innerHTML = `<div class="legende"><h3>Woher das Geld kommt</h3>${leg(E, K.ert)}</div><div class="legende"><h3>Wohin es geht</h3>${leg(A, K.auf)}</div>`;
  $$('#legenden li').forEach(li => li.addEventListener('click', () => springeSachgruppe(li.dataset.sg)));
  const teile = [];
  if(Math.abs(K.ao) >= 5e4) teile.push(`${K.ao > 0 ? 'Dazu kommen' : 'Davon gehen ab'} ${mio(Math.abs(K.ao))} Mio. ausserordentliches Ergebnis${K.ao > 0 ? ', vor allem Entnahmen aus dem Eigenkapital' : ', vor allem Einlagen in finanzpolitische Reserven'}.`);
  if(Math.abs(K.ek) >= 5e4) teile.push(`Fonds und Spezialfinanzierungen im Eigenkapital ${mioVz(K.ek)} Mio.`);
  $('#ergebnis').innerHTML = `Ordentlicher Ertrag <b>${mio(K.ert)}</b> minus ordentlicher Aufwand <b>${mio(K.auf)}</b> ergibt das operative Ergebnis von <b>${mioVz(K.ord)} Mio.</b> ${esc(teile.join(' '))}
    Gesamtergebnis <b>${mioVz(K.gesamt)} Mio. Franken</b>${K.gesamt < 0 ? ', ein Aufwandüberschuss' : ', ein Ertragsüberschuss'}.` + (K.iv ? ` Interne Verrechnungen (${mio(Math.abs(K.iv))} Mio.) stehen auf beiden Seiten gleich und sind weggelassen.` : '');
}
function springeSachgruppe(sg){
  const sel = istPlan(st.sel[0]) ? st.sel : st.sel;
  zuSeite('vergleich', {d: sel.join(','), r: 'er', g: 'art', a: sg[0] === '4' ? 'E' : 'A', u: 'ord', p: 'a' + sg});
}

/* ── Kennzahlen ──────────────────────────────────────────────────────── */
const KENNZAHLEN = [
  ['ert', 'Ordentlicher Ertrag', 'Sachgruppen 40 bis 47'],
  ['auf', 'Ordentlicher Aufwand', 'Sachgruppen 30 bis 37'],
  ['ord', 'Operatives Ergebnis', 'ordentlicher Ertrag minus Aufwand'],
  ['ao', 'Ausserordentliches Ergebnis', 'Sachgruppen 48 minus 38, vor allem Reserven'],
  ['gesamt', 'Gesamtergebnis', 'mit Fonds und Spezialfinanzierungen im Eigenkapital'],
  ['fiskal', 'Fiskalertrag (Steuern)', 'Sachgruppe 40'],
  ['transferE', 'Transferertrag', 'Sachgruppe 46: Bundessteueranteile, Finanzausgleich, Beiträge'],
  ['pers', 'Personalaufwand', 'Sachgruppe 30'],
  ['sach', 'Sach- und Betriebsaufwand', 'Sachgruppe 31'],
  ['transfer', 'Transferaufwand', 'Sachgruppe 36'],
  ['netInv', 'Nettoinvestitionen', 'Ausgaben minus Einnahmen der Investitionsrechnung'],
  ['ekap', 'Eigenkapital am Jahresende', 'Bilanz, Ziffer 2.3 des Berichts zum Budget 2027; Budget 2026 aktualisiert'],
  ['sfnp', 'Steuerfuss natürliche Personen', 'Prozent der einfachen Staatssteuer'],
];
const kzRoh = (k, key) => { const K = KZ[k]; return !K || K[key] === undefined || K[key] === null ? null : K[key]; };
const kzFormat = (key, v) => key === 'sfnp' ? v + ' %' : ['ord', 'ao', 'gesamt'].includes(key) ? mioVz(v) : mio(v);
const kzDiff = (key, d, b) => key === 'sfnp' ? (d > 0 ? '+' : d < 0 ? '−' : '±') + Math.abs(d) + ' Prozentpunkte' : mioVz(d) + (['ord', 'ao', 'gesamt'].includes(key) || !pct(d, b) ? '' : ` (${pct(d, b)})`);
function zeichneKennzahlen(){
  const t = $('#kz'); if(!t) return;
  t.innerHTML = '';
  const kopf = el('tr', null, [el('th', {text: 'Kennzahl, Mio. Franken'}), ...st.sel.map((k, s) => { const th = el('th', {class: 'r'}); const sw = el('span', {class: 'schl'}); sw.style.background = slotFarbe(s); th.append(sw, document.createTextNode(SLOT[s] + ' · ' + dsLang(k))); return th; })]);
  const body = el('tbody');
  for(const [key, name, erkl] of KENNZAHLEN){
    if(!st.sel.some(k => kzRoh(k, key) !== null)) continue;
    const tr = el('tr');
    const td0 = el('td'); td0.append(el('span', {text: name})); if(erkl) td0.append(el('small', {class: 'h-m', text: ' · ' + erkl}));
    tr.append(td0);
    st.sel.forEach((k, s) => {
      const v = kzRoh(k, key), td = el('td', {class: 'r'});
      if(v === null){ td.append(el('span', {class: 'leise', text: '·', title: 'Für diesen Datensatz nicht ausgewiesen'})); tr.append(td); return; }
      td.append(el('b', {text: kzFormat(key, v)}));
      const b = kzRoh(st.sel[0], key);
      if(s > 0 && b !== null) td.append(el('span', {class: 'dd', text: kzDiff(key, v - b, b)}));
      tr.append(td);
    });
    body.append(tr);
  }
  t.append(el('thead', null, [kopf]), body);
  const zus = $('#kzZus');
  if(zus){ const K = KZ[st.sel[0]]; zus.textContent = `${SLOT[0]} ${dsLang(st.sel[0])}: Gesamtergebnis ${mioVz(K.gesamt)} Mio.`; }
}
