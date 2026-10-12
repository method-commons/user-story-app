/*
 * Bericht: alle Stories eines Projekts als Karten im Standardformat mit Akzeptanzkriterien,
 * zum Drucken (Story-Karten für die Wand oder als PDF) und als Markdown zum Herunterladen.
 */
import { useState } from 'preact/hooks';
import { IO } from '../io.js';
import { Invest } from '../invest.js';
import { Model } from '../model.js';
import { Texts } from '../texts.js';
import { Util } from '../util.js';
import { download } from './components.jsx';
import { useProject } from './core.js';
import { Sentence } from './backlog.jsx';

export function Report() {
  const p = useProject();
  const [includeDone, setIncludeDone] = useState(true);
  const list = p.stories.filter(s => includeDone || s.status !== 'done');
  const groups = [...p.epics.map(e => ({ id: /** @type {string | null} */ (e.id), name: e.name || Texts.epics.untitled, color: e.color })), { id: null, name: Texts.epics.none, color: '#98a2b3' }]
    .map(g => ({ ...g, stories: list.filter(s => s.epicId === g.id) })).filter(g => g.stories.length);
  return (
    <div class="page report">
      <div class="page-head no-print">
        <div>
          <h1>{Texts.report.title}</h1>
          <div class="sub">{Texts.report.intro}</div>
        </div>
        <span class="spacer" />
        <label class="check-inline"><input type="checkbox" id="reportDone" checked={includeDone} onChange={() => setIncludeDone(!includeDone)} />{Texts.report.includeDone}</label>
        <button type="button" class="btn" id="reportMd" onClick={() => download(IO.markdown(p, { includeDone }), Util.fileName(p.name, 'md'), 'text/markdown')}>{Texts.report.markdown}</button>
        <button type="button" class="btn primary" id="reportPrint" onClick={() => window.print()}>{Texts.report.print}</button>
      </div>
      <h1 class="print-only">{p.name}</h1>
      {p.description && <p class="report-desc">{p.description}</p>}
      {!list.length && <div class="card pad empty"><p>{Texts.report.empty}</p></div>}
      {groups.map(g => (
        <section key={g.id || 'none'} class="report-group">
          <h2><span class="dot" style={{ background: g.color }} />{g.name}</h2>
          <div class="report-cards">
            {g.stories.map(s => {
              const r = Invest.check(p, s);
              return (
                <article class="card story-card" key={s.id}>
                  <header class="row">
                    <span class="id">{Model.code(p, s)}</span>
                    <b>{Model.title(s)}</b>
                    <span class="spacer" />
                    {s.priority && <span class={`chip prio-${s.priority}`}>{Texts.priority.short[s.priority]}</span>}
                    {s.size && <span class="size">{s.size}</span>}
                  </header>
                  <p class="story-sentence"><Sentence s={s} /></p>
                  {s.criteria.length > 0 && <ol class="report-ac">
                    {s.criteria.map(c => (
                      <li key={c.id} class={c.confirmed ? 'confirmed' : ''}>
                        {c.title && <b>{c.title}: </b>}
                        {c.format === 'check' ? c.text : <><span class="kw">{Texts.criteria.given}</span> {c.given} <span class="kw">{Texts.criteria.when}</span> {c.when} <span class="kw">{Texts.criteria.then}</span> {c.then}</>}
                      </li>
                    ))}
                  </ol>}
                  <footer class="row sub">
                    <span>{Texts.status[s.status]}</span>
                    <span class="spacer" />
                    <span class="invest plain">{Model.LETTERS.map(l => <i key={l} class={`inv-${r[l].state}`}>{l}</i>)}</span>
                  </footer>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
