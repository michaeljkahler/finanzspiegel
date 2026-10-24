# Auftrag: Kontrolle des Finanzspiegels

Massgebend für alle geplanten Läufe des Finanzspiegels. Repository `michaeljkahler/finanzspiegel`,
Branch `main`, Seite https://michaeljkahler.github.io/finanzspiegel/. Anleitung zu den Skripten:
`README.md` und `finanzspiegel/README.md`.

Stand: Entscheid Michael vom 24. Oktober 2026. Die Dokumente des Kantons kontrolliert ein
monatlicher Lauf; zusätzlich läuft der Auftrag nach jeder Kantonsratssitzung, an der ein
Finanzgeschäft traktandiert ist.

## Anlässe

| Anlass | Geplanter Auftrag | Teile |
|---|---|---|
| Hauptlauf, am 2. jedes Monats | «Finanzspiegel Kontrolle» | K, A, M |
| Vorschau, am 16. jedes Monats | «Finanzspiegel Kontrolle» | K, M |
| Sonderlauf nach einer Kantonsratssitzung mit Finanzgeschäft | einmalig, «Finanzspiegel nach Kantonsratssitzung TT.MM.JJJJ» | S, A, M |
| Nachkontrolle Budget | einmalig, «Finanzspiegel Nachkontrolle Budget JJJJ (n/3)» | A, M |

Grund für die Vorschau: Der Kantonsrat publiziert die Einladung mit der Traktandenliste
rund 14 Tage vor der Sitzung. Ein Lauf im Monat sieht deshalb nur die Sitzungen der ersten
Monatshälfte. Budgetdebatte (bisher immer am dritten Montag im November) und Staatsrechnung
(Juni) fallen in beide Hälften.

Vorbereitung bei jedem Anlass: Ist das Repository in der Sitzung nicht geklont, mit
Schreibzugriff anbinden (add_repo: owner `michaeljkahler`, repo `finanzspiegel`, access `push`),
klonen, `git pull` auf `main`. `pip install requests pdfplumber --break-system-packages -q`,
falls die Pakete fehlen.

## Teil K: Kantonsrat (Hauptlauf und Vorschau)

1. `python3 finanzspiegel/kantonsrat.py`. Das Skript liest die Sitzungen der letzten 40 Tage
   und alle kommenden Sitzungen, deren Einladung schon publiziert ist, und nennt je Sitzung
   die Finanzgeschäfte: Budget, Finanzplan, Oktoberbrief, Nachtragskredite, Staatsrechnung,
   Steuerfuss. Geschäfte unter «In Kommissionen hängig» zählen nicht.
2. Für jede Zeile `SONDERLAUF name="…" run_once_at=…` prüfen, ob dieser einmalige Auftrag
   schon besteht (list_triggers, Name vergleichen). Fehlt er, anlegen (create_trigger):
   - name und run_once_at genau aus der Zeile,
   - prompt: Vorlage unten, mit dem Sitzungsdatum,
   - initiation `human_schedule`, notifications Push und E-Mail,
     requires_local_device nicht setzen, permission_mode nicht setzen.
3. Vergangene Sitzungen mit Finanzgeschäft, für die kein Sonderlauf bestand (etwa weil die
   Einladung erst nach der Vorschau erschien): Teil S für diese Sitzung hier ausführen.
4. sh.ch nicht erreichbar oder keine Sitzung gefunden: im Wortlaut melden, keine Aufträge
   anlegen.

Vorlage für den Sonderlauf (TT.MM.JJJJ und JJJJ-MM-TT ersetzen):

> Sonderlauf Finanzspiegel Schaffhausen nach der Kantonsratssitzung vom TT.MM.JJJJ
> (JJJJ-MM-TT). Repository michaeljkahler/finanzspiegel, Branch main. Ist das Repository nicht
> geklont: add_repo (owner michaeljkahler, repo finanzspiegel, access push), klonen,
> git pull. Dann docs/AUFTRAG_kontrolle.md lesen und den Anlass «Sonderlauf nach einer
> Kantonsratssitzung mit Finanzgeschäft» für diese Sitzung ausführen. Massgebend ist der
> Auftrag im Repository. Grenzen: Quellen nur sh.ch, nichts aus .gitignore entfernen, keine
> Zugangsdaten erzeugen oder ausgeben, bei Zweifeln nicht pushen, sondern melden.

## Teil S: Sonderlauf nach einer Kantonsratssitzung

1. `python3 finanzspiegel/kantonsrat.py --sitzung JJJJ-MM-TT`. Ausgabe: alle Traktanden
   (Finanzgeschäfte mit «F»), die Absätze des Kantonsratsbeschlusses (KRB) zu
   Finanzgeschäften und alle Dateien der Sitzung.
2. Fehlt der KRB noch, steht das in der Meldung; die Beschlüsse stehen dann in der Meldung
   des nächsten Laufs.
3. Wurde das Budget beraten: Teil A sucht die vom Kantonsrat beschlossene Fassung. Ist sie
   noch nicht auf sh.ch, einen einmaligen Auftrag «Finanzspiegel Nachkontrolle Budget JJJJ (1/3)»
   sieben Tage später anlegen (`python3 finanzspiegel/kantonsrat.py --termin JJJJ-MM-TT` gibt
   run_once_at), Prompt wie die Vorlage oben mit «Nachkontrolle Budget JJJJ (1/3)» statt
   «nach der Kantonsratssitzung». Jede Nachkontrolle ohne Fund legt die nächste an, höchstens
   bis (3/3); danach übernimmt der Hauptlauf.
4. Wurde die Staatsrechnung beraten: Die Zahlen stehen seit der Publikation im April im
   Finanzspiegel; der Sonderlauf meldet den Beschluss und prüft mit Teil A, ob der Kanton
   eine bereinigte Fassung publiziert hat.

## Teil A: Dokumente des Kantons (Hauptlauf, Sonderlauf, Nachkontrolle)

1. Bekannte Dokumente: `finanzspiegel/daten/quellen.json` (Seiten der Finanzverwaltung auf
   sh.ch, verarbeitete PDF mit uuid).
2. Die Seiten «Budget» und «Staatsrechnung HRM2 (ab 2018)» auf sh.ch laden ihre Dateiliste
   per JavaScript nach. Beide im headless Chromium öffnen (Playwright; Setup nach
   `scripts/browser_einrichten.sh`) und alle Links der Form `/CMS/get/file/<uuid>` mit Linktext
   lesen. Neu ist jede uuid, die nicht in `quellen.json` steht.
3. Es zählt nur ein Budget oder eine Staatsrechnung (Medienmitteilungen, Präsentationen,
   Anhänge zählen nicht). Erwartet: beschlossenes Budget 2027 nach der Budgetdebatte vom
   16. November 2026 (Deckblatt «beschlossen vom Kantonsrat am …»), Staatsrechnung 2026 im
   April 2027, Vorlage Budget 2028 Ende August 2027. Nichts Neues: eine Zeile melden, nichts
   committen.
4. Neues PDF nach `finanzspiegel/daten/pdf/` laden (gitignoriert) und auf Seite 1 die Fassung
   prüfen. Beim Budget ist die vom Kantonsrat beschlossene Fassung massgebend; sie ersetzt die
   Vorlage. Dann `python3 finanzspiegel/budget_pdf.py <pdf> finanzspiegel/daten/<budget|rechnung><jahr>.csv`
   und die Selbstprüfung lesen: in allen Spalten «0 abweichend». Steht eine Abweichung, hat der
   Kanton das Seitenlayout geändert: nichts veröffentlichen, Meldung im Wortlaut an Michael.
5. Bei sauberer Prüfung nach `finanzspiegel/README.md`, Abschnitt «Neues Dokument» (beim
   beschlossenen Budget der Unterabschnitt «Beschlossenes Budget 2027»): `daten.py` anpassen,
   `quellen.json` ergänzen, dann `python3 finanzspiegel/daten.py` (alle Kontrollen 0
   Abweichungen), `python3 finanzspiegel/analyse.py`, `python3 finanzspiegel/bauen.py`,
   `python3 finanzspiegel/pruefen.py` (muss «0 abweichend» melden).
6. Committen und auf `main` pushen, Nachricht «Stand JJJJ-MM-TT, <Dokument>». Kein Force-Push;
   schlägt der Push fehl, melden. GitHub Pages veröffentlicht `site/` selbst; der Kasten auf der
   Übersicht des Politspiegels liest `site/kennzahlen.json` beim nächsten Bau des Politspiegels.
7. Social Media: `python3 scripts/finanzen_social.py --jahr <schlüssel>` schreibt Bilder und
   `posts.json` nach `site/social/<serie>/`; zwei Bilder mit dem Read-Tool auf abgeschnittenen
   Text prüfen und mitcommitten. In Metricool nichts anlegen: das Kontingent teilt sich der
   Finanzspiegel mit dem Politspiegel (Sendeplan im Repository politspiegel,
   `docs/KONZEPT_social-media.md` und `scripts/sendeplan.py`). Die Serie nur melden; Michael
   entscheidet über die Termine.

## Teil M: Meldung an Michael

Knapp, als nummerierte Liste:

1. Anlass und Datum des Laufs.
2. Kantonsrat: Sitzungen mit Finanzgeschäft (Datum, Traktandum), angelegte einmalige Aufträge
   mit Zeitpunkt; im Sonderlauf die Beschlüsse laut KRB.
3. Dokumente: neue Dokumente mit Titel und Datum, Ergebnis der Selbstprüfung und der
   Kontrollen, Gesamtergebnis des neuen Datensatzes, Commit, Social-Media-Serie.

Vorschau ohne Finanzgeschäft und ohne neuen Auftrag: eine Zeile.

## Grenzen

1. Quellen nur sh.ch.
2. Nichts aus `.gitignore` entfernen, keine PDF ins Repository.
3. Keine Zugangsdaten erzeugen oder ausgeben.
4. Keine anderen geplanten Aufträge ändern oder löschen als die einmaligen Aufträge dieses
   Dokuments.
5. Texte nach den Regeln des Politspiegels: Hochdeutsch, generisches Maskulinum, kein
   Gedankenstrich mit Leerzeichen als Trenner (stattdessen Komma oder Doppelpunkt), keine
   Wertung.
6. Bei Zweifeln nicht pushen, sondern melden.
