#!/usr/bin/env python3
"""Baut den Finanzspiegel Schaffhausen: sieben Unterseiten mit Seitenliste, Suche oben und
geführtem Einstieg.

Aufruf aus der Projektwurzel (nach daten.py und analyse.py):
    python3 finanzspiegel/bauen.py

Liest    finanzspiegel/daten/finanzspiegel.json   daten.py, analyse.py
         finanzspiegel/daten/begriffe.json        Begriffe (Seite und Suche)
         finanzspiegel/daten/synonyme.json        Alltagswörter für die Suche
         finanzspiegel/web/*.css, *.js            Darstellung und Programm der Seiten
         finanzspiegel/grafik.js                  Grafiken für Präsentation und Social Media
         finanzspiegel/rahmen/                    Impressum, Fehler melden, Kanal (wie Politspiegel)
Schreibt site/index.html                          Start: Einstieg, Kurzzahlen, Seiten
         site/ueberblick/  site/entwicklung/  site/vergleich/  site/pruefhinweise/
         site/begriffe/    site/methode/
         site/daten/kern.json er.json ir.json komm.json befunde.json index.json
         site/assets/finanzspiegel.css, finanzspiegel.js

Warum Unterseiten und Datendateien statt einer Seite: Die frühere Einzelseite trug alle
Zahlen inline (850 kB für vier Jahre). Mit zwölf Datensätzen wüchse sie auf über 2 MB. Jetzt
lädt jede Seite nur, was sie zeigt: Start, Woher und wohin und Entwicklung kommen mit
kern.json aus (Summen sind vorberechnet), der Vergleich lädt die Kontozeilen, die Kommentare
der Dienststellen kommen nach. Der Browser behält die Dateien beim Wechsel der Seite.

Die Ansicht steht weiter in der Adresse (#d=b27,b26,r25&r=er&g=inst&a=A&u=ord&p=d22/s2210),
die Seitenliste trägt die gewählten Jahre mit.
"""

from __future__ import annotations

import hashlib
import html
import json
import shutil
import sys
from collections import defaultdict
from pathlib import Path

HIER = Path(__file__).resolve().parent
ROOT = HIER.parent
SITE = ROOT / "site"
WEB = HIER / "web"
sys.path.insert(0, str(HIER / "rahmen"))
from impressum import IMPRESSUM_CSS, impressum_html  # noqa: E402
from melden import MELDEN_CSS, melden_html, melden_knopf_html  # noqa: E402
from social import kanal_html  # noqa: E402
from testphase import TESTPHASE_CSS, testphase_html  # noqa: E402

RAHMEN = json.loads((HIER / "rahmen" / "politspiegel.json").read_text(encoding="utf-8"))
POLITSPIEGEL = RAHMEN.get("politspiegel_url", "https://michaeljkahler.github.io/politspiegel/")
ADRESSE = RAHMEN.get("finanzspiegel_url", "https://michaeljkahler.github.io/finanzspiegel/")
e = lambda s: html.escape(str(s), quote=True)
chf = lambda v: f"{v:,.0f}".replace(",", "'")
MONATE = ("Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember")

# Seitenliste: Schlüssel, Pfad, Titel, Untertitel, Datendateien
SEITEN = [
    ("start", "", "Start", "Einstieg und Überblick", "kern"),
    ("ueberblick", "ueberblick/", "Woher und wohin", "Ertrag und Aufwand eines Jahres", "kern"),
    ("entwicklung", "entwicklung/", "Entwicklung 2021–2030", "Verlauf, Departemente, Aufgabenfelder", "kern"),
    ("vergleich", "vergleich/", "Vergleich bis zum Konto", "bis drei Jahre, Ebene oder Baum", "kern,er,ir,befunde"),
    ("pruefhinweise", "pruefhinweise/", "Prüfhinweise", "grosse Veränderungen, Abweichungen", "kern,befunde"),
    ("begriffe", "begriffe/", "Begriffe", "von Aufwand bis Verpflichtungskredit", "kern"),
    ("methode", "methode/", "Methode und Quellen", "Dokumente, Selbstprüfung, Regeln", "kern"),
]
MIT_AUSWAHL = {"ueberblick", "entwicklung", "vergleich"}


def mio(v: float, st: int = 1) -> str:
    return ("−" if v < 0 else "") + f"{abs(v) / 1e6:,.{st}f}".replace(",", "'")


def datum(iso: str) -> str:
    return f"{int(iso[8:10])}. {MONATE[int(iso[5:7]) - 1]} {iso[:4]}" if len(iso) == 10 else ""


# ─────────────────────────────────────────────────────────────── Datendateien

def datendateien(D: dict, begriffe: dict, synonyme: dict) -> dict[str, dict]:
    keys = [j["k"] for j in D["jahre"]]
    kern = {k: D[k] for k in ("stand", "jahre", "plan", "dep", "dst", "spz", "sg", "erkl", "kz", "bilanz",
                              "felder", "agg", "aggir", "g2", "depn", "dstn", "quellen", "regeln", "kontrollen")
            if k in D}
    kern["pruefung"] = D.get("pruefung", {})
    er = {"z": D["z"]}
    ir = {"ir": D["ir"], "irk": D["irk"], "irp": D["irp"]}
    komm = D["komm"]
    befunde = {"befunde": D.get("befunde", []), "typen": D.get("typen", [])}

    # Suchverzeichnis. Je Eintrag: Art, Nummer, Bezeichnung, Ort, Jahre (Bitmaske über die
    # Datensätze je Konto), weitere Felder je Art; das Programm (suche.js) liest die Positionen.
    maske_konto, maske_dst, maske_dep, maske_spz = defaultdict(int), defaultdict(int), defaultdict(int), defaultdict(int)
    konto_info = {}
    for z in D["z"]:
        dep, dst, spz, konto, name = z[:5]
        m = sum(1 << i for i, v in enumerate(z[5:5 + len(keys)]) if v)
        schl = (dst, spz, konto)
        maske_konto[schl] |= m
        konto_info[schl] = (name, dep)
        maske_dst[dst] |= m
        maske_dep[dep] |= m
        if spz:
            maske_spz[(spz, dst)] |= m
    vorhaben, maske_vh = {}, defaultdict(int)
    for z in D["ir"]:
        dep, dst, spz, konto, pr, w = z
        if not pr:
            continue
        m = sum(1 << i for i in range(len(keys)) if w[2 * i] or w[2 * i + 1])
        vorhaben[(dst, spz, pr)] = dep
        maske_vh[(dst, spz, pr)] |= m
        maske_dst[dst] |= m
    eintraege = []
    for key, pfad, titel, unter, _ in SEITEN:
        eintraege.append(["s", "", titel, unter, pfad])
    for b in begriffe["begriffe"]:
        eintraege.append(["b", "", b["t"], b["d"], b["id"], " ".join(b.get("auch", []))])
    kz_namen = {"ert": "Ordentlicher Ertrag", "auf": "Ordentlicher Aufwand", "ord": "Operatives Ergebnis",
                "ao": "Ausserordentliches Ergebnis", "gesamt": "Gesamtergebnis", "fiskal": "Fiskalertrag (Steuern)",
                "transfer": "Transferaufwand", "pers": "Personalaufwand", "netInv": "Nettoinvestitionen",
                "ekap": "Eigenkapital", "sfnp": "Steuerfuss natürliche Personen"}
    for k, n in kz_namen.items():
        eintraege.append(["z", k, n, "Kennzahl, Verlauf 2021 bis 2030"])
    for dep in sorted(D["dep"]):
        eintraege.append(["d", dep, D["dep"][dep], "", maske_dep[dep]])
    for dst in sorted(D["dst"]):
        if maske_dst[dst]:
            eintraege.append(["n", dst, D["dst"][dst] or f"Dienststelle {dst}", "", maske_dst[dst]])
    for (spz, dst), m in sorted(maske_spz.items()):
        eintraege.append(["f", spz, D["spz"].get(spz) or f"Fonds {spz}", dst, m])
    for c in sorted(D["sg"]):
        if c[0] in "34" and len(c) in (2, 3):
            eintraege.append(["g", c, D["sg"][c], ""])
    for x in D["felder"]:
        eintraege.append(["a", str(x["nr"]), x["name"], ""])
    for (dst, spz, pr), dep in sorted(vorhaben.items()):
        eintraege.append(["v", pr, D["irp"].get(pr) or pr, dst, maske_vh[(dst, spz, pr)], spz, dep])
    for (dst, spz, konto), m in sorted(maske_konto.items()):
        name, dep = konto_info[(dst, spz, konto)]
        eintraege.append(["k", konto, name, dst, m, spz, dep])
    index = {"e": eintraege, "syn": synonyme["liste"]}
    return {"kern": kern, "er": er, "ir": ir, "komm": komm, "befunde": befunde, "index": index}


# ─────────────────────────────────────────────────────────────── Bausteine

def seitenliste(aktiv: str, basis: str, unterpunkte: list[tuple[str, str]]) -> str:
    out = []
    for key, pfad, titel, unter, _ in SEITEN:
        ziel = basis + pfad if pfad else (basis or "./")
        attr = f' data-mit-auswahl data-ziel="{e(ziel)}"' if key in MIT_AUSWAHL else ""
        cur = ' aria-current="page"' if key == aktiv else ""
        li = f'<li><a href="{e(ziel)}"{attr}{cur}>{e(titel)}<small>{e(unter)}</small></a>'
        if key == aktiv and unterpunkte:
            li += "<ol>" + "".join(f'<li><a href="#{e(i)}">{e(t)}</a></li>' for i, t in unterpunkte) + "</ol>"
        out.append(li + "</li>")
    return '<ol class="seitenliste">' + "".join(out) + "</ol>"


LUPE = ('<svg class="lupe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" '
        'aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4.2-4.2"/></svg>')
MENU = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">'
        '<path d="M4 7h16M4 12h16M4 17h16"/></svg>')
GRAFIK_DIALOG = """
<button type="button" class="grafikknopf" id="grafikAuf" title="Grafik für Social Media, Präsentation oder Bericht erzeugen" aria-label="Grafik erzeugen" aria-haspopup="dialog">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/></svg><span>Grafik</span></button>
<div class="grafiklage" id="grafikLage">
  <div class="grafikbox" role="dialog" aria-modal="true" aria-labelledby="grafikKopfTitel">
    <div class="grafikkopf"><h2 id="grafikKopfTitel">Grafik für Social Media, Präsentation oder Bericht</h2>
      <button type="button" class="grafikzu" id="grafikZu" aria-label="Schliessen">&times;</button></div>
    <div class="grafikbody">
      <div class="grafikwahl">
        <label class="feld" for="grafikMotiv">Motiv</label>
        <select id="grafikMotiv"></select>
        <div id="grafikEbeneZeile"><label class="feld" for="grafikEbene">Ebene</label><select id="grafikEbene"></select>
          <p class="grafikhinweis" id="grafikEbeneStand" hidden></p><p class="grafikhinweis" id="grafikEbeneHinweis" hidden></p></div>
        <div id="grafikTiefeZeile" hidden><label class="feld" for="grafikTiefe">Unterteilung</label><select id="grafikTiefe"><option value="naechste">nächste Ebene</option><option value="konten">alle Konten darunter</option></select></div>
        <div id="grafikSlotZeile" hidden><label class="feld" for="grafikSlot">Jahr</label><select id="grafikSlot"></select></div>
        <div id="grafikSkalaZeile" hidden><label class="feld" for="grafikSkala">Ringe</label><select id="grafikSkala"><option value="anteil">Anteile, jeder Ring 100 %</option><option value="betrag">Beträge, gemeinsame Skala</option></select></div>
        <label class="feld" for="grafikFormat">Format</label>
        <select id="grafikFormat"></select>
        <span class="feld" id="grafikHgName">Hintergrund</span>
        <div class="radio" role="radiogroup" aria-labelledby="grafikHgName"><label><input type="radio" name="grafikHg" value="weiss" checked> weiss</label><label><input type="radio" name="grafikHg" value="transparent"> transparent</label></div>
        <label class="feld" for="grafikTitel">Titel</label>
        <input type="text" id="grafikTitel" maxlength="140" autocomplete="off">
        <p class="grafiknote" id="grafikNote"></p>
        <div class="grafikknoepfe">
          <button type="button" class="btn" id="grafikLaden">Als PNG herunterladen</button>
          <button type="button" class="btn zweit" id="grafikKopie">In die Zwischenablage kopieren</button>
        </div>
        <p class="grafikmeldung" id="grafikMeldung" role="status" aria-live="polite"></p>
      </div>
      <div class="grafikvorschau" id="grafikVorschau"><canvas id="grafikCanvas" width="1080" height="1350" role="img" aria-label="Vorschau der Grafik"></canvas><p id="grafikMass"></p></div>
    </div>
  </div>
</div>"""


def abschnitt(id_: str, titel: str, inhalt: str, offen: bool = True, zus: str = "") -> str:
    return (f'<details class="abschnitt" id="{e(id_)}"{" open" if offen else ""}><summary><h2>{titel}</h2>'
            f'{f"<span class=zus>{zus}</span>" if zus else ""}</summary><div class="inhalt">{inhalt}</div></details>')


def chips(feld: str, eintraege: list[tuple[str, str]], ids: list[str] | None = None) -> str:
    out = '<div class="chips">'
    for i, (w, t) in enumerate(eintraege):
        idattr = f' id="{ids[i]}"' if ids and ids[i] else ""
        out += f'<button type="button" data-feld="{feld}" data-wert="{e(w)}"{idattr}>{e(t)}</button>'
    return out + "</div>"


def raster_karte(text: str) -> str:
    return f"""<div class="karte">
  <div class="wahl-kopf">
    <div class="auswahl" id="auswahl" aria-live="polite"></div>
    <div class="schnell" id="schnell"><b>Schnellwahl</b>
      <button type="button" data-sel="b27,b26,r25">Budget 2027 und 2026, Rechnung 2025</button>
      <button type="button" data-sel="r25,r24,r23">Rechnung 2025, 2024, 2023</button>
      <button type="button" data-sel="b25,r25">Budget und Rechnung 2025</button>
      <button type="button" data-sel="r25,r21">Rechnung 2025 und 2021</button>
      <button type="button" data-sel="b27,p28,p30">Budget 2027, Finanzplan 2028 und 2030</button>
    </div>
  </div>
  <div class="raster"><table id="raster"></table></div>
  <p class="raster-legende">{text}</p>
  <div class="hinweis" id="planhinweis" hidden></div>
</div>"""


def seite_html(key: str, titel: str, beschreibung: str, inhalt: str, D: dict, version: str,
               unterpunkte: list[tuple[str, str]] | None = None, grafik: bool = False) -> str:
    eintrag = next(s for s in SEITEN if s[0] == key)
    basis = "" if key == "start" else "../"
    stand = ".".join(reversed(D["stand"].split("-")))
    voll = "Finanzspiegel Schaffhausen" + ("" if key == "start" else f": {titel}")
    adresse = ADRESSE + eintrag[1]
    return f"""<!DOCTYPE html>
<html lang="de-CH">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(voll)}</title>
<meta name="description" content="{e(beschreibung)}">
<link rel="canonical" href="{e(adresse)}">
<meta property="og:title" content="{e(voll)}">
<meta property="og:description" content="{e(beschreibung)}">
<meta property="og:url" content="{e(adresse)}">
<meta property="og:type" content="website">
<link rel="icon" href="{basis}favicon.svg" type="image/svg+xml">
<link rel="icon" href="{basis}favicon.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="{basis}apple-touch-icon.png">
<meta name="theme-color" content="#0B0F14">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=Public+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{basis}assets/finanzspiegel.css?v={version}">
</head>
<body data-seite="{key}" data-basis="{basis}" data-daten="{eintrag[4]}" data-version="{version}">
<a class="skip" href="#inhalt">Zum Inhalt</a>
{testphase_html("unten-links")}
<header class="leiste">
  <button type="button" class="menuknopf" id="menuKnopf" aria-controls="seitenleiste" aria-expanded="false">{MENU}<span>Seiten</span></button>
  <a class="marke-link" href="{basis or './'}"><b>Finanzspiegel</b><span>Kanton Schaffhausen</span></a>
  <div class="suche" role="search"><label class="nur-sr" for="sucheGlobal">Suche im Finanzspiegel</label>{LUPE}
    <input id="sucheGlobal" type="search" autocomplete="off" spellcheck="false" placeholder="Suchen: Dienststelle, Konto, Begriff, Stichwort" aria-controls="sucheGlobalListe" aria-autocomplete="list">
    <ul id="sucheGlobalListe" class="global" role="listbox" hidden></ul>
  </div>
</header>
<div class="schleier" id="schleier"></div>
<div class="rahmen">
<nav class="seitenleiste" id="seitenleiste" aria-label="Seiten des Finanzspiegels">
  <a class="zurueck" href="{e(POLITSPIEGEL)}">&larr; Politspiegel Schaffhausen</a>
  {seitenliste(key, basis, unterpunkte or [])}
  <div class="leiste-fuss">Stand der Daten <span id="standLeiste">{stand}</span><br>Rechnung 2021–2025, Budget 2021–2027, Finanzplan bis 2030<br>{melden_knopf_html("melden-inline")}</div>
</nav>
<main class="haupt" id="inhalt">
<p class="hinweis" id="ladefehler" hidden></p>
{inhalt}
<footer class="fuss">
<p><b>Stand</b> {stand}. Aufbereitung der publizierten Zahlen ohne Gewähr; massgebend sind die Dokumente des Kantons. Teil des <a href="{e(POLITSPIEGEL)}">Politspiegels Schaffhausen</a>.</p>
{kanal_html("Politspiegel folgen: der WhatsApp-Kanal meldet jede neue Auswertung", "fuss-kanal")}
{impressum_html()}
</footer>
</main>
</div>
<div class="tip" id="tip" role="tooltip"></div>
<div class="pop" id="pop"></div>
{GRAFIK_DIALOG if grafik else ""}
{melden_html("Finanzspiegel: " + titel, schwebend=False)}
<script src="{basis}assets/finanzspiegel.js?v={version}"></script>
</body>
</html>
"""


def kopf(marke: str, h1: str, lead: str) -> str:
    return f'<div class="seitentitel"><div class="marke">{marke}</div><h1>{h1}</h1><p class="lead">{lead}</p></div>'


LADEN = '<p class="leise" data-laden>Daten werden geladen …</p>'


# ─────────────────────────────────────────────────────────────── Seiten

def seite_start(D, version):
    b27 = next(j for j in D["jahre"] if j["k"] == "b27")
    inhalt = kopf("Kanton Schaffhausen · Finanzspiegel", "Wohin das Geld des Kantons fliesst",
                  "Staatsrechnungen 2021 bis 2025, Budgets 2021 bis 2027 und Finanzplan bis 2030: vom Gesamtbild bis zum einzelnen Konto und Investitionsvorhaben. "
                  "Oben suchen oder hier Schritt für Schritt zur passenden Ansicht.")
    inhalt += f'<p class="stand">Budget 2027 und Finanzplan: {e(b27["fassung"])}; massgebend wird die Fassung, die der Kantonsrat beschliesst.</p>'
    inhalt += abschnitt("einstieg-teil", "Geführter Einstieg", f'<div class="einstieg" id="einstieg">{LADEN}</div>', True, "fünf Fragen, jede Antwort änderbar")
    legende = ('<div class="legende-zeile"><span><svg viewBox="0 0 26 12"><rect x="7" y="1" width="12" height="10" rx="2" fill="var(--linie-r)"/></svg>Rechnung</span>'
               '<span><svg viewBox="0 0 26 12"><rect x="7" y="1" width="12" height="10" rx="2" fill="var(--karte)" stroke="var(--linie-b)" stroke-width="1.6"/></svg>Budget</span>'
               '<span><svg viewBox="0 0 26 12"><rect x="7" y="1" width="12" height="10" rx="2" fill="var(--karte)" stroke="var(--linie-b)" stroke-width="1.6" stroke-dasharray="2 2.5"/></svg>Finanzplan</span></div>')
    inhalt += abschnitt("zahlen", "Auf einen Blick",
                        f'<div class="kurzzahlen" id="kurzzahlen"></div><div class="karte" style="margin-top:12px"><h3 style="margin:0 0 6px">Gesamtergebnis 2021 bis 2030, Millionen Franken</h3>'
                        f'<p class="unter klein" style="margin:0 0 8px">Plus: Ertragsüberschuss, minus: Aufwandüberschuss. Budget ohne Nachtragskredite.</p><div id="startBalken"></div>{legende}</div>')
    karten = "".join(f'<a class="seitenkarte" href="{p or "./"}"><b>{e(t)}</b><span>{e(u)}</span></a>' for k, p, t, u, _ in SEITEN if k != "start")
    inhalt += abschnitt("seiten", "Seiten", f'<div class="seitenkarten">{karten}</div>')
    return seite_html("start", "Start", "Finanzspiegel Schaffhausen: Budget, Staatsrechnung und Finanzplan des Kantons 2021 bis 2030, bis zum einzelnen Konto. Mit Suche und geführtem Einstieg.",
                      inhalt, D, version, [("einstieg-teil", "Geführter Einstieg"), ("zahlen", "Auf einen Blick"), ("seiten", "Seiten")])


def seite_ueberblick(D, version):
    inhalt = kopf("Woher und wohin", "Woher das Geld kommt, wohin es geht",
                  "Ordentlicher Ertrag und Aufwand eines Jahres nach Sachgruppen, auf derselben Skala, mit der Rechnung vom operativen Ergebnis zum Gesamtergebnis.")
    inhalt += abschnitt("jahre", "Jahr wählen", raster_karte("Gezeigt wird A; B dient dem Vergleich in den Kacheln. Zahl im Feld: Gesamtergebnis in Millionen Franken. Klick wählt ein Jahr oder nimmt es heraus."),
                        False, '<span class="wahlzus" id="wahlZus"></span>')
    inhalt += abschnitt("woher", 'Woher, wohin <small id="wwTitel"></small>',
                        f'{LADEN}<div class="kacheln" id="kacheln"></div><div class="karte ww"><div class="werkzeug" style="justify-content:flex-end"><button type="button" class="knopf" data-grafik="ueberblick">Als Grafik</button></div>'
                        '<div id="ww"></div><div class="legenden" id="legenden"></div><p class="ergebnis" id="ergebnis"></p></div>'
                        '<p class="unter klein">Klick auf eine Sachgruppe öffnet sie im Vergleich, bis zum einzelnen Konto.</p>')
    return seite_html("ueberblick", "Woher und wohin", "Woher das Geld des Kantons Schaffhausen kommt und wohin es geht: Ertrag und Aufwand nach Sachgruppen, Rechnung und Budget 2021 bis 2027.",
                      inhalt, D, version, [("jahre", "Jahr wählen"), ("woher", "Woher, wohin")], grafik=True)


def seite_entwicklung(D, version):
    fp_teil = "Teil der Vorlage zum Budget 2027" if next(j for j in D["jahre"] if j["k"] == "b27").get("vorlage") else "Teil des Budgets 2027"
    legende = """<div class="legende-zeile">
    <span><svg viewBox="0 0 26 12"><line x1="0" x2="26" y1="6" y2="6" stroke="var(--linie-r)" stroke-width="2"/><circle cx="13" cy="6" r="3.5" fill="var(--linie-r)"/></svg>Rechnung</span>
    <span><svg viewBox="0 0 26 12"><line x1="0" x2="26" y1="6" y2="6" stroke="var(--linie-b)" stroke-width="2" stroke-dasharray="5 4"/><circle cx="13" cy="6" r="3.5" fill="var(--karte)" stroke="var(--linie-b)" stroke-width="2"/></svg>Budget</span>
    <span><svg viewBox="0 0 26 12"><line x1="0" x2="26" y1="6" y2="6" stroke="var(--linie-b)" stroke-width="2" stroke-dasharray="1.5 3.5" stroke-linecap="round"/><path d="M13,1.5l4.5,4.5l-4.5,4.5l-4.5,-4.5z" fill="var(--karte)" stroke="var(--linie-b)" stroke-width="1.8"/></svg>Finanzplan</span>
    <span><svg viewBox="0 0 26 12"><circle cx="13" cy="6" r="4.5" fill="none" stroke="var(--s1)" stroke-width="2.5"/></svg>gewählte Jahre A, B, C</span>
  </div>"""
    inhalt = kopf("Entwicklung", "Entwicklung 2021 bis 2030",
                  f"Rechnung 2021 bis 2025, Budget 2021 bis 2027, Finanzplan 2028 bis 2030. Der Finanzplan ist {fp_teil} und liegt nur zusammengefasst vor: nach Sachgruppen, Aufgabenfeldern und als Bilanz.")
    inhalt += abschnitt("verlauf-teil", "Verlauf", f"""{LADEN}<div class="steuer">
  <div class="grp"><b>Kennzahl</b><div class="chips" id="kzChips"></div></div>
  <div class="grp"><b>oder Bereich</b><select id="kzBereich"><option value="">nicht gewählt</option></select></div>
  <div class="grp" id="eaGrp" hidden><b>Ansicht</b><div class="chips" id="eaChips"><button type="button" data-wert="A">Aufwand</button><button type="button" data-wert="E">Ertrag</button><button type="button" data-wert="N">Netto</button></div></div>
</div>
<div class="karte">
  <div class="werkzeug"><h3 id="verlaufTitel" style="margin:0"></h3><button type="button" class="knopf" data-grafik="entwicklung">Als Grafik</button></div>
  <div class="verlauf" id="verlauf"></div>
  {legende}
</div>
<details class="unter" id="tabelle"><summary>Werte als Tabelle <small>Rechnung, Budget, Finanzplan je Jahr</small></summary><div class="inner" style="overflow-x:auto"><table class="tab" id="verlaufTab"></table></div></details>
<p class="unter klein">Klick in die Grafik wählt das Jahr als A, B oder C für den Vergleich. Eigenkapital und Steuerfuss stehen nur für 2025 bis 2030 in den Dokumenten, die hier gelesen sind.</p>""")
    inhalt += abschnitt("departemente-teil", "Departemente und Dienststellen",
                        '<p class="unter klein">Aufwand minus Ertrag über alle Konten, wie Ziffer 4.4.2 des Berichts zum Budget; negativ: Ertragsüberschuss (Finanzdepartement mit den Steuern). Millionen Franken. '
                        '+ öffnet die Dienststellen eines Departements; Klick auf eine Zeile zeigt sie im Verlauf oben.</p>'
                        '<div class="karte" style="overflow-x:auto"><table class="tab" id="departemente"></table></div>')
    inhalt += abschnitt("felder-teil", "Finanzplan je Aufgabenfeld",
                        '<p class="unter klein">Nettoaufwand je Aufgabenfeld, Budget 2027 und Finanzplan 2028 bis 2030 (Kapitel 7 des Berichts), Millionen Franken. «Finanzen und Steuern» ist ein Nettoertrag.</p>'
                        '<div class="karte" style="overflow-x:auto"><table class="tab" id="felder"></table></div>')
    return seite_html("entwicklung", "Entwicklung 2021–2030", "Finanzen des Kantons Schaffhausen 2021 bis 2030: Gesamtergebnis, Steuern, Aufwand und Investitionen im Verlauf, je Departement, Dienststelle und Aufgabenfeld.",
                      inhalt, D, version, [("verlauf-teil", "Verlauf"), ("departemente-teil", "Departemente"), ("felder-teil", "Aufgabenfelder")], grafik=True)


def seite_vergleich(D, version):
    inhalt = kopf("Vergleich", "Vergleich bis zum Konto",
                  "Bis zu drei Jahre nebeneinander: Erfolgs- oder Investitionsrechnung, nach Dienststelle oder Sachgruppe, als Aufteilung, als Tabelle der Ebene oder als Baum, in dem sich jede Stufe aufklappen lässt.")
    inhalt += abschnitt("jahre", "Jahre wählen", raster_karte("Bis zu drei Jahre; A ist der Bezug für alle Differenzen. Zahl im Feld: Gesamtergebnis in Millionen Franken. Klick wählt ein Jahr oder nimmt es heraus."),
                        False, '<span class="wahlzus" id="wahlZus"></span>')
    inhalt += abschnitt("kennzahlen", "Kennzahlen", '<div class="karte" style="overflow-x:auto"><table class="tab kz-tab" id="kz"></table></div>', False, '<span id="kzZus"></span>')
    inhalt += abschnitt("aufteilung", "Aufteilung", f"""{LADEN}<div class="steuer" id="drillSteuer">
  <div class="grp"><b>Rechnung</b>{chips("rechnung", [("er", "Erfolgsrechnung"), ("ir", "Investitionsrechnung")])}</div>
  <div class="grp"><b>Gliederung</b>{chips("gl", [("inst", "Dienststelle"), ("art", "Sachgruppe")])}</div>
  <div class="grp"><b>Ansicht</b>{chips("ansicht", [("A", "Aufwand"), ("E", "Ertrag"), ("N", "Netto")], ["ansA", "ansE", "ansN"])}</div>
  <div class="grp"><b>Konten</b>{chips("umfang", [("ord", "ordentliche"), ("alle", "alle")])}</div>
</div>
<div class="werkzeug"><nav class="krume" id="krume" aria-label="Ebenen" style="margin:0"></nav>
  <div class="knoepfe"><button type="button" class="knopf" data-grafik="kuchen">Als Grafik</button><button type="button" class="knopf" data-grafik="ringe">Ringe</button><button type="button" class="knopf" id="csvKnopf">Tabelle als CSV</button></div>
</div>
<p class="unter klein">Je Jahr ein Band auf derselben Skala; die Breite entspricht dem Betrag. Obere Reihe: Einträge der geöffneten Ebene, untere: deren Unterteilung. Klick geht eine Stufe tiefer.</p>
<div class="karte"><div class="icicles" id="icicles"></div></div>""", True, '<span id="aufteilungZus"></span>')
    inhalt += abschnitt("tabelle-teil", "Tabelle", f"""<div class="tab-umschalter"><div class="grp"><b>Darstellung</b><div class="chips" id="tabArt"><button type="button" data-wert="ebene">Ebene</button><button type="button" data-wert="baum">Baum</button></div></div>
<p class="leise klein" style="margin:0;max-width:60ch">Ebene: die geöffnete Stufe mit Differenzen, Klick geht tiefer. Baum: alle Stufen, jede aufklappbar, Kommentare der Dienststellen unter der Zeile.</p></div>
<p class="unter klein" id="tabelleBreit" hidden>Die Tabelle ist breiter als das Fenster: seitlich scrollen oder das Fenster vergrössern.</p>
<div class="karte" id="tabelle" style="overflow-x:auto"></div>""")
    return seite_html("vergleich", "Vergleich bis zum Konto", "Budget und Staatsrechnung des Kantons Schaffhausen im Vergleich: bis zu drei Jahre, nach Dienststelle oder Sachgruppe, bis zum einzelnen Konto und Investitionsvorhaben, mit den Kommentaren der Dienststellen.",
                      inhalt, D, version, [("jahre", "Jahre wählen"), ("kennzahlen", "Kennzahlen"), ("aufteilung", "Aufteilung"), ("tabelle-teil", "Tabelle")], grafik=True)


def seite_pruefhinweise(D, version):
    S = D.get("regeln", {})
    n_bf = len(D.get("befunde", []))
    rj = [j["j"] for j in D["jahre"] if j["a"] == "r"]
    inhalt = kopf("Prüfhinweise", f"{n_bf} Stellen mit grossen Veränderungen",
                  "Stellen, an denen Beträge sich gegenüber dem Vorjahr stark verändern, vom Budget abweichen oder zwischen Dokumenten nicht übereinstimmen. "
                  "Jeder Hinweis nennt die Zahlen und die Kommentare der Dienststellen im Wortlaut und führt in den Vergleich. Feststellungen, keine Bewertung.")
    inhalt += abschnitt("liste", "Hinweise", f"""{LADEN}<div class="bf-filter"><div class="grp"><b>Art des Hinweises</b><div class="bf-typen" id="bfTypen"></div></div></div>
<div class="bf-filter">
  <div class="grp"><b>Jahr</b><select id="bfDs"><option value="alle">alle</option></select></div>
  <div class="grp"><b>Departement</b><select id="bfDep"><option value="">alle</option></select></div>
  <div class="grp"><b>Betrag</b><select id="bfMin"><option value="0">alle</option><option value="2">ab 1 Mio. Franken</option><option value="1">ab 5 Mio. Franken</option></select></div>
  <div class="grp"><b>Wort oder Konto</b><input id="bfSuche" type="search" placeholder="zum Beispiel Personal" style="height:34px;padding:4px 10px;border:1px solid var(--linie-2);border-radius:8px;background:var(--karte);color:var(--text);font:inherit;font-size:14px"></div>
  <label class="klein" style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><input type="checkbox" id="bfNur"> nur zu den gewählten Jahren</label>
</div>
<p class="leise klein" id="bfZahl"></p>
<ul class="bf-liste" id="bfListe"></ul>
<div class="mehr" id="bfMehr"></div>""")
    regeln = f"""<ol>
  <li>Budget zu Vorjahresbudget: Nettoaufwand einer Dienststelle (alle Konten) im Budget 2027 um mindestens {chf(S.get("bb_chf", 0))} Franken und {int(S.get("bb_pct", 0) * 100)} % anders als im Budget 2026.</li>
  <li>Budget zu letzter Rechnung: dasselbe gegenüber der Rechnung 2025, ab {chf(S.get("br_chf", 0))} Franken und {int(S.get("br_pct", 0) * 100)} %.</li>
  <li>Rechnung zu Budget: Nettoaufwand einer Dienststelle in der Rechnung {rj[0]} bis {rj[-1]} um mindestens {chf(S.get("rb_chf", 0))} Franken und {int(S.get("rb_pct", 0) * 100)} % anders als im Budget desselben Jahres.</li>
  <li>Strukturänderung: Dienststelle mit Beträgen ab {chf(S.get("neu_chf", 0))} Franken in einem der Budgets 2026 und 2027 und keinen im anderen.</li>
  <li>Investition Rechnung zu Budget: Nettoinvestition eines Vorhabens in der Rechnung {rj[0]} bis {rj[-1]} um mindestens {chf(S.get("ir_rb_chf", 0))} Franken und {int(S.get("ir_rb_pct", 0) * 100)} % anders als im Budget desselben Jahres. Investition Budget zu Vorjahresbudget: Veränderung ab {chf(S.get("ir_bb_chf", 0))} Franken vom Budget 2026 zum Budget 2027.</li>
  <li>Dokumentenabgleich: Vergleichsspalten im Dokument Budget 2027 gegen die Datensätze aus den früheren Dokumenten; Detailzahlen gegen die Übersichten des Berichts.</li>
  <li>Je Hinweis die {S.get("konten", 3)} Konten mit der grössten Veränderung und ihre Kommentare. Betrag in der Liste: Veränderung in Millionen Franken, Grundlage der Sortierung.</li>
</ol>"""
    inhalt += abschnitt("regeln", "Regeln", regeln, False)
    return seite_html("pruefhinweise", "Prüfhinweise", "Prüfhinweise zu Budget und Staatsrechnung des Kantons Schaffhausen: grosse Veränderungen je Dienststelle und Investitionsvorhaben, mit den Kommentaren der Dienststellen.",
                      inhalt, D, version, [("liste", "Hinweise"), ("regeln", "Regeln")])


def seite_begriffe(D, version, begriffe):
    gruppen = begriffe["gruppen"]
    nach = defaultdict(list)
    for b in begriffe["begriffe"]:
        nach[b["g"]].append(b)
    slug = lambda g: "g-" + "".join(c if c.isalnum() else "-" for c in g.lower()).strip("-")
    abc = '<nav class="abc" aria-label="Gruppen">' + "".join(f'<a href="#{slug(g)}">{e(g)}</a>' for g in gruppen if nach[g]) + "</nav>"
    inhalt = kopf("Begriffe", "Begriffe",
                  f"{len(begriffe['begriffe'])} Begriffe aus Budget und Staatsrechnung, kurz erklärt, je mit Quelle. Die Suche oben findet sie auch unter Alltagswörtern.")
    inhalt += abc
    for g in gruppen:
        if not nach[g]:
            continue
        eintraege = ""
        for b in nach[g]:
            ziel = f'<a href="../{e(b["ziel"])}">Im Finanzspiegel ansehen &rarr;</a>' if b.get("ziel") else ""
            eintraege += (f'<div class="eintrag" id="{e(b["id"])}"><dt>{e(b["t"])}</dt><dd><p>{e(b["d"])}</p>'
                          f'<p class="q">Quelle: {e(b["q"])}</p>{ziel}</dd></div>')
        inhalt += abschnitt(slug(g), e(g), f'<dl class="begriffe">{eintraege}</dl>', True, f"{len(nach[g])}")
    return seite_html("begriffe", "Begriffe", "Begriffe aus Budget und Staatsrechnung des Kantons Schaffhausen, kurz erklärt: von Aufwand bis Verpflichtungskredit, mit Quellen.",
                      inhalt, D, version, [(slug(g), g) for g in gruppen if nach[g]])


def seite_methode(D, version):
    pr = D.get("pruefung", {})
    K = D["kz"]
    kontrolle = D.get("kontrollen", {})
    q = {x.get("k"): x for x in D["quellen"] if x.get("k")}
    b27 = next(j for j in D["jahre"] if j["k"] == "b27")
    pub = (q.get("budget2027") or {}).get("publiziert", "")
    pub27 = f", publiziert am {datum(pub)}" if pub else ""
    vorlage27 = (" Bis der Kantonsrat das Budget beschlossen hat, ist dies die Vorlage; die beschlossene Fassung ersetzt sie."
                 if b27.get("vorlage") else "")
    er_summen = sum(v.get("er", {}).get("summen", 0) for k, v in pr.items() if k != "finanzplan")
    er_abw = sum(v.get("er", {}).get("abweichend", 0) for k, v in pr.items() if k != "finanzplan")
    ir_summen = sum(v.get("ir", {}).get("summen", 0) for k, v in pr.items() if k != "finanzplan")
    ir_abw = sum(v.get("ir", {}).get("abweichend", 0) for k, v in pr.items() if k != "finanzplan")
    eck, vj, zf = kontrolle.get("eckwerte", {}), kontrolle.get("vorjahr", {}), kontrolle.get("ziffer", {})
    daten = f"""<ol>
  <li>Staatsrechnungen 2021 bis 2025 mit Detailzahlen: Erfolgsrechnung je Konto mit den Kommentaren der Organisationseinheiten, Investitionsrechnung je Konto und Vorhaben. Die Staatsrechnung 2021 in der Fassung nach den Anpassungen des Kantonsrates (publiziert am 18. August 2022).</li>
  <li>Budget 2021 bis 2025: Spalte «Budget» der Staatsrechnung desselben Jahres, also das beschlossene Budget ohne Nachtragskredite (Fussnote der Detailzahlen). Kommentare zum Budget gibt es für diese Jahre deshalb nicht; die Kommentare der Staatsrechnung begründen die Abweichung zum Budget.</li>
  <li>Budget 2026 in der vom Kantonsrat am 17. November 2025 beschlossenen Fassung.</li>
  <li>Budget 2027 inklusive Detailzahlen und Finanzplan 2027–2030, {e(b27["fassung"])}{pub27}.{vorlage27}</li>
  <li>Der Finanzplan 2028–2030 liegt nur zusammengefasst vor: Sachgruppen (Ziffer 2.1), Nettoinvestitionen (2.2), Bilanz (2.3) und Aufgabenfelder (Kapitel 7).</li>
  <li>Eigenkapital und Steuerfuss sind aus dem Bericht zum Budget 2027 gelesen und deshalb nur für 2025 bis 2030 vorhanden.</li>
</ol>"""
    kontrollen = f"""<ol>
  <li>Beim Lesen: Je Dokument und Spalte ist die Summe der Konten gleich der gedruckten Summe je Dienststelle, Fonds und Departement, in der Investitionsrechnung zusätzlich je Konto und Vorhaben. Erfolgsrechnung {chf(er_summen)} Summen, {er_abw} Abweichungen; Investitionsrechnung {chf(ir_summen)} Summen, {ir_abw} Abweichungen.</li>
  <li>Rechnung 2025, Budget 2026 und Budget 2027: Summen je Sachgruppe und je Departement gegen die Ziffern 2.1 und 4.4.2 des Berichts zum Budget 2027, {zf.get("abweichend", 0)} Abweichungen.</li>
  <li>Rechnung und Budget 2021 bis 2024: Ertrag, Aufwand, operatives und ausserordentliches Ergebnis, Gesamtergebnis und Nettoinvestitionen gegen die Tabelle «Eckwerte» der jeweiligen Staatsrechnung, {eck.get("werte", 0)} Werte, {eck.get("abweichend", 0)} Abweichungen.</li>
  <li>Die Spalte «Rechnung Vorjahr» jeder Staatsrechnung 2022 bis 2025 stimmt je Konto mit der Staatsrechnung des Vorjahres überein: {chf(vj.get("konten", 0))} Konten, {vj.get("abweichend", 0)} Abweichungen.</li>
  <li>Die Übersichtstabellen des Finanzplans sind nachgerechnet: {pr.get("finanzplan", {}).get("abweichend", 0)} Abweichungen.</li>
  <li>Wo Dokumente voneinander abweichen, gilt die spätere Publikation; die Abweichungen stehen unter den Prüfhinweisen (Dokumentenabgleich). Die Nettoinvestitionen des Budgets 2027 sind aus den Detailzahlen gerechnet ({mio(K["b27"]["netInv"])} Mio. Franken); die Übersicht des Berichts nennt 110.1 Mio.</li>
</ol>"""
    lesehilfe = """<ol>
  <li>Konten «ordentliche»: Sachgruppen 30 bis 37 und 40 bis 47. Ihre Totale sind der ordentliche Aufwand und Ertrag des Berichts. «Alle» nimmt Ausserordentliches (38, 48, vor allem finanzpolitische Reserven), interne Verrechnungen (39, 49) und den Abschluss der Fonds im Eigenkapital (90) dazu; so summieren die Detailzahlen die Dienststellen.</li>
  <li>Netto: Aufwand minus Ertrag, in der Investitionsrechnung Ausgaben minus Einnahmen. Negativ heisst Ertragsüberschuss.</li>
  <li>Gliederung nach Dienststelle: Departement, Dienststelle, Fonds, Konto; kreditrechtlich verbindlich. Nach Sachgruppe: Artengliederung HRM2, zwei- und dreistellig, dann das Konto über alle Dienststellen.</li>
  <li>Dienststellen sind über ihre Nummer verknüpft. Wurde eine Dienststelle umbenannt, steht die jüngste Bezeichnung; wurde sie aufgehoben oder neu geschaffen, fehlen ihr Beträge in den übrigen Jahren. Die Zahlen sind nicht zurückgerechnet.</li>
  <li>Investitionsrechnung: Vorhaben sind Verpflichtungskredite (VK) oder Budgetkredite. Die Budgets gliedern Konto vor Vorhaben, die Staatsrechnungen Vorhaben vor Konto, die Staatsrechnungen 2021 und 2022 nur netto je Konto; hier einheitlich Dienststelle, Vorhaben, Konto.</li>
  <li>Aufteilung (Icicle): Flächen können nicht negativ sein. Einträge mit negativem Betrag, etwa Rückerstattungen, stehen nur in der Tabelle.</li>
  <li>Baum: jede Stufe lässt sich aufklappen, mehrere Äste gleichzeitig. Einträge einer Stufe nach Betrag geordnet, ab 60 Einträgen in Schritten.</li>
  <li>Kommentar: Begründung der Dienststelle im Dokument, im Wortlaut. Im Budget bezieht er sich auf das Vorjahresbudget, in der Staatsrechnung auf das Budget desselben Jahres.</li>
  <li>Suche: findet Departemente, Dienststellen, Fonds, Sachgruppen, Konten, Investitionsvorhaben, Aufgabenfelder, Kennzahlen, Begriffe und die Kommentare der Dienststellen, ab drei Buchstaben. Eine Liste von Alltagswörtern ergänzt die Bezeichnungen der Dokumente (zum Beispiel «Lehrer» für «Lehrpersonen»).</li>
  <li>Geführter Einstieg: fünf Fragen (Ziel, Jahr, Bereich, Aufwand oder Ertrag, Stichwort) und eine Kontrollfrage. Jede Stufe zeigt alle Möglichkeiten vollständig, Departemente und Dienststellen nach ihrer Nummer.</li>
  <li>Grafik (Knopf unten rechts und «Als Grafik»): PNG für Social Media (4:5), Präsentationen (16:9) oder Berichte (3:2), mit Quelle und Datenstand.</li>
</ol>"""
    zeilen = ""
    for x in sorted(D["quellen"], key=lambda x: (x.get("publiziert") or "0"), reverse=True):
        k = x.get("k")
        p = pr.get(k, {}) if k else {}
        er, ir = p.get("er", {}), p.get("ir", {})
        pruef = "" if not k else ("keine Abweichung" if not er.get("abweichend") and not ir.get("abweichend")
                                  else f"{er.get('abweichend', 0) + ir.get('abweichend', 0)} Abweichungen")
        url = x.get("url") or (f"https://sh.ch/CMS/get/file/{x['uuid']}" if x.get("uuid") else "")
        titel = f'<a href="{e(url)}" rel="noopener">{e(x["titel"])}</a>' if url else e(x["titel"])
        verwendet = x.get("verwendet") or x.get("bemerkung") or ""
        zahl = f'{chf(er.get("konten", 0))} / {chf(ir.get("zeilen", 0))}' if k else ""
        zeilen += (f'<tr><td>{titel}<br><span class="leise klein">{e(x["datei"])}{", " + datum(x["publiziert"]) if x.get("publiziert") else ""}</span></td>'
                   f'<td class="h-m">{e(x.get("fassung", ""))}</td><td class="h-s">{e(verwendet)}</td>'
                   f'<td class="r">{zahl}</td><td class="r h-s">{pruef}</td></tr>')
    quellen = (f'<p class="unter">Alle Dokumente stehen auf sh.ch, Finanzverwaltung, Seiten «Budget» und «Staatsrechnung HRM2 (ab 2018)». '
               f'Der Kanton publiziert sie nur als PDF; data.sh.ch und opendata.swiss führen keine Finanzdaten.</p>'
               f'<div style="overflow-x:auto"><table class="tab quellen"><thead><tr><th>Dokument</th><th class="h-m">Fassung</th><th class="h-s">Verwendet für</th>'
               f'<th class="r">Konten ER / Zeilen IR</th><th class="r h-s">Selbstprüfung</th></tr></thead><tbody>{zeilen}</tbody></table></div>')
    inhalt = kopf("Methode und Quellen", "Methode und Quellen",
                  "Woher die Zahlen kommen, wie sie gelesen und geprüft sind und wie die Seite sie zeigt.")
    inhalt += abschnitt("daten", "Datengrundlage", daten, False)
    inhalt += abschnitt("kontrollen", "Selbstprüfung und Kontrollen", kontrollen, False,
                        f"{er_abw + ir_abw + eck.get('abweichend', 0) + vj.get('abweichend', 0)} Abweichungen")
    inhalt += abschnitt("lesehilfe", "Lesehilfe", lesehilfe, False)
    inhalt += abschnitt("quellen", "Quellen", quellen, False, f"{len(D['quellen'])} Dokumente")
    inhalt += '<p class="unter klein" style="margin-top:22px">Die Regeln der Prüfhinweise stehen auf der Seite <a href="../pruefhinweise/#regeln">Prüfhinweise</a>.</p>'
    return seite_html("methode", "Methode und Quellen", "Methode und Quellen des Finanzspiegels Schaffhausen: Dokumente des Kantons, Selbstprüfung beim Lesen, Kontrollen gegen die Berichte.",
                      inhalt, D, version, [("daten", "Datengrundlage"), ("kontrollen", "Kontrollen"), ("lesehilfe", "Lesehilfe"), ("quellen", "Quellen")])


# ─────────────────────────────────────────────────────────────── Ablauf

def main() -> None:
    D = json.loads((HIER / "daten" / "finanzspiegel.json").read_text(encoding="utf-8"))
    begriffe = json.loads((HIER / "daten" / "begriffe.json").read_text(encoding="utf-8"))
    synonyme = json.loads((HIER / "daten" / "synonyme.json").read_text(encoding="utf-8"))
    dateien = datendateien(D, begriffe, synonyme)

    css = (WEB / "stil.css").read_text(encoding="utf-8") + IMPRESSUM_CSS + TESTPHASE_CSS + MELDEN_CSS
    js = ("(function(){\n\"use strict\";\n"
          + "\n".join((WEB / f).read_text(encoding="utf-8") for f in ("kern.js", "kern2.js"))
          + "\n" + (HIER / "grafik.js").read_text(encoding="utf-8")
          + "\n" + (WEB / "suche.js").read_text(encoding="utf-8")
          + "\n" + (WEB / "init.js").read_text(encoding="utf-8")
          + "\n})();\n")
    texte = {n: json.dumps(d, ensure_ascii=False, separators=(",", ":")) for n, d in dateien.items()}
    version = hashlib.sha1((css + js + "".join(texte.values())).encode("utf-8")).hexdigest()[:10]

    (SITE / "daten").mkdir(parents=True, exist_ok=True)
    (SITE / "assets").mkdir(parents=True, exist_ok=True)
    for n, t in texte.items():
        (SITE / "daten" / f"{n}.json").write_text(t, encoding="utf-8")
    (SITE / "assets" / "finanzspiegel.css").write_text(css, encoding="utf-8")
    (SITE / "assets" / "finanzspiegel.js").write_text(js, encoding="utf-8")
    # Kennzahlen für den Kasten auf der Übersicht des Politspiegels (politspiegel/bauen.py
    # liest diese Datei von der veröffentlichten Seite, wie beim Vertragsspiegel)
    j = D["jahre"][-1]
    K = D["kz"][j["k"]]
    (SITE / "kennzahlen.json").write_text(json.dumps({
        "stand": D["stand"], "datensatz": j["k"], "titel": j["t"] + (" (Vorlage)" if j.get("vorlage") else ""),
        "aufwand": round(K["auf"]), "gesamt": round(K["gesamt"]),
        "jahre": f"{D['jahre'][0]['j']}–{D['plan'][-1]['j'] if D.get('plan') else j['j']}",
    }, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    for f in (WEB / "zeichen").glob("*"):
        shutil.copy2(f, SITE / f.name)

    seiten = {
        "": seite_start(D, version),
        "ueberblick/": seite_ueberblick(D, version),
        "entwicklung/": seite_entwicklung(D, version),
        "vergleich/": seite_vergleich(D, version),
        "pruefhinweise/": seite_pruefhinweise(D, version),
        "begriffe/": seite_begriffe(D, version, begriffe),
        "methode/": seite_methode(D, version),
    }
    for pfad, inhalt in seiten.items():
        ziel = SITE / pfad / "index.html"
        ziel.parent.mkdir(parents=True, exist_ok=True)
        ziel.write_text(inhalt, encoding="utf-8")
    groessen = ", ".join(f"{n} {len(t.encode('utf-8')) / 1024:.0f} kB" for n, t in texte.items())
    print(f"site/: {len(seiten)} Seiten, Version {version}; Daten: {groessen}; Programm {len(js.encode('utf-8')) / 1024:.0f} kB")
    print(f"  {len(D['z'])} Kontozeilen, {len(D['ir'])} Zeilen Investitionsrechnung, {len(D.get('befunde', []))} Prüfhinweise, "
          f"{len(dateien['index']['e'])} Einträge im Suchverzeichnis")


if __name__ == "__main__":
    main()
