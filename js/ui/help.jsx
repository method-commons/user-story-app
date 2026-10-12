/*
 * Methodik-Hilfe: kurze Erklärungen zu Standardformat, 3Cs, INVEST, Akzeptanzkriterien,
 * Definition of Ready/Done, Aufteilen und Ablauf – als Dialog mit Reitern.
 */
import { useState } from 'preact/hooks';
import { Model } from '../model.js';
import { Texts } from '../texts.js';
import { Dialog } from './components.jsx';
import { openDialog } from './core.js';

/** @typedef {keyof typeof Texts.help.sections} HelpSection */
const ORDER = /** @type {HelpSection[]} */ (['format', 'threec', 'invest', 'criteria', 'ready', 'split', 'workflow', 'app']);

/** @param {HelpSection} [section] */
export function openHelp(section = 'format') {
  openDialog(() => <Help initial={section} />);
}

/** @param {{ initial: HelpSection }} props */
function Help({ initial }) {
  const [sec, setSec] = useState(initial);
  const h = Texts.help.sections[sec];
  return (
    <Dialog title={Texts.help.title} wide id="helpDialog">
      <div class="help">
        <nav class="help-nav" role="tablist" aria-label={Texts.help.title}>
          {ORDER.map(k => (
            <button type="button" role="tab" key={k} aria-selected={sec === k} class={sec === k ? 'on' : ''} data-help={k} onClick={() => setSec(k)}>
              {Texts.help.sections[k].title}
            </button>
          ))}
        </nav>
        <div class="help-body" role="tabpanel">
          <h2>{h.title}</h2>
          {h.paras.map((x, i) => <p key={i}>{x}</p>)}
          {sec === 'invest' && (
            <dl class="invest-help">
              {Model.LETTERS.map(l => (
                <div key={l}>
                  <dt><span class="inv-letter">{l}</span>{Texts.invest.letters[l].name} <small class="sub">– {Texts.invest.letters[l].short}</small></dt>
                  <dd>{Texts.invest.letters[l].help}</dd>
                </div>
              ))}
            </dl>
          )}
          {h.list.length > 0 && <ul>{h.list.map((x, i) => <li key={i}>{x}</li>)}</ul>}
          {h.example && <div class="preview small">{h.example}</div>}
        </div>
      </div>
    </Dialog>
  );
}
