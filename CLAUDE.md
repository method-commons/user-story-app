# CLAUDE.md – Hinweise für Claude Code

User-Story-App als Web-App ohne Server: Vite 8, Preact 10 + @preact/signals, Daten nur im Browser
(localStorage), veröffentlicht über GitHub Pages. Technische Vorlage ist die
[Morphologische Matrix](https://github.com/method-commons/morphological-matrix-app). Funktionen und Module
stehen in der [README](README.md), das Datenformat in [docs/DATENFORMAT.md](docs/DATENFORMAT.md).

## Zusammenarbeit

- **Sprache:** Antworten, Code-Kommentare, Commit-Nachrichten und PR-Texte auf **Deutsch**.
- **Erst zeigen, dann bauen:** neue Funktionen zuerst als Mockup, umsetzen nach „Ja“.
- **Abgrenzung:** Die App unterstützt die Methodik (Standardformat, 3Cs, INVEST, Akzeptanzkriterien, DoR/DoD) – kein Projektmanagement (keine Sprints, Velocity, Zuständigkeiten).
- **Pull Requests nur auf Nachfrage.** Keine Modellbezeichnungen in Commits, PRs oder Code.
- **Fertig heißt:** `npm test` grün, README/DATENFORMAT aktualisiert, Commit und Push.

## Befehle

```sh
npm test                       # Lint, Typprüfung, Unit, Build, E2E
npx eslint .                   # Lint
npx tsc --noEmit -p jsconfig.json && node scripts/typecheck-logic.js
npx vitest run [datei]         # Unit-Tests (tests/unit/)
npx vite build && npx playwright test [datei]   # E2E gegen den Build (Port 4173)
```

## Architektur

- **Logik ohne DOM** in `js/*.js` (`Model`, `Invest`, `Ops`, `Store`, `IO`, `Examples`), Oberfläche in `js/ui/*.jsx`.
- **Zustand:** `project` in `js/ui/core.js` ist ein normales Objekt; neu gezeichnet wird über das Signal `revision`. Strukturelle Änderungen mit `mutate(fn)`, Textfelder mit `{...fieldProps(get, set)}` (Verlaufseintrag beim Verlassen). Navigation über den Hash (`#/p/<id>/backlog`, `#/p/<id>/s/<story>/confirmation`).
- `main.js` entfernt `Component.prototype.shouldComponentUpdate` (von @preact/signals): sonst zeichnen Kinder mit unveränderten Props nicht neu, obwohl sich das Projekt-Objekt geändert hat.
- **Texte** nur in `js/i18n/de.js` (maßgeblich) und `en.js` (gleiche Struktur und Platzhalter, wird geprüft).
- **Beispiele** `examples/food-truck.{de,en}.json` müssen exakt der Ausgabe von `Model.normalize` entsprechen.

## Ablage (method-commons/sync)

- Abhängigkeit `@method-commons/sync` über `git+https://github.com/method-commons/sync.git#<Tag oder Commit>` (nicht `github:` – npm schreibt sonst `git+ssh` ins Lockfile, das scheitert in der CI). Neue Version des Kerns: `package.json` und Lockfile anheben.
- Fest eingebunden nur `@method-commons/sync/config`; Kern, Oberfläche und Stile lädt `loadSync()` in `js/ui/sync.jsx` erst bei Bedarf.
- Änderungen meldet die Speicherschicht (`Store.observe`: Schreiben und Löschen) – auch Import, Duplizieren, Beispiele.
- Übernahmen aus der Ablage: abgelehnt, solange die geöffnete Datei ungespeicherte Eingaben hat (`hasPendingSave`, dann meldet der Kern einen Konflikt), sonst sofort angezeigt (`adoptStored(id, true)`).
- `resolve.dedupe: ['preact']` in `vite.config.js` – sonst zwei Preact-Instanzen (Hooks der Oberfläche brechen).
- **Versionen:** früherer Stand nur lesend über `showPreview`/`endPreview` (`core.js`): Speichern, `mutate`, Rückgängig und Eingaben (`beforeinput` in `fieldProps`) sind gesperrt, Wechsel zu einem anderen Dokument beendet das Ansehen, Übernahmen aus der Ablage werden solange abgelehnt.
- **Teilen zum Ansehen:** Link `#g=<gist>` öffnet `openSharedFromHash` (`sync.jsx`, beim Start und bei `hashchange`) → `showShared` (`core.js`): eigene Route, nur lesend, **nichts wird gespeichert**; „Schließen“ führt zum vorher geöffneten Dokument bzw. zur Übersicht, erst „Als Kopie speichern“ (Kern) legt ein Dokument an.
- E2E: `tests/e2e/github.js` bildet die GitHub-API mit `page.route` nach (Dateien mit `sha`, Commits je Datei, Tags, geheime Gists; `fakeGitHub(page, { gh })` teilt den Zustand mit einer zweiten Seite), genutzt von `sync.spec.js`, `versions.spec.js` und `share.spec.js`; `tests/e2e/tabs.spec.js` prüft die Übernahme aus einem anderen Browser-Tab.

## Fallstricke

- **Werte vor `setState`/`mutate` lesen:** Das Neuzeichnen ist synchron; ein kontrolliertes Feld hat danach schon den alten Wert.
- **Speichern ist verzögert** (300 ms) – E2E-Tests lesen den localStorage mit `expect.poll`.
- **`backdrop-filter`** an der Kopfzeile bindet `position: fixed` an sie – mobil daher abgeschaltet.
