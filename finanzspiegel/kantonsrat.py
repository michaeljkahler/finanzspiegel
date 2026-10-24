#!/usr/bin/env python3
"""Finanzgeschäfte des Kantonsrats Schaffhausen auf sh.ch erkennen.

Liest die Sitzungen des Kantonsrats über den öffentlichen Listen-Endpoint von sh.ch
(gleicher Weg wie scripts/scraper.py im Repository politspiegel), lädt je Sitzung die
Einladung mit der Traktandenliste und, falls schon publiziert, den Kantonsratsbeschluss
(KRB) und meldet die Traktanden, die den Finanzspiegel betreffen: Budget, Finanzplan,
Oktoberbrief (Nachträge zum Budget), Nachtragskredite, Staatsrechnung, Steuerfuss. Geschäftsberichte selbständiger Anstalten (ITSH, Gebäudeversicherung,
Pensionskasse) betreffen die Zahlen des Kantons nicht und zählen nicht.

Die Einladung erscheint rund 14 Tage vor der Sitzung; erst dann steht die Sitzung in
der Liste. Geschäfte unter «In Kommissionen hängig» werden an der Sitzung nicht beraten
und zählen nicht.

Aufrufe:
    python3 finanzspiegel/kantonsrat.py                       # 40 Tage zurück bis alle publizierten kommenden Sitzungen
    python3 finanzspiegel/kantonsrat.py --ab 2025-11-01       # anderer Beginn
    python3 finanzspiegel/kantonsrat.py --sitzung 2026-11-16  # eine Sitzung mit allen Traktanden, KRB und Dateien
    python3 finanzspiegel/kantonsrat.py --json                # maschinenlesbar
    python3 finanzspiegel/kantonsrat.py --termin 2026-11-19   # Zeitpunkt 07:36 Europe/Zurich als RFC3339

Für jede kommende Sitzung mit Finanzgeschäft nennt die Ausgabe in einer Zeile «SONDERLAUF»
Name und Zeitpunkt des einmaligen Laufs nach der Sitzung (Sitzungstag plus 3 Tage, 07:36),
siehe docs/AUFTRAG_kontrolle.md.

Abhängigkeiten: requests, pdfplumber.
"""
import argparse
import datetime as dt
import html
import io
import json
import re
import sys
import time
from zoneinfo import ZoneInfo

import requests

try:
    import pdfplumber
except ImportError:  # pragma: no cover
    sys.exit("pdfplumber fehlt: pip install pdfplumber --break-system-packages")

BASE = "https://sh.ch"
LIST_URL = BASE + "/CMS/lists/list"
CONTENT_URL = BASE + "/CMS/content"
SITZUNGEN_URL = (BASE + "/CMS/Webseite/Kanton-Schaffhausen/Beh-rde/Parlament/Der-Kantonsrat/"
                 "Sitzungen-des-Kantonsrats---2274767-DE.html")
LIST_PARAMS = {
    "sort": "sortable_datetime desc",
    "filter_customposttypeid_int": "403",
    "filter_published_string": "published",
    "filter_approvedpaths_string": "*/1752/8540/1753/1765/1755/1763/1805/40608/*",
    "filter_text": "()",
    "filter_language_string": "DE",
    "status": "",
    "kioskid": "be0e2565-f587-3475-8be2-1ef3b1e18133",
    "mode": "list",
    "append": "true",
    "slider": "false",
    "language": "DE",
    "domainpath": "/1752/8540/1753/",
    "kiosktype": "kioskWidget",
}
# sh.ch liefert je nach User-Agent eine abgespeckte Antwort ohne Dateiangaben
UA = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "de-CH,de;q=0.9",
}
SEITEN_DATEIEN = ("favicon.ico", "apple-touch-icon.png", "vorlage_shch_icon.jpg", "sh_ch_logo_farbe.svg")

# Traktanden, die den Finanzspiegel betreffen. Steuergesetz-Revisionen und Vorstösse zu
# Steuern ändern die Zahlen des Finanzspiegels nicht und zählen darum nicht.
FINANZ = re.compile(
    r"\bBudget|\bVoranschlag|\bFinanzplan|Oktoberbrief|Nachtr[äa]ge? zum Budget|Nachtragskredit"
    r"|Staatsrechnung|Steuerfuss|Kredit[üu]berschreitung", re.I)
# Budget und Rechnung im engeren Sinn: nur sie bringen ein neues Dokument in den Finanzspiegel
KERN = re.compile(r"\bBudget|\bVoranschlag|Staatsrechnung", re.I)

ABSCHNITTE = {
    "verhandlungsbereite geschäfte": "verhandlungsbereit",
    "übrige traktanden": "übrig",
    "in kommissionen hängig": "hängig",
}
ZONE = ZoneInfo("Europe/Zurich")
UHRZEIT = (7, 36)
NACH_SITZUNG_TAGE = 3   # KRB und Abstimmungsergebnisse erscheinen einige Tage nach der Sitzung
MONATE = {m: i + 1 for i, m in enumerate(
    ["januar", "februar", "märz", "april", "mai", "juni", "juli", "august",
     "september", "oktober", "november", "dezember"])}


def _klartext(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]*>", " ", html.unescape(s or ""))).strip()


def _datum(s):
    """DD.MM.YYYY oder «2. November 2026» → date."""
    s = (s or "").strip()
    m = re.match(r"(\d{1,2})\.(\d{1,2})\.(\d{4})", s)
    if m:
        return dt.date(int(m[3]), int(m[2]), int(m[1]))
    m = re.match(r"(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s+(\d{4})", s)
    if m and m[2].lower() in MONATE:
        return dt.date(int(m[3]), MONATE[m[2].lower()], int(m[1]))
    return None


def termin(tag):
    """07:36 Uhr Schweizer Zeit an diesem Tag, als RFC3339 mit Zeitzonenversatz."""
    return dt.datetime(tag.year, tag.month, tag.day, *UHRZEIT, tzinfo=ZONE).isoformat()


def sonderlauf(sitzung):
    return {"name": f"Finanzspiegel nach Kantonsratssitzung {sitzung:%d.%m.%Y}",
            "run_once_at": termin(sitzung + dt.timedelta(days=NACH_SITZUNG_TAGE))}


class SH:
    def __init__(self):
        self.s = requests.Session()
        self.s.headers.update(UA)

    def ids(self, zeilen=30):
        """contentids der jüngsten Sitzungen, neueste zuerst."""
        p = dict(LIST_PARAMS, rows=str(zeilen), start="0")
        r = self.s.get(LIST_URL, params=p, timeout=60, headers={"X-Requested-With": "XMLHttpRequest"})
        r.raise_for_status()
        return list(dict.fromkeys(re.findall(r'contentid="(\d+)"', r.text)))

    def content(self, cid):
        r = self.s.get(CONTENT_URL, params={"contentid": str(cid), "language": "DE"}, timeout=60,
                       headers={"Accept": "application/json, text/javascript, */*; q=0.01",
                                "X-Requested-With": "XMLHttpRequest"})
        r.raise_for_status()
        return r.json()

    def sitzung(self, cid):
        j = self.content(cid)
        titel = _klartext(j.get("data_articleHeadline") or j.get("data_listlabel") or "") or f"Sitzung {cid}"
        datum = _datum(j.get("data_eventDate_start") or "")
        datei_ids = []
        for section in json.loads(j.get("data_widget_data") or "[]"):
            for col in section.get("cols", []):
                for feld in col.get("fields", []):
                    for ct in (feld.get("data", {}) or {}).get("contenttypes", []):
                        if ct.get("key") == "downloads":
                            datei_ids += [str(x) for x in ct.get("contentids", [])]
        dateien, gesehen = [], set()
        for fc in dict.fromkeys(datei_ids):
            try:
                fj = self.content(fc)
            except requests.RequestException:
                continue
            meta = fj.get("data_filemeta") or ""
            if isinstance(meta, str):
                try:
                    meta = json.loads(meta)
                except ValueError:
                    meta = {}
            name = (meta.get("originalname") or fj.get("data_file_name") or "").strip()
            fid = meta.get("fileid") or ""
            if not name or not fid or name.lower() in SEITEN_DATEIEN or fid in gesehen:
                continue
            gesehen.add(fid)
            dateien.append({"name": name, "url": f"{BASE}/CMS/get/file/{fid}"})
        return {"cid": cid, "titel": titel, "datum": datum, "dateien": dateien}

    def pdftext(self, url):
        r = self.s.get(url, timeout=120)
        r.raise_for_status()
        with pdfplumber.open(io.BytesIO(r.content)) as pdf:
            return "\n".join((p.extract_text() or "") for p in pdf.pages)


def art(name):
    n = name.lower()
    if n.startswith("krb"):
        return "krb"
    if "abstimmungsergebnis" in n:
        return "abstimmung"
    if n.startswith("protokoll"):
        return "protokoll"
    if re.match(r"^\d+\.(?:,?\s*(?:und\s+)?\d+\.)*\s*sitzung vom", n):
        return "einladung"
    return "beilage"


def traktanden(text):
    """Nummerierte Traktanden der Einladung mit ihrem Abschnitt."""
    liste, abschnitt, akt = [], "verhandlungsbereit", None
    for zeile in text.splitlines():
        z = zeile.strip()
        if not z or re.fullmatch(r"-\s*\d+\s*-", z):
            continue
        if z.lower() in ABSCHNITTE:
            abschnitt, akt = ABSCHNITTE[z.lower()], None
            continue
        if z.startswith("Die nächste Sitzung"):
            akt = None
            continue
        m = re.match(r"^(\d{1,2})\s+(\S.*)$", z)
        if m and int(m[1]) == (liste[-1]["nr"] + 1 if liste else 1):
            akt = {"nr": int(m[1]), "abschnitt": abschnitt, "text": m[2]}
            liste.append(akt)
        elif akt is not None:
            akt["text"] += " " + z
    for t in liste:
        t["text"] = re.sub(r"(\w)- ([a-zäöüß])", r"\1\2", t["text"])
        t["finanz"] = bool(FINANZ.search(t["text"])) and t["abschnitt"] != "hängig"
        t["kern"] = t["finanz"] and bool(KERN.search(t["text"]))
    return liste


def naechste(text):
    m = re.search(r"nächste Sitzung findet am\s+(?:\w+,\s*)?(\d{1,2}\.\s*\w+\s+\d{4})", text)
    return _datum(m[1]) if m else None


def krb_auszug(text):
    """Absätze des Kantonsratsbeschlusses, die ein Finanzgeschäft nennen."""
    absaetze, akt = [], None
    for zeile in text.splitlines():
        z = zeile.strip()
        if not z:
            continue
        m = re.match(r"^(\d{1,2})\.\s+(\S.*)$", z)
        if m:
            akt = {"nr": int(m[1]), "text": m[2]}
            absaetze.append(akt)
        elif akt is not None:
            akt["text"] += " " + z
    for a in absaetze:
        a["text"] = re.sub(r"(\w)- ([a-zäöüß])", r"\1\2", a["text"])
    return [a for a in absaetze if FINANZ.search(a["text"])]


def lesen(ab, bis=None, einzeln=None):
    sh = SH()
    ergebnis = []
    for cid in sh.ids():
        s = sh.sitzung(cid)
        d = s["datum"]
        if d is None:
            continue
        if einzeln and d != einzeln:
            if d < einzeln:
                break
            continue
        if not einzeln and d < ab:
            break
        if bis and d > bis:
            continue
        s["traktanden"], s["naechste"], s["krb"] = [], None, []
        for f in s["dateien"]:
            f["art"] = art(f["name"])
        ein = [f for f in s["dateien"] if f["art"] == "einladung"]
        if ein:
            t = sh.pdftext(ein[0]["url"])
            s["traktanden"] = traktanden(t)
            s["naechste"] = naechste(t)
        else:
            s["hinweis"] = "keine Einladung gefunden"
        for f in s["dateien"]:
            if f["art"] == "krb":
                s["krb"] += krb_auszug(sh.pdftext(f["url"]))
        s["finanz"] = [t for t in s["traktanden"] if t["finanz"]]
        # Beilagen wie «Budget 2026_Sitzungsablauf Kantonsrat.pdf» oder «Leitfaden Staatsrechnung 2025.pdf»
        s["finanz_dateien"] = [f["name"] for f in s["dateien"] if f["art"] == "beilage" and FINANZ.search(f["name"])]
        s["budget_oder_rechnung"] = (any(t["kern"] for t in s["finanz"])
                                     or any(KERN.search(n) for n in s["finanz_dateien"]))
        ergebnis.append(s)
        time.sleep(0.2)
    return sorted(ergebnis, key=lambda s: s["datum"])


def ausgabe(sitzungen, heute, alles=False):
    if not sitzungen:
        print("Keine Sitzung im Zeitraum. Liste: " + SITZUNGEN_URL)
        return
    for s in sitzungen:
        zeit = "kommend" if s["datum"] >= heute else "vergangen"
        print(f"{s['datum']:%d.%m.%Y} ({zeit}) {s['titel']}: "
              f"{len(s['traktanden'])} Traktanden, davon {len(s['finanz'])} Finanzgeschäfte"
              + (f", Beilagen {', '.join(s['finanz_dateien'])}" if s["finanz_dateien"] else "")
              + (", Budget oder Staatsrechnung" if s["budget_oder_rechnung"] else "")
              + (f"; {s['hinweis']}" if s.get("hinweis") else ""))
        for t in (s["traktanden"] if alles else s["finanz"]):
            mark = "F " if t["finanz"] else "  "
            print(f"   {mark}{t['nr']:>2} [{t['abschnitt']}] {t['text'][:240]}")
        for a in s["krb"]:
            print(f"   KRB {a['nr']}. {a['text'][:400]}")
        if alles:
            for f in s["dateien"]:
                print(f"   Datei [{f['art']}] {f['name']}: {f['url']}")
        if s["naechste"]:
            print(f"   nächste Sitzung laut Einladung: {s['naechste']:%d.%m.%Y}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--ab", help="JJJJ-MM-TT, Voreinstellung heute minus 40 Tage")
    ap.add_argument("--bis", help="JJJJ-MM-TT")
    ap.add_argument("--sitzung", help="JJJJ-MM-TT: nur diese Sitzung, mit allen Traktanden und Dateien")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--termin", help="JJJJ-MM-TT: nur den Zeitpunkt 07:36 Europe/Zurich als RFC3339 ausgeben")
    a = ap.parse_args()
    if a.termin:
        print(termin(dt.date.fromisoformat(a.termin)))
        return
    heute = dt.date.today()
    ab = dt.date.fromisoformat(a.ab) if a.ab else heute - dt.timedelta(days=40)
    bis = dt.date.fromisoformat(a.bis) if a.bis else None
    einzeln = dt.date.fromisoformat(a.sitzung) if a.sitzung else None
    try:
        sitzungen = lesen(ab, bis, einzeln)
    except requests.RequestException as e:
        sys.exit(f"sh.ch nicht erreichbar: {e}")
    for s in sitzungen:
        s["sonderlauf"] = sonderlauf(s["datum"]) if (s["finanz"] or s["finanz_dateien"]) and s["datum"] >= heute else None
    if a.json:
        print(json.dumps(sitzungen, ensure_ascii=False, indent=1, default=str))
        return
    ausgabe(sitzungen, heute, alles=bool(einzeln))
    kommend = [s for s in sitzungen if s["datum"] >= heute]
    letzte = max((s["naechste"] for s in sitzungen if s["naechste"]), default=None)
    if kommend:
        print("Publizierte kommende Sitzungen: " + ", ".join(f"{s['datum']:%d.%m.%Y}" for s in kommend))
    if not einzeln and letzte and letzte >= heute and letzte not in {s["datum"] for s in sitzungen}:
        print(f"Angekündigt, Einladung noch nicht publiziert: {letzte:%d.%m.%Y}")
    for s in sitzungen:
        if s["sonderlauf"]:
            print(f"SONDERLAUF name=\"{s['sonderlauf']['name']}\" run_once_at={s['sonderlauf']['run_once_at']}")


if __name__ == "__main__":
    main()
