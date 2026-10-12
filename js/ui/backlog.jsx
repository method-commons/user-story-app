/*
 * Backlog eines Projekts: Stories in Reihenfolge der Priorisierung, gruppiert nach Epic oder
 * Status, mit Filtern, Schnelleingabe im Standardformat und Kennzahlen zur Qualität.
 */
import { useState } from 'preact/hooks';
import { Invest } from '../invest.js';
import { Model } from '../model.js';
import { Ops } from '../ops.js';
import { Texts } from '../texts.js';
import { Util } from '../util.js';
import { InvestBar, PriorityChip, SizeBadge, StatusChip, fill } from './components.jsx';
import { go, mutate, prefs, project, setPrefs, toast, useProject } from './core.js';
import { openHelp } from './help.jsx';

/** Satz im Standardformat mit hervorgehobenen Teilen. @param {{ s: Story }} props */
export function Sentence({ s }) {
  const f = Texts.format;
  return (
    <>
      <span class="kw">{f.as}</span> <b>{s.role.trim() || <span class="missing">{f.rolePh}</span>}</b>{' '}
      <span class="kw">{f.want}</span> <b>{s.want.trim() || <span class="missing">{f.wantPh}</span>}</b>
      {s.benefit.trim()
        ? <>, <span class="kw">{f.so}</span> {s.benefit.trim()}</>
        : <> <span class="kw missing">– {f.so} …?</span></>}
    </>
  );
}

/**
 * Story aus der Schnelleingabe anlegen.
 * @param {string} text @param {string | null} epicId @returns {Story | null}
 */
function quickAdd(text, epicId) {
  const parts = Model.parseSentence(text);
  if (!parts.want) return null;
  return mutate(p => Ops.addStory(p, { ...parts, epicId }));
}

/** Neue, leere Story anlegen und im Editor öffnen. @param {string | null} [epicId] */
export function newStory(epicId = null) {
  const s = mutate(p => Ops.addStory(p, { epicId }));
  if (s && project) go({ view: 'story', pid: project.id, sid: s.id, tab: 'card' });
}

/** @typedef {{ q: string, status: string, priority: string, epic: string, problems: boolean }} Filter */

/** @param {Project} p @param {Story} s @param {Filter} f */
function matches(p, s, f) {
  if (f.status && s.status !== f.status) return false;
  if (f.priority && (s.priority || 'none') !== f.priority) return false;
  if (f.epic && (s.epicId || 'none') !== f.epic) return false;
  if (f.problems && !Invest.hasProblem(p, s)) return false;
  if (f.q) {
    const hay = Util.fold([Model.code(p, s), s.title, s.role, s.want, s.benefit, s.notes, ...s.criteria.map(c => `${c.title} ${c.given} ${c.when} ${c.then} ${c.text}`)].join(' '));
    if (!Util.fold(f.q).split(/\s+/).every(w => hay.includes(w))) return false;
  }
  return true;
}

/**
 * Zeile einer Story.
 * @param {{ p: Project, s: Story, visible: Story[], drag: { id: string | null }, onDrop: (target: Story, after: boolean) => void }} props
 */
function StoryRow({ p, s, visible, drag, onDrop }) {
  const [over, setOver] = useState(/** @type {'before' | 'after' | null} */ (null));
  const r = Invest.check(p, s);
  const i = visible.indexOf(s);
  return (
    <div
      class={`story-row${over ? ' drop-' + over : ''}`} data-story={s.id} draggable
      onDragStart={e => { drag.id = s.id; if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', s.id); } }}
      onDragEnd={() => { drag.id = null; }}
      onDragOver={e => {
        if (!drag.id || drag.id === s.id) return;
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        setOver(e.clientY > rect.top + rect.height / 2 ? 'after' : 'before');
      }}
      onDragLeave={() => setOver(null)}
      onDrop={e => { e.preventDefault(); const after = over === 'after'; setOver(null); onDrop(s, after); }}
    >
      <span class="grip" aria-hidden="true" title={Texts.backlog.dragHint}>⋮⋮</span>
      <span class="id">{Model.code(p, s)}</span>
      <a class="text" href={`#/p/${p.id}/s/${s.id}`} title={Model.sentence(s)}>
        <Sentence s={s} />
      </a>
      <InvestBar p={p} s={s} />
      <span class="cell-prio"><PriorityChip priority={s.priority} /></span>
      <span class="cell-status"><StatusChip status={s.status} /></span>
      <SizeBadge size={s.size} warn={r.S.state === 'bad'} />
      <span class="row-steps">
        <button type="button" class="icon-btn sm" aria-label={`${Model.code(p, s)} ${Texts.backlog.up}`} title={Texts.backlog.up} disabled={i <= 0}
          onClick={() => mutate(pp => Ops.stepStory(pp, s.id, -1, visible))}>↑</button>
        <button type="button" class="icon-btn sm" aria-label={`${Model.code(p, s)} ${Texts.backlog.down}`} title={Texts.backlog.down} disabled={i >= visible.length - 1}
          onClick={() => mutate(pp => Ops.stepStory(pp, s.id, 1, visible))}>↓</button>
      </span>
    </div>
  );
}

/** @param {{ p: Project, st: ReturnType<typeof Ops.stats>, setFilter: (f: Partial<Filter>) => void }} props */
function Side({ p, st, setFilter }) {
  const problems = p.stories.map(s => ({ s, r: Invest.check(p, s) }))
    .flatMap(({ s, r }) => Model.LETTERS.filter(l => r[l].state === 'bad').map(l => ({ s, l, r: r[l] })))
    .slice(0, 4);
  return (
    <aside class="side">
      <section class="card pad">
        <h3>{Texts.backlog.health}</h3>
        <div class="stat-row"><span>{Texts.backlog.total}</span><b>{st.count}</b></div>
        {st.points != null && <div class="stat-row"><span>{Texts.backlog.points}</span><b>{st.points}{st.unestimated ? <span class="sub"> · {fill(Texts.backlog.open, { n: st.unestimated })}</span> : null}</b></div>}
        {st.points == null && <div class="stat-row"><span>{Texts.backlog.unestimated}</span><b class={st.unestimated ? 'warn' : ''}>{st.unestimated}</b></div>}
        <div class="stat-row"><span>{Texts.backlog.ready}</span><b class="good">{st.readyCount}</b></div>
        <div class="stat-row"><span>{Texts.backlog.avgCriteria}</span><b>{st.avgCriteria.toLocaleString(Texts.locale, { maximumFractionDigits: 1 })}</b></div>
        <div class="stat-row"><span>{Texts.backlog.noBenefit}</span><b class={st.noBenefit ? 'warn' : ''}>{st.noBenefit}</b></div>
        <div class="stat-row"><span>{Texts.backlog.openQuestions}</span><b class={st.openQuestions ? 'warn' : ''}>{st.openQuestions}</b></div>
      </section>
      <section class="card pad" id="investSummary">
        <div class="row"><h3>{Texts.backlog.investTitle}</h3><span class="spacer" /><button type="button" class="link sm" onClick={() => openHelp('invest')}>{Texts.ui.whatIsThis}</button></div>
        {Model.LETTERS.map(l => (
          <div class="stat-row" key={l}>
            <span><b>{l}</b>{Texts.invest.letters[l].name.slice(1)}</span>
            <span class={st.count && st.letters[l] < st.count ? 'warn' : ''}>{st.letters[l]} / {st.count}</span>
          </div>
        ))}
        {problems.map(({ s, l, r }) => (
          <a key={s.id + l} class="hint warn" href={`#/p/${p.id}/s/${s.id}`}>
            <b>{Model.code(p, s)}</b> · {l}: {fill(Texts.invest.hints[r.hint], r.params)}
          </a>
        ))}
        {st.problems > 0 && <button type="button" class="link sm" onClick={() => setFilter({ problems: true })}>{fill(Texts.backlog.showProblems, { n: st.problems })}</button>}
      </section>
      <section class="card pad legend-card">
        <h3>{Texts.backlog.legend}</h3>
        <div class="legend">
          {/** @type {InvestState[]} */ (['ok', 'warn', 'bad', 'open']).map(k => (
            <span key={k}><span class="invest"><i class={`inv-${k}`}>{Texts.invest.stateSymbol[k]}</i></span> {Texts.invest.state[k]}</span>
          ))}
        </div>
      </section>
    </aside>
  );
}

export function Backlog() {
  const p = useProject();
  const [filter, setFilterState] = useState(/** @type {Filter} */ ({ q: '', status: '', priority: '', epic: '', problems: false }));
  const [quick, setQuick] = useState('');
  const [drag] = useState(() => ({ id: /** @type {string | null} */ (null) }));
  /** @param {Partial<Filter>} f */
  const setFilter = f => setFilterState({ ...filter, ...f });
  const group = prefs.value.group;
  const st = Ops.stats(p);
  const visible = p.stories.filter(s => matches(p, s, filter));
  const filtered = visible.length !== p.stories.length;

  /** @type {{ key: string, name: string, color?: string, stories: Story[], epicId?: string | null }[]} */
  let groups;
  if (group === 'epic') {
    groups = [...p.epics.map(e => ({ key: e.id, name: e.name || Texts.epics.untitled, color: e.color, epicId: /** @type {string | null} */ (e.id) })), { key: 'none', name: Texts.epics.none, epicId: null }]
      .map(g => ({ ...g, stories: visible.filter(s => s.epicId === g.epicId) }))
      .filter(g => g.stories.length || (g.epicId && !filtered));
  } else if (group === 'status') {
    groups = Model.STATUSES.map(s => ({ key: s, name: Texts.status[s], stories: visible.filter(x => x.status === s) })).filter(g => g.stories.length);
  } else {
    groups = [{ key: 'all', name: '', stories: visible }];
  }

  /** @param {Story} target @param {boolean} after @param {string | null | undefined} epicId */
  const dropOn = (target, after, epicId) => {
    const id = drag.id;
    drag.id = null;
    if (!id || id === target.id) return;
    mutate(pp => {
      const s = /** @type {Story} */ (Ops.find(pp, id));
      if (epicId !== undefined && s.epicId !== epicId) s.epicId = epicId;
      const from = pp.stories.indexOf(s);
      let to = pp.stories.indexOf(target) + (after ? 1 : 0);
      if (from < to) to--;
      Ops.moveStory(pp, id, to);
    });
  };

  /** @param {Event} e */
  const submitQuick = e => {
    e.preventDefault();
    const epicId = filter.epic && filter.epic !== 'none' ? filter.epic : null;
    const s = quickAdd(quick, epicId);
    if (!s) { toast(Texts.backlog.quickEmpty); return; }
    setQuick('');
    const parsed = s.role && s.benefit;
    toast(fill(parsed ? Texts.backlog.quickAdded : Texts.backlog.quickAddedPartial, { code: Model.code(p, s) }), { label: Texts.ui.open, run: () => go({ view: 'story', pid: p.id, sid: s.id, tab: 'card' }) });
  };

  return (
    <div class="page">
      <div class="toolbar">
        <input type="search" class="input search" id="search" placeholder={Texts.backlog.search} value={filter.q} onInput={e => setFilter({ q: e.currentTarget.value })} aria-label={Texts.backlog.search} />
        <select class="input select" id="filterStatus" value={filter.status} onChange={e => setFilter({ status: e.currentTarget.value })} aria-label={Texts.fields.status}>
          <option value="">{Texts.backlog.allStatus}</option>
          {Model.STATUSES.map(s => <option key={s} value={s}>{Texts.status[s]}</option>)}
        </select>
        <select class="input select" id="filterPriority" value={filter.priority} onChange={e => setFilter({ priority: e.currentTarget.value })} aria-label={Texts.fields.priority}>
          <option value="">{Texts.backlog.allPriorities}</option>
          {Model.PRIORITIES.map(s => <option key={s} value={s}>{Texts.priority[s]}</option>)}
          <option value="none">{Texts.priority.none}</option>
        </select>
        {p.epics.length > 0 && <select class="input select" id="filterEpic" value={filter.epic} onChange={e => setFilter({ epic: e.currentTarget.value })} aria-label={Texts.fields.epic}>
          <option value="">{Texts.backlog.allEpics}</option>
          {p.epics.map(e => <option key={e.id} value={e.id}>{e.name || Texts.epics.untitled}</option>)}
          <option value="none">{Texts.epics.none}</option>
        </select>}
        <button type="button" class={`chip toggle${filter.problems ? ' on warn' : ''}`} id="filterProblems" aria-pressed={filter.problems} onClick={() => setFilter({ problems: !filter.problems })}>
          ⚠ {fill(Texts.backlog.problems, { n: st.problems })}
        </button>
        <span class="spacer" />
        <span class="sub hide-narrow">{Texts.backlog.group}</span>
        <div class="seg" role="radiogroup" aria-label={Texts.backlog.group}>
          {/** @type {const} */ (['epic', 'status', 'none']).map(g => (
            <button type="button" key={g} role="radio" aria-checked={group === g} class={group === g ? 'on' : ''} onClick={() => setPrefs({ group: g })}>{Texts.backlog.groupBy[g]}</button>
          ))}
        </div>
        <button type="button" class="btn primary" id="newStoryBtn" onClick={() => newStory(filter.epic && filter.epic !== 'none' ? filter.epic : null)}>+ {Texts.backlog.newStory}</button>
      </div>

      <div class="layout">
        <div>
          <form class="quick card" onSubmit={submitQuick}>
            <span class="quick-icon" aria-hidden="true">✎</span>
            <input class="quick-input" id="quickAdd" value={quick} onInput={e => setQuick(e.currentTarget.value)} placeholder={Texts.backlog.quickPlaceholder} aria-label={Texts.backlog.quickLabel} />
            <button type="submit" class="btn sm">{Texts.backlog.quickAdd}</button>
          </form>

          {!p.stories.length && (
            <div class="card pad empty">
              <h2>{Texts.backlog.emptyTitle}</h2>
              <p>{Texts.backlog.emptyText}</p>
              <button type="button" class="link" onClick={() => openHelp('format')}>{Texts.backlog.emptyHelp}</button>
            </div>
          )}
          {p.stories.length > 0 && !visible.length && <div class="card pad empty"><p>{Texts.backlog.noMatch}</p></div>}

          <div id="storyList">
            {groups.map(g => (
              <section class="card group" key={g.key} data-group={g.key}>
                {g.name && <div class="group-head"
                  onDragOver={e => { if (drag.id && group === 'epic') e.preventDefault(); }}
                  onDrop={e => {
                    e.preventDefault();
                    const id = drag.id;
                    drag.id = null;
                    if (id && group === 'epic') mutate(pp => { const s = Ops.find(pp, id); if (s) s.epicId = g.epicId ?? null; });
                  }}>
                  {g.color && <span class="bar" style={{ background: g.color }} />}
                  <span class="group-name">{g.name}</span>
                  <span class="sub">· {(g.stories.length === 1 ? Texts.backlog.groupCountOne : fill(Texts.backlog.groupCount, { n: g.stories.length }))}{p.settings.sizeScale === 'points' ? ` · ${Model.pointSum(p, g.stories)} SP` : ''}</span>
                  <span class="spacer" />
                  {g.stories.length > 0 && <>
                    <div class="progress small"><span class="bar-done" style={{ width: `${g.stories.filter(s => s.status === 'done').length / g.stories.length * 100}%` }} /></div>
                    <span class="sub pct">{Math.round(g.stories.filter(s => s.status === 'done').length / g.stories.length * 100)} %</span>
                  </>}
                </div>}
                {g.stories.map(s => <StoryRow key={s.id} p={p} s={s} visible={g.stories} drag={drag} onDrop={(t, after) => dropOn(t, after, group === 'epic' ? g.epicId : undefined)} />)}
                {!g.stories.length && <div class="group-empty sub">{Texts.backlog.groupEmpty}</div>}
              </section>
            ))}
          </div>
        </div>
        <Side p={p} st={st} setFilter={setFilter} />
      </div>
    </div>
  );
}
