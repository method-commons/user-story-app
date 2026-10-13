/*
 * Story-Editor mit den 3Cs: Card (Standardformat und Eigenschaften), Conversation (Notizen,
 * Fragen, Entscheidungen) und Confirmation (Akzeptanzkriterien). Rechts: INVEST-Check,
 * Definition of Ready und Definition of Done.
 */
import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Invest } from '../invest.js';
import { Model } from '../model.js';
import { Ops } from '../ops.js';
import { Texts } from '../texts.js';
import { Sentence } from './backlog.jsx';
import { Avatar, PriorityChip, confirmDialog, fill } from './components.jsx';
import { fieldProps, go, mutate, prefs, setPrefs, toast, undo, useProject } from './core.js';
import { checkText, requestStatus } from './gates.jsx';
import { openHelp } from './help.jsx';
import { openSplit } from './split.jsx';

/** Passender Tipp zum Standardformat. @param {Project} p @param {Story} s */
function formatTip(p, s) {
  const r = Invest.auto(p, s);
  const T = Texts.tips;
  if (!s.role.trim()) return { cls: '', text: T.role };
  if (Invest.genericRole(s.role)) return { cls: 'warn', text: fill(T.genericRole, { role: s.role.trim() }) };
  if (!s.want.trim()) return { cls: '', text: T.want };
  if (!s.benefit.trim()) return { cls: 'warn', text: T.benefit };
  if (r.N.hint === 'tech') return { cls: 'warn', text: fill(T.tech, r.N.params) };
  if (r.S.hint === 'manyParts') return { cls: 'warn', text: T.manyParts };
  return { cls: 'good', text: T.good };
}

/** @param {{ p: Project, s: Story }} props */
function CardTab({ p, s }) {
  const roles = [...new Set(p.stories.map(x => x.role.trim()).filter(Boolean))].sort();
  const tip = formatTip(p, s);
  const candidates = p.stories.filter(x => x.id !== s.id && !s.dependsOn.includes(x.id) && !Ops.reaches(p, x.id, s.id));
  const r = Invest.check(p, s);
  return (
    <div class="tab-body" id="cardTab">
      <div class="fmt">
        <label for="fRole">{Texts.format.as}</label>
        <input class="input" id="fRole" list="roleList" placeholder={Texts.format.rolePlaceholder} {...fieldProps(() => s.role, v => { s.role = v; })} />
        <datalist id="roleList">{roles.map(x => <option key={x} value={x} />)}</datalist>
        <label for="fWant">{Texts.format.want}</label>
        <textarea class="input" rows={1} id="fWant" placeholder={Texts.format.wantPlaceholder} {...fieldProps(() => s.want, v => { s.want = v; })} />
        <label for="fBenefit">{Texts.format.so}</label>
        <textarea class="input" rows={1} id="fBenefit" placeholder={Texts.format.benefitPlaceholder} {...fieldProps(() => s.benefit, v => { s.benefit = v; })} />
      </div>
      <div class="preview" id="preview" aria-live="polite"><Sentence s={s} /></div>
      <div class={`hint tip ${tip.cls}`} id="formatTip">
        <span aria-hidden="true">💡</span>
        <span>{tip.text} <button type="button" class="link" onClick={() => openHelp('format')}>{Texts.tips.more}</button></span>
      </div>

      <div class="props">
        <div class="prop prop-size">
          <span class="label" id="sizeLabel">{Texts.fields.size} <small class="sub">({Texts.scale[p.settings.sizeScale].name})</small></span>
          <div class="size-picker" role="radiogroup" aria-labelledby="sizeLabel">
            {[...Model.sizes(p), '?'].map(v => (
              <button type="button" key={v} role="radio" aria-checked={s.size === v} class={`size-btn${s.size === v ? ' on' : ''}${Invest.sizeRank(p, v) > Invest.sizeRank(p, p.settings.smallLimit) ? ' big' : ''}`}
                data-size={v} onClick={() => mutate(() => { s.size = s.size === v ? null : v; })}>{v}</button>
            ))}
          </div>
        </div>
        <div class="prop">
          <label class="label" for="fPriority">{Texts.fields.priority}</label>
          <select class="input select" id="fPriority" value={s.priority || ''} onChange={e => { const v = e.currentTarget.value; mutate(() => { s.priority = v ? /** @type {Priority} */ (v) : null; }); }}>
            <option value="">{Texts.priority.none}</option>
            {Model.PRIORITIES.map(x => <option key={x} value={x}>{Texts.priority[x]}</option>)}
          </select>
        </div>
        <div class="prop">
          <label class="label" for="fEpic">{Texts.fields.epic}</label>
          <select class="input select" id="fEpic" value={s.epicId || ''} onChange={e => { const v = e.currentTarget.value; mutate(() => { s.epicId = v || null; }); }}>
            <option value="">{Texts.epics.none}</option>
            {p.epics.map(x => <option key={x.id} value={x.id}>{x.name || Texts.epics.untitled}</option>)}
          </select>
        </div>
      </div>

      <div class="prop-block">
        <span class="label">{Texts.fields.dependsOn}</span>
        <div class="chips" id="deps">
          {s.dependsOn.map(d => {
            const x = Ops.find(p, d);
            if (!x) return null;
            return (
              <span class={`chip dep${x.status === 'done' ? ' good' : ''}`} key={d}>
                <a href={`#/p/${p.id}/s/${x.id}`}><b class="id">{Model.code(p, x)}</b> {Model.title(x)}</a>
                <button type="button" class="chip-x" aria-label={fill(Texts.story.removeDep, { code: Model.code(p, x) })} onClick={() => mutate(pp => Ops.removeDependency(pp, s.id, d))}>✕</button>
              </span>
            );
          })}
          {candidates.length > 0 && (
            <select class="input select sm" id="addDep" value="" aria-label={Texts.story.addDep} onChange={e => { const v = e.currentTarget.value; if (v) mutate(pp => Ops.addDependency(pp, s.id, v)); }}>
              <option value="">+ {Texts.story.addDep}</option>
              {candidates.map(x => <option key={x.id} value={x.id}>{Model.code(p, x)} · {Model.title(x)}</option>)}
            </select>
          )}
        </div>
        {r.I.state === 'warn' && <small class="help-text">{Texts.story.depHint}</small>}
      </div>

      <div class="prop-block">
        <label class="label" for="fNotes">{Texts.fields.notes}</label>
        <textarea class="input notes" id="fNotes" rows={3} placeholder={Texts.story.notesPlaceholder} {...fieldProps(() => s.notes, v => { s.notes = v; })} />
      </div>
    </div>
  );
}

/** @param {{ p: Project, s: Story }} props */
function ConversationTab({ p, s }) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState(/** @type {ConversationKind} */ ('note'));
  const author = prefs.value.author;
  const add = () => {
    if (!text.trim()) return;
    mutate(() => { s.conversation.push(Model.createEntry({ kind, author: author.trim(), text: text.trim() })); });
    setText('');
  };
  return (
    <div class="tab-body" id="conversationTab">
      <p class="sub intro-line">{Texts.conversation.intro}</p>
      {!s.conversation.length && <p class="empty-line">{Texts.conversation.empty}</p>}
      {s.conversation.map(e => {
        const ci = e.criterionId ? s.criteria.findIndex(c => c.id === e.criterionId) : -1;
        return (
          <div class={`conv kind-${e.kind}${e.kind === 'question' && !e.resolved ? ' open' : ''}`} key={e.id} data-entry={e.id}>
            <Avatar name={e.author} />
            <div class="conv-main">
              <div class="conv-head">
                <b>{e.author || Texts.conversation.anonymous}</b>
                <span class={`chip kind kind-${e.kind}`}>{Texts.kind[e.kind]}</span>
                <small class="sub">{new Date(e.date + 'T12:00:00').toLocaleDateString(Texts.locale)}</small>
                <span class="spacer" />
                <button type="button" class="icon-btn sm" aria-label={Texts.ui.delete} title={Texts.ui.delete}
                  onClick={() => mutate(() => { s.conversation = s.conversation.filter(x => x.id !== e.id); })}>✕</button>
              </div>
              <textarea class="input bare" rows={1} aria-label={Texts.conversation.text} {...fieldProps(() => e.text, v => { e.text = v; })} />
              <div class="conv-actions">
                {e.kind === 'question' && (
                  <label class="check-inline">
                    <input type="checkbox" checked={e.resolved} onChange={() => mutate(() => { e.resolved = !e.resolved; })} />
                    {Texts.conversation.resolved}
                  </label>
                )}
                {e.kind === 'decision' && (ci >= 0
                  ? <a class="chip good" href={`#/p/${p.id}/s/${s.id}/confirmation`}>→ {Texts.criteria.short} {ci + 1}</a>
                  : <button type="button" class="btn sm" data-to-criterion={e.id} onClick={() => { mutate(() => Ops.criterionFromEntry(s, e.id)); toast(Texts.conversation.adopted); }}>{Texts.conversation.toCriterion}</button>)}
              </div>
            </div>
          </div>
        );
      })}
      <div class="conv-new card">
        <div class="row wrap">
          <input class="input author" id="convAuthor" placeholder={Texts.conversation.author} value={author} onInput={e => setPrefs({ author: e.currentTarget.value })} aria-label={Texts.conversation.author} />
          <div class="seg" role="radiogroup" aria-label={Texts.conversation.kind}>
            {Model.KINDS.map(k => <button type="button" key={k} role="radio" aria-checked={kind === k} class={kind === k ? 'on' : ''} data-kind={k} onClick={() => setKind(k)}>{Texts.kind[k]}</button>)}
          </div>
        </div>
        <textarea class="input" id="convText" rows={2} placeholder={Texts.conversation.placeholder[kind]} value={text}
          onInput={e => setText(e.currentTarget.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); add(); } }} />
        <div class="row">
          <small class="sub">{Texts.conversation.tip}</small>
          <span class="spacer" />
          <button type="button" class="btn primary sm" id="convAdd" disabled={!text.trim()} onClick={add}>{Texts.conversation.add}</button>
        </div>
      </div>
    </div>
  );
}

/** @param {{ p: Project, s: Story }} props */
function ConfirmationTab({ p, s }) {
  const r = Invest.auto(p, s);
  /** @param {'gwt' | 'check'} format */
  const add = format => mutate(() => { s.criteria.push(Model.createCriterion({ format })); });
  return (
    <div class="tab-body" id="confirmationTab">
      <p class="sub intro-line">{Texts.criteria.intro} <button type="button" class="link" onClick={() => openHelp('criteria')}>{Texts.tips.more}</button></p>
      {s.criteria.map((c, i) => {
        const complete = Invest.criterionComplete(c);
        return (
          <div class={`ac${complete ? '' : ' incomplete'}${c.confirmed ? ' confirmed' : ''}`} key={c.id} data-criterion={c.id}>
            <div class="ac-head">
              <input type="checkbox" class="ac-check" checked={c.confirmed} aria-label={fill(Texts.criteria.confirm, { n: i + 1 })} title={Texts.criteria.confirmHint}
                onChange={() => mutate(() => { c.confirmed = !c.confirmed; })} />
              <b class="ac-num">{Texts.criteria.short} {i + 1}</b>
              <input class="input bare ac-title" placeholder={Texts.criteria.titlePlaceholder} aria-label={fill(Texts.criteria.titleLabel, { n: i + 1 })} {...fieldProps(() => c.title, v => { c.title = v; })} />
              {!complete && <span class="chip warn">{c.format === 'gwt' ? Texts.criteria.incompleteGwt : Texts.criteria.incompleteCheck}</span>}
              <div class="seg mini" role="radiogroup" aria-label={Texts.criteria.format}>
                {/** @type {const} */ (['gwt', 'check']).map(f => <button type="button" key={f} role="radio" aria-checked={c.format === f} class={c.format === f ? 'on' : ''}
                  onClick={() => mutate(() => {
                    if (c.format === f) return;
                    // Inhalt beim Umschalten mitnehmen
                    if (f === 'check' && !c.text.trim()) c.text = [c.given, c.when, c.then].filter(x => x.trim()).join(' – ');
                    if (f === 'gwt' && !c.given && !c.when && !c.then && c.text.trim()) c.then = c.text;
                    c.format = f;
                  })}>{Texts.criteria.formats[f]}</button>)}
              </div>
              <button type="button" class="icon-btn sm" aria-label={Texts.backlog.up} disabled={i === 0} onClick={() => mutate(() => Ops.step(s.criteria, i, -1))}>↑</button>
              <button type="button" class="icon-btn sm" aria-label={Texts.backlog.down} disabled={i === s.criteria.length - 1} onClick={() => mutate(() => Ops.step(s.criteria, i, 1))}>↓</button>
              <button type="button" class="icon-btn sm" aria-label={Texts.ui.delete} title={Texts.ui.delete} onClick={() => mutate(() => Ops.deleteCriterion(s, c.id))}>✕</button>
            </div>
            {c.format === 'gwt' ? (
              <div class="ac-body">
                {/** @type {const} */ (['given', 'when', 'then']).map(k => <Fragment key={k}>
                  <label class={`gwt-label${c[k].trim() ? '' : ' missing'}`} for={`${c.id}-${k}`}>{Texts.criteria[k]}</label>
                  <textarea rows={1} class="input" id={`${c.id}-${k}`} placeholder={Texts.criteria.placeholders[k]} {...fieldProps(() => c[k], v => { c[k] = v; })} />
                </Fragment>)}
              </div>
            ) : (
              <div class="ac-body single">
                <textarea rows={1} class="input" id={`${c.id}-text`} aria-label={Texts.criteria.text} placeholder={Texts.criteria.placeholders.text} {...fieldProps(() => c.text, v => { c.text = v; })} />
              </div>
            )}
          </div>
        );
      })}
      <div class="row wrap">
        <button type="button" class="btn sm" id="addGwt" onClick={() => add('gwt')}>+ {Texts.criteria.addGwt}</button>
        <button type="button" class="btn sm" id="addCheck" onClick={() => add('check')}>+ {Texts.criteria.addCheck}</button>
      </div>
      {r.T.hint === 'vague' && <div class="hint warn">{fill(Texts.invest.hints.vague, r.T.params)} {Texts.criteria.vagueTip}</div>}
      <p class="sub small-print">{Texts.criteria.footer}</p>
    </div>
  );
}

/** @param {{ p: Project, s: Story }} props */
function InvestPanel({ p, s }) {
  const r = Invest.check(p, s);
  const score = Model.LETTERS.filter(l => r[l].state === 'ok').length;
  return (
    <section class="card pad" id="investPanel">
      <div class="score">
        <div class="ring" style={{ '--pct': `${score / 6 * 100}%` }}><b>{score}/6</b></div>
        <div>
          <b>{Texts.invest.title}</b>
          <div class="sub small">{Texts.invest.subtitle}</div>
        </div>
        <span class="spacer" />
        <button type="button" class="icon-btn" aria-label={Texts.ui.whatIsThis} title={Texts.ui.whatIsThis} onClick={() => openHelp('invest')}>?</button>
      </div>
      {Model.LETTERS.map(l => {
        const x = r[l];
        const canConfirm = x.auto === 'warn' || x.auto === 'none';
        return (
          <div class={`inv-item inv-${x.state}`} key={l} data-letter={l}>
            <span class="inv-letter">{l}</span>
            <div>
              <b>{Texts.invest.letters[l].name}</b> <small class="sub">{Texts.invest.letters[l].short}</small>
              <p>{fill(Texts.invest.hints[x.hint], x.params)}{x.confirmed && canConfirm ? ` ${Texts.invest.confirmedNote}` : ''}</p>
            </div>
            <input type="checkbox" class="inv-check" checked={x.state === 'ok'} disabled={!canConfirm}
              aria-label={fill(Texts.invest.confirm, { name: Texts.invest.letters[l].name })}
              title={canConfirm ? Texts.invest.confirmHint : x.auto === 'ok' ? Texts.invest.autoOk : Texts.invest.autoBad}
              onChange={() => mutate(() => { if (s.invest[l]) delete s.invest[l]; else s.invest[l] = true; })} />
          </div>
        );
      })}
      {(r.S.state === 'bad' || r.S.state === 'warn' || r.I.state === 'warn') && (
        <button type="button" class="btn sm split-btn" onClick={() => openSplit(s.id)}>✂ {Texts.split.button}</button>
      )}
    </section>
  );
}

/** @param {{ p: Project, s: Story, gate: 'ready' | 'done' }} props */
function ChecklistPanel({ p, s, gate }) {
  const items = gate === 'ready' ? Invest.ready(p, s) : Invest.done(p, s);
  const open = Invest.missing(items).length;
  return (
    <section class={`card pad checklist${gate === 'done' && Model.STATUSES.indexOf(s.status) < 2 ? ' later' : ''}`} id={gate === 'ready' ? 'dorPanel' : 'dodPanel'}>
      <div class="row">
        <h3>{gate === 'ready' ? Texts.dor.title : Texts.dod.title}</h3>
        <span class="spacer" />
        <span class={`chip ${open ? '' : 'good'}`}>{items.length - open}/{items.length}</span>
      </div>
      {items.map(item => (
        <label class="check-row" key={item.id} data-check={item.id}>
          {item.auto
            ? <span class={`check-auto ${item.done ? 'ok' : 'bad'}`} aria-hidden="true">{item.done ? '✓' : '✕'}</span>
            : <input type="checkbox" checked={item.done} onChange={() => mutate(() => {
              const map = gate === 'ready' ? s.dor : s.dod;
              if (map[item.id]) delete map[item.id]; else map[item.id] = true;
            })} />}
          <span class={item.auto ? 'auto-text' : ''}>{checkText(gate, item)}</span>
        </label>
      ))}
      <a class="sub small" href={`#/p/${p.id}/settings`}>{Texts.dor.customize}</a>
    </section>
  );
}

/** @param {{ sid: string, tab: 'card' | 'conversation' | 'confirmation' }} props */
export function StoryEditor({ sid, tab }) {
  const p = useProject();
  const s = Ops.find(p, sid);
  if (!s) return null;
  const i = p.stories.indexOf(s);
  const prev = p.stories[i - 1];
  const next = p.stories[i + 1];
  const epic = p.epics.find(e => e.id === s.epicId);
  const questions = s.conversation.filter(e => e.kind === 'question' && !e.resolved).length;
  const confirmed = s.criteria.filter(c => c.confirmed).length;
  const remove = () => confirmDialog({
    title: Texts.story.deleteTitle, text: fill(Texts.story.deleteText, { code: Model.code(p, s) }), ok: Texts.ui.delete, danger: true,
    onOk: () => {
      mutate(pp => Ops.deleteStory(pp, s.id));
      go({ view: 'project', pid: p.id, tab: 'backlog' });
      toast(fill(Texts.story.deleted, { code: Model.code(p, s) }), { label: Texts.ui.undo, run: undo });
    },
  });
  const tabs = /** @type {const} */ ([
    ['card', '①', Texts.threec.card, ''],
    ['conversation', '②', Texts.threec.conversation, s.conversation.length ? `${s.conversation.length}${questions ? ` · ${questions}?` : ''}` : ''],
    ['confirmation', '③', Texts.threec.confirmation, s.criteria.length ? `${confirmed}/${s.criteria.length} ✓` : '0'],
  ]);
  return (
    <div class="page story-page">
      <div class="crumbs">
        <a href={`#/p/${p.id}/backlog`}>{Texts.nav.backlog}</a>
        {epic && <> › <span><span class="dot" style={{ background: epic.color }} />{epic.name || Texts.epics.untitled}</span></>}
        {' › '}<span class="id">{Model.code(p, s)}</span>
      </div>
      <div class="story-head">
        <input class="title-input" id="storyTitle" aria-label={Texts.fields.title} placeholder={Model.title({ ...s, title: '' })} {...fieldProps(() => s.title, v => { s.title = v; })} />
        <select class={`input select status-select status-${s.status}`} id="storyStatus" value={s.status} aria-label={Texts.fields.status}
          onChange={e => { const v = /** @type {StoryStatus} */ (e.currentTarget.value); e.currentTarget.value = s.status; requestStatus(p, s.id, v); }}>
          {Model.STATUSES.map(x => <option key={x} value={x}>{Texts.status[x]}</option>)}
        </select>
        <PriorityChip priority={s.priority} />
        <span class="spacer" />
        <div class="actions">
          <a class={`btn${prev ? '' : ' disabled'}`} id="prevStory" aria-disabled={!prev} href={prev ? `#/p/${p.id}/s/${prev.id}${tab === 'card' ? '' : '/' + tab}` : undefined}>‹ {prev ? Model.code(p, prev) : ''}</a>
          <a class={`btn${next ? '' : ' disabled'}`} id="nextStory" aria-disabled={!next} href={next ? `#/p/${p.id}/s/${next.id}${tab === 'card' ? '' : '/' + tab}` : undefined}>{next ? Model.code(p, next) : ''} ›</a>
          <button type="button" class="btn" id="splitBtn" onClick={() => openSplit(s.id)}>✂ {Texts.split.button}</button>
          <button type="button" class="btn" id="duplicateBtn" onClick={() => {
            const copy = mutate(pp => Ops.duplicateStory(pp, s.id));
            if (copy) { go({ view: 'story', pid: p.id, sid: copy.id, tab: 'card' }); toast(fill(Texts.story.duplicated, { code: Model.code(p, copy) })); }
          }}>{Texts.story.duplicate}</button>
          <button type="button" class="btn danger-text" id="deleteStoryBtn" onClick={remove}>{Texts.ui.delete}</button>
        </div>
      </div>
      <div class="editor">
        <div class="card">
          <nav class="threec" aria-label="3Cs">
            {tabs.map(([key, num, label, badge]) => (
              <a key={key} href={`#/p/${p.id}/s/${s.id}${key === 'card' ? '' : '/' + key}`} class={tab === key ? 'on' : ''} aria-current={tab === key ? 'page' : undefined} data-tab={key}>
                <span class="num" aria-hidden="true">{num}</span> {label}{badge && <em>{badge}</em>}
              </a>
            ))}
            <span class="spacer" />
            <button type="button" class="link sm threec-help" onClick={() => openHelp('threec')}>{Texts.threec.what}</button>
          </nav>
          {tab === 'card' && <CardTab p={p} s={s} />}
          {tab === 'conversation' && <ConversationTab p={p} s={s} />}
          {tab === 'confirmation' && <ConfirmationTab p={p} s={s} />}
        </div>
        <aside class="side">
          <InvestPanel p={p} s={s} />
          <ChecklistPanel p={p} s={s} gate="ready" />
          <ChecklistPanel p={p} s={s} gate="done" />
          <p class="sub small stamp">{fill(Texts.story.stamp, { created: new Date(s.createdAt).toLocaleDateString(Texts.locale), updated: new Date(s.updatedAt).toLocaleString(Texts.locale, { dateStyle: 'short', timeStyle: 'short' }) })}</p>
        </aside>
      </div>
    </div>
  );
}
