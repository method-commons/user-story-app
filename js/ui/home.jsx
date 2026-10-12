/*
 * Startseite: alle Projekte mit Kennzahlen, neues Projekt, Beispiel, Import und Sicherung.
 */
import { useState } from 'preact/hooks';
import { Examples } from '../examples.js';
import { IO } from '../io.js';
import { Model } from '../model.js';
import { Ops } from '../ops.js';
import { Store } from '../storage.js';
import { Texts } from '../texts.js';
import { Util } from '../util.js';
import { Dialog, StatusBar, confirmDialog, download, fill, pickFile } from './components.jsx';
import { closeDialog, go, openDialog, render, toast, useRevision } from './core.js';
import { openHelp } from './help.jsx';

/** Projekt speichern und öffnen. @param {Project} p */
function openNew(p) {
  Store.save(p);
  go({ view: 'project', pid: p.id, tab: 'backlog' });
}

export function openExample() {
  const p = Examples.load();
  openNew(p);
  toast(fill(Texts.home.exampleOpened, { name: p.name }));
}

export async function importFile() {
  const text = await pickFile('.json,application/json');
  if (text == null) return;
  let list;
  try { list = IO.parse(text); } catch (e) { toast(/** @type {Error} */ (e).message); return; }
  const counts = { new: 0, same: 0, copy: 0 };
  /** @type {Project | null} */
  let last = null;
  for (const p of list) {
    const r = IO.resolveImport(p, Store.load(p.id));
    counts[r.action]++;
    if (r.action !== 'same') Store.save(r.project);
    last = r.project;
  }
  toast(fill(Texts.home.imported, { n: counts.new + counts.copy, same: counts.same, copy: counts.copy }));
  if (list.length === 1 && last) go({ view: 'project', pid: last.id, tab: 'backlog' });
  else render();
}

function backup() {
  const list = Store.all();
  download(IO.backupJson(list), `user-stories-backup-${Util.today()}.json`, 'application/json');
}

export function newProjectDialog() {
  openDialog(() => <NewProject />);
}

function NewProject() {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [scale, setScale] = useState(/** @type {SizeScale} */ ('tshirt'));
  const shownKey = keyEdited ? key : (name.trim() ? Util.keyFromName(name) : '');
  /** @param {Event} e */
  const submit = e => {
    e.preventDefault();
    const p = Model.createProject({ name, key: shownKey, description, sizeScale: scale });
    closeDialog();
    openNew(p);
  };
  return (
    <Dialog title={Texts.home.newProject} id="newProjectDialog">
      <form onSubmit={submit}>
        <div class="dialog-body form-grid">
          <label for="npName">{Texts.project.name}</label>
          <input id="npName" class="input" value={name} placeholder={Texts.project.namePlaceholder} onInput={e => setName(e.currentTarget.value)} required />
          <label for="npKey">{Texts.project.key}</label>
          <div>
            <input id="npKey" class="input key-input" value={shownKey} maxLength={6} placeholder="FT" onInput={e => { const v = Util.sanitizeKey(e.currentTarget.value); setKeyEdited(true); setKey(v); }} />
            <small class="help-text">{Texts.project.keyHelp}</small>
          </div>
          <label for="npDesc">{Texts.project.description}</label>
          <textarea id="npDesc" class="input" rows={2} value={description} placeholder={Texts.project.descriptionPlaceholder} onInput={e => setDescription(e.currentTarget.value)} />
          <span class="label">{Texts.project.sizeScale}</span>
          <div class="radio-row" role="radiogroup" aria-label={Texts.project.sizeScale}>
            {/** @type {SizeScale[]} */ (['tshirt', 'points']).map(sc => (
              <label key={sc} class="radio">
                <input type="radio" name="npScale" value={sc} checked={scale === sc} onChange={() => setScale(sc)} />
                <span><b>{Texts.scale[sc].name}</b><small>{Texts.scale[sc].help}</small></span>
              </label>
            ))}
          </div>
        </div>
        <div class="dialog-foot">
          <button type="button" class="btn" onClick={closeDialog}>{Texts.ui.cancel}</button>
          <button type="submit" class="btn primary" id="npCreate">{Texts.home.create}</button>
        </div>
      </form>
    </Dialog>
  );
}

/** Wichtigster Hinweis zu einem Projekt. @param {ReturnType<typeof Ops.stats>} st */
function projectHint(st) {
  if (!st.count) return { cls: '', text: Texts.home.hintEmpty };
  if (st.readyNoCriteria) return { cls: 'warn', text: fill(Texts.home.hintNoCriteria, { n: st.readyNoCriteria }) };
  if (st.tooBig) return { cls: 'warn', text: fill(Texts.home.hintTooBig, { n: st.tooBig }) };
  if (st.noBenefit) return { cls: 'warn', text: fill(Texts.home.hintNoBenefit, { n: st.noBenefit }) };
  if (st.openQuestions) return { cls: 'warn', text: fill(Texts.home.hintQuestions, { n: st.openQuestions }) };
  if (st.compliant === st.count) return { cls: 'good', text: Texts.home.hintAllGood };
  return { cls: '', text: fill(Texts.home.hintProblems, { n: st.problems }) };
}

/** @param {{ p: Project }} props */
function ProjectCard({ p }) {
  const st = Ops.stats(p);
  const hint = projectHint(st);
  const remove = () => confirmDialog({
    title: Texts.home.deleteTitle, text: fill(Texts.home.deleteText, { name: p.name, n: st.count }), ok: Texts.ui.delete, danger: true,
    onOk: () => {
      const copy = JSON.stringify(p);
      Store.removeProject(p.id);
      render();
      toast(fill(Texts.home.deleted, { name: p.name }), { label: Texts.ui.undo, run: () => { Store.save(JSON.parse(copy)); render(); } });
    },
  });
  return (
    <article class="card proj" data-project={p.id}>
      <div class="proj-head">
        <span class="proj-icon" style={{ background: p.color }} aria-hidden="true">{p.key.slice(0, 3)}</span>
        <div class="proj-title">
          <h2><a href={`#/p/${p.id}/backlog`} class="stretched">{p.name}</a></h2>
          {p.description && <div class="sub clamp">{p.description}</div>}
        </div>
      </div>
      <div class="meta">
        <div><b>{st.count}</b><small>{Texts.home.stories}</small></div>
        <div><b>{st.points ?? st.byStatus.done}</b><small>{st.points != null ? Texts.home.points : Texts.home.accepted}</small></div>
        <div><b class={st.compliantPct == null ? '' : st.compliantPct >= 80 ? 'good' : st.compliantPct >= 50 ? 'warn' : 'bad'}>{st.compliantPct == null ? '–' : `${st.compliantPct} %`}</b><small>{Texts.home.compliant}</small></div>
      </div>
      {st.count > 0 && <div>
        <StatusBar counts={st.byStatus} total={st.count} />
        <div class="legend">
          {Model.STATUSES.filter(s => st.byStatus[s]).map(s => <span key={s}><i class={`dot bar-${s}`} />{Texts.status[s]} {st.byStatus[s]}</span>)}
        </div>
      </div>}
      <div class={`hint ${hint.cls}`}>{hint.text}</div>
      <div class="proj-actions">
        <button type="button" class="btn sm ghost" onClick={() => download(IO.projectJson(p), Util.fileName(p.name, 'json'), 'application/json')}>{Texts.home.export}</button>
        <button type="button" class="btn sm ghost danger-text" data-delete={p.id} onClick={remove}>{Texts.ui.delete}</button>
      </div>
    </article>
  );
}

export function Home() {
  useRevision();
  const list = Store.all();
  const total = list.reduce((n, p) => n + p.stories.length, 0);
  const recent = list.flatMap(p => p.stories.map(s => ({ p, s })))
    .sort((a, b) => b.s.updatedAt.localeCompare(a.s.updatedAt)).slice(0, 6);
  return (
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{Texts.home.title}</h1>
          <div class="sub">{list.length ? fill(Texts.home.summary, { projects: list.length, stories: total }) : Texts.home.tagline}</div>
        </div>
        <span class="spacer" />
        <div class="actions">
          <button type="button" class="btn" id="exampleBtn" onClick={openExample}>{Texts.home.example}</button>
          <button type="button" class="btn" id="importBtn" onClick={importFile}>{Texts.home.import}</button>
          {list.length > 0 && <button type="button" class="btn" id="backupBtn" onClick={backup}>{Texts.home.backup}</button>}
          <button type="button" class="btn primary" id="newProjectBtn" onClick={newProjectDialog}>+ {Texts.home.newProject}</button>
        </div>
      </div>

      {!list.length && (
        <section class="card intro">
          <h2>{Texts.home.introTitle}</h2>
          <p>{Texts.home.intro}</p>
          <ul class="intro-list">
            {Texts.home.introPoints.map(x => <li key={x}>{x}</li>)}
          </ul>
          <div class="actions">
            <button type="button" class="btn primary" onClick={newProjectDialog}>+ {Texts.home.newProject}</button>
            <button type="button" class="btn" onClick={openExample}>{Texts.home.example}</button>
            <button type="button" class="btn ghost" onClick={() => openHelp()}>{Texts.home.learn}</button>
          </div>
        </section>
      )}

      {list.length > 0 && <div class="projects" id="projectList">
        {list.map(p => <ProjectCard key={p.id} p={p} />)}
        <button type="button" class="proj new" onClick={newProjectDialog}>+ {Texts.home.newProject}<small>{Texts.home.newProjectHint}</small></button>
      </div>}

      {recent.length > 0 && (
        <section class="card pad recent">
          <h2>{Texts.home.recent}</h2>
          {recent.map(({ p, s }) => (
            <a key={s.id} class="stat-row link-row" href={`#/p/${p.id}/s/${s.id}`}>
              <span><span class="id">{Model.code(p, s)}</span> {Model.title(s)}</span>
              <span class="sub">{p.name} · {new Date(s.updatedAt).toLocaleDateString(Texts.locale)}</span>
            </a>
          ))}
        </section>
      )}
    </div>
  );
}
