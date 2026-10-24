#!/usr/bin/env python3
"""
Veröffentlichen auf GitHub Pages
================================
Committet den Stand und schiebt ihn ins Repository michaeljkahler/finanzspiegel.
Der Arbeitsablauf .github/workflows/pages.yml liefert danach den Ordner site/ aus.

Vorher bauen (aus der Projektwurzel):
    python3 finanzspiegel/daten.py
    python3 finanzspiegel/analyse.py
    python3 finanzspiegel/bauen.py
    python3 finanzspiegel/pruefen.py      # 0 abweichend, sonst nicht veröffentlichen

Zugang
------
data/github_zugang.json, in .gitignore ausgeschlossen:

    {"benutzer": "michaeljkahler", "repo": "finanzspiegel", "token": "github_pat_..."}

Das Token ist ein Personal Access Token mit Schreibrecht auf Inhalte dieses
Repositories (fine-grained, Contents: Read and write). Es steht nie im Repository,
nie in einer Commit-Nachricht und nicht in der Fernadresse: es wird nur dem
Push-Befehl mitgegeben, wie beim Politspiegel.

Ausführen:
    python3 scripts/publish.py            # Probelauf, zeigt was passieren würde
    python3 scripts/publish.py --apply    # committet und pusht
"""
import base64
import json
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
ZUGANG = ROOT / "data" / "github_zugang.json"


def lauf(*args, pruefen=True):
    r = subprocess.run(args, cwd=ROOT, capture_output=True, text=True)
    if pruefen and r.returncode:
        raise SystemExit(f"Fehlgeschlagen: {' '.join(args[:2])}\n{r.stderr.strip()[:400]}")
    return r


def main():
    schreiben = "--apply" in sys.argv
    if not (SITE / "index.html").exists():
        raise SystemExit("site/index.html fehlt. Zuerst finanzspiegel/bauen.py laufen lassen.")
    if not ZUGANG.exists():
        raise SystemExit(f"{ZUGANG} fehlt. Anlegen mit "
                         '{"benutzer": "...", "repo": "finanzspiegel", "token": "..."}.')
    z = json.load(open(ZUGANG, encoding="utf-8"))
    for feld in ("benutzer", "repo", "token"):
        if not z.get(feld):
            raise SystemExit(f"Feld «{feld}» fehlt in {ZUGANG.name}.")
    url = f"https://{z['benutzer']}.github.io/{z['repo']}/"
    stand = json.loads((SITE / "daten" / "kern.json").read_text(encoding="utf-8")).get("stand", "")
    print(f"Adresse: {url}\nDatenstand: {stand}")
    if not schreiben:
        print("(Probelauf, nichts geschrieben. Mit --apply veröffentlichen.)")
        return
    (SITE / ".nojekyll").write_text("", encoding="utf-8")
    if not (ROOT / ".git").exists():
        lauf("git", "init", "-b", "main")
    lauf("git", "config", "user.name", "Finanzspiegel")
    lauf("git", "config", "user.email", f"{z['benutzer']}@users.noreply.github.com")
    fern = f"https://github.com/{z['benutzer']}/{z['repo']}.git"
    if "origin" in lauf("git", "remote").stdout.split():
        lauf("git", "remote", "set-url", "origin", fern)
    else:
        lauf("git", "remote", "add", "origin", fern)
    lauf("git", "add", "-A")
    if not lauf("git", "status", "--porcelain").stdout.strip():
        print("Nichts zu veröffentlichen, der Stand ist bereits oben.")
        return
    nachricht = f"Stand {date.today().isoformat()}, Daten {stand}"
    lauf("git", "commit", "-m", nachricht)
    kennung = base64.b64encode(f"{z['benutzer']}:{z['token']}".encode()).decode()
    r = lauf("git", "-c", f"http.extraheader=AUTHORIZATION: basic {kennung}",
             "push", "-u", "origin", "main", pruefen=False)
    if r.returncode:
        raise SystemExit("Push fehlgeschlagen:\n" + (r.stderr or "").replace(z["token"], "***").strip()[:500])
    print(f"Veröffentlicht: {nachricht}\nSichtbar unter {url} (GitHub Pages braucht ein bis zwei Minuten).")


if __name__ == "__main__":
    main()
