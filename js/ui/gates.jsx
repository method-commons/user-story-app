/*
 * Statuswechsel mit Prüfung: Wer eine Story nach „Bereit“ (oder weiter) schiebt, sieht die
 * offenen Punkte der Definition of Ready; nach „Fertig“ die der Definition of Done.
 * Eigene Punkte lassen sich direkt im Dialog abhaken; verschieben geht trotzdem.
 */
import { Invest } from '../invest.js';
import { Model } from '../model.js';
import { Ops } from '../ops.js';
import { Texts } from '../texts.js';
import { Dialog, fill } from './components.jsx';
import { closeDialog, go, mutate, openDialog, toast, useProject } from './core.js';

/** Text eines Prüfpunkts. @param {'ready' | 'done'} gate @param {CheckItem} item */
export function checkText(gate, item) {
  if (!item.auto) return item.text || Texts.ui.unnamed;
  return gate === 'ready' ? Texts.dor[/** @type {keyof typeof Texts.dor} */ (item.id)] : Texts.dod[/** @type {keyof typeof Texts.dod} */ (item.id)];
}

/** Offene Punkte je Prüfung. @param {Project} p @param {Story} s @param {('ready' | 'done')[]} gates */
function openItems(p, s, gates) {
  return gates.map(g => ({ gate: g, items: Invest.missing(g === 'ready' ? Invest.ready(p, s) : Invest.done(p, s)) })).filter(x => x.items.length);
}

/**
 * Status ändern; bei offenen Punkten erst nachfragen.
 * @param {Project} p @param {string} id @param {StoryStatus} to
 */
export function requestStatus(p, id, to) {
  const s = Ops.find(p, id);
  if (!s || s.status === to) return;
  const gates = Invest.gatesFor(s.status, to);
  if (!openItems(p, s, gates).length) {
    mutate(pp => Ops.setStatus(pp, id, to));
    return;
  }
  openDialog(() => <GateDialog id={id} to={to} gates={gates} />);
}

/** @param {{ id: string, to: StoryStatus, gates: ('ready' | 'done')[] }} props */
function GateDialog({ id, to, gates }) {
  const p = useProject();
  const s = Ops.find(p, id);
  if (!s) return <></>;
  const groups = openItems(p, s, gates);
  const move = () => {
    closeDialog();
    mutate(pp => Ops.setStatus(pp, id, to));
    if (groups.length) toast(fill(Texts.gate.movedAnyway, { code: Model.code(p, s), status: Texts.status[to] }));
  };
  return (
    <Dialog title={fill(Texts.gate.title, { code: Model.code(p, s), status: Texts.status[to] })} id="gateDialog">
      <div class="dialog-body">
        {groups.length ? <p class="sub">{Texts.gate.intro}</p> : <p class="hint good">✓ {Texts.gate.allDone}</p>}
        {groups.map(g => (
          <div key={g.gate} class="gate-group">
            <h3>{g.gate === 'ready' ? Texts.dor.title : Texts.dod.title}</h3>
            {g.items.map(item => (
              <label class="check-row" key={item.id}>
                {item.auto
                  ? <span class="check-auto bad" aria-hidden="true">✕</span>
                  : <input type="checkbox" checked={false} onChange={() => mutate(pp => {
                    const x = /** @type {Story} */ (Ops.find(pp, id));
                    (g.gate === 'ready' ? x.dor : x.dod)[item.id] = true;
                  })} />}
                <span>{checkText(g.gate, item)}{item.auto && <small class="sub"> · {Texts.gate.auto}</small>}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn ghost" onClick={() => { closeDialog(); go({ view: 'story', pid: p.id, sid: id, tab: 'card' }); }}>{Texts.gate.openStory}</button>
        <span class="spacer" />
        <button type="button" class="btn" onClick={closeDialog}>{Texts.ui.cancel}</button>
        <button type="button" class={`btn ${groups.length ? '' : 'primary'}`} id="gateMove" onClick={move}>{groups.length ? Texts.gate.moveAnyway : Texts.gate.move}</button>
      </div>
    </Dialog>
  );
}
