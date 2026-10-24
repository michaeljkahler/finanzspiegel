#!/usr/bin/env python3
"""Prüft den gebauten Finanzspiegel im Browser.

Aufruf aus der Projektwurzel, nach bauen.py:
    python3 finanzspiegel/pruefen.py [Ordner für Bildschirmfotos]

Braucht Playwright mit Chromium (in der Sandbox: bash scripts/browser_einrichten.sh).
Die Seiten laufen über einen lokalen HTTP-Server; mit ?test in der Adresse legt das
Programm einen Zugang zu seinen Funktionen an (window.__fs). Geprüft wird:

1. Zahlen: Wurzel des Kontobaums gegen die Kennzahlen je Datensatz (ordentlicher Aufwand
   und Ertrag, Nettoaufwand aller Konten gleich minus Gesamtergebnis, Nettoinvestitionen),
   jeder Knoten gleich der Summe seiner Kinder, nach Dienststelle und nach Sachgruppe.
2. Vorberechnete Summen (Start, Woher und wohin, Entwicklung) gegen die Kontozeilen:
   je Sachgruppe, Departement und Dienststelle.
3. Suche und Einstieg: Treffer für Nummern, Alltagswörter (Synonyme) und Kommentare;
   ein Durchlauf des geführten Einstiegs ergibt die erwartete Adresse.
4. Grafiken: jedes Motiv jeder Seite zeichnet etwas in die Leinwand.
5. Darstellung: keine Fehler in der Konsole, auf 390 px kein waagrechtes Scrollen.
Rückgabewert 1 bei einer Abweichung.
"""
from __future__ import annotations

import functools
import http.server
import os
import socketserver
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
SEITEN = ["", "ueberblick/", "entwicklung/", "vergleich/", "pruefhinweise/", "begriffe/", "methode/"]


def browser_umgebung():
    libs = Path.home() / "libs"
    if libs.exists():
        pfade = [str(libs / "usr/lib/x86_64-linux-gnu"), str(libs / "lib/x86_64-linux-gnu")]
        os.environ["LD_LIBRARY_PATH"] = ":".join(pfade + [os.environ.get("LD_LIBRARY_PATH", "")])


ZAHLEN = r"""
() => {
  const T = window.__fs, D = T.D(), KZ = T.KZ(), st = T.st, out = {faelle: 0, abw: []};
  const nah = (a, b) => Math.abs(a - b) <= 2;
  const kinderSumme = (n, wo) => {
    if(!n.kinder.size) return;
    for(const i of [0, 1]){
      const s = [...n.kinder.values()].reduce((a, c) => a + c.v[0][i], 0);
      out.faelle++;
      if(!nah(s, n.v[0][i])) out.abw.push(`${wo} ${n.id} Seite ${i}: Kinder ${s} statt ${n.v[0][i]}`);
    }
    n.kinder.forEach(c => kinderSumme(c, wo));
  };
  for(const j of D.jahre){
    const k = j.k, K = KZ[k];
    for(const gl of ['inst', 'art']){
      Object.assign(st, {sel: [k], rechnung: 'er', gl, umfang: 'ord', pfad: []}); T.baum();
      const B = T.BAUM(); out.faelle += 2;
      if(!nah(B.v[0][0], K.auf)) out.abw.push(`${k} ${gl} Aufwand ${B.v[0][0]} statt ${K.auf}`);
      if(!nah(B.v[0][1], K.ert)) out.abw.push(`${k} ${gl} Ertrag ${B.v[0][1]} statt ${K.ert}`);
      kinderSumme(B, `${k} ${gl} ord`);
      Object.assign(st, {umfang: 'alle'}); T.baum();
      const A = T.BAUM(); out.faelle++;
      // Toleranz 10 Franken: Kontozeilen und Kennzahlen sind je Konto auf Franken gerundet
      if(Math.abs(A.v[0][0] - A.v[0][1] + K.gesamt) > 10) out.abw.push(`${k} ${gl} netto alle ${A.v[0][0] - A.v[0][1]} statt ${-K.gesamt}`);
      kinderSumme(A, `${k} ${gl} alle`);
    }
    Object.assign(st, {sel: [k], rechnung: 'ir', gl: 'inst', umfang: 'alle', pfad: []}); T.baum();
    const I = T.BAUM(); out.faelle++;
    if(!nah(I.v[0][0] - I.v[0][1], K.netInv)) out.abw.push(`${k} Nettoinvestitionen ${I.v[0][0] - I.v[0][1]} statt ${K.netInv}`);
    kinderSumme(I, `${k} ir`);
    // Vorberechnete Summen gegen die Kontozeilen
    const i = 5 + D.jahre.findIndex(x => x.k === k), g2 = {}, dep = {}, dst = {};
    for(const z of D.z){ const v = z[i]; if(!v) continue; g2[z[3].slice(0, 2)] = (g2[z[3].slice(0, 2)] || 0) + v; dep[z[0]] = (dep[z[0]] || 0) + v; dst[z[1]] = (dst[z[1]] || 0) + v; }
    for(const [c, v] of Object.entries(g2)){ out.faelle++; if(!nah(v, D.g2[k][c] || 0)) out.abw.push(`${k} g2 ${c}`); }
    for(const [c, v] of Object.entries(dep)){ out.faelle++; if(!nah(v, D.depn[k][c][2])) out.abw.push(`${k} depn ${c}`); }
    for(const [c, v] of Object.entries(dst)){ out.faelle++; if(!nah(v, D.dstn[k][c][2])) out.abw.push(`${k} dstn ${c}`); }
    const summe = Object.values(D.depn[k]).reduce((a, x) => a + x[2], 0); out.faelle++;
    if(Math.abs(summe + K.gesamt) > 10) out.abw.push(`${k} Departemente netto ${summe} statt ${-K.gesamt}`);
  }
  return out;
}
"""

SUCHE = r"""
async () => {
  const T = window.__fs, out = {faelle: 0, abw: []};
  await T.ladeIndex(); await T.ladeKommIndex();
  const fall = (q, art, text) => { out.faelle++; const r = T.suchen(q); if(!r.some(e => e[0] === art && (e[1] + ' ' + e[2]).includes(text))) out.abw.push(`Suche «${q}»: kein ${art} mit «${text}»`); };
  fall('2131', 'n', 'Gesundheitsamt'); fall('lehrer', 'k', 'Lehrpersonen'); fall('krankenkasse', 'n', 'Krankenversicherung');
  fall('IPR0181', 'v', 'Cantosana'); fall('3010.00', 'k', 'Löhne'); fall('defizit', 'b', 'Aufwandüberschuss'); fall('steuern', 'z', 'Fiskalertrag');
  out.faelle++; if(!T.suchenKomm('Prämienverbilligung').length) out.abw.push('Kommentare: kein Treffer für Prämienverbilligung');
  return out;
}
"""

EINSTIEG = r"""
() => {
  const T = window.__fs, E = T.E, out = {faelle: 0, abw: []};
  const fall = (setzen, erwartet) => { Object.assign(E, {ziel: null, jahre: [], bereich: null, dep: null, ansicht: null, kz: null, stichwort: ''}, setzen); out.faelle++; const z = decodeURIComponent(T.einstiegZiel()); if(!z.endsWith(erwartet)) out.abw.push(`Einstieg ${JSON.stringify(setzen)}: ${z}`); };
  fall({ziel: 'jahr', jahre: ['r25']}, 'ueberblick/#d=r25');
  fall({ziel: 'vergleich', jahre: ['b27', 'b26'], bereich: 's2131', ansicht: 'N'}, 'vergleich/#d=b27,b26&r=er&g=inst&a=N&u=alle&p=d21/s2131');
  fall({ziel: 'vergleich', jahre: ['r25', 'r24'], bereich: 'g30', ansicht: 'A'}, 'vergleich/#d=r25,r24&r=er&g=art&a=A&u=ord&p=a30');
  fall({ziel: 'entwicklung', bereich: 'd22', ansicht: 'A'}, 'entwicklung/#b=d22&ea=A');
  fall({ziel: 'entwicklung', kz: 'fiskal'}, 'entwicklung/#kz=fiskal');
  fall({ziel: 'pruef', jahre: ['r24'], bereich: 'd25', stichwort: 'Steuern'}, 'pruefhinweise/#ds=r24&dep=25&q=Steuern');
  fall({ziel: 'grafik', jahre: ['b27'], bereich: 'd22', ansicht: 'A'}, 'vergleich/#d=b27&r=er&g=inst&a=A&u=ord&p=d22&grafik=kuchen');
  return out;
}
"""

GRAFIK = r"""
async (motive) => {
  const T = window.__fs, out = {faelle: 0, abw: []};
  for(const m of motive){
    T.oeffneGrafik(m);
    await new Promise(r => setTimeout(r, 120));
    const c = document.querySelector('#grafikCanvas'), x = c.getContext('2d');
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let dunkel = 0; for(let i = 0; i < d.length; i += 4 * 97) if(d[i] < 120) dunkel++;
    out.faelle++; if(dunkel < 50) out.abw.push(`Grafik ${m}: Leinwand fast leer (${dunkel})`);
    document.querySelector('#grafikZu').click();
  }
  return out;
}
"""


def main() -> int:
    from playwright.sync_api import sync_playwright
    bilder = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if bilder:
        bilder.mkdir(parents=True, exist_ok=True)

    class Still(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    srv = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Still, directory=str(SITE)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    U = f"http://127.0.0.1:{srv.server_address[1]}/"
    faelle, abw = 0, []
    browser_umgebung()
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-proxy-server"])
        fehler = []
        for breite in (1300, 390):
            pg = b.new_page(viewport={"width": breite, "height": 900}, is_mobile=breite < 500)
            pg.on("pageerror", lambda e: fehler.append(f"{e}"))
            pg.on("console", lambda m: fehler.append(m.text) if m.type == "error" else None)
            for s in SEITEN:
                pg.goto(U + s + "?test"); pg.wait_for_timeout(1200)
                faelle += 1
                if pg.evaluate("document.documentElement.scrollWidth") > breite + 1:
                    abw.append(f"{s or 'start'} {breite} px: waagrechtes Scrollen")
                if bilder:
                    pg.screenshot(path=str(bilder / f"{(s.strip('/') or 'start')}-{breite}.png"), full_page=True)
                if breite == 1300 and s == "vergleich/":
                    for teil in (ZAHLEN, SUCHE, GRAFIK):
                        r = pg.evaluate(teil, ["kuchen", "balken", "ringe", "ueberblick", "entwicklung", "kennzahlen"]) if teil is GRAFIK else pg.evaluate(teil)
                        faelle += r["faelle"]; abw += r["abw"]
                if breite == 1300 and s == "":
                    r = pg.evaluate(EINSTIEG); faelle += r["faelle"]; abw += r["abw"]
                if breite == 1300 and s in ("ueberblick/", "entwicklung/"):
                    r = pg.evaluate(GRAFIK, ["ueberblick", "kennzahlen"] if s == "ueberblick/" else ["entwicklung"])
                    faelle += r["faelle"]; abw += r["abw"]
            pg.close()
        b.close()
    srv.shutdown()
    abw += [f"Konsole: {f}" for f in fehler if "WebGL" not in f and "GroupMarker" not in f]
    print(f"Prüfung: {faelle} Fälle, {len(abw)} abweichend")
    for a in abw[:40]:
        print("  ", a)
    return 1 if abw else 0


if __name__ == "__main__":
    sys.exit(main())
