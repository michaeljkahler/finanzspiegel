(function(){
"use strict";
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
function rahmenInit(){
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

/* ── Entwicklung 2021 bis 2030 ───────────────────────────────────────── */
const KZ_WAHL = [['gesamt', 'Gesamtergebnis'], ['ord', 'Operatives Ergebnis'], ['ert', 'Ertrag'], ['auf', 'Aufwand'], ['fiskal', 'Steuern'],
  ['transfer', 'Transferaufwand'], ['pers', 'Personalaufwand'], ['netInv', 'Nettoinvestitionen'], ['ekap', 'Eigenkapital'], ['sfnp', 'Steuerfuss']];
const KZ_TITEL = {gesamt: 'Gesamtergebnis der Erfolgsrechnung', ord: 'Operatives Ergebnis (ordentlicher Ertrag minus Aufwand)', ert: 'Ordentlicher Ertrag', auf: 'Ordentlicher Aufwand',
  fiskal: 'Fiskalertrag (Steuern)', transfer: 'Transferaufwand', pers: 'Personalaufwand', netInv: 'Nettoinvestitionen', ekap: 'Eigenkapital am Jahresende', sfnp: 'Steuerfuss natürliche Personen', ao: 'Ausserordentliches Ergebnis'};
const EA_NAME = {A: 'Aufwand', E: 'Ertrag', N: 'Nettoaufwand'};
const FELD_IDX = {b27: 0, p28: 1, p29: 2, p30: 3};
const bereichArt = () => st.bereich === null ? null : st.bereich[0];
const istProzent = () => st.bereich === null && st.kz === 'sfnp';
function kzWert(k){
  if(IDX[k] === undefined) return null;
  const art = bereichArt();
  if(art === null) return kzRoh(k, st.kz);
  const code = st.bereich.slice(1);
  const ea = i => st.ea === 'A' ? i[0] : st.ea === 'E' ? i[1] : i[2];
  if(art === 'd' || art === 's'){
    if(istPlan(k)) return null;
    const m = (art === 'd' ? D.depn : D.dstn)[k] || {}, v = m[code];
    return v === undefined ? null : ea(v);
  }
  if(art === 'g'){
    const v = (istPlan(k) ? D.agg[k] : D.g2[k] || {})[code];
    return v === undefined ? null : code[0] === '4' ? -v : v;
  }
  const f = D.felder.find(x => String(x.nr) === code), i = FELD_IDX[k];
  return !f || i === undefined ? null : f.netto[i] * 1000;
}
function kzTitel(){
  const art = bereichArt();
  if(art === null) return KZ_TITEL[st.kz] || st.kz;
  const code = st.bereich.slice(1);
  if(art === 'd') return `${EA_NAME[st.ea]} ${D.dep[code] || code}`;
  if(art === 's') return `${EA_NAME[st.ea]} ${code} ${D.dst[code] || ''}`.trim();
  if(art === 'g') return `${code} ${D.sg[code] || ''}`.trim();
  const f = D.felder.find(x => String(x.nr) === code);
  return `Nettoaufwand Aufgabenfeld ${f ? f.name : code}`;
}
const kzUeber = () => { const art = bereichArt(); return art === 'd' || art === 's' ? 'Erfolgsrechnung, alle Konten' : art === 'g' ? 'Erfolgsrechnung, Sachgruppe' : art === 'f' ? 'Finanzplan, Kapitel 7' : st.kz === 'netInv' ? 'Investitionsrechnung' : st.kz === 'ekap' ? 'Bilanz' : st.kz === 'sfnp' ? 'Steuerfuss' : 'Erfolgsrechnung'; };
function serienVerlauf(){
  const p = (k, j) => [j, kzWert(k), k];
  const r = [], b = [], pl = [];
  for(let j = J_MIN; j <= J_MAX; j++){
    const jj = String(j).slice(2);
    if(IDX['r' + jj] !== undefined) r.push(p('r' + jj, j));
    if(IDX['b' + jj] !== undefined) b.push(p('b' + jj, j));
    if(IDX['p' + jj] !== undefined) pl.push(p('p' + jj, j));
  }
  const letztesBudget = b[b.length - 1];
  return {r, b, p: letztesBudget ? [letztesBudget, ...pl] : pl};
}
const wertText = v => istProzent() ? v + ' %' : mio(v) + ' Mio.';
function zeichneVerlauf(){
  const box = $('#verlauf'); if(!box) return;
  const chips = $('#kzChips'); chips.innerHTML = '';
  KZ_WAHL.forEach(([k, t]) => { const b = el('button', {type: 'button', 'aria-pressed': String(st.bereich === null && st.kz === k), text: t}); b.addEventListener('click', () => { st.kz = k; st.bereich = null; zeichneVerlauf(); zeichneBereiche(); hashSchreiben(); }); chips.append(b); });
  $('#kzBereich').value = st.bereich === null ? '' : st.bereich;
  const eaBox = $('#eaGrp'), art = bereichArt();
  eaBox.hidden = !(art === 'd' || art === 's');
  $$('#eaChips button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.wert === st.ea)));
  $('#verlaufTitel').textContent = kzTitel();
  const S = serienVerlauf(), da = v => v !== null && v !== undefined;
  const W = Math.max(320, box.clientWidth || 900), schmal = W < 600;
  const H = schmal ? 250 : 300, L = schmal ? 46 : 60, R = schmal ? 14 : 24, T = 40, B = 30;
  const x = j => L + (W - L - R) * (j - J_MIN) / (J_MAX - J_MIN);
  const alle = [...S.r, ...S.b, ...S.p].map(q => q[1]).filter(da);
  let lo = Math.min(...alle), hi = Math.max(...alle);
  if(!alle.length){ lo = 0; hi = 1; }
  if(istProzent()){ lo = Math.max(0, lo - 10); hi = hi + 10; }
  else if(lo < 0 || hi <= 0){ lo = Math.min(lo, 0); hi = Math.max(hi, 0); } else { lo = Math.max(0, lo - (hi - lo) * 0.3); }
  const spanne = hi - lo || 1;
  const schritt = (() => { const roh = spanne / 5, p = Math.pow(10, Math.floor(Math.log10(roh))); return [1, 2, 2.5, 5, 10].map(f => f * p).find(s => s >= roh); })();
  lo = Math.floor(lo / schritt) * schritt; hi = Math.ceil(hi / schritt) * schritt;
  const y = v => T + (H - T - B) * (1 - (v - lo) / ((hi - lo) || 1));
  const achse = v => istProzent() ? v + ' %' : mio(v, schritt < 1e6 ? 1 : 0);
  const dunkel = farbe('--linie-r'), grau = farbe('--linie-b'), fl = farbe('--karte');
  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(kzTitel())}, ${J_MIN} bis ${J_MAX}">`;
  s += '<g class="gitter">';
  for(let v = lo; v <= hi + 1e-6; v += schritt) s += `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"${Math.abs(v) < 1e-6 ? ' style="stroke:var(--linie-2)"' : ''}/>`;
  s += '</g><g class="achse">';
  for(let v = lo; v <= hi + 1e-6; v += schritt) s += `<text x="${L - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${achse(v)}</text>`;
  for(let j = J_MIN; j <= J_MAX; j++) s += `<text x="${x(j).toFixed(1)}" y="${H - 8}" text-anchor="middle">${schmal ? "’" + String(j).slice(2) : j}</text>`;
  s += `<text x="${L - 8}" y="${T - 12}" text-anchor="end">${istProzent() ? 'Prozent' : 'Mio. Fr.'}</text></g>`;
  const xb = (x(2027) + x(2028)) / 2;
  s += `<g class="bruch"><line x1="${xb}" x2="${xb}" y1="${T - 14}" y2="${H - B}"/><text x="${xb - 5}" y="${T - 6}" text-anchor="end">Budget</text><text x="${xb + 5}" y="${T - 6}">Finanzplan</text></g>`;
  const pfad = (pts, stil) => { const p = pts.filter(q => da(q[1])); if(p.length < 2) return ''; return `<path d="${p.map((q, i) => (i ? 'L' : 'M') + x(q[0]).toFixed(1) + ',' + y(q[1]).toFixed(1)).join('')}" fill="none" ${stil}/>`; };
  s += pfad(S.b, `stroke="${grau}" stroke-width="2" stroke-dasharray="5 4"`);
  s += pfad(S.p, `stroke="${grau}" stroke-width="2" stroke-dasharray="1.5 3.5" stroke-linecap="round"`);
  s += pfad(S.r, `stroke="${dunkel}" stroke-width="2"`);
  const gewaehlt = st.sel.map((k, sidx) => ({k, sidx, j: DS[IDX[k]].j, v: kzWert(k)})).filter(g => da(g.v));
  const labelUnten = new Set();
  gewaehlt.forEach(g => { if(gewaehlt.some(h => h !== g && h.j === g.j && (h.v > g.v || (h.v === g.v && h.sidx < g.sidx)))) labelUnten.add(g.k); });
  const punkt = (j, v, k, art2) => {
    if(!da(v)) return '';
    const sidx = st.sel.indexOf(k); let o = '';
    if(sidx >= 0){ o += `<circle cx="${x(j).toFixed(1)}" cy="${y(v).toFixed(1)}" r="10" fill="none" stroke="${slotFarbe(sidx)}" stroke-width="3"/>`; o += `<text x="${x(j).toFixed(1)}" y="${(labelUnten.has(k) ? y(v) + 27 : y(v) - 15).toFixed(1)}" text-anchor="middle" style="font-size:12px;font-weight:700;fill:var(--text)">${SLOT[sidx]}</text>`; }
    if(art2 === 'r') o += `<circle cx="${x(j).toFixed(1)}" cy="${y(v).toFixed(1)}" r="4.5" fill="${dunkel}" stroke="${fl}" stroke-width="2"/>`;
    else if(art2 === 'p') o += `<path d="M${x(j).toFixed(1)},${(y(v) - 5.5).toFixed(1)}l5.5,5.5l-5.5,5.5l-5.5,-5.5z" fill="${fl}" stroke="${grau}" stroke-width="2"/>`;
    else o += `<circle cx="${x(j).toFixed(1)}" cy="${y(v).toFixed(1)}" r="4.5" fill="${fl}" stroke="${grau}" stroke-width="2"/>`;
    return o;
  };
  for(const [j, v, k] of S.b) s += punkt(j, v, k, 'b');
  for(const [j, v, k] of S.p) if(k[0] === 'p') s += punkt(j, v, k, 'p');
  for(const [j, v, k] of S.r) s += punkt(j, v, k, 'r');
  s += `<line id="vlKreuz" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="${farbe('--text-leise')}" stroke-width="1" style="display:none"/>`;
  s += `<rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent" id="vlFlaeche"/></svg>`;
  box.innerHTML = s;
  const flaeche = $('#vlFlaeche'), kreuz = $('#vlKreuz'), tip = $('#tip');
  const jahrVon = ev => { const r = box.querySelector('svg').getBoundingClientRect(); return Math.max(J_MIN, Math.min(J_MAX, Math.round(J_MIN + ((ev.clientX - r.left) * W / r.width - L) / (W - L - R) * (J_MAX - J_MIN)))); };
  flaeche.addEventListener('pointermove', ev => {
    const j = jahrVon(ev);
    kreuz.setAttribute('x1', x(j)); kreuz.setAttribute('x2', x(j)); kreuz.style.display = '';
    tip.innerHTML = ''; tip.append(el('div', {class: 't', text: `${j} · ${kzTitel()}`}));
    const z = el('div', {class: 'z'});
    const zeile = (k, name, stil) => { if(IDX[k] === undefined) return; const v = kzWert(k); if(!da(v)) return; const i = el('i'); i.style.background = stil; z.append(i, el('span', {text: name}), el('b', {text: wertText(v)})); };
    const jj = String(j).slice(2);
    zeile('r' + jj, 'Rechnung', dunkel); zeile('b' + jj, 'Budget' + (DS[IDX['b' + jj]] && DS[IDX['b' + jj]].vorlage ? ' (Vorlage)' : ''), grau); zeile('p' + jj, 'Finanzplan', grau);
    tip.append(z);
    if(st.kz === 'ekap' && st.bereich === null && j === 2026) tip.append(el('div', {class: 'd', text: 'Budget 2026 aktualisiert mit dem Abschluss 2025 (Ziffer 2.3).'}));
    const r = kzWert('r' + jj), b = kzWert('b' + jj);
    if(!istProzent() && da(r) && da(b)) tip.append(el('div', {class: 'd', text: `Rechnung minus Budget: ${mioVz(r - b)} Mio. ${pct(r - b, b)}`}));
    tip.append(el('div', {class: 'd', text: 'Klick wählt dieses Jahr für den Vergleich (A, B, C).'}));
    platziereTip(ev);
  });
  flaeche.addEventListener('pointerleave', () => { kreuz.style.display = 'none'; tip.style.display = 'none'; });
  flaeche.addEventListener('click', ev => {
    const jj = String(jahrVon(ev)).slice(2);
    const k = ['r' + jj, 'b' + jj, 'p' + jj].find(q => IDX[q] !== undefined);
    if(k && !st.sel.includes(k)){ waehle(k); }
  });
  zeichneVerlaufTabelle(S);
}
function zeichneVerlaufTabelle(){
  const t = $('#verlaufTab'); if(!t) return;
  t.innerHTML = '';
  const kopf = el('tr', null, [el('th', {text: 'Jahr'}), el('th', {class: 'r', text: 'Rechnung'}), el('th', {class: 'r', text: 'Budget'}), el('th', {class: 'r', text: 'Finanzplan'}), el('th', {class: 'r h-s', text: 'Rechnung minus Budget'})]);
  const body = el('tbody');
  const w = k => { if(IDX[k] === undefined) return '·'; const v = kzWert(k); return v === null || v === undefined ? '·' : wertText(v); };
  for(let j = J_MIN; j <= J_MAX; j++){
    const jj = String(j).slice(2), r = IDX['r' + jj] !== undefined ? kzWert('r' + jj) : null, b = IDX['b' + jj] !== undefined ? kzWert('b' + jj) : null;
    const diff = r !== null && b !== null && !istProzent() ? `${mioVz(r - b)} Mio.` : '·';
    body.append(el('tr', null, [el('td', {text: String(j)}), el('td', {class: 'r', text: w('r' + jj)}), el('td', {class: 'r', text: w('b' + jj) + (DS[IDX['b' + jj]] && DS[IDX['b' + jj]].vorlage ? ' (Vorlage)' : '')}), el('td', {class: 'r', text: w('p' + jj)}), el('td', {class: 'r h-s', text: diff})]));
  }
  t.append(el('thead', null, [kopf]), body);
}
function platziereTip(ev){
  const tip = $('#tip'); tip.style.display = 'block';
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let lx = ev.clientX + 14, ly = ev.clientY + 14;
  if(lx + w > window.innerWidth - 8) lx = ev.clientX - w - 14;
  if(ly + h > window.innerHeight - 8) ly = ev.clientY - h - 14;
  tip.style.left = Math.max(8, lx) + 'px'; tip.style.top = Math.max(8, ly) + 'px';
}

/* ── Departemente, Dienststellen, Aufgabenfelder ─────────────────────── */
function spark(werte, w, h){
  const v = werte.filter(q => q !== null);
  if(v.length < 2) return '';
  let lo = Math.min(...v), hi = Math.max(...v);
  const rand = Math.max((hi - lo) * 0.15, Math.abs(hi) * 0.02, 1); lo -= rand; hi += rand;
  const xs = i => 3 + (w - 6) * i / (werte.length - 1), ys = q => 3 + (h - 6) * (1 - (q - lo) / ((hi - lo) || 1));
  let s = `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true">`;
  const pts = werte.map((q, i) => q === null ? null : [xs(i), ys(q)]).filter(Boolean);
  s += `<path d="${pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('')}" fill="none" stroke="${farbe('--linie-r')}" stroke-width="1.6"/>`;
  const l = pts[pts.length - 1];
  return s + `<circle cx="${l[0]}" cy="${l[1]}" r="2.6" fill="${farbe('--text')}"/></svg>`;
}
const BEREICH_KS = () => D.jahre.filter(j => j.a === 'r').map(j => j.k).concat(D.jahre.filter(j => j.a === 'b' && j.j > Math.max(...D.jahre.filter(x => x.a === 'r').map(x => x.j))).map(j => j.k));
const offeneDep = new Set();
function zeichneBereiche(){
  const t = $('#departemente'); if(!t) return;
  t.innerHTML = '';
  const ks = BEREICH_KS(), kL = ks[ks.length - 1], kV = ks[ks.length - 2];
  const kurzT = k => dsT(k).replace('Budget ', 'B ').replace('Rechnung ', 'R ') + (DS[IDX[k]].vorlage ? ' Vorlage' : '');
  const alt = k => ['r21', 'r22', 'r23'].includes(k) ? ' h-m' : '';
  t.append(el('thead', null, [el('tr', null, [el('th', {text: 'Departement, Dienststelle'}), el('th', {class: 'h-s', text: 'Verlauf'}), ...ks.map(k => el('th', {class: 'r' + alt(k), text: kurzT(k)})), el('th', {class: 'r h-s', text: `${kurzT(kL)} − ${kurzT(kV)}`})])]));
  const body = el('tbody');
  const summe = {};
  const zeileBauen = (name, code, wertVon, art, ebene) => {
    const id = art + code;
    const tr = el('tr', {class: 'klick' + (st.bereich === id ? ' aktiv' : '') + (ebene ? ' entw-dst' : ''), tabindex: '0'});
    const td0 = el('td', {class: 'name'});
    if(!ebene){
      const auf = el('button', {type: 'button', class: 'mk komm', 'aria-expanded': String(offeneDep.has(code)), title: 'Dienststellen zeigen', text: offeneDep.has(code) ? '−' : '+'});
      auf.style.marginRight = '8px';
      auf.addEventListener('click', ev => { ev.stopPropagation(); if(offeneDep.has(code)) offeneDep.delete(code); else offeneDep.add(code); zeichneBereiche(); });
      td0.append(auf);
    }
    td0.append(el('span', {class: 'code', text: code}), document.createTextNode(name));
    tr.append(td0);
    const werte = ks.map(wertVon);
    const tdS = el('td', {class: 'h-s'}); tdS.innerHTML = spark(werte, 120, 28); tr.append(tdS);
    ks.forEach((k, i) => tr.append(el('td', {class: 'r' + alt(k), text: werte[i] === null ? '·' : mio(werte[i])})));
    const a = werte[ks.length - 1], b = werte[ks.length - 2];
    tr.append(el('td', {class: 'r h-s', text: a !== null && b !== null ? `${mioVz(a - b, Math.abs(a - b) < 1e5 ? 2 : 1)} ${pct(a - b, b)}` : '·'}));
    const wahl = () => { st.bereich = id; zeichneVerlauf(); zeichneBereiche(); hashSchreiben(); $('#verlaufTitel').scrollIntoView({behavior: 'smooth', block: 'center'}); };
    tr.addEventListener('click', wahl); tr.addEventListener('keydown', ev => { if(ev.key === 'Enter') wahl(); });
    return tr;
  };
  for(const dep of Object.keys(D.dep).sort()){
    const wv = k => { const v = (D.depn[k] || {})[dep]; return v ? v[2] : null; };
    ks.forEach(k => { summe[k] = (summe[k] || 0) + (wv(k) || 0); });
    body.append(zeileBauen(D.dep[dep], dep, wv, 'd', 0));
    if(offeneDep.has(dep)){
      const dsts = Object.keys(D.dst).filter(c => c.slice(0, 2) === dep && ks.some(k => (D.dstn[k] || {})[c])).sort();
      dsts.forEach(c => body.append(zeileBauen(D.dst[c] || ('Dienststelle ' + c), c, k => { const v = (D.dstn[k] || {})[c]; return v ? v[2] : null; }, 's', 1)));
    }
  }
  const tr = el('tr', {class: 'summe'}); tr.append(el('td', {text: 'Total: Aufwand minus Ertrag'}), el('td', {class: 'h-s'}));
  ks.forEach(k => tr.append(el('td', {class: 'r' + alt(k), text: mio(summe[k])})));
  tr.append(el('td', {class: 'r h-s', text: mioVz(summe[kL] - summe[kV])}));
  body.append(tr); t.append(body);
  // Aufgabenfelder des Finanzplans
  const f = $('#felder'); if(!f) return;
  f.innerHTML = '';
  f.append(el('thead', null, [el('tr', null, [el('th', {text: 'Aufgabenfeld'}), el('th', {class: 'h-s', text: '2027 bis 2030'}), el('th', {class: 'r', text: 'B 2027'}), el('th', {class: 'r h-m', text: 'FP 2028'}), el('th', {class: 'r h-m', text: 'FP 2029'}), el('th', {class: 'r', text: 'FP 2030'}), el('th', {class: 'r h-s', text: '2030 − 2027'}), el('th', {class: 'r h-m', text: 'Summe 2027–2030'})])]));
  const fb = el('tbody'), fs = [0, 0, 0, 0];
  for(const x of D.felder){
    const tr2 = el('tr', {class: 'klick' + (st.bereich === 'f' + x.nr ? ' aktiv' : ''), tabindex: '0'});
    const w = x.netto.map(v => v * 1000); w.forEach((v, i) => fs[i] += v);
    const tdS = el('td', {class: 'h-s'}); tdS.innerHTML = spark(w, 120, 28);
    tr2.append(el('td', {text: x.name + (x.netto[0] < 0 ? ' (Nettoertrag)' : '')}), tdS, el('td', {class: 'r', text: mio(w[0])}), el('td', {class: 'r h-m', text: mio(w[1])}), el('td', {class: 'r h-m', text: mio(w[2])}), el('td', {class: 'r', text: mio(w[3])}),
      el('td', {class: 'r h-s', text: `${mioVz(w[3] - w[0])} ${pct(w[3] - w[0], w[0])}`}), el('td', {class: 'r h-m', text: mio(x.kumuliert * 1000)}));
    const wahl = () => { st.bereich = 'f' + x.nr; zeichneVerlauf(); zeichneBereiche(); hashSchreiben(); $('#verlaufTitel').scrollIntoView({behavior: 'smooth', block: 'center'}); };
    tr2.addEventListener('click', wahl); tr2.addEventListener('keydown', ev => { if(ev.key === 'Enter') wahl(); });
    fb.append(tr2);
  }
  const ts = el('tr', {class: 'summe'});
  ts.append(el('td', {text: 'Total: Aufwandüberschuss'}), el('td', {class: 'h-s'}), el('td', {class: 'r', text: mio(fs[0])}), el('td', {class: 'r h-m', text: mio(fs[1])}), el('td', {class: 'r h-m', text: mio(fs[2])}), el('td', {class: 'r', text: mio(fs[3])}), el('td', {class: 'r h-s', text: mioVz(fs[3] - fs[0])}), el('td', {class: 'r h-m', text: mio(D.felder.reduce((a, x) => a + x.kumuliert * 1000, 0))}));
  fb.append(ts); f.append(fb);
}
function bereichAuswahlFuellen(){
  const selB = $('#kzBereich'); if(!selB) return;
  const og1 = el('optgroup', {label: 'Departement, Rechnung und Budget 2021 bis 2027'});
  Object.keys(D.dep).sort().forEach(c => og1.append(el('option', {value: 'd' + c, text: `${c} ${D.dep[c]}`})));
  selB.append(og1);
  Object.keys(D.dep).sort().forEach(dep => {
    const og = el('optgroup', {label: `Dienststellen: ${D.dep[dep]}`});
    Object.keys(D.dst).filter(c => c.slice(0, 2) === dep && D.jahre.some(j => (D.dstn[j.k] || {})[c])).sort().forEach(c => og.append(el('option', {value: 's' + c, text: `${c} ${D.dst[c] || 'Dienststelle'}`})));
    if(og.children.length) selB.append(og);
  });
  const og3 = el('optgroup', {label: 'Sachgruppe, ordentlich, auch Finanzplan'});
  Object.keys(D.sg).filter(c => c.length === 2 && ORDENTLICH(c) && DS.some(d => (istPlan(d.k) ? D.agg[d.k] : D.g2[d.k] || {})[c])).sort().forEach(c => og3.append(el('option', {value: 'g' + c, text: `${c} ${D.sg[c]}`})));
  selB.append(og3);
  const og2 = el('optgroup', {label: 'Aufgabenfeld, Budget 2027 und Finanzplan'});
  D.felder.forEach(x => og2.append(el('option', {value: 'f' + x.nr, text: x.name})));
  selB.append(og2);
  selB.addEventListener('change', () => { st.bereich = selB.value === '' ? null : selB.value; zeichneVerlauf(); zeichneBereiche(); hashSchreiben(); });
  $$('#eaChips button').forEach(b => b.addEventListener('click', () => { st.ea = b.dataset.wert; zeichneVerlauf(); hashSchreiben(); }));
}

/* ── Vergleich: Icicles, Tabelle, Baum ───────────────────────────────── */
function zeichneDrill(){
  if(!$('#icicles') || !BAUM) return;
  const ir = st.rechnung === 'ir';
  $$('#drillSteuer .chips button').forEach(b => {
    const f = b.dataset.feld, w = b.dataset.wert;
    b.setAttribute('aria-pressed', String(String(st[f]) === w));
    if(f === 'gl' && w === 'inst') { b.disabled = gesperrt() && !ir; b.title = b.disabled ? 'Der Finanzplan liegt nur nach Sachgruppen vor.' : ''; }
    if(f === 'umfang') b.disabled = ir;
  });
  $('#ansA').textContent = ir ? 'Ausgaben' : 'Aufwand';
  $('#ansE').textContent = ir ? 'Einnahmen' : 'Ertrag';
  const weg = aktuellerKnoten(), jetzt = weg[weg.length - 1];
  const kr = $('#krume'); kr.innerHTML = '';
  weg.forEach((n, i) => {
    if(i === weg.length - 1) kr.append(el('span', {class: 'jetzt', text: knotenName(n)}));
    else { const b = el('button', {type: 'button', text: knotenName(n)}); b.addEventListener('click', () => { st.pfad = st.pfad.slice(0, i); st.markiert = null; zeichneDrill(); hashSchreiben(); }); kr.append(b, el('span', {class: 'sep', text: '›'})); }
  });
  const az = $('#aufteilungZus'); if(az) az.textContent = `${st.rechnung === 'ir' ? 'Investitionsrechnung' : 'Erfolgsrechnung'} · ${jetzt.id === 'root' ? 'oberste Ebene' : knotenName(jetzt)}`;
  zeichneIcicles(jetzt);
  $$('#tabArt button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.wert === st.tab)));
  if(st.tab === 'baum') zeichneBaum(); else zeichneTabelle(jetzt);
}
function zeichneIcicles(jetzt){
  const box = $('#icicles'); box.innerHTML = '';
  const W = Math.max(300, box.clientWidth || 900), H1 = 38, H2 = 24, G = 3;
  const kinder = kinderSortiert(jetzt);
  const summen = st.sel.map((_, s) => kinder.reduce((a, c) => a + pos(wert(c, s)), 0));
  const maxT = Math.max(1, ...summen);
  st.sel.forEach((k, s) => {
    const wrap = el('div', {class: 'ic'}), kopf = el('div', {class: 'ic-kopf'});
    const sw = el('span'); sw.style.cssText = `display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-1px;background:${slotFarbe(s)}`;
    const l = el('span'); l.append(sw, el('b', {text: `${SLOT[s]} · ${dsLang(k)}`}));
    const v = wert(jetzt, s);
    const dv = v - wert(jetzt, 0), st2 = Math.abs(v) < 1e7 ? 2 : 1;
    kopf.append(l, el('span', {class: 'wert', text: `${ansichtName()} ${mio(v, st2)} Mio. Fr.` + (s > 0 ? ` (${mioVz(dv, st2)} Mio.${pct(dv, wert(jetzt, 0)) ? ', ' + pct(dv, wert(jetzt, 0)) : ''})` : '')}));
    wrap.append(kopf);
    if(!kinder.some(c => pos(wert(c, s)) > 0)){
      const leer = istPlan(k) && jetzt.id === 'root' && st.rechnung === 'ir' ? 'Der Finanzplan führt die Investitionen nur als Total.'
        : istPlan(k) && jetzt.id !== 'root' ? 'Der Finanzplan liegt nur nach Sachgruppen vor.'
        : jetzt.v[s][0] || jetzt.v[s][1] ? `Keine positiven Beträge in der Ansicht ${ansichtName()}.` : `${dsT(k)}: keine Beträge auf dieser Ebene.`;
      wrap.append(el('div', {class: 'keine', text: leer})); box.append(wrap); return;
    }
    const hoehe = H1 + G + H2, fS = slotFarbe(s), fH = slotHell(s), tS = textAuf(fS), tH = textAuf(fH);
    let svg = `<svg viewBox="0 0 ${W} ${hoehe}" width="${W}" height="${hoehe}" role="img" aria-label="${esc(dsT(k))}: Aufteilung ${esc(jetzt.name)}">`;
    svg += `<rect class="leerband" x="0" y="0" width="${W}" height="${H1}" rx="3"/>`;
    let x = 0;
    for(const c of kinder){
      const w = W * pos(wert(c, s)) / maxT; if(w <= 0) continue;
      const bf = befundeFuer(c.id), mark = bf.d.length ? '▲ ' : '';
      svg += `<rect class="seg" data-id="${esc(c.id)}" x="${(x + 1).toFixed(2)}" y="0" width="${Math.max(w - 2, .6).toFixed(2)}" height="${H1}" rx="3" fill="${fS}"/>`;
      if(w > 58){ svg += `<text x="${(x + 7).toFixed(1)}" y="15" fill="${tS}" font-weight="700">${esc(kurz(mark + knotenName(c), Math.floor((w - 10) / 6.3)))}</text>`; if(w > 100) svg += `<text x="${(x + 7).toFixed(1)}" y="30" fill="${tS}">${mio(wert(c, s))} Mio.</text>`; }
      const enkel = [...c.kinder.values()].map(g => [g, pos(wert(g, s))]).filter(q => q[1] > 0).sort((a, b) => b[1] - a[1]);
      const es = enkel.reduce((a, q) => a + q[1], 0);
      let x2 = x;
      for(const [g, gv] of enkel){
        const w2 = w * gv / es;
        if(w2 > .8) svg += `<rect class="seg" data-id="${esc(g.id)}" x="${(x2 + 1).toFixed(2)}" y="${H1 + G}" width="${Math.max(w2 - 2, .6).toFixed(2)}" height="${H2}" rx="2" fill="${fH}"/>`;
        if(w2 > 70) svg += `<text x="${(x2 + 6).toFixed(1)}" y="${H1 + G + 16}" fill="${tH}">${esc(kurz(knotenName(g), Math.floor((w2 - 10) / 6)))}</text>`;
        x2 += w2;
      }
      x += w;
    }
    const div = el('div'); div.innerHTML = svg + '</svg>'; wrap.append(div); box.append(wrap);
  });
  const tip = $('#tip');
  $$('rect.seg', box).forEach(r => {
    const n = KNOTEN.get(r.dataset.id);
    r.addEventListener('pointermove', ev => {
      tip.innerHTML = ''; tip.append(el('div', {class: 't', text: knotenName(n)}));
      const z = el('div', {class: 'z'});
      st.sel.forEach((k, s) => { const i = el('i', {class: 'k'}); i.style.background = slotFarbe(s); z.append(i, el('span', {text: SLOT[s] + ' · ' + dsLang(k)}), el('b', {text: fr(wert(n, s))})); });
      tip.append(z);
      if(st.sel.length > 1) tip.append(el('div', {class: 'd', text: st.sel.slice(1).map((k, i) => `${SLOT[i + 1]} minus A: ${frS(wert(n, i + 1) - wert(n, 0))} ${pct(wert(n, i + 1) - wert(n, 0), wert(n, 0))}`).join(' · ')}));
      const bf = befundeFuer(n.id);
      if(bf.d.length) tip.append(el('div', {class: 'd', text: `▲ ${bf.d.length} Prüfhinweis${bf.d.length > 1 ? 'e' : ''} zu diesem Eintrag`}));
      platziereTip(ev);
    });
    r.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
    r.addEventListener('click', () => {
      tip.style.display = 'none';
      if(gesperrt()){ $('#planhinweis').scrollIntoView({behavior: 'smooth', block: 'center'}); return; }
      if(n.blatt){ setzePfad(n.eltern); st.markiert = n.id; } else setzePfad(n);
      zeichneDrill(); hashSchreiben();
    });
  });
}
function kopfZeile(erste){
  const kopf = el('tr', null, [el('th', {text: erste})]);
  st.sel.forEach((k, s) => { const th = el('th', {class: 'r' + (s === 2 ? ' h-m' : '')}); const sw = el('span', {class: 'schl'}); sw.style.background = slotFarbe(s); th.append(sw, document.createTextNode(SLOT[s])); th.title = dsLang(k); kopf.append(th); });
  st.sel.slice(1).forEach((k, i) => kopf.append(el('th', {class: 'r' + (i === 1 ? ' h-m' : ' h-s'), text: `${SLOT[i + 1]} minus A`})));
  kopf.append(el('th', {class: 'r', text: ''}));
  return kopf;
}
function wertZellen(tr, c){
  st.sel.forEach((_, s) => tr.append(el('td', {class: 'r' + (s === 2 ? ' h-m' : ''), text: sichtbar(c, s) ? fr(wert(c, s)) : '·'})));
  st.sel.slice(1).forEach((_, i) => { const d = wert(c, i + 1) - wert(c, 0); const td = el('td', {class: 'r' + (i === 1 ? ' h-m' : ' h-s')}); td.append(el('div', {text: d ? frS(d) : '·'})); if(d && Math.abs(wert(c, 0)) >= 1) td.append(el('div', {class: 'leise klein', text: pct(d, wert(c, 0))})); tr.append(td); });
}
function markenZelle(c, kommBaum){
  const tdm = el('td', {class: 'r'});
  const km = kommentareFuer(c);
  if(km.length){
    const b = el('button', {type: 'button', class: 'mk komm', title: 'Kommentar der Dienststelle', 'aria-label': 'Kommentar der Dienststelle', text: 'Kommentar'});
    if(kommBaum){ b.setAttribute('aria-expanded', String(st.kommOffen.has(c.id))); b.addEventListener('click', ev => { ev.stopPropagation(); if(st.kommOffen.has(c.id)) st.kommOffen.delete(c.id); else st.kommOffen.add(c.id); zeichneBaum(); }); }
    else b.addEventListener('click', ev => { ev.stopPropagation(); zeigeKommentar(b, c, km); });
    tdm.append(b);
  }
  const bf = befundeFuer(c.id);
  if(bf.d.length){ const b = el('button', {type: 'button', class: 'mk', title: 'Prüfhinweise zu diesem Eintrag', text: '▲ ' + bf.d.length}); b.addEventListener('click', ev => { ev.stopPropagation(); zeigePop(b, bf.d, c); }); tdm.append(b); }
  else if(bf.i.length){ const b = el('button', {type: 'button', class: 'mk indirekt', title: 'Prüfhinweise in tieferen Ebenen', text: bf.i.length + ' darunter'}); b.addEventListener('click', ev => { ev.stopPropagation(); zeigePop(b, bf.i, c); }); tdm.append(b); }
  return tdm;
}
function zeichneTabelle(jetzt){
  const t = $('#tabelle'); t.innerHTML = '';
  const kinder = kinderSortiert(jetzt).filter(c => st.sel.some((_, s) => sichtbar(c, s)));
  if(!kinder.length){ t.append(el('div', {class: 'leise', text: jetzt.kinder.size ? `Keine Einträge mit ${ansichtName()} auf dieser Ebene.` : 'Unterste Ebene erreicht.'})); return; }
  const k0 = kinder[0].id[0];
  const kopfName = {d: 'Departement', s: 'Dienststelle', f: 'Fonds', v: 'Vorhaben', k: 'Konto', a: 'Sachgruppe', b: 'Sachgruppe'}[k0] || 'Eintrag';
  const body = el('tbody');
  const max = Math.max(1, ...kinder.flatMap(c => st.sel.map((_, s) => Math.abs(wert(c, s)))));
  const zu = gesperrt();
  for(const c of kinder){
    const klickbar = !c.blatt && !zu && c.kinder.size;
    const tr = el('tr', {class: (klickbar ? 'klick' : '') + (st.markiert === c.id ? ' markiert' : ''), 'data-id': c.id, tabindex: klickbar ? '0' : null});
    const td0 = el('td');
    td0.append(el('span', {class: 'code', text: c.code}), document.createTextNode(c.name));
    const balk = el('div', {class: 'balk'});
    st.sel.forEach((_, s) => { const b = el('span'); b.style.width = (100 * Math.abs(wert(c, s)) / max).toFixed(1) + '%'; b.style.background = slotFarbe(s); if(wert(c, s) < 0) b.style.opacity = '.45'; balk.append(b); });
    td0.append(balk); tr.append(td0);
    wertZellen(tr, c);
    tr.append(markenZelle(c, false));
    if(klickbar){ const go = () => { setzePfad(c); st.markiert = null; zeichneDrill(); hashSchreiben(); }; tr.addEventListener('click', go); tr.addEventListener('keydown', ev => { if(ev.key === 'Enter') go(); }); }
    body.append(tr);
  }
  const sum = el('tr', {class: 'summe'});
  sum.append(el('td', {text: 'Total ' + (jetzt.id === 'root' ? jetzt.name : knotenName(jetzt))}));
  st.sel.forEach((_, s) => sum.append(el('td', {class: 'r' + (s === 2 ? ' h-m' : ''), text: fr(wert(jetzt, s))})));
  st.sel.slice(1).forEach((_, i) => sum.append(el('td', {class: 'r' + (i === 1 ? ' h-m' : ' h-s'), text: frS(wert(jetzt, i + 1) - wert(jetzt, 0))})));
  sum.append(markenZelle(jetzt, false));
  body.append(sum);
  t.append(el('table', {class: 'tab'}, [el('thead', null, [kopfZeile(kopfName + ' · ' + ansichtName() + ', Franken')]), body]));
  if(st.markiert){ const m = $(`tr[data-id="${CSS.escape(st.markiert)}"]`, t); if(m) setTimeout(() => m.scrollIntoView({behavior: 'smooth', block: 'center'}), 60); }
}
/* Baum: jede Stufe aufklappbar, mehrere Äste offen. Der geöffnete Pfad ist anfangs offen. */
const BAUM_GRENZE = 60;
const baumMehr = new Map();
function zeichneBaum(){
  const t = $('#tabelle'); t.innerHTML = '';
  st.pfad.forEach(id => st.offen.add(id));
  const body = el('tbody');
  const zu = gesperrt();
  const zeile = (c, tiefe) => {
    const kinder = kinderSortiert(c).filter(x => st.sel.some((_, s) => sichtbar(x, s)));
    const hatKinder = !zu && kinder.length > 0;
    const offen = hatKinder && st.offen.has(c.id);
    const tr = el('tr', {class: `t${Math.min(tiefe, 3)}` + (offen ? ' offen-z' : '') + (st.markiert === c.id ? ' markiert' : ''), 'data-id': c.id});
    const td0 = el('td', {class: 'name'}); td0.style.setProperty('--t', tiefe);
    const kn = el('button', {type: 'button', class: 'auf' + (hatKinder ? '' : ' leer'), 'aria-expanded': String(offen), 'aria-label': (offen ? 'Zuklappen: ' : 'Aufklappen: ') + knotenName(c), text: offen ? '−' : '+'});
    if(hatKinder) kn.addEventListener('click', () => { if(st.offen.has(c.id)) st.offen.delete(c.id); else st.offen.add(c.id); zeichneBaum(); });
    else kn.tabIndex = -1;
    td0.append(kn, el('span', {class: 'code', text: c.code}), document.createTextNode(c.name));
    tr.append(td0);
    wertZellen(tr, c);
    tr.append(markenZelle(c, true));
    body.append(tr);
    const km = kommentareFuer(c);
    if(km.length && st.kommOffen.has(c.id)){
      const td = el('td', {colspan: String(2 + st.sel.length * 2)}); td.style.paddingLeft = `calc(${tiefe + 1} * 18px + 8px)`;
      km.forEach(([k, s, txt]) => { const p = el('p', {style: 'margin:0 0 4px'}); p.append(el('b', {text: `${SLOT[s]} · ${dsDok(k)}: `}), el('q', {text: txt})); td.append(p); });
      body.append(el('tr', {class: 'komm-zeile'}, [td]));
    }
    if(offen){
      const n = baumMehr.get(c.id) || BAUM_GRENZE;
      kinder.slice(0, n).forEach(x => zeile(x, tiefe + 1));
      if(kinder.length > n){
        const td = el('td', {colspan: String(2 + st.sel.length * 2)});
        const b = el('button', {type: 'button', class: 'knopf', text: `Weitere ${Math.min(BAUM_GRENZE, kinder.length - n)} von ${kinder.length - n} zeigen`});
        b.addEventListener('click', () => { baumMehr.set(c.id, n + BAUM_GRENZE); zeichneBaum(); });
        td.append(b); body.append(el('tr', {class: 'mehrzeile'}, [td]));
      }
    }
  };
  const oben = kinderSortiert(BAUM).filter(c => st.sel.some((_, s) => sichtbar(c, s)));
  if(!oben.length){ t.append(el('div', {class: 'leise', text: `Keine Einträge mit ${ansichtName()}.`})); return; }
  oben.forEach(c => zeile(c, 0));
  const sum = el('tr', {class: 'summe'});
  sum.append(el('td', {text: 'Total ' + BAUM.name}));
  st.sel.forEach((_, s) => sum.append(el('td', {class: 'r' + (s === 2 ? ' h-m' : ''), text: fr(wert(BAUM, s))})));
  st.sel.slice(1).forEach((_, i) => sum.append(el('td', {class: 'r' + (i === 1 ? ' h-m' : ' h-s'), text: frS(wert(BAUM, i + 1) - wert(BAUM, 0))})));
  sum.append(el('td'));
  body.append(sum);
  const werkzeug = el('div', {class: 'werkzeug', style: 'margin:0 0 6px'});
  const allesZu = el('button', {type: 'button', class: 'knopf', text: 'Alle zuklappen'});
  allesZu.addEventListener('click', () => { st.offen.clear(); st.kommOffen.clear(); st.pfad = []; zeichneDrill(); hashSchreiben(); });
  const ersteAuf = el('button', {type: 'button', class: 'knopf', text: 'Erste Stufe aufklappen'});
  ersteAuf.addEventListener('click', () => { oben.forEach(c => st.offen.add(c.id)); zeichneBaum(); });
  werkzeug.append(el('span', {class: 'leise klein', text: `${gesperrt() ? 'Finanzplan: nur Sachgruppen. ' : ''}+ klappt eine Stufe auf, − zu. Mehrere Äste können offen sein.`}), el('div', {class: 'knoepfe'}, [ersteAuf, allesZu]));
  t.append(werkzeug, el('table', {class: 'tab baum'}, [el('thead', null, [kopfZeile((st.gl === 'inst' ? 'Departement › Dienststelle › Konto' : 'Sachgruppe › Konto') + ' · ' + ansichtName() + ', Franken')]), body]));
  if(st.markiert){ const m = $(`tr[data-id="${CSS.escape(st.markiert)}"]`, t); if(m) setTimeout(() => m.scrollIntoView({behavior: 'smooth', block: 'center'}), 60); }
}
function popZeigen(anker){
  const pop = $('#pop'), r = anker.getBoundingClientRect();
  pop.style.display = 'block';
  const w = pop.offsetWidth;
  pop.style.left = Math.max(8, Math.min(window.scrollX + r.right - w, window.scrollX + window.innerWidth - w - 8)) + 'px';
  pop.style.top = (window.scrollY + r.bottom + 6) + 'px';
}
function zeigePop(anker, liste, knoten){
  const pop = $('#pop'); pop.innerHTML = '';
  pop.append(el('div', {class: 'kopf-pop', text: `${liste.length} Prüfhinweis${liste.length > 1 ? 'e' : ''}: ${knotenName(knoten)}`}));
  const ol = el('ol');
  liste.slice(0, 12).forEach(i => { const b = BF[i]; const li = el('li'); const a = el('a', {href: `${BASIS}pruefhinweise/#nr=${b.nr}`, text: `${b.nr}. ${b.titel}`}); li.append(a); ol.append(li); });
  pop.append(ol);
  if(liste.length > 12) pop.append(el('div', {class: 'leise klein', text: `und ${liste.length - 12} weitere auf der Seite Prüfhinweise`}));
  popZeigen(anker);
}
function zeigeKommentar(anker, knoten, liste){
  const pop = $('#pop'); pop.innerHTML = '';
  pop.append(el('div', {class: 'kopf-pop', text: knotenName(knoten)}));
  liste.forEach(([k, s, t]) => { const p = el('p'); p.append(el('b', {text: `${SLOT[s]} · ${dsDok(k)}: `}), el('q', {text: t})); pop.append(p); });
  pop.append(el('div', {class: 'leise klein', text: 'Kommentar der Organisationseinheit im Dokument, im Wortlaut. Er begründet die Abweichung zum Vorjahresbudget, in der Staatsrechnung die Abweichung zum Budget.'}));
  popZeigen(anker);
}
document.addEventListener('click', ev => { const pop = $('#pop'); if(pop && pop.style.display === 'block' && !pop.contains(ev.target) && !ev.target.classList.contains('mk')) pop.style.display = 'none'; });

/* ── Suche im Vergleich: springt auf einen Knoten ────────────────────── */
function springeZu(n){
  if(gesperrt() && n.tiefe > 1){ $('#planhinweis').scrollIntoView({behavior: 'smooth', block: 'center'}); return; }
  if(!st.sel.some((_, s) => sichtbar(n, s))) st.ansicht = st.sel.some((_, s) => Math.abs(n.v[s][0]) > .004) ? 'A' : 'E';
  if(n.blatt || !n.kinder.size){ setzePfad(n.eltern); st.markiert = n.id; } else { setzePfad(n.eltern && n.eltern.id !== 'root' ? n.eltern : BAUM); st.markiert = n.id; }
  zeichneDrill(); hashSchreiben();
}

/* ── CSV der aktuellen Tabelle ───────────────────────────────────────── */
function csv(){
  const weg = aktuellerKnoten(), jetzt = weg[weg.length - 1];
  const zeilen = [['Ebene', 'Code', 'Bezeichnung', ...st.sel.map(k => dsLang(k) + ' ' + ansichtName())]];
  for(const c of kinderSortiert(jetzt)) zeilen.push([weg.map(n => n.name).join(' > '), c.code, c.name, ...st.sel.map((_, s) => wert(c, s).toFixed(0))]);
  const text = '﻿' + zeilen.map(z => z.map(v => /[;"\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : v).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type: 'text/csv;charset=utf-8'}));
  a.download = 'finanzspiegel-' + st.rechnung + '-' + st.sel.join('-') + '-' + (jetzt.code || 'total').replace(/[^\w.]+/g, '') + '.csv';
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ── Prüfhinweise ────────────────────────────────────────────────────── */
function bfGefiltert(){
  const f = st.bf, q = norm(f.q.trim());
  return BF.map((b, i) => [b, i]).filter(([b]) =>
    (f.typ === 'alle' || b.typ === f.typ) && (f.ds === 'alle' || b.ds.includes(f.ds)) &&
    (f.min === 0 || b.stufe <= f.min) && (!f.nurAuswahl || b.ds.some(k => st.sel.includes(k))) &&
    (!f.dep || (b.pfad[0] || '') === 'd' + f.dep) &&
    (!q || norm(b.titel + ' ' + b.fakten.join(' ') + ' ' + b.komm.map(x => x[1] + ' ' + x[2]).join(' ')).includes(q)));
}
function zeichneBefunde(){
  const typen = $('#bfTypen'); if(!typen) return;
  typen.innerHTML = '';
  const f = st.bf;
  const basis = BF.filter(b => (f.ds === 'alle' || b.ds.includes(f.ds)) && (f.min === 0 || b.stufe <= f.min) && (!f.nurAuswahl || b.ds.some(k => st.sel.includes(k))) && (!f.dep || (b.pfad[0] || '') === 'd' + f.dep));
  [['alle', 'Alle'], ...(D.typen || []).map(t => [t, t])].forEach(([k, t]) => {
    if(k !== 'alle' && !BF.some(b => b.typ === k)) return;
    const n = k === 'alle' ? basis.length : basis.filter(b => b.typ === k).length;
    const b = el('button', {type: 'button', 'aria-pressed': String(f.typ === k)}); b.append(document.createTextNode(t), el('em', {text: String(n)}));
    b.addEventListener('click', () => { st.bf.typ = k; st.bfZahl = 30; zeichneBefunde(); hashSchreiben(); });
    typen.append(b);
  });
  const liste = $('#bfListe'); liste.innerHTML = '';
  const g = bfGefiltert();
  $('#bfZahl').textContent = `${g.length} von ${BF.length} Prüfhinweisen`;
  g.slice(0, st.bfZahl).forEach(([b, i]) => {
    const li = el('li', {class: 'bf' + (st.bfOffen.has(i) ? ' offen' : ''), id: 'bf-' + b.nr});
    const kopf = el('button', {type: 'button', class: 'bf-kopf', 'aria-expanded': String(st.bfOffen.has(i))});
    const meta = el('span', {class: 'meta'}); meta.append(el('span', {class: 'typ', text: b.typ}), document.createTextNode(b.ds.map(dsLang).join(', ') + (b.rechnung === 'ir' ? ' · Investitionsrechnung' : '')));
    kopf.append(el('span', {class: 'nr', text: b.nr + '.'}), el('span', {class: 'titel', text: b.titel}), el('span', {class: 'betr', text: mioVz(b.chf, 2) + ' Mio.'}), meta);
    kopf.addEventListener('click', () => { if(st.bfOffen.has(i)) st.bfOffen.delete(i); else st.bfOffen.add(i); li.classList.toggle('offen'); kopf.setAttribute('aria-expanded', String(st.bfOffen.has(i))); });
    const body = el('div', {class: 'bf-body'});
    body.append(el('ol', null, b.fakten.map(x => el('li', {text: x}))));
    if(b.komm && b.komm.length){
      body.append(el('div', {class: 'komm-titel', text: b.komm_titel + ':'}));
      b.komm.forEach(([k, wo, t]) => { const q = el('blockquote'); q.append(el('b', {text: wo + ': '}), document.createTextNode('«' + t + '»')); body.append(q); });
    }
    const p = {d: b.ds.filter(k => IDX[k] !== undefined).slice(0, 3).join(','), r: b.rechnung || 'er', g: b.gl || 'inst', a: b.ansicht || 'N', u: b.umfang || 'alle'};
    if(b.pfad.length) p.p = b.pfad.join('/');
    if(b.markiert) p.m = b.markiert;
    body.append(el('a', {class: 'knopf', href: `${BASIS}vergleich/#${new URLSearchParams(p).toString()}`, text: 'Im Vergleich zeigen', style: 'display:inline-block;text-decoration:none'}));
    li.append(kopf, body); liste.append(li);
  });
  const mehr = $('#bfMehr'); mehr.innerHTML = '';
  if(g.length > st.bfZahl){ const b = el('button', {type: 'button', class: 'knopf', text: `Weitere ${Math.min(30, g.length - st.bfZahl)} anzeigen`}); b.addEventListener('click', () => { st.bfZahl += 30; zeichneBefunde(); }); mehr.append(b); }
}
function oeffneBefundNr(nr){
  const i = BF.findIndex(b => b.nr === nr); if(i < 0) return;
  st.bf = {typ: 'alle', ds: 'alle', min: 0, nurAuswahl: false, q: '', dep: ''};
  const p = bfGefiltert().findIndex(([, j]) => j === i);
  st.bfZahl = Math.max(30, p + 10);
  st.bfOffen.add(i);
  zeichneBefunde();
  const li = document.getElementById('bf-' + nr);
  if(li){ li.classList.add('markiert'); setTimeout(() => li.scrollIntoView({behavior: 'smooth', block: 'center'}), 80); setTimeout(() => li.classList.remove('markiert'), 2800); }
}

/* ── Grafiken für Präsentation und Social Media ───────────────────────────
   Knopf unten rechts, Dialog mit Motiv, Ebene, Format, Hintergrund und Titel,
   Vorschau im Canvas, Download als PNG oder Kopie in die Zwischenablage.
   Formate: Präsentation 16:9, Bericht 3:2, Social Media 4:5 (1080 × 1350).
   Die Grafiken sind immer hell. Grundlage ist die Ansicht, die auf der Seite
   gewählt ist; keine eigene Rechnung. Farben der Datensätze A, B, C wie auf der
   Seite; Flächen in Kuchen und Ringen nach Rang aus einer Reihe von sieben Farben,
   geprüft für benachbarte Flächen, Rest grau. */
const G_FORMATE = {
  hoch:    {w:1080, h:1350, t:'Social Media 4:5', m:'1080 × 1350 Pixel'},
  folie:   {w:1920, h:1080, t:'Präsentation 16:9', m:'1920 × 1080 Pixel'},
  bericht: {w:1800, h:1200, t:'Bericht 3:2', m:'1800 × 1200 Pixel'},
};
const G_MOTIVE = [
  ['kuchen', 'Kuchendiagramm der gewählten Ebene'],
  ['balken', 'Balkenliste der gewählten Ebene, bis drei Datensätze'],
  ['ringe', 'Ringdiagramm, A aussen, B und C innen'],
  ['ueberblick', 'Woher, wohin: Ertrag und Aufwand nach Sachgruppen'],
  ['entwicklung', 'Entwicklung der gewählten Kennzahl'],
  ['kennzahlen', 'Kennzahlen im Vergleich'],
];
const G_NOTIZ = {
  balken: 'Einträge der gewählten Ebene mit den Einstellungen des Vergleichs (Rechnung, Gliederung, Ansicht, Konten), für alle gewählten Datensätze. Einträge ohne Platz sind als «Übrige» zusammengefasst.',
  kuchen: 'Einträge der gewählten Ebene für einen Datensatz. Die sieben grössten einzeln, der Rest als «Übrige». Negative Beträge haben keine Fläche und stehen unter der Legende.',
  ringe: 'Einträge der gewählten Ebene als Ringe: A aussen, B und C nach innen. Gleiche Farbe heisst gleicher Eintrag. Skala «Anteile»: jeder Ring ergibt den vollen Kreis. Skala «Beträge»: das grösste Total ergibt den vollen Kreis, kleinere Totale bleiben offen.',
  ueberblick: 'Ordentlicher Ertrag und Aufwand eines Datensatzes nach Sachgruppen auf derselben Skala, mit der Rechnung vom operativen Ergebnis zum Gesamtergebnis.',
  entwicklung: 'Die unter «Entwicklung» gewählte Kennzahl oder der gewählte Bereich: Rechnung, Budget und Finanzplan 2021 bis 2030.',
  kennzahlen: 'Die Kennzahlen aus dem Vergleich mit den Differenzen gegenüber Datensatz A.',
};
const G = {motiv:'kuchen', format:'hoch', hg:'weiss', slot:0, skala:'anteil', ebene:null, tiefe:'naechste', titel:'', autoTitel:'', opener:null};
const G_MIT_EBENE = ['balken', 'kuchen', 'ringe'];
const G_TINTE = '#12161C', G_TINTE2 = '#3F4752', G_TINTE3 = '#5A626D', G_LINIE = '#E2E6EB', G_LINIE2 = '#C9CFD6';
const G_SLOT = ['#2a78d6', '#eb6834', '#1baf7a'];
// Kategoriale Reihe, geprüft für benachbarte Flächen in genau dieser Reihenfolge: Farben nur nach Rang vergeben
const G_KAT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7'];
const G_GRAU = '#B9BEC6', G_RECHNUNG = '#2C3440', G_BUDGET = '#7B8494', G_PLAN = '#7B8494';
const G_AUF = ['#0F766E','#1E9189','#3FB3A8','#7ACBC3','#A9DDD8','#CDEBE8','#E2F3F1'];
const G_ERT = ['#7E3C9A','#9553AE','#AE78C4','#C4A0D6','#D8BEE4','#E8D8F0','#F1E8F6'];
const G_TF = 'Archivo, "Helvetica Neue", Arial, sans-serif', G_F = '"Public Sans", "Helvetica Neue", Arial, sans-serif';

/* Hilfen für Text und Formen */
function gSchrift(x, gewicht, px, fam){ x.font = `${gewicht} ${Math.round(px * 10) / 10}px ${fam || G_F}`; }
function gSpacing(x, px){ if('letterSpacing' in x) x.letterSpacing = px + 'px'; }
function gKuerzen(x, t, breite){
  t = String(t);
  if(x.measureText(t).width <= breite) return t;
  let lo = 0, hi = t.length;
  while(lo < hi){ const m = Math.ceil((lo + hi) / 2); if(x.measureText(t.slice(0, m).trimEnd() + '…').width <= breite) lo = m; else hi = m - 1; }
  return t.slice(0, lo).trimEnd() + '…';
}
function gUmbruch(x, text, breite){
  const w = String(text).split(/\s+/).filter(Boolean), out = []; let z = '';
  for(const t of w){ const p = z ? z + ' ' + t : t; if(x.measureText(p).width > breite && z){ out.push(z); z = t; } else z = p; }
  if(z) out.push(z); return out;
}
function gZeilen(x, text, breite, n){
  const z = gUmbruch(x, text, breite);
  if(z.length <= n) return z.map(t => gKuerzen(x, t, breite));
  const out = z.slice(0, n - 1).map(t => gKuerzen(x, t, breite)); out.push(gKuerzen(x, z.slice(n - 1).join(' '), breite)); return out;
}
function gText(x, t, px, py, o){
  o = o || {};
  gSchrift(x, o.w || 400, o.s || 20, o.f);
  x.fillStyle = o.c || G_TINTE; x.textAlign = o.a || 'left'; x.textBaseline = o.b || 'alphabetic';
  const txt = o.max ? gKuerzen(x, String(t), o.max) : String(t);
  x.fillText(txt, px, py);
  const breite = x.measureText(txt).width;
  x.textAlign = 'left'; x.textBaseline = 'alphabetic';
  return breite;
}
function gRundBalken(x, x0, y, x1, h, r, farbe){
  // abgerundet am Datenende, gerade an der Nulllinie
  const l = Math.min(x0, x1), w = Math.abs(x1 - x0); if(w < .5) return;
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  x.fillStyle = farbe; x.beginPath();
  if(x1 >= x0){ x.moveTo(l, y); x.lineTo(l + w - rr, y); x.quadraticCurveTo(l + w, y, l + w, y + rr); x.lineTo(l + w, y + h - rr); x.quadraticCurveTo(l + w, y + h, l + w - rr, y + h); x.lineTo(l, y + h); }
  else { x.moveTo(l + w, y); x.lineTo(l + rr, y); x.quadraticCurveTo(l, y, l, y + rr); x.lineTo(l, y + h - rr); x.quadraticCurveTo(l, y + h, l + rr, y + h); x.lineTo(l + w, y + h); }
  x.closePath(); x.fill();
}
const gDs = k => dsLang(k);
const gName = n => knotenName(n);
const gRechnungWort = () => st.rechnung === 'ir' ? 'Investitionsrechnung' : 'Erfolgsrechnung';
const gGliederungWort = () => st.gl === 'art' ? 'Sachgruppen' : 'Departementen';
const gUmfangText = () => st.rechnung === 'er' ? (st.umfang === 'ord' ? ' · ordentlicher Aufwand und Ertrag' : ' · alle Konten') : '';

/* Einheit einer Grafik: nach dem grössten Betrag */
function gEinheit(werte){
  const m = Math.max(0, ...werte.filter(v => v !== null && v !== undefined).map(Math.abs));
  if(m >= 1e7) return {f: v => mioG(v, 1), t: 'Millionen Franken', k: 'Mio.'};
  if(m >= 1e6) return {f: v => mioG(v, 2), t: 'Millionen Franken', k: 'Mio.'};
  if(m >= 1e4) return {f: v => tsd(v), t: 'Tausend Franken', k: 'Tsd.'};
  return {f: v => fr(v), t: 'Franken', k: 'Fr.'};
}
const mioG = (v, s) => (v < 0 ? '−' : '') + tausender((Math.abs(v) / 1e6).toFixed(s));
const tsd = v => (v < 0 ? '−' : '') + tausender(Math.round(Math.abs(v) / 1000));

/* Quelle: die Dokumente der gezeigten Datensätze. «Vorlage» steht, solange ein
   Datensatz des Dokuments das Kennzeichen trägt (daten.py, JAHRE). */
function gQuelle(ks){
  const s = new Set(ks.map(k => DS[IDX[k]].q));
  const vl = q => DS.some(d => d.q === q && d.vorlage) ? ' (Vorlage des Regierungsrates)' : '';
  const teile = [];
  [...s].sort().reverse().forEach(q => {
    const j = q.replace(/\D/g, ''), jj = j.slice(2);
    if(q.startsWith('budget')){
      const plan = ks.some(k => DS[IDX[k]].a === 'p' && DS[IDX[k]].q === q);
      teile.push((plan ? `Budget ${j} und Finanzplan ${j}–${+j + 3}` : `Budget ${j}`) + vl(q));
    } else if(q.startsWith('rechnung')) teile.push(ks.includes('b' + jj) ? `Staatsrechnung ${j} mit Budget ${j}` : `Staatsrechnung ${j}`);
  });
  return teile;
}

/* Rahmen: Marke oben, Titel, Quelle und Stand unten.
   o: titel, unter (Untertitel), legende ([{f, t}]), ueber (Zeile über dem Titel), fuss (Einheit rechts unten), ds (gezeigte Datensätze) */
function gRahmen(x, W, H, o){
  const u = Math.min(W, H) / 1080, M = Math.round(64 * u), breit = W - 2 * M;
  x.setLineDash([]); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; gSpacing(x, 0);
  if(G.hg === 'weiss'){ x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, W, H); } else x.clearRect(0, 0, W, H);
  gSpacing(x, 1.2 * u); gText(x, 'KANTON SCHAFFHAUSEN', M, M + 24 * u, {w:700, s:27 * u, f:G_TF});
  gSpacing(x, 2 * u); gText(x, 'FINANZSPIEGEL', M, M + 54 * u, {w:600, s:18 * u, c:G_TINTE3});
  gSpacing(x, 0);
  x.fillStyle = G_TINTE; x.fillRect(M, M + 74 * u, breit, Math.max(1, 3 * u));
  let y = M + 74 * u + 58 * u;
  if(o.ueber){ gText(x, o.ueber, M, y, {s:20 * u, c:G_TINTE3, max: breit}); y += 56 * u; }
  else y += 12 * u;
  G.autoTitel = o.titel;
  const titelText = G.titel.trim() || o.titel;
  let ts = 46 * u;
  for(const g of [46, 40, 34]){ ts = g * u; gSchrift(x, 700, ts, G_TF); if(gUmbruch(x, titelText, breit).length <= 2) break; }
  gZeilen(x, titelText, breit, 2).forEach(z => { gText(x, z, M, y, {w:700, s:ts, f:G_TF, max: breit}); y += ts * 1.15; });
  y += (52 * u - ts * 1.15);
  let unten = y - 30 * u;
  if(o.unter){
    gSchrift(x, 400, 22 * u);
    const uz = gZeilen(x, o.unter, breit, 2);
    uz.forEach((z, i) => gText(x, z, M, y - 8 * u + i * 29 * u, {s:22 * u, c:G_TINTE2, max: breit}));
    unten = y - 8 * u + (uz.length - 1) * 29 * u;
    y = unten + 38 * u;
  }
  if(o.legende && o.legende.length){
    let lx = M, ly = y + (o.unter ? 2 : 0) * u;
    gSchrift(x, 500, 21 * u);
    o.legende.forEach(e => {
      const tw = Math.min(x.measureText(e.t).width, breit - 30 * u);
      if(lx > M && lx + 30 * u + tw > W - M){ lx = M; ly += 32 * u; }
      x.fillStyle = e.f; x.fillRect(lx, ly - 17 * u, 20 * u, 20 * u);
      gText(x, e.t, lx + 30 * u, ly, {w:500, s:21 * u, max: breit - 30 * u});
      lx += 30 * u + tw + 40 * u;
    });
    unten = ly;
  }
  // Fuss: Marke und Einheit, darunter die Quelle
  const yf = H - M;
  x.fillStyle = G_LINIE; x.fillRect(M, yf - 58 * u, breit, Math.max(1, 1.5 * u));
  const rechts = o.fuss || 'Beträge in Franken';
  gText(x, 'Politspiegel Schaffhausen · Finanzspiegel', M, yf - 30 * u, {w:700, s:18 * u});
  gText(x, rechts, W - M, yf - 30 * u, {s:16 * u, c:G_TINTE3, a:'right'});
  gSchrift(x, 400, 15 * u);
  const teile = gQuelle(o.ds || st.sel);
  const stand = ` · Stand ${standText()}`;
  // Von lang nach kurz; die erste, die in die Zeile passt. «Vorlage» bleibt bis zur kürzesten Form stehen.
  const kurz = t => t.replace(' (Vorlage des Regierungsrates)', ' (Vorlage)');
  const knapp = t => kurz(t).replace(/ \d{4}–\d{4}/, '').replace(/ mit Budget \d{4}/, '');
  const quellen = [`Quelle: Kanton Schaffhausen, ${teile.join(', ')}${stand}`, `Quelle: Kanton Schaffhausen, ${teile.map(kurz).join(', ')}${stand}`,
    `Quelle: Kanton Schaffhausen, ${teile.map(knapp).join(', ')}${stand}`, `Quelle: Kanton Schaffhausen, Budget und Staatsrechnung${stand}`];
  const quelle = quellen.find(t => x.measureText(t).width <= breit) || quellen[quellen.length - 1];
  gText(x, quelle, M, yf - 4 * u, {s:15 * u, c:G_TINTE3, max: breit});
  return {x0: M, x1: W - M, y0: unten + 48 * u, y1: yf - 84 * u, u, W, H, M};
}

/* Ebene der Grafik: Vorgabe ist die im Vergleich geöffnete Ebene oder der dort
   markierte Suchtreffer; im Dialog wählbar. Ebenen mit nur einem Untereintrag
   werden übersprungen. Mit Unterteilung «Konten» zeigt die Grafik alle Konten
   unterhalb der Ebene. */
function gKnotenVon(id){
  const weg = aktuellerKnoten(), jetzt = weg[weg.length - 1];
  return weg.find(n => n.id === id) || jetzt.kinder.get(id) || null;
}
function gZielKnoten(){
  const weg = aktuellerKnoten();
  let n = weg[weg.length - 1];
  const gewaehlt = G.ebene && gKnotenVon(G.ebene);
  if(gewaehlt) n = gewaehlt;
  if(gesperrt()) return n;
  while(n.kinder.size === 1){ const c = n.kinder.values().next().value; if(c.blatt || !c.kinder.size) break; n = c; }
  if(G.tiefe === 'konten' && [...n.kinder.values()].some(c => !c.blatt)){
    const konten = new Map();
    const sammeln = k => k.kinder.forEach(c => { if(c.blatt) konten.set(c.id, c); else sammeln(c); });
    sammeln(n);
    return Object.assign({}, n, {kinder: konten, alleKonten: true});
  }
  return n;
}
function gEbene(){
  const jetzt = gZielKnoten();
  const kinder = kinderSortiert(jetzt).filter(c => st.sel.some((_, s) => sichtbar(c, s)));
  return {jetzt, kinder};
}
function gUeberEbene(n){
  if(n.id === 'root') return gRechnungWort() + gUmfangText();
  const p = []; let e = n.eltern; while(e){ p.unshift(e.id === 'root' ? gRechnungWort() : gName(e)); e = e.eltern; }
  return p.join(' › ') + gUmfangText();
}
const gTitelEbene = n => n.alleKonten ? (n.id === 'root' ? `${ansichtName()} nach Konten` : `${gName(n)}: ${ansichtName()} nach Konten`)
  : n.id === 'root' ? `${ansichtName()} nach ${gGliederungWort()}` : `${gName(n)}: ${ansichtName()}`;

/* 1. Balkenliste der gewählten Ebene, bis drei Datensätze, Beträge am Balkenende */
function gBalken(x, W, H){
  const E = gEbene(), S = st.sel.length, n0 = E.jetzt;
  const alleW = E.kinder.flatMap(c => st.sel.map((_, s) => wert(c, s)));
  const ein = gEinheit(alleW.concat(st.sel.map((_, s) => wert(n0, s))));
  const B = gRahmen(x, W, H, {titel: gTitelEbene(n0), ueber: gUeberEbene(n0),
    unter: S === 1 ? `${gDs(st.sel[0])}, ${ansichtName()} in ${ein.t}` : `${ansichtName()} in ${ein.t}`,
    legende: S > 1 ? st.sel.map((k, s) => ({f: G_SLOT[s], t: `${SLOT[s]} · ${gDs(k)}`})) : null, fuss: `Beträge in ${ein.t}`});
  const u = B.u, quer = W > H, breite = B.x1 - B.x0;
  let y = B.y0;
  if(!E.kinder.length){ gText(x, `Keine Einträge mit ${ansichtName()} auf dieser Ebene.`, B.x0, y + 20 * u, {s:24 * u, c:G_TINTE3}); return; }
  gSchrift(x, 500, 22 * u);
  const namen = E.kinder.map(gName);
  const labelMax = quer ? Math.min(0.36 * breite, 640 * u) : 0;
  const zweizeilig = quer && namen.some(t => x.measureText(t).width > labelMax);
  const labelW = quer ? Math.min(labelMax, Math.max(x.measureText('Übrige (00)').width, ...namen.map(t => x.measureText(t).width)) + 4 * u) : 0;
  const gap = (S > 1 ? 3 : 0) * u, labelH = quer ? 0 : 31 * u, labelMin = quer ? (zweizeilig ? 50 : 26) * u : 0;
  const maxBar = (S === 1 ? 40 : S === 2 ? 26 : 20) * u, minBar = (S === 1 ? 12 : 9) * u;
  const gruppe = bh => S * bh + (S - 1) * gap;
  const zeileVon = bh => Math.max(labelMin, gruppe(bh)) + labelH + Math.max(14 * u, (S === 1 ? 0.6 : 0.32) * gruppe(bh));
  const platz = B.y1 - y - 40 * u;
  let zeilen = E.kinder.map((c, i) => ({name: namen[i], v: st.sel.map((_, s) => sichtbar(c, s) ? wert(c, s) : null)}));
  const nMax = Math.max(2, Math.floor(platz / zeileVon(minBar)));
  if(zeilen.length > nMax){
    const rest = zeilen.slice(nMax - 1);
    zeilen = zeilen.slice(0, nMax - 1);
    zeilen.push({name: `Übrige (${rest.length})`, uebrig: true, v: st.sel.map((_, s) => { const w = rest.map(r => r.v[s]).filter(v => v !== null); return w.length ? w.reduce((a, b) => a + b, 0) : null; })});
  }
  let barH = maxBar;
  while(barH > minBar && zeilen.length * zeileVon(barH) > platz) barH -= .5 * u;
  const zeileH = zeileVon(barH), gh = gruppe(barH), blockH = Math.max(gh, labelMin);
  const vs = Math.max(15 * u, Math.min(22 * u, (barH + gap) * (S === 1 ? 0.75 : 1)));
  gSchrift(x, 500, vs);
  const tw = v => x.measureText(ein.f(v)).width, abst = 10 * u;
  const alle = zeilen.flatMap(r => r.v.filter(v => v !== null));
  const posV = alle.filter(v => v > 0), negV = alle.filter(v => v < 0);
  const bx0 = B.x0 + labelW + (quer ? 24 * u : 0), bx1 = B.x1;
  const hi = Math.max(0, ...alle), lo = Math.min(0, ...alle);
  const maxTw = Math.max(0, ...alle.map(tw));
  let k = (bx1 - bx0 - (negV.length ? 2 : 1) * (abst + maxTw)) / Math.max(1, hi - lo);
  const xNull = bx0 + (negV.length ? Math.max(...negV.map(v => -v * k + abst + tw(v))) : 0);
  posV.forEach(v => { k = Math.min(k, (bx1 - xNull - abst - tw(v)) / v); });
  negV.forEach(v => { k = Math.min(k, (xNull - bx0 - abst - tw(v)) / -v); });
  k = Math.max(k, 0);
  const yStart = y;
  zeilen.forEach(r => {
    const tinte = r.uebrig ? G_TINTE2 : G_TINTE, gewicht = r.uebrig ? 400 : 500;
    if(quer){
      gSchrift(x, gewicht, 22 * u);
      const zl = gZeilen(x, r.name, labelW, 2), mitte = y + blockH / 2;
      const b0 = zl.length === 1 ? mitte + 8 * u : mitte - 4.5 * u;
      zl.forEach((z, i) => gText(x, z, B.x0, b0 + i * 25 * u, {w:gewicht, s:22 * u, c:tinte, max: labelW}));
    } else {
      gText(x, r.name, B.x0, y + 22 * u, {w:gewicht, s:22 * u, c:tinte, max: breite});
    }
    let by = y + labelH + (blockH - gh) / 2;
    r.v.forEach((v, s) => {
      const ym = by + barH / 2 + .5 * u;
      if(v === null){ gText(x, 'kein Betrag', xNull + abst, ym, {s:vs * .85, b:'middle', c:G_TINTE3}); }
      else {
        const xe = xNull + v * k;
        gRundBalken(x, xNull, by, xe, barH, Math.min(4 * u, barH / 2), G_SLOT[s]);
        if(v >= 0) gText(x, ein.f(v), xe + abst, ym, {w:500, s:vs, b:'middle'});
        else gText(x, ein.f(v), xe - abst, ym, {w:500, s:vs, b:'middle', a:'right'});
      }
      by += barH + gap;
    });
    y += zeileH;
  });
  if(negV.length){ x.fillStyle = G_LINIE2; x.fillRect(xNull - .75 * u, yStart - 6 * u, Math.max(1, 1.5 * u), y - yStart - (zeileH - blockH - labelH) + 12 * u); }
  const tot = st.sel.map((_, s) => wert(n0, s));
  const totText = S === 1 ? ein.f(tot[0]) : st.sel.map((kk, s) => `${SLOT[s]} ${ein.f(tot[s])}`).join(' · ');
  gText(x, `Total ${n0.id === 'root' ? gRechnungWort() : gName(n0)}: ${totText} ${ein.k}`, B.x0, y + 16 * u, {w:500, s:20 * u, c:G_TINTE2, max: breite});
}

/* 2. Kuchendiagramm der gewählten Ebene, ein Datensatz. Auf der untersten
   Ebene zeigt es die Ebene darüber. */
function gKuchen(x, W, H){
  const s = Math.min(G.slot, st.sel.length - 1), k = st.sel[s];
  let knoten = gEbene().jetzt;
  if(!knoten.kinder.size && knoten.eltern) knoten = knoten.eltern;
  const kinder = [...knoten.kinder.values()].map(c => [c, wert(c, s)]);
  const plus = kinder.filter(q => q[1] >= .5).sort((a, b) => b[1] - a[1] || a[0].id.localeCompare(b[0].id));
  const minus = kinder.filter(q => q[1] <= -.5);
  const summe = plus.reduce((a, q) => a + q[1], 0), total = wert(knoten, s);
  const ein = gEinheit(plus.map(q => q[1]).concat([summe]));
  const einzeln = plus.length <= 8 ? plus.length : 7;
  const teile = plus.slice(0, einzeln).map((q, i) => ({name: gName(q[0]), wert: q[1], f: i < 7 ? G_KAT[i] : G_GRAU}));
  if(plus.length > einzeln) teile.push({name: `Übrige (${plus.length - einzeln})`, wert: plus.slice(einzeln).reduce((a, q) => a + q[1], 0), f: G_GRAU, uebrig: true});
  const B = gRahmen(x, W, H, {titel: gTitelEbene(knoten), unter: `${gDs(k)}, ${ansichtName()} in ${ein.t}`, ueber: gUeberEbene(knoten), ds: [k], fuss: `Beträge in ${ein.t}`});
  const u = B.u, quer = W > H, breite = B.x1 - B.x0;
  if(!teile.length){ gText(x, `Keine positiven Beträge in der Ansicht ${ansichtName()}.`, B.x0, B.y0 + 30 * u, {s:24 * u, c:G_TINTE3}); return; }
  const hinweis = minus.length ? `Nicht dargestellt: ${minus.length} ${minus.length === 1 ? 'Eintrag' : 'Einträge'} mit negativem Betrag, zusammen ${ein.f(minus.reduce((a, q) => a + q[1], 0))} ${ein.k}. Total der Ebene: ${ein.f(total)} ${ein.k}` : '';
  const hoehe = B.y1 - B.y0;
  const legZeilen = quer ? teile.length : Math.ceil(teile.length / 2);
  let cx, cy, R;
  if(quer){ R = Math.min(hoehe * 0.46, breite * 0.2); cx = B.x0 + R + 10 * u; cy = B.y0 + hoehe / 2; }
  else { R = Math.min(breite * 0.3, (hoehe - legZeilen * 64 * u - 70 * u - (hinweis ? 60 * u : 0)) / 2); cx = W / 2; cy = B.y0 + R + 6 * u; }
  const r = R * 0.6;
  let a = -Math.PI / 2;
  teile.forEach(t => {
    t.a = a; t.w = 2 * Math.PI * t.wert / summe;
    x.beginPath(); x.arc(cx, cy, R, a, a + t.w); x.arc(cx, cy, r, a + t.w, a, true); x.closePath();
    x.fillStyle = t.f; x.fill();
    a += t.w;
  });
  if(teile.length > 1){
    x.save();
    if(G.hg === 'weiss') x.strokeStyle = '#FFFFFF'; else { x.globalCompositeOperation = 'destination-out'; x.strokeStyle = '#000000'; }
    x.lineWidth = 4 * u;
    teile.forEach(t => { x.beginPath(); x.moveTo(cx + Math.cos(t.a) * (r - 2 * u), cy + Math.sin(t.a) * (r - 2 * u)); x.lineTo(cx + Math.cos(t.a) * (R + 2 * u), cy + Math.sin(t.a) * (R + 2 * u)); x.stroke(); });
    x.restore();
  }
  teile.forEach(t => {
    if(t.wert / summe < 0.06) return;
    const m = t.a + t.w / 2, rx = cx + Math.cos(m) * (R + r) / 2, ry = cy + Math.sin(m) * (R + r) / 2;
    gText(x, `${Math.round(100 * t.wert / summe)} %`, rx, ry + u, {w:700, s:22 * u, a:'center', b:'middle', c: textAuf(t.f)});
  });
  gSchrift(x, 700, 40 * u, G_TF);
  const zs = Math.min(40 * u, 40 * u * (r * 1.6) / Math.max(1, x.measureText(ein.f(summe)).width));
  gText(x, ein.f(summe), cx, cy + 6 * u, {w:700, s:zs, f:G_TF, a:'center'});
  gText(x, ein.t.replace('Franken', 'Fr.'), cx, cy + 36 * u, {s:19 * u, c:G_TINTE3, a:'center'});
  const eintrag = (t, lx, ly, bw) => {
    x.fillStyle = t.f; x.fillRect(lx, ly - 19 * u, 22 * u, 22 * u);
    gText(x, t.name, lx + 34 * u, ly, {w:500, s:22 * u, max: bw - 34 * u, c: t.uebrig ? G_TINTE2 : G_TINTE});
    gText(x, `${ein.f(t.wert)} ${ein.k} · ${(100 * t.wert / summe).toFixed(1)} %`, lx + 34 * u, ly + 27 * u, {s:19 * u, c:G_TINTE3, max: bw - 34 * u});
  };
  if(quer){
    const lx = cx + R + 80 * u, bw = Math.min(B.x1 - lx, 900 * u);
    const zeile = Math.min(70 * u, (hoehe - (hinweis ? 70 * u : 0)) / teile.length);
    let ly = cy - (teile.length * zeile + (hinweis ? 70 * u : 0)) / 2 + 24 * u;
    teile.forEach(t => { eintrag(t, lx, ly, bw); ly += zeile; });
    if(hinweis){ gSchrift(x, 400, 18 * u); gZeilen(x, hinweis, bw, 2).forEach((z, i) => gText(x, z, lx, ly + 4 * u + i * 24 * u, {s:18 * u, c:G_TINTE3})); }
  } else {
    const sp = breite / 2;
    let ly = cy + R + 58 * u;
    teile.forEach((t, i) => eintrag(t, B.x0 + (i % 2) * sp, ly + Math.floor(i / 2) * 64 * u, sp - 18 * u));
    ly += legZeilen * 64 * u;
    if(hinweis){ gSchrift(x, 400, 18 * u); gZeilen(x, hinweis, breite, 2).forEach((z, i) => gText(x, z, B.x0, ly + i * 24 * u, {s:18 * u, c:G_TINTE3})); }
  }
}

/* Ringdiagramm im Vergleich: ein Ring je Datensatz, A aussen, B und C nach innen.
   Gleiche Einträge in allen Ringen in derselben Reihenfolge und Farbe. Skala
   «anteil»: jeder Ring ergibt den vollen Kreis; «betrag»: das grösste Total
   ergibt den vollen Kreis, kleinere Totale bleiben offen. */
function gRingDaten(knoten, maxEinzeln){
  const kinder = [...knoten.kinder.values()];
  const rang = c => Math.max(...st.sel.map((_, s) => Math.max(0, wert(c, s))));
  const plus = kinder.filter(c => rang(c) >= .5).sort((a, b) => rang(b) - rang(a) || a.id.localeCompare(b.id));
  const einzeln = plus.length <= maxEinzeln + 1 ? plus.length : maxEinzeln;
  const teile = plus.slice(0, einzeln).map((c, i) => ({name: gName(c), f: i < 7 ? G_KAT[i] : G_GRAU,
    v: st.sel.map((_, s) => sichtbar(c, s) ? wert(c, s) : null), fl: st.sel.map((_, s) => Math.max(0, wert(c, s)))}));
  if(plus.length > einzeln){
    const rest = plus.slice(einzeln);
    teile.push({name: `Übrige (${rest.length})`, f: G_GRAU, uebrig: true,
      v: st.sel.map((_, s) => { const w = rest.filter(c => sichtbar(c, s)).map(c => wert(c, s)); return w.length ? w.reduce((a, b) => a + b, 0) : null; }),
      fl: st.sel.map((_, s) => rest.reduce((a, c) => a + Math.max(0, wert(c, s)), 0))});
  }
  const summe = st.sel.map((_, s) => teile.reduce((a, t) => a + t.fl[s], 0));
  return {kinder, plus, teile, summe};
}
function gRinge(x, W, H){
  const S = st.sel.length, E = gEbene(), quer = W > H;
  let knoten = E.jetzt;
  if(!knoten.kinder.size && knoten.eltern) knoten = knoten.eltern;
  const modus = S > 1 ? G.skala : 'anteil';
  const {kinder, teile, summe} = gRingDaten(knoten, quer ? 7 : 5);
  const maxSumme = Math.max(...summe, 1);
  const ein = gEinheit(teile.flatMap(t => t.v).concat(st.sel.map((_, s) => wert(knoten, s))));
  const negNamen = new Map();
  kinder.forEach(c => st.sel.forEach((_, s) => { const v = wert(c, s); if(v <= -.5){ const n = gName(c); if(!negNamen.has(n)) negNamen.set(n, []); negNamen.get(n).push(`${SLOT[s]} ${ein.f(v)}`); } }));
  const negListe = [...negNamen.entries()];
  const negSumme = st.sel.map((_, s) => kinder.reduce((a, c) => a + Math.min(0, wert(c, s)), 0));
  const ohneTeile = st.sel.map((k, s) => Math.abs(wert(knoten, s)) >= .5 && !kinder.some(c => Math.abs(wert(c, s)) >= .5) ? `${SLOT[s]} ${gDs(k)}: nur als Total (${ein.f(wert(knoten, s))} ${ein.k})` : '').filter(Boolean);
  const hinweis = (ohneTeile.length ? ohneTeile.join('; ') + '. ' : '') + (negListe.length === 0 ? '' : negListe.length <= 2
    ? `Ohne Fläche, weil negativ: ${negListe.map(([n, w]) => `${n} (${S > 1 ? w.join(', ') : w.join(', ').slice(2)})`).join('; ')} ${ein.k}. Anteile bezogen auf die Summe der positiven Einträge.`
    : `Ohne Fläche: ${negListe.length} Einträge mit negativem Betrag, zusammen ${st.sel.map((k, s) => (S > 1 ? SLOT[s] + ' ' : '') + ein.f(negSumme[s])).join(', ')} ${ein.k}. Anteile bezogen auf die Summe der positiven Einträge.`);
  const ringName = s => s === 0 ? 'aussen' : s === S - 1 ? 'innen' : 'Mitte';
  const kopfText = (k, s) => S === 1 ? gDs(k) : `${SLOT[s]} · ${ringName(s)}`;
  const unter = S === 1 ? `${gDs(st.sel[0])}, ${ansichtName()} in ${ein.t}`
    : `Von aussen nach innen: ${st.sel.map((k, s) => `${SLOT[s]} ${gDs(k)}`).join(', ')}. ` + (modus === 'betrag' ? 'Gemeinsame Skala: das grösste Total ergibt den vollen Kreis.' : 'Jeder Ring zeigt die Anteile an seinem Total.');
  const B = gRahmen(x, W, H, {titel: gTitelEbene(knoten), unter, ueber: gUeberEbene(knoten), fuss: `Beträge in ${ein.t}`});
  const u = B.u, breite = B.x1 - B.x0, hoehe = B.y1 - B.y0;
  if(!teile.length){ gText(x, `Keine positiven Beträge in der Ansicht ${ansichtName()}.`, B.x0, B.y0 + 30 * u, {s:24 * u, c:G_TINTE3}); return; }
  const zeilenN = teile.length + 1;
  const hinweisH = hinweis ? 58 * u : 0;
  let cx, cy, R, tx0, tx1, ty0, zeileH;
  if(quer){ R = Math.min(hoehe * 0.47, breite * 0.18); cx = B.x0 + R + 6 * u; cy = B.y0 + hoehe / 2; tx0 = cx + R + 80 * u; }
  else tx0 = B.x0;
  tx1 = B.x1;
  gSchrift(x, 500, 20 * u);
  const wertW = Math.max(...teile.flatMap(t => t.v.filter(v => v !== null).map(v => x.measureText(ein.f(v)).width)), ...st.sel.map((_, s) => x.measureText(ein.f(wert(knoten, s))).width));
  gSchrift(x, 700, 19 * u, G_TF);
  const kopfW = S === 1 ? 0 : Math.max(...st.sel.map((k, s) => x.measureText(kopfText(k, s)).width));
  const colW = Math.min(Math.max(wertW, kopfW, 110 * u) + 40 * u, (tx1 - tx0) * (S === 1 ? 0.4 : 0.62) / S);
  gSchrift(x, 400, 17 * u);
  const kopfH = S === 1 ? 44 * u : 30 * u + Math.max(...st.sel.map(k => gZeilen(x, gDs(k), colW - 12 * u, 2).length)) * 21 * u + 12 * u;
  if(quer){
    zeileH = Math.min(62 * u, (hoehe - kopfH - hinweisH) / zeilenN);
    const tabH = kopfH + zeilenN * zeileH + hinweisH;
    ty0 = B.y0 + Math.max(0, (hoehe - tabH) / 2);
  } else {
    zeileH = 44 * u;
    const tabH = kopfH + zeilenN * zeileH + hinweisH;
    R = Math.max(90 * u, Math.min(breite * 0.36, (hoehe - tabH - 44 * u) / 2));
    cx = W / 2; cy = B.y0 + R;
    ty0 = cy + R + 44 * u;
  }
  const nameW = tx1 - tx0 - S * colW;
  const r0 = S === 1 ? R * 0.6 : S === 2 ? R * 0.44 : R * 0.36;
  const rg = S > 1 ? 9 * u : 0;
  const dicke = (R - r0 - (S - 1) * rg) / S;
  const voll = 2 * Math.PI, start = -Math.PI / 2;
  const bogen = (ra, ri, a0, a1, farbe) => { x.beginPath(); x.arc(cx, cy, ra, a0, a1); x.arc(cx, cy, ri, a1, a0, true); x.closePath(); x.fillStyle = farbe; x.fill(); };
  const fuge = (ra, ri, a) => {
    x.save();
    if(G.hg === 'weiss') x.strokeStyle = '#FFFFFF'; else { x.globalCompositeOperation = 'destination-out'; x.strokeStyle = '#000000'; }
    x.lineWidth = 3.5 * u; x.beginPath();
    x.moveTo(cx + Math.cos(a) * (ri - 1 * u), cy + Math.sin(a) * (ri - 1 * u)); x.lineTo(cx + Math.cos(a) * (ra + 1 * u), cy + Math.sin(a) * (ra + 1 * u)); x.stroke();
    x.restore();
  };
  const segmente = [];
  st.sel.forEach((k, s) => {
    const ra = R - s * (dicke + rg), ri = ra - dicke;
    const bezug = modus === 'betrag' ? maxSumme : summe[s];
    if(modus === 'betrag' || summe[s] <= 0) bogen(ra, ri, 0, voll, '#EEF0F3');
    let a = start;
    const grenzen = [];
    teile.forEach(t => {
      if(t.fl[s] <= 0 || bezug <= 0) return;
      const w = voll * t.fl[s] / bezug;
      bogen(ra, ri, a, a + w, t.f);
      grenzen.push(a);
      segmente.push({t, s, a, w, ra, ri});
      a += w;
    });
    const zu = Math.abs(a - start - voll) < 1e-6;
    if(grenzen.length > 1 || !zu) grenzen.forEach(g => fuge(ra, ri, g));
    if(!zu && grenzen.length) fuge(ra, ri, a);
  });
  const ps = Math.min(20 * u, dicke * 0.42);
  segmente.forEach(g => {
    const anteil = g.t.fl[g.s] / summe[g.s];
    const rm = (g.ra + g.ri) / 2, txt = `${Math.round(100 * anteil)} %`;
    gSchrift(x, 700, ps);
    const tw = x.measureText(txt).width;
    if(anteil < 0.05 || dicke < 34 * u || g.w * rm < tw + 16 * u) return;
    const m = g.a + g.w / 2;
    if(S > 1 && Math.abs(Math.atan2(Math.sin(m - start), Math.cos(m - start))) < (26 * u) / rm) return;
    gText(x, txt, cx + Math.cos(m) * rm, cy + Math.sin(m) * rm + .5 * u, {w:700, s:ps, a:'center', b:'middle', c: textAuf(g.t.f)});
  });
  if(S > 1){
    st.sel.forEach((k, s) => {
      const ra = R - s * (dicke + rg), rm = ra - dicke / 2;
      const ph = Math.min(dicke - 8 * u, 30 * u), pw = 30 * u, px = cx - pw / 2, py = cy - rm - ph / 2;
      x.fillStyle = G_RECHNUNG; x.beginPath();
      if(x.roundRect) x.roundRect(px, py, pw, ph, 6 * u); else x.rect(px, py, pw, ph);
      x.fill();
      gText(x, SLOT[s], cx, cy - rm + 1 * u, {w:700, s:Math.min(18 * u, ph * 0.7), a:'center', b:'middle', c:'#FFFFFF', f:G_TF});
    });
  } else {
    gSchrift(x, 700, 40 * u, G_TF);
    const zs = Math.min(40 * u, 40 * u * (r0 * 1.6) / Math.max(1, x.measureText(ein.f(summe[0])).width));
    gText(x, ein.f(summe[0]), cx, cy + 6 * u, {w:700, s:zs, f:G_TF, a:'center'});
    gText(x, ein.t.replace('Franken', 'Fr.'), cx, cy + 36 * u, {s:19 * u, c:G_TINTE3, a:'center'});
  }
  const colR = s => tx0 + nameW + (s + 1) * colW;
  let ty = ty0 + 22 * u;
  st.sel.forEach((k, s) => {
    gText(x, kopfText(k, s), colR(s), ty, {w:700, s:19 * u, a:'right', f:G_TF, max: colW - 12 * u});
    if(S === 1) return;
    gSchrift(x, 400, 17 * u);
    gZeilen(x, gDs(k), colW - 12 * u, 2).forEach((z, i) => gText(x, z, colR(s), ty + 23 * u + i * 21 * u, {s:17 * u, c:G_TINTE2, a:'right'}));
  });
  ty = ty0 + kopfH;
  x.fillStyle = G_TINTE2; x.fillRect(tx0, ty - 2 * u, tx1 - tx0, Math.max(1, 2 * u));
  const zweizeilig = zeileH >= 42 * u;
  teile.forEach(t => {
    const ym = ty + zeileH / 2;
    x.fillStyle = t.f; x.fillRect(tx0, ym - 11 * u, 22 * u, 22 * u);
    gText(x, t.name, tx0 + 34 * u, ym + 7 * u, {w: t.uebrig ? 400 : 500, s:21 * u, c: t.uebrig ? G_TINTE2 : G_TINTE, max: nameW - 50 * u});
    st.sel.forEach((_, s) => {
      const v = t.v[s];
      if(v === null){ gText(x, '·', colR(s), ym + 7 * u, {s:20 * u, c:G_TINTE3, a:'right'}); return; }
      const anteil = t.fl[s] > 0 && summe[s] > 0 ? `${(100 * t.fl[s] / summe[s]).toFixed(1)} %` : (v < 0 ? 'negativ' : '0.0 %');
      if(zweizeilig){
        gText(x, ein.f(v), colR(s), ym - 2 * u, {w:500, s:20 * u, a:'right'});
        gText(x, anteil, colR(s), ym + 16 * u, {s:16 * u, c:G_TINTE3, a:'right'});
      } else {
        gText(x, `${ein.f(v)} · ${anteil}`, colR(s), ym + 6 * u, {s:17 * u, a:'right', max: colW - 8 * u});
      }
    });
    x.fillStyle = G_LINIE; x.fillRect(tx0, ty + zeileH - .75 * u, tx1 - tx0, Math.max(1, 1.5 * u));
    ty += zeileH;
  });
  const ymT = ty + zeileH / 2;
  gText(x, `Total ${knoten.id === 'root' ? gRechnungWort() : gName(knoten)}`, tx0, ymT + 7 * u, {w:700, s:21 * u, max: nameW - 12 * u});
  st.sel.forEach((_, s) => gText(x, ein.f(wert(knoten, s)), colR(s), ymT + 7 * u, {w:700, s:20 * u, a:'right'}));
  ty += zeileH;
  if(hinweis){ gSchrift(x, 400, 16 * u); gZeilen(x, hinweis, tx1 - tx0, 2).forEach((z, i) => gText(x, z, tx0, ty + 22 * u + i * 22 * u, {s:16 * u, c:G_TINTE3})); }
}

/* 3. Woher, wohin: ordentlicher Ertrag und Aufwand nach Sachgruppen, ein Datensatz */
function gUeberblick(x, W, H){
  const s = Math.min(G.slot, st.sel.length - 1), k = st.sel[s];
  const K = kennzahlenVon(k), g = gruppenVon(k);
  const reihe = (p, ramp) => Object.entries(g).filter(([c, v]) => c[0] === p && ORDENTLICH(c) && Math.abs(v) >= .5)
    .map(([c, v]) => ({c, name: D.sg[c] || c, wert: p === '4' ? -v : v})).filter(t => t.wert > 0).sort((a, b) => b.wert - a.wert)
    .map((t, i) => Object.assign(t, {f: ramp[Math.min(i, ramp.length - 1)]}));
  const ert = reihe('4', G_ERT), auf = reihe('3', G_AUF);
  const B = gRahmen(x, W, H, {titel: 'Woher das Geld kommt, wohin es geht', unter: `${gDs(k)}, ordentlicher Ertrag und Aufwand nach Sachgruppen, Millionen Franken`, ueber: 'Erfolgsrechnung', ds: [k], fuss: 'Beträge in Millionen Franken'});
  const u = B.u, quer = W > H, spalten = quer ? 3 : 2, breite = B.x1 - B.x0;
  const skala = Math.max(K.ert, K.auf, 1);
  let y = B.y0 + 4 * u;
  const block = (liste, total, label) => {
    gSpacing(x, 1.4 * u); gText(x, label.toUpperCase(), B.x0, y, {w:700, s:19 * u, c:G_TINTE3, f:G_TF}); gSpacing(x, 0);
    y += 14 * u;
    const bh = (quer ? 50 : 60) * u;
    let px = B.x0;
    for(const t of liste){
      const w = breite * t.wert / skala;
      if(w > 0){
        x.fillStyle = t.f; x.fillRect(px, y, Math.max(w - 3 * u, .5), bh);
        gSchrift(x, 700, 21 * u);
        const txt = `${Math.round(100 * t.wert / total)} %`;
        if(w - 3 * u > x.measureText(txt).width + 18 * u) gText(x, txt, px + 10 * u, y + bh / 2 + u, {w:700, s:21 * u, b:'middle', c: textAuf(t.f)});
      }
      px += w;
    }
    y += bh + 44 * u;
    const sp = breite / spalten, zh = (quer ? 50 : 58) * u;
    const zeigen = liste.slice(0, quer ? 6 : 6);
    zeigen.forEach((t, i) => {
      const lx = B.x0 + (i % spalten) * sp, ly = y + Math.floor(i / spalten) * zh;
      x.fillStyle = t.f; x.fillRect(lx, ly - 19 * u, 20 * u, 20 * u);
      gText(x, t.name, lx + 30 * u, ly, {w:500, s:21 * u, max: sp - 46 * u});
      gText(x, `${mioG(t.wert, 1)} Mio. · ${(100 * t.wert / total).toFixed(1)} %`, lx + 30 * u, ly + 25 * u, {s:18 * u, c:G_TINTE3, max: sp - 46 * u});
    });
    y += (Math.ceil(zeigen.length / spalten) - 1) * zh + 26 * u + (quer ? 40 : 50) * u;
  };
  block(ert, K.ert, `Woher · Ertrag ${mioG(K.ert, 1)} Mio.`);
  block(auf, K.auf, `Wohin · Aufwand ${mioG(K.auf, 1)} Mio.`);
  const wort = Math.round(K.gesamt) === 0 ? 'ausgeglichen' : K.gesamt < 0 ? 'Aufwandüberschuss' : 'Ertragsüberschuss';
  const teile = [`Operatives Ergebnis ${mioVz(K.ord)} Mio.`];
  if(Math.abs(K.ao) >= 5e4) teile.push(`ausserordentliches Ergebnis ${mioVz(K.ao)} Mio.`);
  if(Math.abs(K.ek) >= 5e4) teile.push(`Fonds im Eigenkapital ${mioVz(K.ek)} Mio.`);
  gSchrift(x, 400, 19 * u);
  const uz = gZeilen(x, `Überleitung: ${teile.join(' · ')}`, breite, 2);
  const yE = Math.min(y - 4 * u, B.y1 - 20 * u - (uz.length - 1) * 25 * u);
  gText(x, `Gesamtergebnis: ${mioVz(K.gesamt)} Mio. Franken (${wort})`, B.x0, yE, {w:700, s:27 * u, f:G_TF, max: breite});
  uz.forEach((z, i) => gText(x, z, B.x0, yE + 34 * u + i * 25 * u, {s:19 * u, c:G_TINTE2}));
}

/* 4. Entwicklung der gewählten Kennzahl, 2021 bis 2030 */
function gEntwicklung(x, W, H){
  const S = serienVerlauf();
  const alleK = [...S.r, ...S.b, ...S.p].filter(p => p[1] !== null).map(p => p[2]);
  const proz = istProzent(), fmtG = (v, s) => proz ? v + ' %' : mioG(v, s), einheit = proz ? 'Prozent' : 'Millionen Franken';
  const B = gRahmen(x, W, H, {titel: kzTitel(), unter: `Rechnung, Budget und Finanzplan ${J_MIN} bis ${J_MAX}, ${einheit}.` + (st.kz === 'ekap' && st.bereich === null ? ' Budget 2026 aktualisiert mit dem Abschluss 2025.' : ''), ueber: kzUeber(), ds: alleK.length ? [...new Set(alleK)] : st.sel, fuss: proz ? 'Prozent der einfachen Staatssteuer' : 'Beträge in Millionen Franken'});
  const u = B.u;
  const da = v => v !== null && v !== undefined;
  const alle = [...S.r, ...S.b, ...S.p].map(p => p[1]).filter(da);
  if(!alle.length){ gText(x, 'Für diese Auswahl liegen keine Werte vor.', B.x0, B.y0 + 30 * u, {s:24 * u, c:G_TINTE3}); return; }
  let lo = Math.min(...alle), hi = Math.max(...alle);
  if(proz){ lo = Math.max(0, lo - 10); hi = hi + 10; }
  else if(lo < 0 || hi <= 0){ lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  else { lo = Math.max(0, lo - (hi - lo) * 0.3); }
  const schritt = (() => { const roh = (hi - lo || 1) / 5, p = Math.pow(10, Math.floor(Math.log10(roh))); return [1, 2, 2.5, 5, 10].map(f => f * p).find(q => q >= roh); })();
  lo = Math.floor(lo / schritt) * schritt; hi = Math.ceil(hi / schritt) * schritt;
  const legTexte = ['Rechnung', 'Budget', 'Finanzplan'];
  const L = B.x0 + 90 * u, R = B.x1 - 250 * u, T = B.y0 + 34 * u, BU = B.y1 - 96 * u;
  const xj = j => L + (R - L) * (j - J_MIN) / (J_MAX - J_MIN);
  const yv = v => T + (BU - T) * (1 - (v - lo) / ((hi - lo) || 1));
  for(let v = lo; v <= hi + 1e-6; v += schritt){
    x.fillStyle = Math.abs(v) < 1e-6 ? G_LINIE2 : G_LINIE; x.fillRect(L, yv(v) - .75 * u, R - L, Math.max(1, 1.5 * u));
    gText(x, fmtG(v, schritt < 1e6 ? 1 : 0), L - 16 * u, yv(v) + 6 * u, {s:18 * u, c:G_TINTE3, a:'right'});
  }
  for(let j = J_MIN; j <= J_MAX; j++) gText(x, (R - L) / (J_MAX - J_MIN) < 70 * u ? '’' + String(j).slice(2) : String(j), xj(j), BU + 34 * u, {s:18 * u, c:G_TINTE3, a:'center'});
  const xb = (xj(2027) + xj(2028)) / 2;
  x.fillStyle = G_LINIE2; x.fillRect(xb - .75 * u, T - 26 * u, Math.max(1, 1.5 * u), BU - T + 26 * u);
  gText(x, 'Budget', xb - 10 * u, T - 10 * u, {s:16 * u, c:G_TINTE3, a:'right'});
  gText(x, 'Finanzplan', xb + 10 * u, T - 10 * u, {s:16 * u, c:G_TINTE3});
  const strich = art => art === 'strich' ? [12 * u, 9 * u] : art === 'punkt' ? [1 * u, 9 * u] : [];
  const linie = (pts, farbe, art) => {
    const p = pts.filter(q => da(q[1])); if(p.length < 2) return;
    x.save(); x.strokeStyle = farbe; x.lineWidth = 3.5 * u; x.lineJoin = 'round'; x.lineCap = art === 'punkt' ? 'round' : 'butt';
    x.setLineDash(strich(art));
    x.beginPath(); p.forEach((q, i) => i ? x.lineTo(xj(q[0]), yv(q[1])) : x.moveTo(xj(q[0]), yv(q[1]))); x.stroke(); x.restore();
  };
  linie(S.b, G_BUDGET, 'strich'); linie(S.p, G_PLAN, 'punkt'); linie(S.r, G_RECHNUNG);
  const punkte = (pts, art) => pts.forEach(([j, v]) => {
    if(!da(v)) return;
    x.save(); x.beginPath();
    if(art === 'p'){ const r = 6.5 * u; x.moveTo(xj(j), yv(v) - r); x.lineTo(xj(j) + r, yv(v)); x.lineTo(xj(j), yv(v) + r); x.lineTo(xj(j) - r, yv(v)); x.closePath(); }
    else x.arc(xj(j), yv(v), 6.5 * u, 0, 2 * Math.PI);
    x.fillStyle = art === 'r' ? G_RECHNUNG : '#FFFFFF'; x.fill(); x.lineWidth = 3 * u; x.strokeStyle = art === 'r' ? '#FFFFFF' : art === 'p' ? G_PLAN : G_BUDGET; x.stroke(); x.restore();
  });
  punkte(S.b, 'b'); punkte(S.p.filter(q => q[2][0] === 'p'), 'p'); punkte(S.r, 'r');
  // Endwerte rechts: letzter Planwert, sonst letztes Budget
  const lx = xj(J_MAX) + 30 * u;
  const ende = [...S.p].reverse().find(q => da(q[1])) || [...S.b].reverse().find(q => da(q[1]));
  if(ende){
    gText(x, ende[0] > 2027 ? `Finanzplan ${ende[0]}` : `Budget ${ende[0]}`, lx, yv(ende[1]) - 8 * u, {s:17 * u, c:G_TINTE3});
    gText(x, proz ? `${ende[1]} %` : `${mioG(ende[1], 1)} Mio.`, lx, yv(ende[1]) + 18 * u, {w:700, s:25 * u, f:G_TF});
  }
  const rEnde = [...S.r].reverse().find(q => da(q[1]));
  if(rEnde){
    const yr = Math.max(T + 20 * u, Math.min(BU, yv(rEnde[1])));
    gText(x, fmtG(rEnde[1], 1), xj(rEnde[0]) + 14 * u, yr - 14 * u, {w:700, s:20 * u, f:G_TF, c:G_RECHNUNG});
  }
  let gx = L, gy = B.y1 - 12 * u;
  const leg = (farbe, art, voll, text, raute) => {
    x.save(); x.strokeStyle = farbe; x.lineWidth = 3.5 * u; x.setLineDash(strich(art)); x.lineCap = art === 'punkt' ? 'round' : 'butt';
    x.beginPath(); x.moveTo(gx, gy - 7 * u); x.lineTo(gx + 44 * u, gy - 7 * u); x.stroke(); x.restore();
    x.beginPath();
    if(raute){ const r = 6 * u, cx = gx + 22 * u, cy = gy - 7 * u; x.moveTo(cx, cy - r); x.lineTo(cx + r, cy); x.lineTo(cx, cy + r); x.lineTo(cx - r, cy); x.closePath(); }
    else x.arc(gx + 22 * u, gy - 7 * u, 6 * u, 0, 2 * Math.PI);
    x.fillStyle = voll ? farbe : '#FFFFFF'; x.fill(); x.lineWidth = 3 * u; x.strokeStyle = voll ? '#FFFFFF' : farbe; x.stroke();
    gx += 56 * u; gx += gText(x, text, gx, gy, {s:19 * u, c:G_TINTE2}) + 38 * u;
  };
  leg(G_RECHNUNG, null, true, legTexte[0]); leg(G_BUDGET, 'strich', false, legTexte[1]); leg(G_PLAN, 'punkt', false, legTexte[2], true);
}

/* 5. Kennzahlen im Vergleich */
function gKennzahlen(x, W, H){
  const S = st.sel.length;
  const B = gRahmen(x, W, H, {titel: 'Kennzahlen im Vergleich', unter: S === 1 ? `${gDs(st.sel[0])}, Millionen Franken` : `Millionen Franken, Differenzen gegenüber ${SLOT[0]} (${gDs(st.sel[0])})`, ueber: 'Erfolgsrechnung, Investitionsrechnung, Bilanz', fuss: 'Beträge in Millionen Franken'});
  const u = B.u, quer = W > H, breite = B.x1 - B.x0;
  const nameW = breite * (quer ? (S === 1 ? 0.55 : 0.4) : 0.38);
  const spW = (breite - nameW) / S;
  let y = B.y0 + 2 * u;
  let kopfZeilen = 1;
  st.sel.forEach((k, s) => {
    const xr = B.x0 + nameW + spW * (s + 1) - (s < S - 1 ? 28 * u : 0);
    gSchrift(x, 400, 19 * u);
    const tz = gZeilen(x, gDs(k), spW - 40 * u, 2);
    kopfZeilen = Math.max(kopfZeilen, tz.length);
    const tw = gText(x, SLOT[s], xr, y, {w:700, s:22 * u, f:G_TF, a:'right'});
    x.fillStyle = G_SLOT[s]; x.fillRect(xr - tw - 30 * u, y - 18 * u, 20 * u, 20 * u);
    tz.forEach((z, i) => gText(x, z, xr, y + 28 * u + i * 24 * u, {s:19 * u, c:G_TINTE2, a:'right'}));
  });
  y += 28 * u + (kopfZeilen - 1) * 24 * u + 16 * u;
  x.fillStyle = G_TINTE2; x.fillRect(B.x0, y, breite, Math.max(1, 2 * u));
  const liste = KENNZAHLEN.filter(([key]) => st.sel.some(k => kzRoh(k, key) !== null));
  const zeileH = Math.min(84 * u, (B.y1 - y) / liste.length);
  liste.forEach(([key, name, erkl], i) => {
    const yz = y + (i + 1) * zeileH, mitte = yz - zeileH / 2;
    gSchrift(x, 500, 23 * u);
    const nz = quer ? [gKuerzen(x, name, nameW - 24 * u)] : gZeilen(x, name, nameW - 24 * u, 2);
    const mitErkl = quer && erkl && zeileH >= 60 * u;
    const nb = mitErkl ? mitte - 3 * u : mitte + 8 * u - (nz.length - 1) * 13 * u;
    nz.forEach((z, j) => gText(x, z, B.x0, nb + j * 27 * u, {w:500, s:23 * u}));
    if(mitErkl) gText(x, erkl, B.x0, mitte + 23 * u, {s:16 * u, c:G_TINTE3, max: nameW - 24 * u});
    st.sel.forEach((k, s) => {
      const v = kzRoh(k, key), xr = B.x0 + nameW + spW * (s + 1) - (s < S - 1 ? 28 * u : 0);
      if(v === null){ gText(x, '·', xr, mitte + 9 * u, {s:25 * u, a:'right', c:G_TINTE3}); return; }
      const txt = kzFormat(key, v);
      if(s === 0){ gText(x, txt, xr, mitte + 9 * u, {w:500, s:25 * u, a:'right'}); return; }
      gText(x, txt, xr, mitte - 1 * u, {w:500, s:25 * u, a:'right'});
      const b = kzRoh(st.sel[0], key);
      if(b === null) return;
      const d = v - b;
      gText(x, kzDiff(key, d, b), xr, mitte + 24 * u, {s:17 * u, c:G_TINTE3, a:'right', max: spW - 16 * u});
    });
    x.fillStyle = G_LINIE; x.fillRect(B.x0, yz - .75 * u, breite, Math.max(1, 1.5 * u));
  });
}

/* Dialog */
const G_ZEICHNER = {balken: gBalken, kuchen: gKuchen, ringe: gRinge, ueberblick: gUeberblick, entwicklung: gEntwicklung, kennzahlen: gKennzahlen};
function gEbenenFuellen(){
  const sel = $('#grafikEbene'); sel.innerHTML = '';
  const weg = aktuellerKnoten(), jetzt = weg[weg.length - 1], zu = gesperrt();
  const oben = el('optgroup', {label: 'Geöffnete Ebene und darüber'});
  weg.forEach((n, i) => oben.append(el('option', {value: n.id, text: (n.id === 'root' ? `${gRechnungWort()}, oberste Ebene` : gName(n)) + (i === weg.length - 1 && i > 0 ? ' (geöffnet)' : '')})));
  sel.append(oben);
  const unter = zu ? [] : kinderSortiert(jetzt).filter(c => !c.blatt && c.kinder.size);
  if(unter.length){
    const og = el('optgroup', {label: 'Eine Ebene tiefer'});
    unter.forEach(c => og.append(el('option', {value: c.id, text: gName(c) + (st.markiert === c.id ? ' (Suchtreffer)' : '')})));
    sel.append(og);
  }
  sel.value = G.ebene && [...sel.options].some(o => o.value === G.ebene) ? G.ebene : jetzt.id;
  const h = $('#grafikEbeneHinweis');
  h.hidden = !zu;
  h.textContent = zu ? 'Der Finanzplan liegt nur nach Sachgruppen vor: Grafik für die oberste Ebene.' : '';
}
function gZeichnen(){
  const f = G_FORMATE[G.format], c = $('#grafikCanvas');
  if(c.width !== f.w) c.width = f.w;
  if(c.height !== f.h) c.height = f.h;
  const x = c.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0);
  G_ZEICHNER[G.motiv](x, f.w, f.h);
  const mitEbene = G_MIT_EBENE.includes(G.motiv);
  $('#grafikEbeneZeile').hidden = !mitEbene;
  if(!mitEbene) $('#grafikTiefeZeile').hidden = true;
  if(mitEbene){
    const z = gZielKnoten();
    $('#grafikTiefeZeile').hidden = gesperrt() || !(z.alleKonten || [...z.kinder.values()].some(k => !k.blatt));
    $('#grafikTiefe').value = G.tiefe;
    const e = $('#grafikEbeneStand');
    const gewaehlt = (G.ebene && gKnotenVon(G.ebene)) || aktuellerKnoten().slice(-1)[0];
    e.hidden = !(z.id !== gewaehlt.id || z.alleKonten);
    e.textContent = z.alleKonten ? `Gezeigt: alle Konten unter ${z.id === 'root' ? gRechnungWort() : gName(z)} (${z.kinder.size}).` : `Gezeigt: ${gName(z)}, weil ${gName(gewaehlt)} nur diesen Untereintrag hat.`;
  }
  const mitSlot = ['kuchen', 'ueberblick'].includes(G.motiv) && st.sel.length > 1;
  $('#grafikSlotZeile').hidden = !mitSlot;
  $('#grafikSkalaZeile').hidden = !(G.motiv === 'ringe' && st.sel.length > 1);
  $('#grafikSkala').value = G.skala;
  const sl = $('#grafikSlot');
  sl.innerHTML = '';
  st.sel.forEach((k, s) => sl.append(el('option', {value: String(s), text: `${SLOT[s]} · ${gDs(k)}`})));
  sl.value = String(Math.min(G.slot, st.sel.length - 1));
  $('#grafikNote').textContent = G_NOTIZ[G.motiv];
  $('#grafikTitel').placeholder = G.autoTitel;
  $('#grafikMass').textContent = `${f.m}, PNG. Quelle und Datenstand stehen in der Grafik.`;
  $('#grafikVorschau').classList.toggle('transparent', G.hg !== 'weiss');
  c.setAttribute('aria-label', `Vorschau: ${G.titel.trim() || G.autoTitel}`);
}
function gDateiname(){
  const E = G_MIT_EBENE.includes(G.motiv) ? gEbene() : null;
  const knoten = !E ? null : ['kuchen', 'ringe'].includes(G.motiv) && !E.jetzt.kinder.size && E.jetzt.eltern ? E.jetzt.eltern : E.jetzt;
  const teil = E ? '-' + st.rechnung + '-' + (knoten.code || (knoten.id === 'root' ? 'total' : knoten.id)).replace(/[^\w.]+/g, '') + (knoten.alleKonten ? '-konten' : '') + (G.motiv === 'ringe' && st.sel.length > 1 ? (G.skala === 'betrag' ? '-skala' : '-anteile') : '')
    : G.motiv === 'entwicklung' ? '-' + (st.bereich !== null ? st.bereich : st.kz) : '';
  const ds = G.motiv === 'entwicklung' ? J_MIN + '-' + J_MAX : ['kuchen', 'ueberblick'].includes(G.motiv) ? st.sel[Math.min(G.slot, st.sel.length - 1)] : st.sel.join('-');
  return `finanzspiegel-${G.motiv}-${ds}${teil}-${G.format}.png`;
}
function gMeldung(t){ const m = $('#grafikMeldung'); m.textContent = t; clearTimeout(m._t); m._t = setTimeout(() => { m.textContent = ''; }, 6000); }
const G_MOTIVE_SEITE = {ueberblick: ['ueberblick', 'kennzahlen'], entwicklung: ['entwicklung'], vergleich: ['kuchen', 'balken', 'ringe', 'ueberblick', 'entwicklung', 'kennzahlen']};
const gMotive = () => G_MOTIVE.filter(([k]) => (G_MOTIVE_SEITE[SEITE] || []).includes(k));
function oeffneGrafik(motiv, opener){
  if(motiv && gMotive().some(([k]) => k === motiv)) G.motiv = motiv;
  if(!gMotive().some(([k]) => k === G.motiv)) G.motiv = gMotive()[0][0];
  G.opener = opener || document.activeElement;
  G.titel = ''; G.slot = Math.min(G.slot, st.sel.length - 1);
  if(BAUM){
    const jetzt = aktuellerKnoten().slice(-1)[0], mk = st.markiert && jetzt.kinder.get(st.markiert);
    G.ebene = mk && !mk.blatt && mk.kinder.size && !gesperrt() ? mk.id : null;
    gEbenenFuellen();
  }
  $('#grafikMotiv').value = G.motiv; $('#grafikFormat').value = G.format; $('#grafikTitel').value = ''; $('#grafikMeldung').textContent = '';
  $$('input[name="grafikHg"]').forEach(r => { r.checked = r.value === G.hg; });
  $('#grafikLage').classList.add('offen');
  document.body.classList.add('grafik-offen');
  document.body.style.overflow = 'hidden';
  gZeichnen();
  if(document.fonts && document.fonts.load){
    Promise.all([`700 48px ${G_TF}`, `600 20px ${G_F}`, `400 20px ${G_F}`, `500 20px ${G_F}`, `700 20px ${G_F}`].map(f => document.fonts.load(f))).then(() => { if($('#grafikLage').classList.contains('offen')) gZeichnen(); }).catch(() => {});
  }
  setTimeout(() => $('#grafikMotiv').focus(), 30);
}
function schliesseGrafik(){
  $('#grafikLage').classList.remove('offen');
  document.body.classList.remove('grafik-offen');
  document.body.style.overflow = '';
  if(G.opener && G.opener.focus) G.opener.focus();
}
function grafikInit(){
  const mot = $('#grafikMotiv'), fmt = $('#grafikFormat'), lage = $('#grafikLage');
  if(!mot) return;
  gMotive().forEach(([k, t]) => mot.append(el('option', {value:k, text:t})));
  Object.entries(G_FORMATE).forEach(([k, f]) => fmt.append(el('option', {value:k, text:`${f.t} (${f.m.replace(' Pixel', '')})`})));
  $('#grafikAuf').addEventListener('click', ev => oeffneGrafik(null, ev.currentTarget));
  $$('[data-grafik]').forEach(b => b.addEventListener('click', ev => oeffneGrafik(b.dataset.grafik, ev.currentTarget)));
  $('#grafikZu').addEventListener('click', schliesseGrafik);
  lage.addEventListener('click', ev => { if(ev.target === lage) schliesseGrafik(); });
  document.addEventListener('keydown', ev => { if(ev.key === 'Escape' && lage.classList.contains('offen')){ ev.preventDefault(); schliesseGrafik(); } });
  lage.addEventListener('keydown', ev => {
    if(ev.key !== 'Tab') return;
    const f = $$('button, select, input', lage).filter(e => !e.disabled && e.offsetParent !== null && !(e.type === 'radio' && !e.checked));
    if(!f.length) return;
    const i = f.indexOf(document.activeElement);
    if(ev.shiftKey && i <= 0){ ev.preventDefault(); f[f.length - 1].focus(); }
    else if(!ev.shiftKey && i === f.length - 1){ ev.preventDefault(); f[0].focus(); }
  });
  mot.addEventListener('change', () => { G.motiv = mot.value; gZeichnen(); });
  fmt.addEventListener('change', () => { G.format = fmt.value; gZeichnen(); });
  $('#grafikSlot').addEventListener('change', ev => { G.slot = +ev.target.value; gZeichnen(); });
  $('#grafikSkala').addEventListener('change', ev => { G.skala = ev.target.value; gZeichnen(); });
  $('#grafikEbene').addEventListener('change', ev => { G.ebene = ev.target.value; gZeichnen(); });
  $('#grafikTiefe').addEventListener('change', ev => { G.tiefe = ev.target.value; gZeichnen(); });
  $$('input[name="grafikHg"]').forEach(r => r.addEventListener('change', () => { if(r.checked){ G.hg = r.value; gZeichnen(); } }));
  let tt; $('#grafikTitel').addEventListener('input', ev => { G.titel = ev.target.value; clearTimeout(tt); tt = setTimeout(gZeichnen, 150); });
  $('#grafikLaden').addEventListener('click', () => {
    gZeichnen();
    const a = document.createElement('a');
    a.download = gDateiname();
    a.href = $('#grafikCanvas').toDataURL('image/png');
    document.body.append(a); a.click(); a.remove();
    gMeldung('Heruntergeladen: ' + a.download);
  });
  $('#grafikKopie').addEventListener('click', async () => {
    gZeichnen();
    const c = $('#grafikCanvas');
    const bild = new Promise((ok, fehler) => c.toBlob(b => b ? ok(b) : fehler(new Error('leer')), 'image/png'));
    try{
      if(!navigator.clipboard || !navigator.clipboard.write || typeof ClipboardItem === 'undefined') throw new Error('keine Zwischenablage');
      try{ await navigator.clipboard.write([new ClipboardItem({'image/png': bild})]); }
      catch(e){ await navigator.clipboard.write([new ClipboardItem({'image/png': await bild})]); }
      gMeldung('Grafik in der Zwischenablage. In Word oder PowerPoint mit Einfügen übernehmen.');
    }catch(e){ gMeldung('Kopieren ist in diesem Browser nicht möglich. Bitte als PNG herunterladen.'); }
  });
}

/* ── Suche oben: alle Begriffe, ab drei Buchstaben ───────────────────────
   Index aus daten/index.json (beim ersten Fokus geladen), Kommentare der
   Dienststellen aus daten/komm.json (erst geladen, wenn gesucht wird).
   Synonyme aus finanzspiegel/daten/synonyme.json ergänzen Alltagswörter. */
let INDEX = null, SYN = [], KOMM_INDEX = null;
const GRUPPE = {s: 'Seiten', b: 'Begriffe', z: 'Kennzahlen', d: 'Departemente', n: 'Dienststellen', a: 'Aufgabenfelder', g: 'Sachgruppen', f: 'Fonds', v: 'Investitionsvorhaben', k: 'Konten', c: 'Kommentare der Dienststellen'};
const EINZAHL = {s: 'Seite', b: 'Begriff', z: 'Kennzahl', d: 'Departement', n: 'Dienststelle', a: 'Aufgabenfeld', g: 'Sachgruppe', f: 'Fonds', v: 'Vorhaben', k: 'Konto', c: 'Kommentar'};
const GRUPPE_REIHE = ['s', 'b', 'z', 'd', 'n', 'a', 'g', 'f', 'v', 'k', 'c'];
const GRUPPE_MAX = {s: 3, b: 4, z: 3, d: 4, n: 6, a: 3, g: 5, f: 3, v: 5, k: 8, c: 6};
function ladeIndex(){
  return ladeDatei('index').then(x => {
    if(INDEX) return INDEX;
    // Durchsucht werden Nummer, Bezeichnung und Ort: bei Konten, Vorhaben und Fonds die
    // Dienststelle, bei Begriffen die weiteren Suchwörter, sonst die Beschreibung.
    const ort = e => e[0] === 'b' ? (e[5] || '') : ['k', 'v', 'f'].includes(e[0]) ? `${e[3]} ${D.dst[e[3]] || ''}` : e[0] === 'n' ? (D.dep[e[1].slice(0, 2)] || '') : (e[3] || '');
    const nt = t => ' ' + norm(t).replace(/[^a-z0-9.]+/g, ' ') + ' ';
    INDEX = x.e.map(e => ({e, t: e[0], n: nt((e[1] || '') + ' ' + e[2] + ' ' + ort(e)), nn: nt((e[1] || '') + ' ' + e[2])}));
    SYN = (x.syn || []).map(([links, rechts]) => [links.map(norm), rechts.map(norm)]);
    return INDEX;
  });
}
function ladeKommIndex(){
  if(KOMM_INDEX) return Promise.resolve(KOMM_INDEX);
  return Promise.all([ladeIndex(), ladeDatei('komm')]).then(([idx, komm]) => {
    if(!D.komm) D.komm = komm;
    const konten = new Map();
    idx.forEach(x => { if(x.t === 'k') konten.set(`${x.e[3]}|${x.e[5]}|${x.e[1]}`, x.e); });
    const out = [];
    const reihe = D.jahre.map(j => j.k).reverse();
    for(const k of reihe){
      for(const [schl, txt] of Object.entries(komm[k] || {})){
        const [dst, spz, konto] = schl.split('|');
        const ke = konto ? konten.get(schl) : null;
        out.push({k, dst, spz, konto, txt, n: ' ' + norm(txt).replace(/[^a-z0-9.]+/g, ' ') + ' ', name: ke ? ke[2] : '', dep: dst.slice(0, 2)});
      }
    }
    KOMM_INDEX = out;
    return out;
  });
}
function suchWoerter(q){
  const w = norm(q).replace(/[^a-z0-9.]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  return w.map(t => {
    const alt = new Set([t]);
    if(t.length >= 3) for(const [links, rechts] of SYN) if(links.some(l => l.startsWith(t) || (t.startsWith(l) && l.length >= 3))) rechts.forEach(r => alt.add(r.replace(/[^a-z0-9.]+/g, ' ').trim()));
    return [...alt];
  });
}
/* Treffer: jedes Wort (oder ein Synonym davon) steht am Wortanfang; ab vier Buchstaben auch mitten im Wort */
function passt(text, woerter){
  let punkte = 0;
  for(const alt of woerter){
    let best = 0;
    for(const a of alt){
      if(text.includes(' ' + a)) best = Math.max(best, text.includes(' ' + a + ' ') ? 3 : 2);
      else if(a.length >= 4 && text.includes(a)) best = Math.max(best, 1);
    }
    if(!best) return 0;
    punkte += best;
  }
  return punkte;
}
const genugZeichen = q => norm(q).replace(/[^a-z0-9]/g, '').length >= 3;
function suchen(q, filter){
  if(!INDEX) return [];
  const woerter = suchWoerter(q);
  const out = [];
  for(const x of INDEX){
    if(filter && !filter(x.e)) continue;
    const p = passt(x.n, woerter);
    if(p) out.push([x.e, p + (passt(x.nn, woerter) ? 4 : 0)]);
  }
  out.sort((a, b) => GRUPPE_REIHE.indexOf(a[0][0]) - GRUPPE_REIHE.indexOf(b[0][0]) || b[1] - a[1] || (a[0][2].length - b[0][2].length));
  return out.map(x => x[0]);
}
function suchenKomm(q, filter, max){
  if(!KOMM_INDEX) return [];
  const woerter = suchWoerter(q), out = [];
  for(const c of KOMM_INDEX){
    if(filter && !filter(c)) continue;
    if(passt(c.n, woerter)){ out.push(c); if(out.length >= (max || 6)) break; }
  }
  return out;
}

/* ── Ziele der Treffer ───────────────────────────────────────────────── */
const vorhanden = (maske, k) => JI[k] !== undefined && (maske >> JI[k]) & 1;
function auswahlFuer(maske, sel){
  const basis = (sel || st.sel).filter(k => !istPlan(k));
  if(!maske) return basis.length ? basis : VORGABE_SEL.slice();
  if(basis.some(k => vorhanden(maske, k))) return basis;
  const da = D.jahre.map(j => j.k).filter(k => vorhanden(maske, k));
  return da.length ? [da[da.length - 1]] : VORGABE_SEL.slice();
}
const pfadDst = (dep, dst, spz) => [`d${dep}`, `s${dst}`].concat(spz ? [`f${spz}`] : []).join('/');
function zielVon(e, o){
  o = o || {};
  const v = (p) => `${BASIS}vergleich/#${new URLSearchParams(p).toString()}`;
  const t = e[0];
  if(t === 's') return BASIS + e[4];
  if(t === 'b') return `${BASIS}begriffe/#${e[4]}`;
  if(t === 'z') return `${BASIS}entwicklung/#kz=${e[1]}`;
  if(t === 'a') return `${BASIS}entwicklung/#b=f${e[1]}`;
  const sel = o.sel || auswahlFuer(e[4]);
  const ir = o.ir || t === 'v';
  const basis = {d: sel.join(','), r: ir ? 'ir' : 'er', g: 'inst', a: 'N', u: 'alle'};
  if(t === 'd') return v({...basis, a: o.ansicht || 'N', p: 'd' + e[1]});
  if(t === 'n') return v({...basis, a: o.ansicht || 'N', p: pfadDst(e[1].slice(0, 2), e[1])});
  if(t === 'f') return v({...basis, p: pfadDst(e[3].slice(0, 2), e[3], e[1])});
  if(t === 'g'){
    const g2 = e[1].slice(0, 2);
    return v({d: sel.join(','), r: 'er', g: 'art', a: g2[0] === '4' ? 'E' : 'A', u: ORDENTLICH(g2) ? 'ord' : 'alle', p: e[1].length === 2 ? 'a' + g2 : `a${g2}/b${e[1]}`});
  }
  if(t === 'v') return v({...basis, r: 'ir', p: pfadDst(e[6], e[3], e[5]), m: `v${e[3]}|${e[5]}|${e[1]}`});
  if(t === 'k'){
    const g2 = e[1].slice(0, 2);
    const a = o.ansicht && o.ansicht !== 'I' ? o.ansicht : e[1][0] === '4' ? 'E' : 'A';
    return v({...basis, a, u: a === 'N' || !ORDENTLICH(g2) ? 'alle' : 'ord', p: pfadDst(e[6], e[3], e[5]), m: `k${e[3]}|${e[5]}|${e[1]}`});
  }
  return BASIS;
}
function zielKomm(c){
  const jj = c.k.slice(1), j = 2000 + +jj;
  const sel = c.k[0] === 'r' ? ['r' + jj, 'b' + jj] : ['b' + jj, 'b' + String(j - 1).slice(2)];
  const p = {d: sel.filter(k => IDX[k] !== undefined).join(','), r: 'er', g: 'inst', a: 'N', u: 'alle', p: pfadDst(c.dep, c.dst, c.spz)};
  if(c.konto) p.m = `k${c.dst}|${c.spz}|${c.konto}`;
  return `${BASIS}vergleich/#${new URLSearchParams(p).toString()}`;
}
function kontextVon(e){
  const t = e[0];
  if(t === 's' || t === 'z') return e[3] || '';
  if(t === 'b') return kurz(e[3] || '', 110);
  if(t === 'n') return D.dep[e[1].slice(0, 2)] || '';
  if(t === 'f') return `${e[3]} ${D.dst[e[3]] || ''}`.trim();
  if(t === 'k' || t === 'v') return `${e[3]} ${D.dst[e[3]] || ''}`.trim() + (e[5] ? ` · Fonds ${e[5]}` : '');
  if(t === 'g') return e[1].length === 2 ? 'Sachgruppe, zweistellig' : 'Sachgruppe, dreistellig';
  if(t === 'd') return 'Departement';
  if(t === 'a') return 'Aufgabenfeld des Finanzplans';
  return '';
}
function auszug(txt, q){
  const n = norm(txt), w = suchWoerter(q).flat();
  let i = -1, l = 0;
  for(const a of w){ const j = n.indexOf(a); if(j >= 0 && (i < 0 || j < i)){ i = j; l = a.length; } }
  if(i < 0) return esc(kurz(txt, 140));
  const a = Math.max(0, i - 60), b = Math.min(txt.length, i + l + 80);
  return (a > 0 ? '…' : '') + esc(txt.slice(a, i)) + '<mark>' + esc(txt.slice(i, i + l)) + '</mark>' + esc(txt.slice(i + l, b)) + (b < txt.length ? '…' : '');
}

/* ── Liste unter dem Suchfeld ────────────────────────────────────────── */
function suchfeld(inp, ul, o){
  o = o || {};
  let zaehler = 0;
  const zeige = () => {
    const q = inp.value, nr = ++zaehler;
    ul.innerHTML = '';
    if(!q.trim()){ ul.hidden = true; return; }
    ul.hidden = false;
    if(!genugZeichen(q)){ ul.append(el('li', {class: 'leer', text: 'Vorschläge ab drei Buchstaben.'})); return; }
    if(!INDEX){ ul.append(el('li', {class: 'leer', text: 'Suchverzeichnis wird geladen …'})); ladeIndex().then(() => { if(nr === zaehler) zeige(); }); return; }
    const treffer = suchen(q, o.filter);
    const gruppen = {};
    treffer.forEach(e => { (gruppen[e[0]] = gruppen[e[0]] || []).push(e); });
    let n = 0;
    for(const g of GRUPPE_REIHE){
      if(g === 'c' || !gruppen[g]) continue;
      ul.append(el('li', {class: 'gruppe', role: 'presentation', text: `${GRUPPE[g]} · ${gruppen[g].length}`}));
      gruppen[g].slice(0, GRUPPE_MAX[g]).forEach(e => {
        const li = el('li', {role: 'option', 'aria-selected': String(n === 0)});
        const a = el('a', {href: o.ziel ? o.ziel(e) : zielVon(e), tabindex: '-1'});
        a.append(el('span', null, [el('span', {class: 'code', text: e[0] === 'b' || e[0] === 's' || e[0] === 'z' ? '' : (e[1] || '')}), document.createTextNode(e[2])]), el('span', {class: 'typ', text: EINZAHL[g]}), el('small', {text: kontextVon(e)}));
        li.append(a); ul.append(li); n++;
      });
    }
    const kommZeigen = () => {
      if(nr !== zaehler) return;
      const k = suchenKomm(q, o.kommFilter, GRUPPE_MAX.c);
      ul.querySelectorAll('.komm-teil').forEach(x => x.remove());
      if(!k.length){ if(!n) ul.append(el('li', {class: 'leer komm-teil', text: 'Nichts gefunden. Andere Schreibweise oder ein kürzeres Wort versuchen.'})); return; }
      ul.append(el('li', {class: 'gruppe komm-teil', role: 'presentation', text: GRUPPE.c}));
      k.forEach(c => {
        const li = el('li', {role: 'option', class: 'komm-teil', 'aria-selected': String(n === 0)});
        const a = el('a', {href: zielKomm(c), tabindex: '-1'});
        const kopf = el('span'); kopf.textContent = `${dsDok(c.k)} · ${c.dst} ${D.dst[c.dst] || ''}` + (c.konto ? ` · ${c.konto} ${c.name}` : '');
        const sm = el('small'); sm.innerHTML = '«' + auszug(c.txt, q) + '»';
        a.append(kopf, el('span', {class: 'typ', text: 'Kommentar'}), sm);
        li.append(a); ul.append(li); n++;
      });
    };
    if(o.kommentare !== false){
      if(KOMM_INDEX) kommZeigen();
      else { ul.append(el('li', {class: 'leer komm-teil', text: 'Kommentare der Dienststellen werden durchsucht …'})); ladeKommIndex().then(kommZeigen).catch(() => {}); }
    } else if(!n) ul.append(el('li', {class: 'leer', text: 'Nichts gefunden.'}));
    if(o.nachher) o.nachher(treffer);
  };
  let t;
  inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(zeige, 90); });
  inp.addEventListener('focus', () => { ladeIndex().catch(() => {}); if(inp.value.trim()) zeige(); });
  inp.addEventListener('blur', () => setTimeout(() => { if(!ul.contains(document.activeElement)) ul.hidden = true; }, 180));
  inp.addEventListener('keydown', ev => {
    const items = $$('li[role="option"]', ul);
    const akt = items.findIndex(li => li.getAttribute('aria-selected') === 'true');
    if(ev.key === 'ArrowDown' || ev.key === 'ArrowUp'){ ev.preventDefault(); if(!items.length) return; const n = (akt + (ev.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items.forEach((li, i) => li.setAttribute('aria-selected', String(i === n))); items[n].scrollIntoView({block: 'nearest'}); }
    else if(ev.key === 'Enter'){ ev.preventDefault(); const li = items[Math.max(akt, 0)]; if(li){ const a = li.querySelector('a'); if(a){ ul.hidden = true; inp.blur(); location.href = a.href; } } }
    else if(ev.key === 'Escape'){ ul.hidden = true; }
  });
  ul.addEventListener('mousedown', ev => { if(ev.target.closest('a')) ev.preventDefault(); });
  ul.addEventListener('click', ev => { const a = ev.target.closest('a'); if(a){ ul.hidden = true; inp.blur(); } });
  return zeige;
}

/* ── Geführter Einstieg (Start) ──────────────────────────────────────── */
const ZIELE = [
  ['jahr', 'Ein Jahr ansehen', 'Budget oder Rechnung eines Jahres: woher das Geld kommt, wohin es geht'],
  ['vergleich', 'Jahre vergleichen', 'Bis zu drei Jahre nebeneinander, mit Differenzen'],
  ['entwicklung', 'Entwicklung über die Jahre', 'Verlauf 2021 bis 2030: Rechnung, Budget, Finanzplan'],
  ['finden', 'Bereich oder Stichwort finden', 'Dienststelle, Konto oder Vorhaben suchen'],
  ['pruef', 'Grosse Veränderungen', 'Prüfhinweise: Stellen mit grossen Abweichungen'],
  ['grafik', 'Grafik erstellen', 'Bild für Social Media, Präsentation oder Bericht'],
];
const SCHRITTE = {
  jahr: ['ziel', 'jahr1', 'bereich', 'ansicht', 'stichwort', 'kontrolle'],
  vergleich: ['ziel', 'jahre', 'bereich', 'ansicht', 'stichwort', 'kontrolle'],
  entwicklung: ['ziel', 'bereichE', 'ansichtE', 'kontrolle'],
  finden: ['ziel', 'jahre', 'bereich', 'ansicht', 'stichwort', 'kontrolle'],
  pruef: ['ziel', 'jahrP', 'bereichP', 'stichwort', 'kontrolle'],
  grafik: ['ziel', 'jahre', 'bereich', 'ansicht', 'kontrolle'],
};
const E = {ziel: null, jahre: [], bereich: null, dep: null, ansicht: null, kz: null, stichwort: '', schritt: 'ziel', ueber: new Set()};
function schritte(){ return SCHRITTE[E.ziel] || ['ziel']; }
function einstiegNeu(){ Object.assign(E, {ziel: null, jahre: [], bereich: null, dep: null, ansicht: null, kz: null, stichwort: '', schritt: 'ziel'}); E.ueber = new Set(); zeichneEinstieg(); }
function weiter(){
  const s = schritte(); let i = s.indexOf(E.schritt) + 1;
  while(i < s.length && uebersprungen(s[i])) i++;
  E.schritt = s[Math.min(i, s.length - 1)];
  zeichneEinstieg(true);
}
function zurueck(){
  const s = schritte(); let i = s.indexOf(E.schritt) - 1;
  while(i > 0 && uebersprungen(s[i])) i--;
  E.schritt = s[Math.max(i, 0)];
  zeichneEinstieg(true);
}
/* Fragen, deren Antwort feststeht, entfallen: Sachgruppe bestimmt Aufwand oder Ertrag, Finanzplan kennt nur Sachgruppen */
function uebersprungen(s){
  if(s === 'ansicht' && E.bereich && E.bereich[0] === 'g'){ E.ansicht = E.bereich[1] === '4' ? 'E' : 'A'; return true; }
  if(s === 'ansichtE' && E.bereich && (E.bereich[0] === 'g' || E.bereich[0] === 'f')) return true;
  if(s === 'stichwort' && E.ansicht === 'I' && E.jahre.some(istPlan)) return true;
  return false;
}
const jahrName = k => dsLang(k);
function bereichName(b){
  if(!b) return E.ziel === 'entwicklung' ? 'Ganzer Kanton' : E.ziel === 'pruef' ? 'Alle Bereiche' : 'Alles, ganzer Kanton';
  const c = b.slice(1);
  return b[0] === 'd' ? `${c} ${D.dep[c]}` : b[0] === 's' ? `${c} ${D.dst[c] || ''}` : b[0] === 'g' ? `Sachgruppe ${c} ${D.sg[c] || ''}` : `Aufgabenfeld ${(D.felder.find(x => String(x.nr) === c) || {}).name || c}`;
}
const ANSICHT_NAME = {A: 'Aufwand', E: 'Ertrag', N: 'Netto (Aufwand minus Ertrag)', I: 'Investitionen (Investitionsrechnung)'};
function optionKnopf(text, klein, gedrueckt, aktion, code){
  const b = el('button', {type: 'button', class: 'option', 'aria-pressed': String(!!gedrueckt)});
  if(code) b.append(el('span', {class: 'code', text: code}));
  b.append(el('b', {text}));
  if(klein) b.append(el('small', {text: klein}));
  b.addEventListener('click', aktion);
  return b;
}
function zeichneEinstieg(fokus){
  const box = $('#einstieg'); if(!box) return;
  box.innerHTML = '';
  const s = schritte(), nr = s.indexOf(E.schritt), sichtbare = s.filter(x => !uebersprungen(x));
  // Weg: bisherige Antworten, jede anklickbar
  if(E.ziel){
    const weg = el('div', {class: 'weg', 'aria-label': 'Bisherige Antworten'});
    const teile = [];
    teile.push(['ziel', ZIELE.find(z => z[0] === E.ziel)[1]]);
    if(E.jahre.length && s.some(x => x.startsWith('jahr'))) teile.push([s.find(x => x.startsWith('jahr')), E.jahre.map(jahrName).join(', ')]);
    if(s.indexOf(E.schritt) > s.findIndex(x => x.startsWith('bereich'))) teile.push([s.find(x => x.startsWith('bereich')), bereichName(E.bereich)]);
    if(E.ansicht && s.indexOf(E.schritt) > s.indexOf('ansicht') && s.includes('ansicht')) teile.push(['ansicht', ANSICHT_NAME[E.ansicht]]);
    if(E.kz && s.includes('ansichtE') && s.indexOf(E.schritt) > s.indexOf('ansichtE')) teile.push(['ansichtE', (KZ_WAHL.find(x => x[0] === E.kz) || [0, E.kz])[1]]);
    teile.forEach(([schritt, text], i) => { if(i) weg.append(el('span', {class: 'sep', text: '›'})); const b = el('button', {type: 'button', text}); b.addEventListener('click', () => { E.schritt = schritt; zeichneEinstieg(true); }); weg.append(b); });
    box.append(weg);
  }
  const kopf = el('div', {class: 'schritt-kopf'});
  const frage = el('h2', {class: 'frage', id: 'einstiegFrage', tabindex: '-1'});
  kopf.append(frage, el('span', {class: 'nummer', text: E.ziel ? `Schritt ${sichtbare.indexOf(E.schritt) + 1} von ${sichtbare.length}` : 'Schritt 1'}));
  box.append(kopf);
  const hilfe = el('p', {class: 'hilfe'}); box.append(hilfe);
  const inhalt = el('div'); box.append(inhalt);
  const unten = el('div', {class: 'knoepfe-unten'});
  const neuKnopf = el('button', {type: 'button', class: 'linkknopf', text: 'Von vorne beginnen'}); neuKnopf.addEventListener('click', einstiegNeu);
  const zurueckKnopf = el('button', {type: 'button', class: 'btn zweit', text: 'Zurück'}); zurueckKnopf.addEventListener('click', zurueck);
  const jahreDa = (fn) => {
    const grp = (titel, art) => {
      const ks = DS.filter(d => d.a === art).map(d => d.k);
      if(!ks.length) return;
      inhalt.append(el('div', {class: 'optgruppe', text: titel}));
      const o = el('div', {class: 'optionen eng'});
      ks.forEach(k => o.append(fn(k)));
      inhalt.append(o);
    };
    grp('Rechnung', 'r'); grp('Budget', 'b'); grp('Finanzplan', 'p');
  };
  const st_ = E.schritt;
  if(st_ === 'ziel'){
    frage.textContent = 'Was soll angezeigt werden?';
    hilfe.textContent = 'Fünf kurze Fragen führen zur passenden Ansicht. Jede Antwort lässt sich später ändern.';
    const o = el('div', {class: 'optionen'});
    ZIELE.forEach(([k, t, kl]) => o.append(optionKnopf(t, kl, E.ziel === k, () => { if(E.ziel !== k){ E.jahre = []; E.bereich = null; E.dep = null; E.ansicht = null; E.kz = null; E.stichwort = ''; } E.ziel = k; weiter(); })));
    inhalt.append(o);
  } else if(st_ === 'jahr1'){
    frage.textContent = 'Welches Jahr?';
    hilfe.textContent = 'Rechnung: abgeschlossenes Jahr. Budget: Voranschlag. Finanzplan: Planung ohne Detailzahlen.';
    jahreDa(k => optionKnopf(String(DS[IDX[k]].j), DS[IDX[k]].vorlage ? 'Vorlage' : (istPlan(k) ? 'nur Sachgruppen' : ''), E.jahre[0] === k, () => { E.jahre = [k]; weiter(); }));
  } else if(st_ === 'jahre' || st_ === 'jahrP'){
    if(st_ === 'jahrP'){
      frage.textContent = 'Zu welchem Jahr?';
      hilfe.textContent = 'Prüfhinweise gibt es zu den Jahren unten. Ohne Wahl erscheinen alle.';
      const o = el('div', {class: 'optionen eng'});
      o.append(optionKnopf('Alle Jahre', '', !E.jahre.length, () => { E.jahre = []; weiter(); }));
      inhalt.append(o);
      const mitBf = new Set(BF.flatMap(b => b.ds));
      const ks = D.jahre.map(j => j.k).filter(k => mitBf.has(k));
      const o2 = el('div', {class: 'optionen eng', style: 'margin-top:8px'});
      ks.forEach(k => o2.append(optionKnopf(dsT(k), DS[IDX[k]].vorlage ? 'Vorlage' : '', E.jahre[0] === k, () => { E.jahre = [k]; weiter(); })));
      inhalt.append(o2);
    } else {
      const mind = E.ziel === 'vergleich' ? 2 : 1;
      frage.textContent = E.ziel === 'vergleich' ? 'Welche Jahre?' : 'Welches Jahr oder welche Jahre?';
      hilfe.textContent = `Bis zu drei. Das zuerst gewählte ist der Bezug A; Differenzen sind B minus A und C minus A.${mind > 1 ? ' Mindestens zwei.' : ''}`;
      jahreDa(k => {
        const i = E.jahre.indexOf(k);
        const b = optionKnopf(String(DS[IDX[k]].j), i >= 0 ? `gewählt als ${SLOT[i]}` : DS[IDX[k]].vorlage ? 'Vorlage' : (istPlan(k) ? 'nur Sachgruppen' : ''), i >= 0, () => {
          if(i >= 0) E.jahre.splice(i, 1); else if(E.jahre.length < 3) E.jahre.push(k); else E.jahre[2] = k;
          zeichneEinstieg();
        });
        return b;
      });
      const w = el('button', {type: 'button', class: 'btn', text: E.jahre.length >= mind ? `Weiter mit ${E.jahre.map(dsT).join(', ')}` : `Weiter (mindestens ${mind})`});
      w.disabled = E.jahre.length < mind;
      w.addEventListener('click', weiter);
      unten.append(w);
    }
  } else if(st_ === 'bereich' || st_ === 'bereichE' || st_ === 'bereichP'){
    const plan = E.jahre.some(istPlan);
    frage.textContent = E.dep && st_ !== 'bereichP' ? `Welche Dienststelle im ${D.dep[E.dep]}?` : 'Welcher Bereich?';
    hilfe.textContent = st_ === 'bereichP' ? 'Prüfhinweise eines Departements oder alle.' : plan ? 'Der Finanzplan liegt nur nach Sachgruppen vor; Departemente und Dienststellen gibt es für Rechnung und Budget.' : 'Departemente und Dienststellen nach ihrer Nummer, Sachgruppen nach dem Kontenrahmen.';
    if(E.dep && st_ !== 'bereichP'){
      const o = el('div', {class: 'optionen'});
      o.append(optionKnopf(`Ganzes ${D.dep[E.dep]}`, '', E.bereich === 'd' + E.dep, () => { E.bereich = 'd' + E.dep; E.dep = null; weiter(); }, E.dep));
      const ks = st_ === 'bereichE' ? D.jahre.map(j => j.k) : E.jahre;
      Object.keys(D.dst).filter(c => c.slice(0, 2) === E.dep && ks.some(k => (D.dstn[k] || {})[c])).sort().forEach(c =>
        o.append(optionKnopf(D.dst[c] || 'Dienststelle', '', E.bereich === 's' + c, () => { E.bereich = 's' + c; E.dep = null; weiter(); }, c)));
      inhalt.append(o);
      const z = el('button', {type: 'button', class: 'linkknopf', text: 'Anderes Departement'}); z.addEventListener('click', () => { E.dep = null; zeichneEinstieg(); });
      unten.append(z);
    } else {
      const o = el('div', {class: 'optionen'});
      o.append(optionKnopf(bereichName(null), '', !E.bereich, () => { E.bereich = null; weiter(); }));
      inhalt.append(o);
      if(!plan){
        inhalt.append(el('div', {class: 'optgruppe', text: 'Departement'}));
        const o2 = el('div', {class: 'optionen'});
        Object.keys(D.dep).sort().forEach(c => o2.append(optionKnopf(D.dep[c], st_ === 'bereichP' ? '' : 'danach Dienststelle wählen oder ganzes Departement', E.bereich && E.bereich.slice(1, 3) === c && E.bereich[0] !== 'g', () => { if(st_ === 'bereichP'){ E.bereich = 'd' + c; weiter(); } else { E.dep = c; zeichneEinstieg(true); } }, c)));
        inhalt.append(o2);
      }
      if(st_ !== 'bereichP'){
        inhalt.append(el('div', {class: 'optgruppe', text: 'Art (Sachgruppe)'}));
        const o3 = el('div', {class: 'optionen'});
        Object.keys(D.sg).filter(c => c.length === 2 && ORDENTLICH(c) && DS.some(d => (istPlan(d.k) ? D.agg[d.k] : D.g2[d.k] || {})[c])).sort().forEach(c =>
          o3.append(optionKnopf(D.sg[c], c[0] === '3' ? 'Aufwand' : 'Ertrag', E.bereich === 'g' + c, () => { E.bereich = 'g' + c; weiter(); }, c)));
        inhalt.append(o3);
      }
      if(st_ === 'bereichE'){
        inhalt.append(el('div', {class: 'optgruppe', text: 'Aufgabenfeld des Finanzplans, 2027 bis 2030'}));
        const o4 = el('div', {class: 'optionen'});
        D.felder.forEach(x => o4.append(optionKnopf(x.name, '', E.bereich === 'f' + x.nr, () => { E.bereich = 'f' + x.nr; weiter(); })));
        inhalt.append(o4);
      }
    }
  } else if(st_ === 'ansicht'){
    frage.textContent = 'Aufwand, Ertrag oder netto?';
    hilfe.textContent = 'Netto: Aufwand minus Ertrag; negativ heisst Ertragsüberschuss. Investitionen: Ausgaben und Einnahmen der Investitionsrechnung.';
    const o = el('div', {class: 'optionen'});
    const plan = E.jahre.some(istPlan);
    [['A', 'Löhne, Sachaufwand, Beiträge'], ['E', 'Steuern, Gebühren, Beiträge'], ['N', 'Aufwand minus Ertrag'], ['I', plan ? 'im Finanzplan nur als Total' : 'Ausgaben minus Einnahmen je Vorhaben']].forEach(([k, kl]) =>
      o.append(optionKnopf(ANSICHT_NAME[k].replace(' (Aufwand minus Ertrag)', '').replace(' (Investitionsrechnung)', ''), kl, E.ansicht === k, () => { E.ansicht = k; weiter(); })));
    inhalt.append(o);
  } else if(st_ === 'ansichtE'){
    if(!E.bereich){
      frage.textContent = 'Welche Kennzahl?';
      hilfe.textContent = 'Eigenkapital und Steuerfuss liegen nur für 2025 bis 2030 vor.';
      const o = el('div', {class: 'optionen'});
      KZ_WAHL.forEach(([k, t]) => o.append(optionKnopf(t, KZ_TITEL[k] !== t ? KZ_TITEL[k] : '', E.kz === k, () => { E.kz = k; weiter(); })));
      inhalt.append(o);
    } else {
      frage.textContent = 'Aufwand, Ertrag oder netto?';
      hilfe.textContent = 'Über alle Konten der Einheit, wie die Summenzeilen der Detailzahlen.';
      const o = el('div', {class: 'optionen'});
      ['A', 'E', 'N'].forEach(k => o.append(optionKnopf(ANSICHT_NAME[k].replace(' (Aufwand minus Ertrag)', ''), '', E.ansicht === k, () => { E.ansicht = k; weiter(); })));
      inhalt.append(o);
    }
  } else if(st_ === 'stichwort'){
    frage.textContent = 'Stichwort, falls gesucht';
    hilfe.textContent = E.ziel === 'pruef' ? 'Ein Wort aus Titel, Zahlen oder Kommentaren der Prüfhinweise. Leer lassen für alle.' : `Ein Wort aus einer Bezeichnung, eine Konto- oder Vorhabennummer. Gesucht wird in: ${bereichName(E.bereich)}. Vorschläge ab drei Buchstaben.`;
    const inp = el('input', {class: 'eingabe', type: 'search', id: 'einstiegStichwort', autocomplete: 'off', spellcheck: 'false', placeholder: E.ziel === 'pruef' ? 'zum Beispiel Personal' : 'zum Beispiel Löhne oder 3010', value: E.stichwort});
    inhalt.append(inp);
    const liste = el('ul', {class: 'trefferliste'}); inhalt.append(liste);
    const zeigeListe = () => {
      liste.innerHTML = '';
      if(E.ziel === 'pruef' || !genugZeichen(inp.value)) return;
      ladeIndex().then(() => {
        const tr = suchen(inp.value, bereichFilter()).slice(0, 12);
        liste.innerHTML = '';
        if(!tr.length){ liste.append(el('li', {class: 'leise klein', text: 'Kein Eintrag in diesem Bereich. Weiter ohne Stichwort oder Bereich ändern.'})); return; }
        tr.forEach(e => { const a = el('a', {href: zielVon(e, einstiegZielOptionen())}); a.append(el('span', null, [el('span', {class: 'code', text: e[1]}), document.createTextNode(e[2])]), el('span', {class: 'leise klein', text: EINZAHL[e[0]]}), el('small', {text: kontextVon(e)})); liste.append(el('li', null, [a])); });
      });
    };
    let t; inp.addEventListener('input', () => { E.stichwort = inp.value; clearTimeout(t); t = setTimeout(zeigeListe, 120); });
    inp.addEventListener('keydown', ev => { if(ev.key === 'Enter'){ ev.preventDefault(); weiter(); } });
    zeigeListe();
    const ohne = el('button', {type: 'button', class: 'btn zweit', text: 'Weiter ohne Stichwort'}); ohne.addEventListener('click', () => { E.stichwort = ''; weiter(); });
    const mit = el('button', {type: 'button', class: 'btn', text: 'Weiter'}); mit.addEventListener('click', weiter);
    unten.append(mit, ohne);
    if(fokus) setTimeout(() => inp.focus(), 30);
  } else if(st_ === 'kontrolle'){
    frage.textContent = 'Kontrollfrage: Stimmt diese Auswahl?';
    hilfe.textContent = 'Jeder Punkt lässt sich ändern. «Ja, anzeigen» öffnet die Ansicht; sie lässt sich danach über die Adresse teilen.';
    const k = el('div', {class: 'kontrolle'}), ol = el('ol');
    const punkt = (text, schritt) => { const li = el('li', {text}); if(schritt){ const b = el('button', {type: 'button', class: 'linkknopf', text: 'ändern'}); b.addEventListener('click', () => { E.schritt = schritt; zeichneEinstieg(true); }); li.append(b); } ol.append(li); };
    punkt(ZIELE.find(z => z[0] === E.ziel)[1], 'ziel');
    if(s.includes('jahr1')) punkt(`Jahr: ${E.jahre.map(jahrName).join(', ')}`, 'jahr1');
    if(s.includes('jahre')) punkt(`Jahre: ${E.jahre.map((x, i) => `${SLOT[i]} ${jahrName(x)}`).join(', ')}`, 'jahre');
    if(s.includes('jahrP')) punkt(`Jahr: ${E.jahre.length ? jahrName(E.jahre[0]) : 'alle'}`, 'jahrP');
    if(E.ziel === 'entwicklung') punkt('Zeitraum: 2021 bis 2030', null);
    const bs = s.find(x => x.startsWith('bereich')); if(bs) punkt(`Bereich: ${bereichName(E.bereich)}`, bs);
    if(s.includes('ansicht') && E.ansicht) punkt(`Ansicht: ${ANSICHT_NAME[E.ansicht]}`, uebersprungen('ansicht') ? null : 'ansicht');
    if(s.includes('ansichtE') && !uebersprungen('ansichtE')) punkt(E.bereich ? `Ansicht: ${ANSICHT_NAME[E.ansicht || 'N']}` : `Kennzahl: ${(KZ_WAHL.find(x => x[0] === (E.kz || 'gesamt')) || [0, ''])[1]}`, 'ansichtE');
    if(s.includes('stichwort')) punkt(`Stichwort: ${E.stichwort.trim() ? '«' + E.stichwort.trim() + '»' : 'keines'}`, 'stichwort');
    k.append(ol); inhalt.append(k);
    const ja = el('a', {class: 'btn', href: einstiegZiel(), text: 'Ja, anzeigen', style: 'text-decoration:none;display:inline-block'});
    unten.append(ja);
    if(E.stichwort.trim() && E.ziel !== 'pruef' && genugZeichen(E.stichwort)){
      const liste = el('ul', {class: 'trefferliste'});
      inhalt.append(el('div', {class: 'optgruppe', text: `Treffer für «${E.stichwort.trim()}» in ${bereichName(E.bereich)}`}), liste);
      ladeIndex().then(() => {
        const tr = suchen(E.stichwort, bereichFilter()).slice(0, 15);
        if(!tr.length) liste.append(el('li', {class: 'leise klein', text: 'Kein Eintrag. «Ja, anzeigen» öffnet den Bereich ohne Stichwort.'}));
        tr.forEach(e => { const a = el('a', {href: zielVon(e, einstiegZielOptionen())}); a.append(el('span', null, [el('span', {class: 'code', text: e[1]}), document.createTextNode(e[2])]), el('span', {class: 'leise klein', text: EINZAHL[e[0]]}), el('small', {text: kontextVon(e)})); liste.append(el('li', null, [a])); });
        if(tr.length) ja.href = zielVon(tr[0], einstiegZielOptionen());
      });
    }
  }
  if(E.ziel) unten.append(zurueckKnopf, neuKnopf);
  if(unten.children.length) box.append(unten);
  if(fokus) setTimeout(() => { const f = $('#einstiegFrage'); if(f && document.activeElement !== $('#einstiegStichwort')) f.focus({preventScroll: false}); }, 20);
}
function einstiegZielOptionen(){
  const ir = E.ansicht === 'I';
  return {sel: E.jahre.length ? E.jahre : VORGABE_SEL.slice(), ir, ansicht: ir ? 'N' : (E.ansicht || 'N')};
}
function bereichFilter(){
  const ir = E.ansicht === 'I', b = E.bereich, ks = E.jahre.filter(k => !istPlan(k));
  const imJahr = e => !ks.length || !e[4] || ks.some(k => vorhanden(e[4], k));
  return e => {
    const t = e[0];
    if(!['d', 'n', 'f', 'g', 'k', 'v'].includes(t)) return false;
    if(ir ? !['d', 'n', 'v'].includes(t) : t === 'v') return false;
    if(['n', 'f', 'k', 'v'].includes(t) && !imJahr(e)) return false;
    if(!b) return true;
    const c = b.slice(1);
    if(b[0] === 'd') return t === 'd' ? e[1] === c : t === 'n' ? e[1].slice(0, 2) === c : t === 'f' ? e[3].slice(0, 2) === c : (t === 'k' || t === 'v') ? e[6] === c : false;
    if(b[0] === 's') return t === 'n' ? e[1] === c : t === 'f' ? e[3] === c : (t === 'k' || t === 'v') ? e[3] === c : false;
    if(b[0] === 'g') return (t === 'k' || t === 'g') && e[1].startsWith(c);
    return true;
  };
}
function einstiegZiel(){
  const sel = E.jahre.length ? E.jahre : VORGABE_SEL.slice();
  const b = E.bereich, ir = E.ansicht === 'I';
  if(E.ziel === 'entwicklung'){
    if(!b) return `${BASIS}entwicklung/#kz=${E.kz || 'gesamt'}`;
    return `${BASIS}entwicklung/#b=${b}&ea=${E.ansicht && E.ansicht !== 'I' ? E.ansicht : 'N'}`;
  }
  if(E.ziel === 'pruef'){
    const p = {}; if(E.jahre.length) p.ds = E.jahre[0]; if(b) p.dep = b.slice(1); if(E.stichwort.trim()) p.q = E.stichwort.trim();
    return `${BASIS}pruefhinweise/#${new URLSearchParams(p).toString()}`;
  }
  if(E.ziel === 'jahr' && !b && !ir && !E.stichwort.trim()) return `${BASIS}ueberblick/#d=${sel[0]}`;
  const p = {d: sel.join(','), r: ir ? 'ir' : 'er', g: b && b[0] === 'g' ? 'art' : 'inst', a: ir ? 'N' : (E.ansicht || 'N'), u: E.ansicht === 'N' || ir ? 'alle' : 'ord'};
  if(b && b[0] === 'd') p.p = 'd' + b.slice(1);
  if(b && b[0] === 's') p.p = `d${b.slice(1, 3)}/s${b.slice(1)}`;
  if(b && b[0] === 'g') p.p = 'a' + b.slice(1);
  if(E.ziel === 'grafik') p.grafik = sel.length > 1 ? 'ringe' : 'kuchen';
  return `${BASIS}vergleich/#${new URLSearchParams(p).toString()}`;
}

/* ── Start: Gesamtergebnis 2021 bis 2030 ─────────────────────────────── */
function zeichneStart(){
  const box = $('#startBalken'); if(!box) return;
  const W = Math.max(320, box.clientWidth || 900), schmal = W < 600, H = schmal ? 230 : 260, L = schmal ? 40 : 52, R = 8, T = 22, B = 30;
  const jahre = []; for(let j = J_MIN; j <= J_MAX; j++) jahre.push(j);
  const werte = jahre.map(j => { const jj = String(j).slice(2); return {j, r: IDX['r' + jj] !== undefined ? KZ['r' + jj].gesamt : null, b: IDX['b' + jj] !== undefined ? KZ['b' + jj].gesamt : null, p: IDX['p' + jj] !== undefined ? KZ['p' + jj].gesamt : null, v: DS[IDX['b' + jj]] && DS[IDX['b' + jj]].vorlage}; });
  const alle = werte.flatMap(w => [w.r, w.b, w.p]).filter(v => v !== null);
  let lo = Math.min(0, ...alle), hi = Math.max(0, ...alle);
  const schritt = (() => { const roh = (hi - lo) / 4, p = Math.pow(10, Math.floor(Math.log10(roh))); return [1, 2, 2.5, 5, 10].map(f => f * p).find(s => s >= roh); })();
  lo = Math.floor(lo / schritt) * schritt; hi = Math.ceil(hi / schritt) * schritt;
  const y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const fw = (W - L - R) / jahre.length, bw = Math.min(26, fw * .34);
  const dunkel = farbe('--linie-r'), grau = farbe('--linie-b'), fl = farbe('--karte');
  let s = `<svg class="balkenjahre" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gesamtergebnis 2021 bis 2030 in Millionen Franken">`;
  for(let v = lo; v <= hi + 1e-6; v += schritt) s += `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="${Math.abs(v) < 1e-6 ? farbe('--linie-2') : farbe('--linie')}"/><text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${mio(v, 0)}</text>`;
  const balken = (x, v, art, titel) => {
    if(v === null) return '';
    const y0 = y(0), y1 = y(v), h = Math.max(1, Math.abs(y1 - y0)), yy = Math.min(y0, y1);
    const stil = art === 'r' ? `fill="${dunkel}"` : art === 'b' ? `fill="${fl}" stroke="${grau}" stroke-width="1.6"` : `fill="${fl}" stroke="${grau}" stroke-width="1.6" stroke-dasharray="2 2.5"`;
    return `<rect x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2" ${stil}><title>${esc(titel)}: ${mioVz(v)} Mio. Franken</title></rect>` +
      (!schmal ? `<text class="wert" x="${(x + bw / 2).toFixed(1)}" y="${(v >= 0 ? yy - 4 : yy + h + 12).toFixed(1)}" text-anchor="middle" style="font-size:10.5px">${mioVz(v, 0)}</text>` : '');
  };
  werte.forEach((w, i) => {
    const x0 = L + i * fw + fw / 2;
    if(w.r !== null && w.b !== null){ s += balken(x0 - bw - 1, w.b, 'b', `Budget ${w.j}`) + balken(x0 + 1, w.r, 'r', `Rechnung ${w.j}`); }
    else if(w.b !== null) s += balken(x0 - bw / 2, w.b, 'b', `Budget ${w.j}${w.v ? ' (Vorlage)' : ''}`);
    else if(w.p !== null) s += balken(x0 - bw / 2, w.p, 'p', `Finanzplan ${w.j}`);
    s += `<text x="${x0.toFixed(1)}" y="${H - 9}" text-anchor="middle">${schmal ? "’" + String(w.j).slice(2) : w.j}</text>`;
  });
  box.innerHTML = s + '</svg>';
}
function zeichneKurzzahlen(){
  const box = $('#kurzzahlen'); if(!box) return;
  const rs = D.jahre.filter(j => j.a === 'r'), letzteR = rs[rs.length - 1];
  const ks = [letzteR.k, ...D.jahre.filter(j => j.a === 'b' && j.j > letzteR.j).map(j => j.k)];
  box.innerHTML = ks.map(k => { const K = KZ[k]; return `<a class="kachel" style="text-decoration:none;color:inherit" href="${BASIS}ueberblick/#d=${k}"><div class="z">${mioVz(K.gesamt)} Mio.</div><div class="l">Gesamtergebnis ${esc(dsLang(k))}</div><div class="s">Ertrag ${mio(K.ert)} Mio., Aufwand ${mio(K.auf)} Mio., Nettoinvestitionen ${mio(K.netInv)} Mio.</div></a>`; }).join('');
}

/* ── Start je Seite ──────────────────────────────────────────────────── */
function zustandAusAdresse(){
  Object.assign(st, {sel: VORGABE_SEL.slice(), rechnung: 'er', gl: 'inst', ansicht: 'A', umfang: 'ord', pfad: [], markiert: null, tab: st.tab, kz: 'gesamt', bereich: null, ea: 'N'});
  st.bf = {typ: 'alle', ds: 'alle', min: 0, nurAuswahl: false, q: '', dep: ''};
  hashLesen();
}
function vergleichInit(){
  $$('#drillSteuer .chips button').forEach(b => b.addEventListener('click', () => {
    if(b.disabled) return;
    const f = b.dataset.feld, w = b.dataset.wert;
    if(st[f] === w) return;
    st[f] = w;
    if(f === 'rechnung' || f === 'gl' || f === 'umfang'){ st.pfad = []; st.markiert = null; st.offen.clear(); baum(); }
    zeichneDrill(); hashSchreiben();
  }));
  $$('#tabArt button').forEach(b => b.addEventListener('click', () => { st.tab = b.dataset.wert; speicher.setze('tab', st.tab); zeichneDrill(); hashSchreiben(); }));
  $$('#schnell button').forEach(b => b.addEventListener('click', () => { st.sel = b.dataset.sel.split(','); st.pfad = []; st.markiert = null; neu(); }));
  $('#csvKnopf').addEventListener('click', csv);
  NACH_OEFFNEN.aufteilung = [() => zeichneDrill()];
}
function befundeInit(){
  const ds = $('#bfDs');
  const mitBf = new Set(BF.flatMap(b => b.ds));
  D.jahre.map(j => j.k).filter(k => mitBf.has(k)).reverse().forEach(k => ds.append(el('option', {value: k, text: dsLang(k)})));
  const dep = $('#bfDep');
  Object.keys(D.dep).sort().forEach(c => dep.append(el('option', {value: c, text: `${c} ${D.dep[c]}`})));
  const setzen = () => { ds.value = st.bf.ds; dep.value = st.bf.dep; $('#bfSuche').value = st.bf.q; $('#bfMin').value = String(st.bf.min); $('#bfNur').checked = st.bf.nurAuswahl; };
  setzen();
  ds.addEventListener('change', ev => { st.bf.ds = ev.target.value; st.bfZahl = 30; zeichneBefunde(); hashSchreiben(); });
  dep.addEventListener('change', ev => { st.bf.dep = ev.target.value; st.bfZahl = 30; zeichneBefunde(); hashSchreiben(); });
  $('#bfMin').addEventListener('change', ev => { st.bf.min = +ev.target.value; st.bfZahl = 30; zeichneBefunde(); });
  $('#bfNur').addEventListener('change', ev => { st.bf.nurAuswahl = ev.target.checked; st.bfZahl = 30; zeichneBefunde(); });
  let t; $('#bfSuche').addEventListener('input', ev => { st.bf.q = ev.target.value; st.bfZahl = 30; clearTimeout(t); t = setTimeout(() => { zeichneBefunde(); hashSchreiben(); }, 150); });
  return setzen;
}
function allesZeichnen(){
  zeichneRaster(); zeichneHinweis(); zeichneUeberblick(); zeichneKennzahlen(); zeichneVerlauf(); zeichneBereiche(); zeichneDrill(); zeichneBefunde();
  zeichneStart();
}
async function seiteStarten(){
  rahmenInit();
  const namen = (document.body.dataset.daten || 'kern').split(',').filter(Boolean);
  let werte;
  try{ werte = await Promise.all(namen.map(ladeDatei)); }
  catch(e){
    const m = $('#ladefehler');
    if(m){ m.hidden = false; m.textContent = 'Die Daten konnten nicht geladen werden. Seite neu laden; wird die Seite direkt aus dem Dateisystem geöffnet, braucht sie einen lokalen Webserver (siehe README).'; }
    return;
  }
  datenSetzen(Object.fromEntries(namen.map((n, i) => [n, werte[i]])));
  // Alte Adressen des Finanzspiegels (#d=…&r=…&p=…) zeigten den Vergleich
  if(SEITE === 'start' && /(^|[#&])(r|p|g)=/.test(location.hash)){ location.replace(BASIS + 'vergleich/' + location.hash); return; }
  const gemerkterTab = speicher.lies('tab'); if(gemerkterTab === 'baum' || gemerkterTab === 'ebene') st.tab = gemerkterTab;
  zustandAusAdresse();
  $$('[data-laden]').forEach(x => x.remove());
  verweiseNachfuehren();
  const sf = $('#sucheGlobal'); if(sf) suchfeld(sf, $('#sucheGlobalListe'));
  // Stand in der Seitenleiste
  const stand = $('#standLeiste'); if(stand) stand.textContent = standText();
  let befundeSetzen = null;
  if(SEITE === 'start'){ zeichneEinstieg(); zeichneKurzzahlen(); zeichneStart(); }
  if(SEITE === 'ueberblick'){ zeichneRaster(); zeichneUeberblick(); grafikInit(); }
  if(SEITE === 'entwicklung'){ bereichAuswahlFuellen(); zeichneVerlauf(); zeichneBereiche(); grafikInit(); NACH_OEFFNEN.tabelle = [zeichneVerlaufTabelle]; }
  if(SEITE === 'vergleich'){
    const g = hashParameter().get('grafik');
    vergleichInit(); baum(); neu(true); grafikInit();
    if(g) setTimeout(() => oeffneGrafik(g), 300);
    // Kommentare der Dienststellen nachladen, danach die Knöpfe «Kommentar» zeigen
    ladeDatei('komm').then(k => { D.komm = k; zeichneDrill(); }).catch(() => {});
  }
  if(SEITE === 'pruefhinweise'){
    befundeSetzen = befundeInit(); zeichneBefunde();
    const nr = +hashParameter().get('nr'); if(nr) oeffneBefundNr(nr);
  }
  if(['ueberblick', 'entwicklung', 'vergleich', 'pruefhinweise'].includes(SEITE)) hashSchreiben();
  // Verweise innerhalb derselben Seite (Suche, Prüfhinweise) ändern nur die Adresse
  window.addEventListener('hashchange', () => {
    const h = location.hash.slice(1);
    if(!h.includes('=')) return;
    zustandAusAdresse();
    if(SEITE === 'vergleich'){ st.offen.clear(); baum(); neu(true); const z = $('#aufteilung'); if(z){ z.open = true; z.scrollIntoView({behavior: 'smooth', block: 'start'}); } }
    else if(SEITE === 'pruefhinweise'){ if(befundeSetzen) befundeSetzen(); zeichneBefunde(); const nr = +hashParameter().get('nr'); if(nr) oeffneBefundNr(nr); }
    else allesZeichnen();
    verweiseNachfuehren();
  });
  let rz, breite = window.innerWidth;
  window.addEventListener('resize', () => { if(window.innerWidth === breite) return; breite = window.innerWidth; clearTimeout(rz); rz = setTimeout(() => { zeichneUeberblick(); zeichneVerlauf(); zeichneDrill(); zeichneStart(); }, 150); });
  if(window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', allesZeichnen);
}
if(document.fonts && document.fonts.ready) document.fonts.ready.then(seiteStarten); else seiteStarten();
/* Zugang für finanzspiegel/pruefen.py, nur mit ?test in der Adresse */
if(/[?&]test\b/.test(location.search)) window.__fs = {D: () => D, KZ: () => KZ, DS: () => DS, st, baum, BAUM: () => BAUM, wert, kinderSortiert, gruppenVon, kzWert, neu, ladeIndex, suchen, ladeKommIndex, suchenKomm, E, zeichneEinstieg, einstiegZiel, oeffneGrafik, gZeichnen: () => gZeichnen(), G};

})();
