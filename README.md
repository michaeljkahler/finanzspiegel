# Finanzspiegel Schaffhausen

Budget, Staatsrechnung und Finanzplan des Kantons Schaffhausen, 2021 bis 2030, vom
Gesamtbild bis zum einzelnen Konto und Investitionsvorhaben.

Seite: https://michaeljkahler.github.io/finanzspiegel/
Teil des Politspiegels Schaffhausen: https://michaeljkahler.github.io/politspiegel/

Bis zum 24. Oktober 2026 lag der Finanzspiegel im Repository `politspiegel` unter
`/finanzen/`. Die alte Adresse leitet hierher weiter, geteilte Ansichten (`#d=…&p=…`)
eingeschlossen.

## Aufbau

| Ordner | Inhalt |
|---|---|
| `finanzspiegel/` | Lesen der PDF, Zusammenführen, Prüfhinweise, Bau der Seiten; Anleitung in `finanzspiegel/README.md` |
| `finanzspiegel/kantonsrat.py` | Finanzgeschäfte auf den Traktandenlisten und in den Beschlüssen des Kantonsrats (sh.ch) |
| `docs/AUFTRAG_kontrolle.md` | Auftrag der geplanten Läufe: Hauptlauf und Vorschau monatlich, Sonderlauf nach Kantonsratssitzungen mit Finanzgeschäft |
| `finanzspiegel/web/` | Darstellung (`stil.css`) und Programm der Seiten (`kern.js`, `kern2.js`, `suche.js`, `init.js`) |
| `finanzspiegel/rahmen/` | Impressum, Fehler melden, WhatsApp-Kanal, Testphase: Kopie aus dem Politspiegel |
| `scripts/` | `publish.py` (veröffentlichen), `finanzen_social.py` (Bilder und Texte für Social Media), `browser_einrichten.sh` |
| `site/` | Gebaute Seiten, wie sie GitHub Pages ausliefert (`.github/workflows/pages.yml`) |

## Ablauf

```
python3 finanzspiegel/daten.py      # zusammenführen, Kontrollen gegen die Berichte
python3 finanzspiegel/analyse.py    # Prüfhinweise
python3 finanzspiegel/bauen.py      # site/
python3 finanzspiegel/pruefen.py    # Browserprüfung, muss «0 abweichend» melden
python3 scripts/publish.py --apply  # commit und push
```

Die Seiten laden ihre Daten aus `site/daten/*.json`. Lokal ansehen deshalb über einen
Webserver, nicht aus dem Dateisystem: `python3 -m http.server -d site 8000`, dann
http://localhost:8000/.

Zugang für den Push: `data/github_zugang.json` (in `.gitignore`), siehe `scripts/publish.py`.

## Kontrolle

Geplante Läufe nach `docs/AUFTRAG_kontrolle.md`: am 2. jedes Monats die Dokumente des Kantons
und die Traktandenlisten des Kantonsrats, am 16. nur die Traktandenlisten. Ist ein
Finanzgeschäft traktandiert (Budget, Finanzplan, Oktoberbrief, Nachtragskredit,
Staatsrechnung, Steuerfuss), legt der Lauf einen einmaligen Sonderlauf drei Tage nach der
Sitzung an. Dieser meldet die Beschlüsse und führt den Finanzspiegel nach, sobald das
beschlossene Dokument publiziert ist. Die Läufe pushen selbst: vor lokaler Arbeit `git pull`.
