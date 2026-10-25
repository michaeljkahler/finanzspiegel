# Finanzspiegel

Eigenes Repository seit 24. Oktober 2026 (vorher Modul im Politspiegel unter `/finanzen/`).
Budget, Staatsrechnung und Finanzplan des Kantons Schaffhausen 2021 bis 2030, vom Gesamtbild
bis zum einzelnen Konto und Investitionsvorhaben.

```
python3 finanzspiegel/budget_pdf.py finanzspiegel/daten/pdf/rechnung2021_detail.pdf finanzspiegel/daten/rechnung2021.csv
python3 finanzspiegel/budget_pdf.py finanzspiegel/daten/pdf/rechnung2022_detail.pdf finanzspiegel/daten/rechnung2022.csv
python3 finanzspiegel/budget_pdf.py finanzspiegel/daten/pdf/rechnung2023.pdf finanzspiegel/daten/rechnung2023.csv
python3 finanzspiegel/budget_pdf.py finanzspiegel/daten/pdf/rechnung2024.pdf finanzspiegel/daten/rechnung2024.csv
python3 finanzspiegel/budget_pdf.py finanzspiegel/daten/pdf/rechnung2025.pdf finanzspiegel/daten/rechnung2025.csv
python3 finanzspiegel/budget_pdf.py finanzspiegel/daten/pdf/budget2026.pdf finanzspiegel/daten/budget2026.csv
python3 finanzspiegel/budget_pdf.py finanzspiegel/daten/pdf/budget2027_vorlage.pdf finanzspiegel/daten/budget2027.csv
python3 finanzspiegel/finanzplan_pdf.py finanzspiegel/daten/pdf/budget2027_vorlage.pdf finanzspiegel/daten/finanzplan2027.json
python3 finanzspiegel/daten.py      # zusammenführen, Kontrollen    -> daten/finanzspiegel.json
python3 finanzspiegel/analyse.py    # Prüfhinweise                  -> daten/finanzspiegel.json
python3 finanzspiegel/bauen.py      # Seiten und Datendateien       -> site/
python3 finanzspiegel/pruefen.py    # Seiten im Browser prüfen (Playwright, Rückgabewert 1 bei Abweichung)
python3 scripts/publish.py --apply  # veröffentlichen
```

Bilder und Texte für Social Media: `python3 scripts/finanzen_social.py --jahr b27`
(Entwürfe unter `site/social/<serie>/`, Freigabe über Metricool).

## Seiten

| Pfad | Seite | Daten |
|---|---|---|
| `/` | Start: geführter Einstieg, Gesamtergebnis 2021–2030, Seitenübersicht | kern |
| `/ueberblick/` | Woher und wohin: Ertrag und Aufwand eines Jahres nach Sachgruppen | kern |
| `/entwicklung/` | Verlauf 2021–2030 je Kennzahl, Departement, Dienststelle, Sachgruppe, Aufgabenfeld | kern |
| `/vergleich/` | bis drei Jahre, Icicle, Tabelle als Ebene oder Baum, Kommentare | kern, er, ir, befunde, komm (nachgeladen) |
| `/pruefhinweise/` | Prüfhinweise mit Filtern | kern, befunde |
| `/begriffe/` | Begriffe aus `daten/begriffe.json` | kern |
| `/methode/` | Datengrundlage, Kontrollen, Lesehilfe, Quellen | kern |

Alle Seiten: Leiste oben mit Suche (`daten/index.json`, ab drei Buchstaben, Synonyme aus
`finanzspiegel/daten/synonyme.json`, Kommentare aus `komm.json`), Seitenliste links (auf dem
Telefon als Menü), aufklappbare Abschnitte (Zustand je Leser im Browser gemerkt). Die
Seitenliste trägt die gewählten Jahre mit (`#d=…`).

Die Summen für Start, Woher und wohin und Entwicklung sind in `daten.py` vorberechnet
(`g2` je Sachgruppe, `depn` je Departement, `dstn` je Dienststelle, je Aufwand, Ertrag,
netto über alle Konten); `pruefen.py` rechnet sie aus den Kontozeilen nach.

## Datensätze

| Schlüssel | Datensatz | Quelle | Tiefe |
|---|---|---|---|
| r21 bis r25 | Rechnung 2021 bis 2025 | Staatsrechnung des Jahres (2021 und 2022: PDF «Detailzahlen») | Konto, Vorhaben |
| b21 bis b25 | Budget 2021 bis 2025 | Spalte «Budget» der Staatsrechnung desselben Jahres, ohne Nachtragskredite | Konto, Vorhaben |
| b26 | Budget 2026 | beschlossen vom Kantonsrat am 17. November 2025 | Konto, Vorhaben |
| b27 | Budget 2027 | Vorlage des Regierungsrates vom 15. September 2026 | Konto, Vorhaben |
| p28, p29, p30 | Finanzplan 2028 bis 2030 | Bericht zum Budget 2027, Ziffern 2.1, 2.2, 2.3, Kapitel 7 | zweistellige Sachgruppe |

Kommentare der Dienststellen: aus den Staatsrechnungen 2021 bis 2025 und den Budgets 2026
und 2027. Zu den Budgets 2021 bis 2025 gibt es keine, weil sie aus der Staatsrechnung stammen.

Massgebend ist beim Budget die vom Kantonsrat beschlossene Fassung (Deckblatt
«beschlossen vom Kantonsrat am ...»). Für 2027 liegt bis zur Budgetdebatte nur die
Vorlage vor; Seite, Übersicht und Social-Media-Texte führen den Zusatz «Vorlage».

## Woher die Zahlen kommen

Der Kanton publiziert Budget und Staatsrechnung nur als PDF.

1. `budget_pdf.py` liest die Detailzahlen (Kapitel 6) über die Wortpositionen im PDF:
   Erfolgsrechnung je Konto mit dem Kommentar der Dienststelle, Investitionsrechnung
   je Konto und Vorhaben. Die Spaltenkanten stammen aus der Kopfzeile jeder Seite.
   Selbstprüfung: Die Summe der gelesenen Konten je Dienststelle, Fonds und
   Departement muss der gedruckten entsprechen, in der Investitionsrechnung zusätzlich
   je Konto bzw. Vorhaben. Ausgabe `<name>.csv`, `<name>_ir.csv`, `<name>_pruefung.json`.
2. `finanzplan_pdf.py` liest die Übersichtstabellen des Berichts (Ziffern 1.6, 2.1,
   2.2, 2.3, 2.5, 4.4.2, 4.4.3, 5.3.1, 5.3.2, Steuerfuss, Kapitel 7) in 1'000 Franken
   und rechnet jede Zwischensumme aus ihren Teilen nach (Toleranz 2 wegen Rundung).
   Aus Ziffer 5.3.10 nimmt es die Nummern der Verpflichtungskredite für den Abgleich
   mit Kapitel 6.
3. `daten.py` führt alles zusammen und vergleicht die Summen je zweistelliger
   Sachgruppe mit Ziffer 2.1, je Departement mit Ziffer 4.4.2 und die
   Nettoinvestitionen mit Ziffer 2.2.
4. `analyse.py` schreibt die Prüfhinweise: Veränderungen je Dienststelle und Vorhaben
   über den Schwellen in `SCHWELLEN`, Strukturänderungen, Dokumentenabgleich. Jeder
   Hinweis nennt Beträge und die Kommentare der Dienststellen im Wortlaut.

Stand der Selbstprüfung:

| Dokument | Konten ER | Dienststellen | Zeilen IR | Abweichungen |
|---|---:|---:|---:|---:|
| Budget 2027, Vorlage | 2'933 | 126 | 187 | 0 |
| Budget 2026, beschlossen | 2'951 | 124 | 188 | 0 |
| Staatsrechnung 2025 | 3'034 | 123 | 160 | 0 |
| Staatsrechnung 2024 | 2'986 | 124 | 144 | 0 |
| Staatsrechnung 2023 | 2'947 | 124 | 133 | 0 |
| Staatsrechnung 2022, Detailzahlen | 2'918 | 124 | 114 | 0 |
| Staatsrechnung 2021, Detailzahlen | 2'952 | 125 | 119 | 0 |
| Finanzplan 2027–2030, Übersichten | | | | 0 |

Kontrollen in `daten.py` (Ausgabe am Ende, Ergebnis in `kontrollen` der Datendatei):

1. Rechnung 2025, Budget 2026 und 2027 je Sachgruppe und Departement gegen die Ziffern 2.1
   und 4.4.2 des Berichts zum Budget 2027: 0 Abweichungen.
2. Rechnung und Budget 2021 bis 2024 gegen die Tabelle «Eckwerte» der Staatsrechnungen
   (`daten/eckwerte.json`, abgeschrieben, 48 Werte): 0 Abweichungen.
3. Spalte «Rechnung Vorjahr» jeder Staatsrechnung 2022 bis 2025 gegen die Staatsrechnung
   des Vorjahres, je Konto (10'334): 0 Abweichungen.

Zwei Abweichungen zwischen Dokumenten stehen als Prüfhinweis auf der Seite:

1. Nettoinvestitionen Budget 2027: Detailzahlen 111.1 Mio. Franken, Ziffer 2.2 des
   Berichts 110.1 Mio. Die Seite rechnet mit 111.1. Die Differenz von 0.95 Mio.
   entspricht den Verpflichtungskrediten IPR0142 (0.55 Mio.) und IPR0189 (0.40 Mio.)
   des Baudepartements, die in Kapitel 6 stehen und in der Liste der Ziffer 5.3.10
   fehlen.
2. Konto 3638.11 im Fonds 2298.7251 Lotteriegewinn-Fonds: Budget 2026 in der
   beschlossenen Fassung 180'000 Franken, in der Vergleichsspalte des Budgets 2027
   200'000 Franken.

Die Sachgruppennamen stammen aus der Artengliederung des FS-Modells der
Eidgenössischen Finanzverwaltung (`daten/kontenplan.xlsx`, Blatt fs_er), ergänzt um
die Gruppen, die das Statistikmodell nicht führt (durchlaufende Beiträge, interne
Verrechnungen, Abschluss, Investitionsrechnung), nach Kontenrahmen HRM2 in `daten.py`.

## Bedienung

1. Auswahl: bis zu drei Datensätze A, B, C aus Rechnung, Budget und Finanzplan 2021
   bis 2030. A ist der Bezug für alle Differenzen.
2. Vergleich: Erfolgs- oder Investitionsrechnung, Gliederung nach Dienststelle
   (Departement, Dienststelle, Fonds, Konto) oder Sachgruppe (zwei- und dreistellig,
   Konto), Ansicht Aufwand, Ertrag oder netto, ordentliche oder alle Konten, CSV.
   Tabelle als «Ebene» (geöffnete Stufe, Klick geht tiefer) oder «Baum» (jede Stufe
   aufklappbar, mehrere Äste offen, Kommentare unter der Zeile). Ist ein Finanzplanjahr
   gewählt, gilt die Gliederung nach Sachgruppe auf der obersten Ebene.
3. Geführter Einstieg (Start): Ziel, Jahr, Bereich, Aufwand oder Ertrag, Stichwort,
   Kontrollfrage; Ergebnis ist eine Adresse auf eine der Unterseiten. Alle Möglichkeiten
   je Stufe vollständig, Departemente und Dienststellen nach Nummer (keine Auswahl
   einzelner Themen).
4. Suche oben: ab drei Buchstaben, gruppiert nach Seiten, Begriffen, Kennzahlen,
   Departementen, Dienststellen, Aufgabenfeldern, Sachgruppen, Fonds, Vorhaben, Konten
   und Kommentaren.

Grafik (`grafik.js`, Knopf unten rechts): Kuchen, Balkenliste, Ringdiagramm mit bis zu
drei Datensätzen (A aussen), Woher und wohin, Entwicklung, Kennzahlen; Ebene wählbar
bis «alle Konten»; Formate 4:5 (1080 × 1350), 16:9 (1920 × 1080), 3:2 (1800 × 1200);
PNG oder Zwischenablage. Die Grafik zeichnet die gewählte Ansicht, ohne eigene Rechnung.

Hell oder dunkel: Knopf oben rechts in der Kopfzeile. Ohne Wahl gilt die Einstellung des
Geräts; die Wahl merkt sich der Browser (`localStorage`, Schlüssel `fs-thema`) und gilt auf
allen Seiten. «Fehler melden» steht unten links: am Desktop am Fuss der Seitenleiste, auf
schmalen Bildschirmen schwebend in der Ecke.

Jede Ansicht steht in der Adresse (`#d=b27,b26&r=er&g=inst&a=A&u=ord&p=d22/s2210`)
und lässt sich teilen.

Gezeigt ist als Vorgabe das Ordentliche (Sachgruppen 30 bis 37, 40 bis 47).
Ausserordentliches (38, 48) und Fondsabschlüsse (90) rechnet der Überblick vor,
interne Verrechnungen (39, 49) stehen beidseits gleich. So stimmen die Totale mit
Ziffer 2.1 des Berichts überein.

## Neues Dokument

1. PDF nach `daten/pdf/` legen (nicht im Repo) und in `daten/quellen.json` eintragen.
2. `budget_pdf.py` darauf laufen lassen, Selbstprüfung lesen: 0 abweichend.
3. Beim neuen Budget mit Finanzplan: `finanzplan_pdf.py`, Ausgabe `finanzplanJJJJ.json`.
4. Neue Staatsrechnung: in `daten.py` und `analyse.py` das Jahr in `RECHNUNGSJAHRE`
   ergänzen; Eckwerte des Berichts in `daten/eckwerte.json`, wenn die Rechnung nicht schon
   über den Bericht zum Budget geprüft ist. Neues Budget: `JAHRE`, `PLAN`, `ER_QUELLEN`,
   `IR_QUELLEN`, `KOMMENTAR`, `NAMEN_REIHENFOLGE` ergänzen; in `analyse.py` die Jahre der
   Regeln «Budget zu Vorjahresbudget» und «Strukturänderung».
5. `daten.py`, `analyse.py`, `bauen.py`, `pruefen.py`, dann `scripts/publish.py --apply`.
   Der Kasten auf der Übersicht des Politspiegels liest seine Zahlen aus der
   veröffentlichten Datei `kennzahlen.json` dieser Seite (bauen.py schreibt sie nach
   `site/kennzahlen.json`); er zieht sie beim nächsten Bau des Politspiegels nach.

Beschlossenes Budget 2027 (nach der Budgetdebatte):

1. PDF der beschlossenen Fassung als `daten/pdf/budget2027.pdf` ablegen, Eintrag in
   `quellen.json` ersetzen (Datei, Adresse, Fassung «beschlossen vom Kantonsrat am ...»,
   Datum der Publikation).
2. `budget_pdf.py` und `finanzplan_pdf.py` auf die neue Datei.
3. In `daten.py` bei `JAHRE` (b27) und `PLAN` die Fassung ändern und `"vorlage": 1`
   entfernen. Seite, Grafiken, Übersicht und Social-Media-Texte lassen den Zusatz
   «Vorlage» dann weg.
4. In `bauen.py` unter «Datengrundlage» den Satz zu den Nettoinvestitionen
   (Ziffer 2.2) mit den neuen Zahlen prüfen.
5. Schritt 5 oben.

Die Spaltenreihenfolge unterscheidet sich zwischen Budget (Budget, Budget Vorjahr,
Rechnung Vorvorjahr) und Staatsrechnung (Rechnung, Budget, Rechnung Vorjahr);
`budget_pdf.py` liest sie aus der Kopfzeile. Die Investitionsrechnung gliedert im
Budget Konto vor Vorhaben, in der Staatsrechnung Vorhaben vor Konto.

## Grenzen

1. Der Finanzplan liegt nur zusammengefasst vor: zweistellige Sachgruppen,
   Nettoinvestitionen, Bilanz, Aufgabenfelder. Kein Drilldown auf Dienststelle oder
   Konto.
2. Funktionale Gliederung (Bildung, Gesundheit, ...) gibt es im Bericht nur einstufig
   (Ziffer 4.4.3). Brutto und feiner beim Bund (EFV, Finanzstatistik).
3. Eigenkapital und Steuerfuss stammen aus dem Bericht zum Budget 2027 und liegen nur für
   2025 bis 2030 vor.
4. Dienststellen sind über ihre Nummer verknüpft; Reorganisationen sind nicht zurückgerechnet.
5. Der Parser hängt am Seitenlayout des Kantons. Ändert es, meldet die Selbstprüfung
   Abweichungen; dann `budget_pdf.py` anpassen.
