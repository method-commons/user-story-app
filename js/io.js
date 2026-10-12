/*
 * IO – Import und Export: Projekt als JSON, Sicherung aller Projekte, Bericht als Markdown.
 * Exportiert den Namensraum `IO`.
 */
import { Invest } from './invest.js';
import { Model } from './model.js';
import { Texts } from './texts.js';
import { Util } from './util.js';

export const IO = (() => {
  const BACKUP_TYPE = 'user-stories-backup';

  /** Projekt als JSON-Text. @param {Project} p */
  function projectJson(p) {
    return JSON.stringify(p, null, 2) + '\n';
  }

  /** Sicherung mehrerer Projekte als JSON-Text. @param {Project[]} list @param {Date} [date] */
  function backupJson(list, date = new Date()) {
    return JSON.stringify({ type: BACKUP_TYPE, version: Model.SCHEMA_VERSION, exportedAt: date.toISOString(), projects: list }, null, 2) + '\n';
  }

  /**
   * JSON-Text lesen: einzelnes Projekt, Sicherung oder Liste von Projekten.
   * @param {string} text @returns {Project[]}
   */
  function parse(text) {
    let raw;
    try { raw = JSON.parse(text); } catch (e) { throw new Error(Texts.io.invalid, { cause: e }); }
    const list = Array.isArray(raw) ? raw : raw && raw.type === BACKUP_TYPE && Array.isArray(raw.projects) ? raw.projects : [raw];
    if (!list.length) throw new Error(Texts.io.empty);
    return list.map(Model.normalize);
  }

  /** Inhalt ohne Zeitstempel (zum Vergleich). @param {Project} p */
  const content = p => JSON.stringify({ ...p, updatedAt: '' });

  /**
   * Wie wird ein importiertes Projekt übernommen? Neu, schon vorhanden (identisch) oder –
   * bei abweichendem Stand – als Kopie mit neuer ID (nichts wird überschrieben).
   * @param {Project} p @param {Project | null} existing
   * @returns {{ action: 'new' | 'same' | 'copy', project: Project }}
   */
  function resolveImport(p, existing) {
    if (!existing) return { action: 'new', project: p };
    if (content(existing) === content(p)) return { action: 'same', project: existing };
    return { action: 'copy', project: { ...p, id: Util.uid('p'), name: `${p.name} ${Texts.io.copySuffix}` } };
  }

  /** Markdown-Zeichen in Text maskieren. @param {string} s */
  const md = s => String(s).replace(/([\\`*_[\]#|<>])/g, '\\$1');

  /**
   * Bericht als Markdown: Projekt, Kennzahlen, Stories je Epic mit Standardformat,
   * Akzeptanzkriterien, INVEST und offenen Fragen.
   * @param {Project} p @param {{ includeDone?: boolean }} [opts]
   */
  function markdown(p, opts = {}) {
    const T = Texts;
    const lines = [`# ${md(p.name)}`, ''];
    if (p.description.trim()) lines.push(md(p.description.trim()), '');
    const list = p.stories.filter(s => opts.includeDone !== false || s.status !== 'done');
    const groups = [...p.epics.map(e => ({ name: e.name || T.epics.untitled, id: /** @type {string | null} */ (e.id) })), { name: T.epics.none, id: null }];
    for (const g of groups) {
      const stories = list.filter(s => s.epicId === g.id);
      if (!stories.length) continue;
      lines.push(`## ${md(g.name)}`, '');
      for (const s of stories) {
        const r = Invest.check(p, s);
        const invest = Model.LETTERS.map(l => (r[l].state === 'ok' ? l : r[l].state === 'bad' ? `~~${l}~~` : `${l}?`)).join(' ');
        lines.push(`### ${Model.code(p, s)} · ${md(Model.title(s))}`, '');
        lines.push(`> ${md(Model.sentence(s) || T.story.untitled)}`, '');
        const meta = [
          `${T.fields.status}: ${T.status[s.status]}`,
          s.priority ? `${T.fields.priority}: ${T.priority[s.priority]}` : '',
          s.size ? `${T.fields.size}: ${s.size}` : '',
          `INVEST: ${invest}`,
        ].filter(Boolean);
        lines.push(meta.join(' · '), '');
        if (s.dependsOn.length) {
          const deps = s.dependsOn.map(d => p.stories.find(x => x.id === d)).filter(Boolean).map(x => Model.code(p, /** @type {Story} */ (x)));
          lines.push(`${T.fields.dependsOn}: ${deps.join(', ')}`, '');
        }
        if (s.notes.trim()) lines.push(md(s.notes.trim()), '');
        if (s.criteria.length) {
          lines.push(`**${T.threec.confirmation}**`, '');
          s.criteria.forEach((c, i) => {
            const box = c.confirmed ? '[x]' : '[ ]';
            const head = `${T.criteria.short} ${i + 1}${c.title.trim() ? ` · ${md(c.title.trim())}` : ''}`;
            if (c.format === 'check') lines.push(`- ${box} ${head}: ${md(c.text)}`);
            else lines.push(`- ${box} ${head}: **${T.criteria.given}** ${md(c.given)} **${T.criteria.when}** ${md(c.when)} **${T.criteria.then}** ${md(c.then)}`);
          });
          lines.push('');
        }
        const open = s.conversation.filter(e => e.kind === 'question' && !e.resolved);
        const decisions = s.conversation.filter(e => e.kind === 'decision');
        if (open.length || decisions.length) {
          lines.push(`**${T.threec.conversation}**`, '');
          for (const e of decisions) lines.push(`- ${T.kind.decision}: ${md(e.text)}${e.author ? ` (${md(e.author)})` : ''}`);
          for (const e of open) lines.push(`- ${T.kind.question}: ${md(e.text)}${e.author ? ` (${md(e.author)})` : ''}`);
          lines.push('');
        }
      }
    }
    if (!list.length) lines.push(T.report.empty, '');
    return lines.join('\n');
  }

  return { BACKUP_TYPE, projectJson, backupJson, parse, resolveImport, markdown };
})();
