/*
 * Kleine, wiederverwendbare Bausteine der Oberfläche: Chips, INVEST-Leiste, Dialog,
 * Bestätigungsdialog, Herunterladen und Datei öffnen.
 */
import { useEffect, useRef } from 'preact/hooks';
import { Invest } from '../invest.js';
import { Model } from '../model.js';
import { Texts } from '../texts.js';
import { Util } from '../util.js';
import { closeDialog, openDialog } from './core.js';

/** INVEST-Leiste: sechs Kästchen, Farbe nach Zustand. @param {{ p: Project, s: Story }} props */
export function InvestBar({ p, s }) {
  const r = Invest.check(p, s);
  const label = Model.LETTERS.map(l => `${Texts.invest.letters[l].name}: ${Texts.invest.state[r[l].state]}`).join(' · ');
  return (
    <span class="invest" role="img" aria-label={`INVEST – ${label}`} title={label}>
      {Model.LETTERS.map(l => <i key={l} class={`inv-${r[l].state}`} data-letter={l}>{l}</i>)}
    </span>
  );
}

/** @param {{ priority: Priority | null, short?: boolean }} props */
export function PriorityChip({ priority, short }) {
  if (!priority) return <span class="chip muted">{short ? '–' : Texts.priority.none}</span>;
  return <span class={`chip prio-${priority}`} title={Texts.priority[priority]}>{short ? Texts.priority.short[priority] : Texts.priority[priority]}</span>;
}

/** @param {{ status: StoryStatus }} props */
export function StatusChip({ status }) {
  return <span class={`chip status-${status}`}>{Texts.status[status]}</span>;
}

/** @param {{ size: string | null, warn?: boolean }} props */
export function SizeBadge({ size, warn }) {
  return <span class={`size${warn ? ' bad' : ''}`} title={Texts.fields.size}>{size ?? '–'}</span>;
}

/** Fortschritt nach Status als gestapelter Balken. @param {{ counts: Record<StoryStatus, number>, total: number }} props */
export function StatusBar({ counts, total }) {
  return (
    <div class="progress" role="img" aria-label={Model.STATUSES.map(st => `${Texts.status[st]} ${counts[st]}`).join(', ')}>
      {[...Model.STATUSES].reverse().map(st => counts[st] ? <span key={st} class={`bar-${st}`} style={{ width: `${counts[st] / total * 100}%` }} /> : null)}
    </div>
  );
}

/**
 * Dialog über der Seite. Escape und Klick auf den Hintergrund schließen; der Fokus landet
 * im ersten Eingabefeld bzw. Knopf.
 * @param {{ title: string, children: any, wide?: boolean, id?: string, onClose?: () => void }} props
 */
export function Dialog({ title, children, wide, id, onClose = closeDialog }) {
  const ref = useRef(/** @type {HTMLDivElement | null} */ (null));
  useEffect(() => {
    const prev = /** @type {HTMLElement | null} */ (document.activeElement);
    const el = ref.current;
    const first = /** @type {HTMLElement | null} */ (el && el.querySelector('[autofocus], input:not([type=checkbox]):not([type=radio]), textarea, select, .dialog-body button, .dialog-foot button'));
    if (first) first.focus();
    else if (el) el.focus();
    return () => { if (prev && document.contains(prev)) prev.focus(); };
  }, []);
  // Escape schließt auch, wenn der Fokus (noch) nicht im Dialog liegt
  useEffect(() => {
    /** @param {KeyboardEvent} e */
    const esc = e => { if (e.key === 'Escape' && !(ref.current && ref.current.contains(/** @type {Node} */ (e.target)))) onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  /** @param {KeyboardEvent} e */
  const onKey = e => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    if (e.key === 'Tab' && ref.current) {
      const items = [...ref.current.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')].filter(x => !(/** @type {HTMLButtonElement} */ (x).disabled));
      const first = /** @type {HTMLElement} */ (items[0]);
      const last = /** @type {HTMLElement} */ (items[items.length - 1]);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  return (
    <div class="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div class={`dialog${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} id={id} ref={ref} tabIndex={-1} onKeyDown={onKey}>
        <div class="dialog-head">
          <h2>{title}</h2>
          <button type="button" class="icon-btn" aria-label={Texts.ui.close} title={Texts.ui.close} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Rückfrage mit „Abbrechen“ und einer Aktion.
 * @param {{ title: string, text: string, ok: string, danger?: boolean, onOk: () => void }} opts
 */
export function confirmDialog({ title, text, ok, danger, onOk }) {
  openDialog(() => (
    <Dialog title={title} id="confirmDialog">
      <div class="dialog-body"><p>{text}</p></div>
      <div class="dialog-foot">
        <button type="button" class="btn" onClick={closeDialog}>{Texts.ui.cancel}</button>
        <button type="button" class={`btn ${danger ? 'danger' : 'primary'}`} id="confirmOk" onClick={() => { closeDialog(); onOk(); }}>{ok}</button>
      </div>
    </Dialog>
  ));
}

/** Text als Datei herunterladen. @param {string} text @param {string} name @param {string} type */
export function download(text, name, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Datei auswählen und als Text lesen. @param {string} accept @returns {Promise<string | null>} */
export function pickFile(accept) {
  // Ein verstecktes Feld für alle Aufrufe; der Wert wird zurückgesetzt, damit dieselbe Datei erneut geht
  let input = /** @type {HTMLInputElement | null} */ (document.getElementById('filePicker'));
  if (!input) {
    input = document.createElement('input');
    input.type = 'file';
    input.id = 'filePicker';
    input.hidden = true;
    document.body.appendChild(input);
  }
  const el = input;
  el.accept = accept;
  el.value = '';
  return new Promise(resolve => {
    el.onchange = async () => {
      const f = el.files && el.files[0];
      resolve(f ? await f.text() : null);
    };
    el.oncancel = () => resolve(null);
    el.click();
  });
}

/** Text mit Platzhaltern. @param {string} text @param {Record<string, string | number>} [params] */
export const fill = (text, params) => Util.fill(text, params);

/** Kreis mit Initialen. @param {{ name: string }} props */
export function Avatar({ name }) {
  const initials = name.split(/\s+/).map(w => (w.match(/\p{L}|\d/u) || [''])[0]).join('').slice(0, 2).toUpperCase() || '?';
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % Model.COLORS.length;
  return <span class="avatar" aria-hidden="true" style={{ background: name.trim() ? Model.COLORS[h] : '#868e96' }}>{initials}</span>;
}
