/*
 * Story aufteilen: Muster wählen (mit Erklärung), Teil-Stories im Standardformat erfassen,
 * Original wahlweise in ein Epic umwandeln.
 */
import { useState } from 'preact/hooks';
import { Model } from '../model.js';
import { Ops } from '../ops.js';
import { Texts } from '../texts.js';
import { Dialog, fill } from './components.jsx';
import { closeDialog, go, mutate, openDialog, toast, useProject } from './core.js';
import { Sentence } from './backlog.jsx';

const PATTERNS = /** @type {const} */ (['workflow', 'rules', 'data', 'simple', 'happy', 'roles', 'spike']);

/** @param {string} id */
export function openSplit(id) {
  openDialog(() => <SplitDialog id={id} />);
}

/** @param {{ id: string }} props */
function SplitDialog({ id }) {
  const p = useProject();
  const s = Ops.find(p, id);
  const [pattern, setPattern] = useState(/** @type {typeof PATTERNS[number]} */ ('workflow'));
  const blank = () => ({ role: s ? s.role : '', want: '', benefit: s ? s.benefit : '', size: /** @type {string | null} */ (null) });
  const [parts, setParts] = useState(() => [blank(), blank()]);
  const [asEpic, setAsEpic] = useState(true);
  if (!s) return <></>;
  const filled = parts.filter(x => x.want.trim()).length;
  /** @param {number} i @param {Partial<typeof parts[number]>} patch */
  const set = (i, patch) => setParts(parts.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const create = () => {
    const code = Model.code(p, s);
    const created = mutate(pp => Ops.splitStory(pp, id, parts, asEpic));
    closeDialog();
    if (created && created.length) {
      toast(fill(asEpic ? Texts.split.doneEpic : Texts.split.done, { n: created.length, code }));
      go({ view: 'project', pid: p.id, tab: 'backlog' });
    }
  };
  return (
    <Dialog title={fill(Texts.split.title, { code: Model.code(p, s) })} wide id="splitDialog">
      <div class="dialog-body">
        <div class="preview small"><Sentence s={s} /></div>
        <div class="split-patterns">
          <span class="label">{Texts.split.pattern}</span>
          <div class="seg wrap" role="radiogroup" aria-label={Texts.split.pattern}>
            {PATTERNS.map(x => <button type="button" key={x} role="radio" aria-checked={pattern === x} class={pattern === x ? 'on' : ''} onClick={() => setPattern(x)}>{Texts.split.patterns[x].name}</button>)}
          </div>
          <p class="hint tip"><span aria-hidden="true">💡</span><span>{Texts.split.patterns[pattern].help} <i>{Texts.split.patterns[pattern].example}</i></span></p>
        </div>
        <div class="split-parts">
          {parts.map((x, i) => (
            <div class="card part" key={i} data-part={i}>
              <div class="row"><span class="id">{fill(Texts.split.part, { n: i + 1 })}</span><span class="spacer" />
                {parts.length > 1 && <button type="button" class="icon-btn sm" aria-label={Texts.ui.delete} onClick={() => setParts(parts.filter((_, j) => j !== i))}>✕</button>}
              </div>
              <div class="fmt compact">
                <label for={`sp${i}r`}>{Texts.format.as}</label>
                <input class="input" id={`sp${i}r`} value={x.role} onInput={e => set(i, { role: e.currentTarget.value })} />
                <label for={`sp${i}w`}>{Texts.format.want}</label>
                <input class="input" id={`sp${i}w`} value={x.want} placeholder={Texts.format.wantPlaceholder} onInput={e => set(i, { want: e.currentTarget.value })} />
                <label for={`sp${i}b`}>{Texts.format.so}</label>
                <input class="input" id={`sp${i}b`} value={x.benefit} onInput={e => set(i, { benefit: e.currentTarget.value })} />
                <label for={`sp${i}s`}>{Texts.fields.size}</label>
                <select class="input select" id={`sp${i}s`} value={x.size || ''} onChange={e => set(i, { size: e.currentTarget.value || null })}>
                  <option value="">–</option>
                  {[...Model.sizes(p), '?'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
          ))}
          <button type="button" class="card part add" id="splitAddPart" onClick={() => setParts([...parts, blank()])}>+ {Texts.split.addPart}</button>
        </div>
        <label class="check-inline">
          <input type="checkbox" id="splitAsEpic" checked={asEpic} onChange={() => setAsEpic(!asEpic)} />
          {Texts.split.asEpic}
        </label>
        <small class="help-text">{asEpic ? Texts.split.asEpicHelp : Texts.split.keepHelp}</small>
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn" onClick={closeDialog}>{Texts.ui.cancel}</button>
        <button type="button" class="btn primary" id="splitCreate" disabled={!filled} onClick={create}>{fill(Texts.split.create, { n: filled })}</button>
      </div>
    </Dialog>
  );
}
