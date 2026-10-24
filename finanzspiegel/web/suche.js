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
