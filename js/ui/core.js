/*
 * Zustand der Oberfläche: Route (Hash), geöffnetes Projekt, Speichern, Rückgängig/Wiederholen,
 * Dialoge und Meldungen.
 *
 * Regeln für Änderungen:
 *  - Strukturelle Änderungen laufen über `mutate(fn)` (Verlaufseintrag, Speichern, Neuzeichnen).
 *  - Texteingaben über `fieldProps(get, set)`: Änderung sofort sichtbar, Verlaufseintrag beim
 *    Verlassen des Felds.
 *
 * Das Projekt ist ein normales Objekt, das `Ops` direkt ändert; das Signal `revision` zählt
 * Änderungen, Komponenten lesen es über `useProject()` und zeichnen dadurch neu.
 */
import { signal } from '@preact/signals';
import { Ops } from '../ops.js';
import { Store } from '../storage.js';

/** Zähler für Änderungen; Komponenten lesen ihn, um neu zu zeichnen. */
export const revision = signal(0);

/**
 * @typedef {{ view: 'home' }
 *   | { view: 'project', pid: string, tab: 'backlog' | 'board' | 'epics' | 'report' | 'settings' }
 *   | { view: 'story', pid: string, sid: string, tab: 'card' | 'conversation' | 'confirmation' }} Route
 */

const PROJECT_TABS = ['backlog', 'board', 'epics', 'report', 'settings'];
const STORY_TABS = ['card', 'conversation', 'confirmation'];

/** Hash → Route. @param {string} hash @returns {Route} */
export function parseHash(hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'p' && parts[1]) {
    if (parts[2] === 's' && parts[3]) {
      const tab = STORY_TABS.includes(parts[4]) ? parts[4] : 'card';
      return /** @type {Route} */ ({ view: 'story', pid: parts[1], sid: parts[3], tab });
    }
    const tab = PROJECT_TABS.includes(parts[2]) ? parts[2] : 'backlog';
    return /** @type {Route} */ ({ view: 'project', pid: parts[1], tab });
  }
  return { view: 'home' };
}

/** Route → Hash. @param {Route} r */
export function hashOf(r) {
  if (r.view === 'project') return `#/p/${encodeURIComponent(r.pid)}/${r.tab}`;
  if (r.view === 'story') return `#/p/${encodeURIComponent(r.pid)}/s/${encodeURIComponent(r.sid)}${r.tab === 'card' ? '' : '/' + r.tab}`;
  return '#/';
}

/** Aktuelle Route. */
export const route = signal(parseHash(typeof location !== 'undefined' ? location.hash : ''));

/** Zur Route wechseln (neuer Verlaufseintrag im Browser). @param {Route} r */
export function go(r) {
  const h = hashOf(r);
  if (location.hash !== h) location.hash = h;
  else applyRoute();
}

/** Geöffnetes Projekt (oder `null` auf der Startseite). @type {Project | null} */
export let project = null;
/** @type {string[]} */
let undoStack = [];
/** @type {string[]} */
let redoStack = [];
const HISTORY_LIMIT = 200;

/** Route aus dem Hash übernehmen und das passende Projekt laden. */
export function applyRoute() {
  const r = parseHash(location.hash);
  if (preview && !(r.view !== 'home' && r.pid === project?.id)) endPreview(false); // anderes Dokument: Ansehen beenden
  if (r.view !== 'home') {
    if (!project || project.id !== r.pid) {
      flushSave();
      project = Store.load(r.pid);
      undoStack = [];
      redoStack = [];
    }
    if (!project) { location.replace('#/'); route.value = { view: 'home' }; render(); return; }
    if (r.view === 'story' && !Ops.find(project, r.sid)) {
      location.replace(hashOf({ view: 'project', pid: r.pid, tab: 'backlog' }));
      route.value = { view: 'project', pid: r.pid, tab: 'backlog' };
      render();
      return;
    }
  } else {
    flushSave();
    project = null;
  }
  route.value = r;
  render();
}

/** Neu zeichnen. */
export function render() {
  revision.value++;
}

/**
 * Für Komponenten: geöffnetes Projekt – und bei jeder Änderung neu zeichnen.
 * @returns {Project}
 */
export function useProject() {
  revision.value;
  return /** @type {Project} */ (project);
}

/** Für Komponenten, die nur neu zeichnen müssen (z. B. Startseite). */
export function useRevision() {
  return revision.value;
}

// ===== Speichern =====
/** @type {ReturnType<typeof setTimeout> | null} */
let saveTimer = null;

/** Gleich speichern (nach kurzer Pause gebündelt). */
export function scheduleSave() {
  if (preview) return; // früherer Stand: nur ansehen
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 300);
}

/** Gibt es Eingaben, die noch nicht gespeichert sind (verzögertes Speichern läuft)? */
export const hasPendingSave = () => saveTimer != null;

/** Ausstehendes Speichern sofort ausführen. */
export function flushSave() {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  if (project && !Store.save(project)) toast(storageFailedText);
}

/** Geöffnetes Projekt verwerfen, ohne es zu speichern (nach dem Löschen). */
export function discardProject() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  editSnapshot = null;
  project = null;
}

let storageFailedText = 'Speichern fehlgeschlagen';
/** Text der Meldung bei vollem Speicher (aus den Sprachdateien). @param {string} t */
export function setStorageFailedText(t) { storageFailedText = t; }

/** Projekt neu setzen (z. B. nach Änderung in einem anderen Browser-Tab). @param {Project} p */
export function replaceProject(p) {
  project = p;
  render();
}

/**
 * Gespeicherten Stand übernehmen, nachdem ein anderer Browser-Tab (oder die Ablage) das Projekt
 * geändert hat: geöffnete Projekt neu laden – außer während einer Texteingabe –, sonst die Übersicht.
 * `force`: auch während einer Texteingabe (die Ablage übernimmt nur ohne ungespeicherte Eingaben).
 * @param {string} id @param {boolean} [force]
 */
export function adoptStored(id, force = false) {
  if (project && project.id === id) {
    const doc = Store.load(id);
    if (!doc) { applyRoute(); return; }
    if (preview) { preview.saved = doc; return; } // gilt nach dem Ansehen
    const active = document.activeElement;
    if (!force && active && /^(INPUT|TEXTAREA)$/.test(active.tagName)) return;
    replaceProject(doc);
  } else if (route.value.view === 'home') {
    render();
  }
}

// ===== Früherer bzw. geteilter Stand (Versionen und Teilen der Ablage) =====
/**
 * Wird ein früherer oder geteilter Stand angesehen? Dann ist das vorher geöffnete Dokument in `saved` geparkt
 * (bei einem geteilten Link ggf. `null`, z. B. von der Übersicht aus). @type {{ saved: any, shared?: boolean } | null}
 */
let preview = null;
/** Meldung bei gesperrtem Bearbeiten und Ende des Ansehens (aus sync.jsx). */
let previewHooks = { locked: '', ended: () => {} };
/** @param {{ locked: string, ended: () => void }} hooks */
export function setPreviewHooks(hooks) { previewHooks = hooks; }
export const isPreview = () => preview !== null;

/** Bearbeiten ist gesperrt, solange ein früherer Stand gezeigt wird (mit Hinweis). */
function blockedByPreview() {
  if (!preview) return false;
  toast(previewHooks.locked);
  render();
  return true;
}

/** Früheren Stand des geöffneten Dokuments nur lesend zeigen. @param {any} data */
export function showPreview(data) {
  if (!project) return;
  commitEdit();
  flushSave();
  preview ??= { saved: project };
  replaceProject(data);
}

/**
 * Geteiltes Dokument (Link `#g=…`) nur lesend zeigen – **ohne es zu speichern**, weder im Browser noch in der Ablage.
 * Erst „Als Kopie speichern“ (Kern) legt bewusst ein eigenes Dokument an.
 * @param {any} data
 */
export function showShared(data) {
  // „Aktualisieren“ desselben Dokuments: Ansicht bleibt
  if (preview?.shared && project?.id === data.id) { project = data; render(); return; }
  if (project && !preview) { commitEdit(); flushSave(); }
  if (!preview) preview = { saved: project, shared: true };
  else preview.shared = true;
  project = data;
  const id = data.id;
  go({ view: 'project', pid: id, tab: 'backlog' });
  render();
}

/**
 * Zurück zum aktuellen Stand. Eine geteilte Ansicht wird verworfen; `navigate`: zum vorher geöffneten Dokument
 * bzw. zur Übersicht wechseln (nicht, wenn ohnehin gerade die Route wechselt).
 * @param {boolean} [navigate]
 */
export function endPreview(navigate = true) {
  if (!preview) return;
  const { saved, shared } = preview;
  preview = null;
  if (shared) {
    project = null;
    if (navigate) {
      const id = saved?.id;
      go(id ? { view: 'project', pid: id, tab: 'backlog' } : { view: 'home' });
    }
  } else if (project) {
    replaceProject(Store.load(project.id) ?? saved);
  }
  previewHooks.ended();
}

// ===== Änderungen und Verlauf =====
/** Stand vor einer Texteingabe (Verlaufseintrag beim Verlassen des Felds). @type {string | null} */
let editSnapshot = null;

/** @param {string} snap */
function pushUndo(snap) {
  undoStack.push(snap);
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack = [];
}

/**
 * Strukturelle Änderung am geöffneten Projekt.
 * @param {(p: Project) => any} fn
 */
export function mutate(fn) {
  if (!project) return undefined;
  if (blockedByPreview()) return undefined;
  commitEdit();
  const before = JSON.stringify(project);
  const result = fn(project);
  if (JSON.stringify(project) !== before) {
    Ops.touch(project);
    pushUndo(before);
    scheduleSave();
  }
  render();
  return result;
}

/** Laufende Texteingabe als Verlaufseintrag abschließen. */
export function commitEdit() {
  if (editSnapshot == null || !project) return;
  const snap = editSnapshot;
  editSnapshot = null;
  if (snap !== JSON.stringify({ ...project, updatedAt: JSON.parse(snap).updatedAt })) pushUndo(snap);
  flushSave();
}

/**
 * Eigenschaften für ein Eingabefeld: Änderung sofort, Verlauf beim Verlassen.
 * @param {() => string} get @param {(v: string) => void} set
 */
export function fieldProps(get, set) {
  return {
    value: get(),
    onFocus: () => { if (project && editSnapshot == null) editSnapshot = JSON.stringify(project); },
    /** @param {Event} e */
    // früherer Stand: Tippen gar nicht erst zulassen
    /** @param {Event} e */
    onBeforeInput: e => { if (preview) { e.preventDefault(); blockedByPreview(); } },
    /** @param {Event} e */
    onInput: e => {
      if (!project || preview) return;
      if (editSnapshot == null) editSnapshot = JSON.stringify(project);
      set(/** @type {HTMLInputElement} */ (e.currentTarget).value);
      Ops.touch(project);
      scheduleSave();
      render();
    },
    onBlur: commitEdit,
  };
}

export const canUndo = () => undoStack.length > 0 || editSnapshot != null;
export const canRedo = () => redoStack.length > 0;

export function undo() {
  if (blockedByPreview()) return;
  commitEdit();
  if (!project || !undoStack.length) return;
  redoStack.push(JSON.stringify(project));
  project = JSON.parse(/** @type {string} */ (undoStack.pop()));
  afterHistory();
}

export function redo() {
  if (blockedByPreview()) return;
  commitEdit();
  if (!project || !redoStack.length) return;
  undoStack.push(JSON.stringify(project));
  project = JSON.parse(/** @type {string} */ (redoStack.pop()));
  afterHistory();
}

function afterHistory() {
  scheduleSave();
  // Geöffnete Story gibt es evtl. nicht mehr
  const r = route.value;
  if (r.view === 'story' && project && !Ops.find(project, r.sid)) go({ view: 'project', pid: project.id, tab: 'backlog' });
  render();
}

// ===== Meldungen und Dialoge =====
/** @typedef {{ id: number, text: string, action?: { label: string, run: () => void } }} Toast */
/** @type {import('@preact/signals').Signal<Toast[]>} */
export const toasts = signal([]);
let toastId = 0;

/** Kurze Meldung unten. @param {string} text @param {Toast['action']} [action] */
export function toast(text, action) {
  const t = { id: ++toastId, text, action };
  toasts.value = [...toasts.value, t];
  setTimeout(() => { toasts.value = toasts.value.filter(x => x.id !== t.id); }, action ? 6000 : 3500);
}

/** Geöffneter Dialog: Funktion, die den Inhalt zeichnet. @type {import('@preact/signals').Signal<null | (() => import('preact').JSX.Element)>} */
export const dialog = signal(null);

/** @param {() => import('preact').JSX.Element} content */
export function openDialog(content) {
  commitEdit();
  dialog.value = content;
}

export function closeDialog() {
  dialog.value = null;
}

// ===== Einstellungen der Oberfläche =====
export const prefs = signal(Store.loadPrefs());

/** @param {Partial<import('../storage.js').Prefs>} patch */
export function setPrefs(patch) {
  prefs.value = { ...prefs.value, ...patch };
  Store.savePrefs(prefs.value);
}
