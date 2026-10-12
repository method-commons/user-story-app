/*
 * Epics eines Projekts: anlegen, benennen, einfärben, beschreiben, löschen – mit Anzahl und
 * Fortschritt der zugehörigen Stories.
 */
import { Model } from '../model.js';
import { Ops } from '../ops.js';
import { Texts } from '../texts.js';
import { StatusBar, confirmDialog, fill } from './components.jsx';
import { fieldProps, mutate, useProject } from './core.js';
import { newStory } from './backlog.jsx';

export function Epics() {
  const p = useProject();
  const without = p.stories.filter(s => !s.epicId);
  const add = () => {
    mutate(pp => { pp.epics.push(Model.createEpic({ color: Model.COLORS[pp.epics.length % Model.COLORS.length] })); });
    setTimeout(() => {
      const inputs = document.querySelectorAll('.epic-name');
      const last = /** @type {HTMLInputElement | undefined} */ (inputs[inputs.length - 1]);
      if (last) last.focus();
    });
  };
  return (
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{Texts.epics.title}</h1>
          <div class="sub">{Texts.epics.intro}</div>
        </div>
        <span class="spacer" />
        <button type="button" class="btn primary" id="addEpic" onClick={add}>+ {Texts.epics.add}</button>
      </div>
      <div class="epics" id="epicList">
        {p.epics.map(e => {
          const stories = p.stories.filter(s => s.epicId === e.id);
          /** @type {Record<StoryStatus, number>} */
          const counts = { draft: 0, ready: 0, progress: 0, review: 0, done: 0 };
          for (const s of stories) counts[s.status]++;
          return (
            <article class="card pad epic-card" key={e.id} data-epic={e.id} style={{ '--epic': e.color }}>
              <div class="row">
                <input type="color" class="color" value={e.color} aria-label={Texts.epics.color} onChange={ev => { const v = ev.currentTarget.value; mutate(() => { e.color = v; }); }} />
                <input class="input bare epic-name" placeholder={Texts.epics.namePlaceholder} aria-label={Texts.epics.name} {...fieldProps(() => e.name, v => { e.name = v; })} />
                <button type="button" class="icon-btn sm" aria-label={Texts.ui.delete} title={Texts.ui.delete} onClick={() => confirmDialog({
                  title: Texts.epics.deleteTitle, text: fill(Texts.epics.deleteText, { name: e.name || Texts.epics.untitled, n: stories.length }), ok: Texts.ui.delete, danger: true,
                  onOk: () => mutate(pp => Ops.deleteEpic(pp, e.id)),
                })}>✕</button>
              </div>
              <textarea class="input bare" rows={2} placeholder={Texts.epics.descriptionPlaceholder} aria-label={Texts.epics.description} {...fieldProps(() => e.description, v => { e.description = v; })} />
              <div class="row sub">
                <span>{(stories.length === 1 ? Texts.backlog.groupCountOne : fill(Texts.backlog.groupCount, { n: stories.length }))}</span>
                {p.settings.sizeScale === 'points' && <span>· {Model.pointSum(p, stories)} SP</span>}
                <span class="spacer" />
                <span>{fill(Texts.epics.doneOf, { n: counts.done, total: stories.length })}</span>
              </div>
              {stories.length > 0 ? <StatusBar counts={counts} total={stories.length} /> : <div class="progress" />}
              <div class="epic-stories">
                {stories.slice(0, 5).map(s => <a key={s.id} href={`#/p/${p.id}/s/${s.id}`}><span class="id">{Model.code(p, s)}</span> {Model.title(s)}</a>)}
                {stories.length > 5 && <span class="sub">{fill(Texts.epics.more, { n: stories.length - 5 })}</span>}
              </div>
              <button type="button" class="btn sm ghost" onClick={() => newStory(e.id)}>+ {Texts.backlog.newStory}</button>
            </article>
          );
        })}
        {!p.epics.length && <div class="card pad empty"><p>{Texts.epics.empty}</p></div>}
      </div>
      {without.length > 0 && p.epics.length > 0 && <p class="sub">{without.length === 1 ? Texts.epics.withoutOne : fill(Texts.epics.without, { n: without.length })}</p>}
    </div>
  );
}
