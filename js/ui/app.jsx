/*
 * Rahmen der App: Kopfzeile mit Navigation und Menü, Inhalt je Route, Dialoge, Meldungen.
 */
import { useEffect, useState } from 'preact/hooks';
import { IO } from '../io.js';
import { Languages, Texts } from '../texts.js';
import { Util } from '../util.js';
import { Backlog } from './backlog.jsx';
import { Board } from './board.jsx';
import { download } from './components.jsx';
import { canRedo, canUndo, commitEdit, dialog, go, redo, route, toasts, undo, useProject, useRevision } from './core.js';
import { Epics } from './epics.jsx';
import { openHelp } from './help.jsx';
import { Home } from './home.jsx';
import { Report } from './report.jsx';
import { Settings } from './settings.jsx';
import { StoryEditor } from './story.jsx';

/** @param {string} lang */
function switchLanguage(lang) {
  commitEdit();
  Languages.choose(lang);
  location.reload();
}

function Menu() {
  const [open, setOpen] = useState(false);
  const r = route.value;
  const p = useProject();
  useEffect(() => {
    if (!open) return undefined;
    /** @param {MouseEvent} e */
    const close = e => { if (!(/** @type {HTMLElement} */ (e.target)).closest('.menu')) setOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);
  /** @param {() => void} fn */
  const run = fn => () => { setOpen(false); fn(); };
  const current = Languages.detect();
  return (
    <div class="menu">
      <button type="button" class="btn ghost" id="menuBtn" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)}>
        {Texts.ui.menu} ▾
      </button>
      {open && (
        <div class="menu-list" id="menuList" role="menu">
          {r.view !== 'home' && p && <>
            <button type="button" role="menuitem" data-action="export" onClick={run(() => download(IO.projectJson(p), Util.fileName(p.name, 'json'), 'application/json'))}>{Texts.menu.exportJson}</button>
            <button type="button" role="menuitem" data-action="settings" onClick={run(() => go({ view: 'project', pid: p.id, tab: 'settings' }))}>{Texts.menu.settings}</button>
            <hr />
          </>}
          <button type="button" role="menuitem" data-action="help" onClick={run(() => openHelp())}>{Texts.menu.help}</button>
          <hr />
          <div class="menu-label">{Texts.menu.language}</div>
          {Object.keys(Languages.packs).map(lang => (
            <button type="button" role="menuitemradio" aria-checked={lang === current} key={lang} data-lang={lang} onClick={run(() => switchLanguage(lang))}>
              {lang === current ? '✓ ' : ''}{Languages.packs[lang].languageName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const NAV = /** @type {const} */ (['backlog', 'board', 'epics', 'report']);

function Header() {
  const r = route.value;
  const p = useProject();
  const active = r.view === 'project' ? r.tab : r.view === 'story' ? 'backlog' : null;
  return (
    <header class="app-header">
      <a class="brand" href="#/" title={Texts.ui.allProjects} id="homeLink">
        <svg class="logo" viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" rx="7" fill="currentColor" />
          <rect x="6" y="7.5" width="20" height="15" rx="2.5" fill="#fff" />
          <rect x="9.5" y="11.5" width="13" height="2" rx="1" fill="currentColor" opacity=".4" />
          <rect x="9.5" y="15.5" width="8" height="2" rx="1" fill="currentColor" opacity=".4" />
          <path d="M18.5 23.5l2.6 2.6 5-5.4" fill="none" stroke="#fb923c" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span class="brand-name">{Texts.appName}</span>
      </a>
      {p && r.view !== 'home' && (
        <a class="project-name" href={`#/p/${p.id}/backlog`} id="projectName">
          <span class="dot" style={{ background: p.color }} />{p.name}
        </a>
      )}
      {p && r.view !== 'home' && (
        <nav class="nav seg" aria-label={Texts.ui.views}>
          {NAV.map(tab => (
            <a key={tab} href={`#/p/${p.id}/${tab}`} class={active === tab ? 'on' : ''} aria-current={active === tab ? 'page' : undefined} data-nav={tab}>
              <span class="nav-icon" aria-hidden="true">{Texts.nav.icons[tab]}</span>{Texts.nav[tab]}
            </a>
          ))}
        </nav>
      )}
      <span class="spacer" />
      {p && r.view !== 'home' && <>
        <button type="button" class="icon-btn" id="undoBtn" title={Texts.ui.undo} aria-label={Texts.ui.undo} disabled={!canUndo()} onClick={undo}>↶</button>
        <button type="button" class="icon-btn" id="redoBtn" title={Texts.ui.redo} aria-label={Texts.ui.redo} disabled={!canRedo()} onClick={redo}>↷</button>
      </>}
      <button type="button" class="btn ghost" id="helpBtn" onClick={() => openHelp()}>? <span class="hide-narrow">{Texts.ui.method}</span></button>
      <Menu />
    </header>
  );
}

function Toasts() {
  return (
    <div class="toasts" aria-live="polite">
      {toasts.value.map(t => (
        <div class="toast" key={t.id}>
          {t.text}
          {t.action && <button type="button" class="link" onClick={t.action.run}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  );
}

export function App() {
  useRevision();
  const r = route.value;
  const p = useProject();
  const docTitle = r.view === 'home' || !p ? Texts.appName : `${p.name} – ${Texts.appName}`;
  useEffect(() => { document.title = docTitle; }, [docTitle]);
  const Dlg = dialog.value;
  return (
    <>
      <Header />
      <main id="main">
        {r.view === 'home' && <Home />}
        {r.view === 'project' && r.tab === 'backlog' && <Backlog />}
        {r.view === 'project' && r.tab === 'board' && <Board />}
        {r.view === 'project' && r.tab === 'epics' && <Epics />}
        {r.view === 'project' && r.tab === 'report' && <Report />}
        {r.view === 'project' && r.tab === 'settings' && <Settings />}
        {r.view === 'story' && <StoryEditor key={r.sid} sid={r.sid} tab={r.tab} />}
      </main>
      {Dlg && <Dlg />}
      <Toasts />
    </>
  );
}
