/*
 * Projekteinstellungen: Name, Kürzel, Beschreibung, Farbe, Skala und Grenze für „Small“,
 * eigene Punkte der Definition of Ready und Done; Export und Löschen.
 */
import { IO } from '../io.js';
import { Model } from '../model.js';
import { Ops } from '../ops.js';
import { Store } from '../storage.js';
import { Texts } from '../texts.js';
import { Util } from '../util.js';
import { confirmDialog, download, fill } from './components.jsx';
import { discardProject, fieldProps, go, mutate, toast, useProject } from './core.js';

/** Liste eigener Prüfpunkte. @param {{ list: ChecklistItem[], id: string, title: string, help: string, auto: string[] }} props */
function ItemList({ list, id, title, help, auto }) {
  return (
    <section class="card pad" id={id}>
      <h2>{title}</h2>
      <p class="sub">{help}</p>
      <ul class="item-list">
        {auto.map(a => <li key={a} class="auto"><span class="check-auto ok" aria-hidden="true">✓</span>{a} <small class="sub">· {Texts.gate.auto}</small></li>)}
        {list.map((x, i) => (
          <li key={x.id}>
            <input class="input" aria-label={fill(Texts.settings.itemLabel, { n: i + 1 })} placeholder={Texts.settings.itemPlaceholder} {...fieldProps(() => x.text, v => { x.text = v; })} />
            <button type="button" class="icon-btn sm" aria-label={Texts.backlog.up} disabled={!i} onClick={() => mutate(() => Ops.step(list, i, -1))}>↑</button>
            <button type="button" class="icon-btn sm" aria-label={Texts.backlog.down} disabled={i === list.length - 1} onClick={() => mutate(() => Ops.step(list, i, 1))}>↓</button>
            <button type="button" class="icon-btn sm" aria-label={Texts.ui.delete} onClick={() => mutate(() => { list.splice(i, 1); })}>✕</button>
          </li>
        ))}
      </ul>
      <button type="button" class="btn sm" data-add={id} onClick={() => mutate(() => { list.push({ id: Util.uid('c'), text: '' }); })}>+ {Texts.settings.addItem}</button>
    </section>
  );
}

export function Settings() {
  const p = useProject();
  const remove = () => confirmDialog({
    title: Texts.home.deleteTitle, text: fill(Texts.home.deleteText, { name: p.name, n: p.stories.length }), ok: Texts.ui.delete, danger: true,
    onOk: () => {
      const copy = JSON.stringify(p);
      discardProject();
      Store.removeDoc(p.id);
      go({ view: 'home' });
      toast(fill(Texts.home.deleted, { name: p.name }), { label: Texts.ui.undo, run: () => { Store.save(JSON.parse(copy)); go({ view: 'project', pid: JSON.parse(copy).id, tab: 'backlog' }); } });
    },
  });
  return (
    <div class="page settings">
      <div class="page-head"><h1>{Texts.settings.title}</h1></div>
      <div class="settings-grid">
        <section class="card pad form-grid">
          <label for="setName">{Texts.project.name}</label>
          <input class="input" id="setName" {...fieldProps(() => p.name, v => { p.name = v; })} />
          <label for="setKey">{Texts.project.key}</label>
          <div>
            <input class="input key-input" id="setKey" maxLength={6} {...fieldProps(() => p.key, v => { p.key = Util.sanitizeKey(v) || p.key; })} />
            <small class="help-text">{Texts.project.keyHelp}</small>
          </div>
          <label for="setDesc">{Texts.project.description}</label>
          <textarea class="input" id="setDesc" rows={2} {...fieldProps(() => p.description, v => { p.description = v; })} />
          <label for="setColor">{Texts.project.color}</label>
          <input type="color" class="color" id="setColor" value={p.color} onChange={e => { const v = e.currentTarget.value; mutate(pp => { pp.color = v; }); }} />
          <span class="label">{Texts.project.sizeScale}</span>
          <div class="radio-row" role="radiogroup" aria-label={Texts.project.sizeScale}>
            {/** @type {SizeScale[]} */ (['tshirt', 'points']).map(sc => (
              <label key={sc} class="radio">
                <input type="radio" name="setScale" value={sc} checked={p.settings.sizeScale === sc} onChange={() => mutate(pp => Ops.setSizeScale(pp, sc))} />
                <span><b>{Texts.scale[sc].name}</b><small>{Texts.scale[sc].help}</small></span>
              </label>
            ))}
          </div>
          <label for="setSmall">{Texts.settings.smallLimit}</label>
          <div>
            <select class="input select" id="setSmall" value={p.settings.smallLimit} onChange={e => { const v = e.currentTarget.value; mutate(pp => { pp.settings.smallLimit = v; }); }}>
              {Model.sizes(p).map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <small class="help-text">{Texts.settings.smallHelp}</small>
          </div>
        </section>
        <ItemList list={p.settings.dor} id="dorItems" title={Texts.dor.title} help={Texts.settings.dorHelp} auto={[Texts.dor.format, Texts.dor.criteria, Texts.dor.estimated, Texts.dor.small]} />
        <ItemList list={p.settings.dod} id="dodItems" title={Texts.dod.title} help={Texts.settings.dodHelp} auto={[Texts.dod.confirmed]} />
        <section class="card pad">
          <h2>{Texts.settings.data}</h2>
          <p class="sub">{Texts.settings.dataHelp}</p>
          <div class="row wrap">
            <button type="button" class="btn" onClick={() => download(IO.projectJson(p), Util.fileName(p.name, 'json'), 'application/json')}>{Texts.menu.exportJson}</button>
            <button type="button" class="btn danger" id="deleteProject" onClick={remove}>{Texts.settings.deleteProject}</button>
          </div>
        </section>
      </div>
    </div>
  );
}
