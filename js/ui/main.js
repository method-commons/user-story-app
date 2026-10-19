/*
 * Start der App: Sprache setzen, Route übernehmen, Ereignisse verdrahten, erstes Zeichnen.
 * Einstieg der App (in index.html als Modul eingebunden).
 */
import { Component, h, options, render as preactRender } from 'preact';
import { Model } from '../model.js';
import { Store } from '../storage.js';
import { Languages, Texts } from '../texts.js';
import { App } from './app.jsx';
import { applyRoute, commitEdit, dialog, flushSave, project, redo, render, replaceProject, route, setStorageFailedText, undo } from './core.js';

// Synchron neu zeichnen: Eingaben, Fokus und Tests sehen sofort den neuen Stand.
options.debounceRendering = cb => cb();

// @preact/signals überspringt Komponenten, die selbst ein Signal lesen, wenn ihre Props gleich
// bleiben. Das Projekt ist aber ein veränderliches Objekt – gleiche Props heißen nicht gleicher
// Inhalt. Daher wie in Preact üblich: jede Komponente zeichnet mit ihrer Elternkomponente neu.
delete (/** @type {any} */ (Component.prototype)).shouldComponentUpdate;

document.documentElement.lang = Languages.detect();
setStorageFailedText(Texts.ui.storageFailed);

window.addEventListener('hashchange', () => { commitEdit(); dialog.value = null; applyRoute(); window.scrollTo(0, 0); });

// Speichern beim Verlassen der Seite bzw. des Tabs
window.addEventListener('beforeunload', () => { commitEdit(); flushSave(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { commitEdit(); flushSave(); } });

// Änderungen aus einem anderen Browser-Tab übernehmen
window.addEventListener('storage', e => {
  const id = Store.docIdFromKey(e.key);
  if (!id) return;
  if (project && project.id === id) {
    if (!e.newValue) { applyRoute(); return; }
    const active = document.activeElement;
    if (active && /^(INPUT|TEXTAREA)$/.test(active.tagName)) return;
    try { replaceProject(Model.normalize(JSON.parse(e.newValue))); } catch (err) { /* beschädigt: ignorieren */ }
  } else if (route.value.view === 'home') {
    render();
  }
});

// Rückgängig/Wiederholen außerhalb von Textfeldern (dort gilt das Rückgängig des Browsers)
document.addEventListener('keydown', e => {
  const t = /** @type {HTMLElement} */ (e.target);
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !(/** @type {HTMLInputElement} */ (t).type === 'checkbox')) return;
  if (dialog.value) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
  else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
});

applyRoute();
preactRender(h(App, {}), /** @type {HTMLElement} */ (document.getElementById('app')));
