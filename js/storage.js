/*
 * Store – Speicherung im Browser (localStorage). Jedes Projekt liegt unter einem eigenen
 * Schlüssel; dazu kommen Einstellungen der Oberfläche. Exportiert den Namensraum `Store`.
 */
import { Model } from './model.js';

/** @typedef {{ author: string, group: 'epic' | 'status' | 'none' }} Prefs */

export const Store = (() => {
  const PREFIX = 'user-stories:project:';
  const PREFS_KEY = 'user-stories:prefs';

  // Web Storage kann fehlen oder gesperrt sein (z. B. privates Fenster) – dann leere Werte.
  /** @param {string} key @returns {string | null} */
  function get(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  /** @param {string} key @param {string} value */
  function set(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }
  /** @param {string} key */
  function remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignorieren */ }
  }
  /** @returns {string[]} */
  function keys() {
    try { return Object.keys(localStorage); } catch (e) { return []; }
  }

  /** Projekt laden (normalisiert), `null` wenn nicht vorhanden oder beschädigt. @param {string} id @returns {Project | null} */
  function load(id) {
    const raw = get(PREFIX + id);
    if (!raw) return null;
    try { return Model.normalize(JSON.parse(raw)); } catch (e) { return null; }
  }

  /** Projekt speichern. @param {Project} p @returns {boolean} */
  function save(p) {
    return set(PREFIX + p.id, JSON.stringify(p));
  }

  /** @param {string} id */
  function removeProject(id) {
    remove(PREFIX + id);
  }

  /** Alle gespeicherten Projekte, zuletzt bearbeitete zuerst. @returns {Project[]} */
  function all() {
    return keys().filter(k => k.startsWith(PREFIX))
      .map(k => load(k.slice(PREFIX.length)))
      .filter(/** @returns {p is Project} */ p => p != null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  /** Ist der Speicherschlüssel der eines Projekts? Liefert die ID. @param {string | null} key */
  function projectIdOfKey(key) {
    return key && key.startsWith(PREFIX) ? key.slice(PREFIX.length) : null;
  }

  /** @type {Prefs} */
  const DEFAULT_PREFS = { author: '', group: 'epic' };

  /** @returns {Prefs} */
  function loadPrefs() {
    try {
      const raw = JSON.parse(get(PREFS_KEY) || '{}');
      return {
        author: typeof raw.author === 'string' ? raw.author : '',
        group: ['epic', 'status', 'none'].includes(raw.group) ? raw.group : 'epic',
      };
    } catch (e) { return { ...DEFAULT_PREFS }; }
  }

  /** @param {Prefs} prefs */
  function savePrefs(prefs) {
    set(PREFS_KEY, JSON.stringify(prefs));
  }

  return { PREFIX, load, save, removeProject, all, projectIdOfKey, loadPrefs, savePrefs, DEFAULT_PREFS };
})();
