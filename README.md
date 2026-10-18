# User Stories

Responsive Web-App, die beim **methodischen Arbeiten mit User Stories** hilft: erstellen, pflegen und abarbeiten – für mehrere Projekte. Sie führt durch Standardformat, 3Cs, INVEST-Regel, Akzeptanzkriterien sowie Definition of Ready und Done.

Bewusst **kein Projektmanagement-Werkzeug**: keine Sprints, keine Velocity, keine Zuständigkeiten, keine Zeiterfassung.

Läuft im Browser ohne Server-Backend; die Oberfläche nutzt [Preact](https://preactjs.com) mit [Signals](https://preactjs.com/guide/v10/signals/), gebaut wird mit [Vite](https://vite.dev) – technisch wie die [Morphologische Matrix](https://github.com/method-commons/morphological-matrix-app).

## Starten

Lokal (Node.js ≥ 22):

```sh
npm install      # einmalig
npm run dev      # Entwicklungsserver, http://localhost:5173/
npm run build    # Build nach dist/
npm run preview  # gebaute App ansehen, http://localhost:4173/
npm test         # Lint, Typprüfung, Unit-Tests, Build, Browser-Tests
```

Auf `main` veröffentlicht die CI die App auf GitHub Pages, sobald alle Prüfungen grün sind (einmalig: *Settings → Pages → Source: „GitHub Actions“*).

## Funktionen

- **Projekte:** beliebig viele, jeweils mit Name, Kürzel (für Story-Nummern wie `FT-12`), Beschreibung, Farbe und Schätzskala. Die Startseite zeigt je Projekt Anzahl Stories, Story Points bzw. Fertige, den Anteil INVEST-konformer Stories, Fortschritt nach Status und den wichtigsten Hinweis (z. B. „3 Stories zu groß“). Dazu „Zuletzt bearbeitet“.
- **Backlog:** Stories in Reihenfolge der Priorisierung, gruppiert nach Epic, Status oder ohne Gruppen.
  - **Schnelleingabe** im Standardformat: „Als … möchte ich …, damit …“ (bzw. „As a … I want to … so that …“) wird in Rolle, Ziel und Nutzen zerlegt.
  - Je Story: Satz im Standardformat (fehlende Teile rot), INVEST-Leiste, MoSCoW-Priorität, Status, Größe.
  - Suche, Filter (Status, Priorität, Epic, „INVEST-Hinweise“), Umsortieren per Ziehen oder ↑/↓; Ziehen in eine andere Epic-Gruppe ordnet die Story dem Epic zu.
  - Seitenleiste „Backlog-Qualität“ und „INVEST im Projekt“ mit Verweisen auf verletzte Stories.
- **Story-Editor mit den 3Cs:**
  - **Card:** Felder *Als / möchte ich / damit* mit Vorschau als Karte und passendem **Tipp** (Rolle zu allgemein, Nutzen fehlt, technische Begriffe, mehrere Funktionen …). Größe (T-Shirt XS–XL oder Story Points 1–40, „?“ = nicht schätzbar), Priorität, Epic, Abhängigkeiten (ohne Kreise), Notiz, optionaler Kurztitel.
  - **Conversation:** Notizen, Fragen (mit „beantwortet“) und Entscheidungen mit frei eingetragenem Namen; eine Entscheidung wird per Klick zum Akzeptanzkriterium.
  - **Confirmation:** Akzeptanzkriterien als *Gegeben/Wenn/Dann* oder *Checklistenpunkt*, mit Titel, umsortierbar; unvollständige werden markiert, unscharfe Wörter („schnell“, „einfach“ …) gemeldet. Abhaken = beim Test bestätigt.
- **INVEST-Check** je Story: automatische Prüfung mit Hinweis je Buchstabe – *Independent* (offene Abhängigkeiten), *Negotiable* (technische Begriffe), *Valuable* (Nutzen, Rolle), *Estimable* (geschätzt, offene Fragen), *Small* (Grenze je Projekt, mehrere „und“), *Testable* (Kriterien vorhanden, vollständig, messbar). Hinweise („prüfen“) und Punkte ohne Aussage bestätigt man selbst; Verletzungen lassen sich nicht wegbestätigen.
- **Definition of Ready / Done:** automatische Punkte (Standardformat vollständig, Kriterien vollständig, geschätzt, klein genug bzw. alle Kriterien bestätigt) plus eigene Punkte je Projekt, je Story abzuhaken.
- **Board** zur Abarbeitung: Entwurf → Bereit → In Arbeit → Review → Fertig. Verschieben per Ziehen oder ‹ ›; beim Wechsel nach „Bereit“ bzw. „Fertig“ zeigt ein Dialog die offenen Punkte (eigene Punkte direkt abhakbar, „Trotzdem verschieben“ möglich). Gleiche Prüfung beim Statuswechsel im Editor.
- **Aufteilen** zu großer Stories mit Mustern (Workflow-Schritte, Geschäftsregeln, Datenvarianten, einfach/komplex, Happy Path/Fehler, Rollen, Spike); das Original wird wahlweise zum Epic.
- **Epics:** anlegen, benennen, einfärben, beschreiben, mit Fortschritt; Löschen behält die Stories.
- **Bericht:** alle Stories als Karten mit Kriterien und INVEST – zum Drucken/als PDF oder als Markdown.
- **Methodik-Hilfe** (Knopf „? Methodik“ und kontextbezogene „Mehr dazu“-Links): Standardformat, 3Cs, INVEST, Akzeptanzkriterien, Ready & Done, Aufteilen, Ablauf.
- **Speichern** automatisch im Browser (localStorage), Rückgängig/Wiederholen (Knöpfe bzw. `Strg+Z` / `Strg+Umschalt+Z` außerhalb von Textfeldern), Export/Import je Projekt als JSON (vorhandene identische Projekte werden übersprungen, abweichende als Kopie angelegt), Sicherung aller Projekte als eine JSON-Datei. Änderungen aus einem anderen Browser-Tab werden übernommen.
- **Beispiel** „Food-Truck Bestell-App“ (Deutsch und Englisch) mit typischen Stärken und Schwächen.
- **Sprachen:** Deutsch und Englisch (Menü „Datei“). Hell/dunkel nach Systemeinstellung, mobil mit Navigation unten.

## Aufbau

| Datei | Inhalt |
|---|---|
| `js/model.js` | Datenmodell, Normalisieren, Standardformat (Satz bilden/zerlegen) |
| `js/invest.js` | INVEST-Prüfung, Definition of Ready/Done, Prüfungen beim Statuswechsel |
| `js/ops.js` | Änderungen (Stories, Abhängigkeiten, Aufteilen, Epics, Skala) und Kennzahlen |
| `js/storage.js` | Speicherung im localStorage |
| `js/io.js` | JSON-Export/-Import, Sicherung, Markdown-Bericht |
| `js/examples.js`, `examples/` | Beispielprojekt je Sprache |
| `js/texts.js`, `js/i18n/` | Texte (Deutsch maßgeblich, Englisch gleiche Struktur) |
| `js/ui/core.js` | Route, geöffnetes Projekt, Speichern, Verlauf, Dialoge, Meldungen |
| `js/ui/*.jsx` | Ansichten: Start, Backlog, Story-Editor, Board, Epics, Bericht, Einstellungen, Hilfe, Aufteilen, Statusprüfung |
| `css/` | Design-Tokens (aus der Matrix-App), Bausteine, Ansichten, mobil, Druck |
| `tests/unit/`, `tests/e2e/` | Vitest (Logik, Mindestabdeckung) und Playwright (gegen den Build) |

Datenformat: [docs/DATENFORMAT.md](docs/DATENFORMAT.md). Entwürfe: [docs/mockups/](docs/mockups/).

## Lizenz

[MIT](LICENSE)
