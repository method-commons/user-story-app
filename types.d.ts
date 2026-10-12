/**
 * Typen des Datenmodells – nur für die Typprüfung (tsc/Editor), wird vom Browser nicht geladen.
 * Die Struktur entspricht dem JSON-Export eines Projekts (siehe docs/DATENFORMAT.md).
 */

/** Status einer Story im Ablauf (Board-Spalten) */
type StoryStatus = 'draft' | 'ready' | 'progress' | 'review' | 'done';

/** Priorität nach MoSCoW */
type Priority = 'must' | 'should' | 'could' | 'wont';

/** Skala für die Größe: T-Shirt-Größen oder Story Points (Fibonacci) */
type SizeScale = 'tshirt' | 'points';

/** Art eines Eintrags in der Conversation */
type ConversationKind = 'note' | 'question' | 'decision';

/** Buchstaben der INVEST-Regel */
type InvestLetter = 'I' | 'N' | 'V' | 'E' | 'S' | 'T';

/** Ergebnis der automatischen Prüfung: erfüllt, prüfen, verletzt, keine Aussage */
type InvestAuto = 'ok' | 'warn' | 'bad' | 'none';

/** Anzeige-Zustand eines Buchstabens (Automatik + eigene Bestätigung) */
type InvestState = 'ok' | 'warn' | 'bad' | 'open';

interface ChecklistItem {
  id: string;
  text: string;
}

interface Epic {
  id: string;
  name: string;
  /** Farbe als #rrggbb */
  color: string;
  description: string;
}

interface Criterion {
  id: string;
  /** Kurzer Titel, optional leer */
  title: string;
  /** `gwt` = Gegeben/Wenn/Dann, `check` = Checklistenpunkt (nur `text`) */
  format: 'gwt' | 'check';
  given: string;
  when: string;
  then: string;
  text: string;
  /** Beim Test bestätigt (Abarbeitung) */
  confirmed: boolean;
}

interface ConversationEntry {
  id: string;
  kind: ConversationKind;
  /** Frei eingetragener Name, optional leer */
  author: string;
  text: string;
  /** Datum der Erfassung (ISO, nur Tag) */
  date: string;
  /** Nur bei Fragen: beantwortet */
  resolved: boolean;
  /** Bei Entscheidungen: daraus übernommenes Akzeptanzkriterium */
  criterionId: string | null;
}

interface Story {
  id: string;
  /** Laufende Nummer im Projekt (Anzeige „KEY-n“) */
  number: number;
  /** Kurztitel, optional leer (dann zählt „möchte ich …“) */
  title: string;
  /** Standardformat: Als <role> möchte ich <want>, damit <benefit> */
  role: string;
  want: string;
  benefit: string;
  /** Notiz / Beschreibung (Freitext) */
  notes: string;
  /** Größe auf der Skala des Projekts, `?` = nicht schätzbar, `null` = nicht geschätzt */
  size: string | null;
  priority: Priority | null;
  epicId: string | null;
  status: StoryStatus;
  /** IDs der Stories, von denen diese abhängt */
  dependsOn: string[];
  conversation: ConversationEntry[];
  criteria: Criterion[];
  /** Eigene Bestätigung je INVEST-Buchstabe (nur bei Hinweisen bzw. ohne Aussage wirksam) */
  invest: Partial<Record<InvestLetter, boolean>>;
  /** Abgehakte Punkte der projektspezifischen Definition of Ready bzw. Done (ID → true) */
  dor: Record<string, boolean>;
  dod: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
}

interface ProjectSettings {
  sizeScale: SizeScale;
  /** Größte Größe, die noch als „Small“ gilt */
  smallLimit: string;
  /** Eigene Punkte der Definition of Ready / Done (zusätzlich zu den automatischen) */
  dor: ChecklistItem[];
  dod: ChecklistItem[];
}

interface Project {
  /** Version des Datenformats */
  version: number;
  id: string;
  /** Kürzel für Story-Nummern, z. B. „FT“ */
  key: string;
  name: string;
  description: string;
  color: string;
  settings: ProjectSettings;
  epics: Epic[];
  /** Reihenfolge = Priorisierung im Backlog */
  stories: Story[];
  /** Nächste freie Story-Nummer */
  nextNumber: number;
  createdAt: string;
  updatedAt: string;
}

interface InvestResult {
  auto: InvestAuto;
  /** Schlüssel des Hinweistexts (Texts.invest.hints) */
  hint: string;
  /** Platzhalter für den Hinweis */
  params: Record<string, string | number>;
  confirmed: boolean;
  state: InvestState;
}

interface CheckItem {
  id: string;
  /** Automatisch geprüft (nicht abhakbar) */
  auto: boolean;
  /** Text bzw. Textschlüssel bei automatischen Punkten */
  text: string;
  done: boolean;
}
