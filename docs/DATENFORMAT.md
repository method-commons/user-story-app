# Datenformat

Ein Projekt wird als JSON gespeichert (localStorage-Schlüssel `user-stories:project:<id>`) und exportiert. Beim Laden und Import normalisiert `Model.normalize` die Daten: fehlende Felder werden ergänzt, unbekannte entfallen, ungültige Werte und Verweise werden bereinigt, doppelte IDs neu vergeben.

## Projekt (Version 1)

```json
{
  "version": 1,
  "id": "p…",
  "key": "FT",
  "name": "Food-Truck Bestell-App",
  "description": "…",
  "color": "#f59f00",
  "settings": {
    "sizeScale": "tshirt",
    "smallLimit": "M",
    "dor": [{ "id": "dor-po", "text": "Mit dem Product Owner besprochen" }],
    "dod": [{ "id": "dod-po", "text": "Vom Product Owner abgenommen" }]
  },
  "epics": [{ "id": "e-order", "name": "Bestellen", "color": "#f59f00", "description": "…" }],
  "stories": [ /* Story, Reihenfolge = Priorisierung */ ],
  "nextNumber": 11,
  "createdAt": "2026-10-01T09:00:00.000Z",
  "updatedAt": "2026-10-08T14:30:00.000Z"
}
```

- `key`: Großbuchstaben/Ziffern, höchstens 6 Zeichen.
- `sizeScale`: `tshirt` (XS, S, M, L, XL) oder `points` (1, 2, 3, 5, 8, 13, 20, 40). `smallLimit` ist ein Wert dieser Skala.
- `dor` / `dod`: eigene Punkte der Definition of Ready bzw. Done (die automatischen Punkte werden nicht gespeichert).

## Story

```json
{
  "id": "s-preorder",
  "number": 2,
  "title": "Vorbestellung aufgeben",
  "role": "hungriger Gast",
  "want": "meine Bestellung vorab per Handy aufgeben",
  "benefit": "ich nicht in der Schlange warten muss",
  "notes": "…",
  "size": "M",
  "priority": "must",
  "epicId": "e-order",
  "status": "ready",
  "dependsOn": ["s-pay"],
  "conversation": [
    { "id": "k3", "kind": "decision", "author": "Aylin", "text": "…", "date": "2026-10-04", "resolved": false, "criterionId": "a5" }
  ],
  "criteria": [
    { "id": "a3", "title": "Bestellung aufgeben", "format": "gwt", "given": "…", "when": "…", "then": "…", "text": "", "confirmed": false },
    { "id": "a5", "title": "", "format": "check", "given": "", "when": "", "then": "", "text": "…", "confirmed": false }
  ],
  "invest": { "I": true },
  "dor": { "dor-po": true },
  "dod": {},
  "createdAt": "…",
  "updatedAt": "…"
}
```

| Feld | Werte |
|---|---|
| `size` | Wert der Skala, `"?"` (nicht schätzbar) oder `null` (nicht geschätzt) |
| `priority` | `must`, `should`, `could`, `wont` oder `null` |
| `status` | `draft`, `ready`, `progress`, `review`, `done` |
| `dependsOn` | IDs anderer Stories des Projekts (ohne Selbstbezug) |
| `conversation[].kind` | `note`, `question`, `decision`; `resolved` gilt für Fragen, `criterionId` verweist auf ein übernommenes Kriterium |
| `criteria[].format` | `gwt` (Gegeben/Wenn/Dann: `given`, `when`, `then`) oder `check` (`text`) |
| `invest` | eigene Bestätigung je Buchstabe (`I N V E S T`), nur `true` wird gespeichert |
| `dor`, `dod` | abgehakte eigene Punkte (ID → `true`) |

## Sicherung

```json
{ "type": "user-stories-backup", "version": 1, "exportedAt": "…", "projects": [ /* Projekte */ ] }
```

Import akzeptiert ein Projekt, eine Sicherung oder eine Liste von Projekten. Gleiche ID mit identischem Inhalt wird übersprungen, abweichender Inhalt als Kopie mit neuer ID und Namenszusatz „(Import)“ angelegt.

## Versionen

| Version | Änderung |
|---|---|
| 1 | Erste Fassung |
