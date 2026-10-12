/*
 * Board zur Abarbeitung: Spalten nach Status (Entwurf → Bereit → In Arbeit → Review → Fertig).
 * Karten per Ziehen oder mit den Pfeil-Knöpfen verschieben; beim Wechsel nach „Bereit“ bzw.
 * „Fertig“ prüft die App Definition of Ready bzw. Done.
 */
import { useState } from 'preact/hooks';
import { Invest } from '../invest.js';
import { Model } from '../model.js';
import { Texts } from '../texts.js';
import { Util } from '../util.js';
import { InvestBar, PriorityChip, SizeBadge, fill } from './components.jsx';
import { useProject } from './core.js';
import { requestStatus } from './gates.jsx';

/** @param {{ p: Project, s: Story, drag: { id: string | null } }} props */
function Card({ p, s, drag }) {
  const idx = Model.STATUSES.indexOf(s.status);
  const r = Invest.check(p, s);
  const confirmed = s.criteria.filter(c => c.confirmed).length;
  const prev = Model.STATUSES[idx - 1];
  const next = Model.STATUSES[idx + 1];
  return (
    <div class={`tcard${s.status === 'done' ? ' done' : ''}`} draggable data-story={s.id}
      onDragStart={e => { drag.id = s.id; if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', s.id); } }}
      onDragEnd={() => { drag.id = null; }}>
      <div class="row">
        <span class="id">{Model.code(p, s)}</span>
        <span class="spacer" />
        {s.priority && <PriorityChip priority={s.priority} short />}
        <SizeBadge size={s.size} warn={r.S.state === 'bad'} />
      </div>
      <a class="t" href={`#/p/${p.id}/s/${s.id}`}>{Model.title(s)}</a>
      <div class="f">
        {s.status === 'draft' || s.status === 'ready'
          ? <InvestBar p={p} s={s} />
          : <>
            <span class="sub">{Texts.criteria.short} {confirmed}/{s.criteria.length}</span>
            <span class="mini-ac" aria-hidden="true">{s.criteria.map(c => <span key={c.id} class={c.confirmed ? 'on' : ''} />)}</span>
          </>}
        <span class="spacer" />
        <button type="button" class="icon-btn sm" disabled={!prev} aria-label={prev ? fill(Texts.board.moveTo, { code: Model.code(p, s), status: Texts.status[prev] }) : ''}
          onClick={() => prev && requestStatus(p, s.id, prev)}>‹</button>
        <button type="button" class="icon-btn sm" disabled={!next} aria-label={next ? fill(Texts.board.moveTo, { code: Model.code(p, s), status: Texts.status[next] }) : ''}
          data-next={s.id} onClick={() => next && requestStatus(p, s.id, next)}>›</button>
      </div>
    </div>
  );
}

export function Board() {
  const p = useProject();
  const [drag] = useState(() => ({ id: /** @type {string | null} */ (null) }));
  const [over, setOver] = useState(/** @type {StoryStatus | null} */ (null));
  const [q, setQ] = useState('');
  const [epic, setEpic] = useState('');
  const [priority, setPriority] = useState('');
  const list = p.stories.filter(s => (!epic || (s.epicId || 'none') === epic) && (!priority || s.priority === priority)
    && (!q || Util.fold(`${Model.code(p, s)} ${s.title} ${s.role} ${s.want} ${s.benefit}`).includes(Util.fold(q))));
  const done = p.stories.filter(s => s.status === 'done').length;
  return (
    <div class="page">
      <div class="toolbar">
        <input type="search" class="input search" id="boardSearch" placeholder={Texts.backlog.search} value={q} onInput={e => setQ(e.currentTarget.value)} aria-label={Texts.backlog.search} />
        {p.epics.length > 0 && <select class="input select" value={epic} onChange={e => setEpic(e.currentTarget.value)} aria-label={Texts.fields.epic}>
          <option value="">{Texts.backlog.allEpics}</option>
          {p.epics.map(e => <option key={e.id} value={e.id}>{e.name || Texts.epics.untitled}</option>)}
          <option value="none">{Texts.epics.none}</option>
        </select>}
        <select class="input select" value={priority} onChange={e => setPriority(e.currentTarget.value)} aria-label={Texts.fields.priority}>
          <option value="">{Texts.backlog.allPriorities}</option>
          {Model.PRIORITIES.map(x => <option key={x} value={x}>{Texts.priority[x]}</option>)}
        </select>
        <span class="spacer" />
        <span class="sub">{fill(Texts.board.accepted, { n: done, total: p.stories.length })}</span>
        <div class="progress medium"><span class="bar-done" style={{ width: `${p.stories.length ? done / p.stories.length * 100 : 0}%` }} /></div>
      </div>
      <div class="board" id="board">
        {Model.STATUSES.map(status => {
          const cards = list.filter(s => s.status === status);
          return (
            <section key={status} class={`col${over === status ? ' over' : ''}`} data-status={status} aria-label={Texts.status[status]}
              onDragOver={e => { if (drag.id) { e.preventDefault(); setOver(status); } }}
              onDragLeave={e => { if (!e.currentTarget.contains(/** @type {Node | null} */ (e.relatedTarget))) setOver(null); }}
              onDrop={e => { e.preventDefault(); setOver(null); const id = drag.id; drag.id = null; if (id) requestStatus(p, id, status); }}>
              <div class="col-head">{Texts.status[status]} <span class="n">{cards.length}</span></div>
              {status === 'ready' && <div class="gate dor">{Texts.board.gateReady}</div>}
              {status === 'done' && <div class="gate dod">{Texts.board.gateDone}</div>}
              {cards.map(s => <Card key={s.id} p={p} s={s} drag={drag} />)}
              {!cards.length && <div class="col-empty">{Texts.board.empty}</div>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
