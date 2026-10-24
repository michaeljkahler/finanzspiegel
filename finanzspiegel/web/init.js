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
