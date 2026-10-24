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
