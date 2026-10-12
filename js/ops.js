/*
 * Ops – Änderungen an einem Projekt (ändern das übergebene Objekt direkt) und Kennzahlen.
 * Exportiert den Namensraum `Ops`.
 */
import { Invest } from './invest.js';
import { Model } from './model.js';
import { Texts } from './texts.js';
import { Util } from './util.js';

export const Ops = (() => {
  /** @param {Project} p @param {string} id */
  const find = (p, id) => p.stories.find(s => s.id === id) || null;

  /** Zeitstempel aktualisieren. @param {Project} p @param {Story} [s] */
  function touch(p, s) {
    const stamp = Util.now();
    p.updatedAt = stamp;
    if (s) s.updatedAt = stamp;
  }

  /**
   * Story anlegen (mit nächster Nummer); standardmäßig ans Ende, mit `index` an diese Stelle.
   * @param {Project} p @param {Partial<Story>} [fields] @param {number} [index]
   * @returns {Story}
   */
  function addStory(p, fields = {}, index) {
    const s = Model.createStory({ ...fields, number: p.nextNumber++ });
    if (index == null || index < 0 || index > p.stories.length) p.stories.push(s);
    else p.stories.splice(index, 0, s);
    touch(p, s);
    return s;
  }

  /** Story löschen; Verweise anderer Stories darauf entfallen. @param {Project} p @param {string} id */
  function deleteStory(p, id) {
    const i = p.stories.findIndex(s => s.id === id);
    if (i < 0) return false;
    p.stories.splice(i, 1);
    for (const s of p.stories) s.dependsOn = s.dependsOn.filter(d => d !== id);
    touch(p);
    return true;
  }

  /** Story kopieren (direkt dahinter, Status „Entwurf“, Bestätigungen zurückgesetzt). @param {Project} p @param {string} id */
  function duplicateStory(p, id) {
    const src = find(p, id);
    if (!src) return null;
    const copy = JSON.parse(JSON.stringify(src));
    const s = addStory(p, {
      ...copy, id: Util.uid('s'), status: 'draft', invest: {}, dor: {}, dod: {},
      title: src.title ? `${src.title} ${Texts.story.copySuffix}` : '',
      criteria: copy.criteria.map((/** @type {Criterion} */ c) => ({ ...c, id: Util.uid('a'), confirmed: false })),
      conversation: copy.conversation.map((/** @type {ConversationEntry} */ e) => ({ ...e, id: Util.uid('k'), criterionId: null })),
    }, p.stories.indexOf(src) + 1);
    return s;
  }

  /** Story an eine andere Stelle verschieben (Priorisierung). @param {Project} p @param {string} id @param {number} to */
  function moveStory(p, id, to) {
    const from = p.stories.findIndex(s => s.id === id);
    if (from < 0) return false;
    const target = Math.max(0, Math.min(p.stories.length - 1, to));
    if (target === from) return false;
    const [s] = p.stories.splice(from, 1);
    p.stories.splice(target, 0, s);
    touch(p);
    return true;
  }

  /**
   * Story innerhalb einer gefilterten Liste um einen Platz verschieben: tauscht mit dem
   * sichtbaren Nachbarn (die übrigen Stories behalten ihre Plätze).
   * @param {Project} p @param {string} id @param {-1 | 1} dir @param {Story[]} visible
   */
  function stepStory(p, id, dir, visible) {
    const vi = visible.findIndex(s => s.id === id);
    const other = visible[vi + dir];
    if (vi < 0 || !other) return false;
    const a = p.stories.findIndex(s => s.id === id);
    const b = p.stories.indexOf(other);
    [p.stories[a], p.stories[b]] = [p.stories[b], p.stories[a]];
    touch(p);
    return true;
  }

  /** Status setzen. @param {Project} p @param {string} id @param {StoryStatus} status */
  function setStatus(p, id, status) {
    const s = find(p, id);
    if (!s || !Model.STATUSES.includes(status) || s.status === status) return false;
    s.status = status;
    touch(p, s);
    return true;
  }

  /**
   * Abhängigkeit hinzufügen; verhindert Selbstbezug und Kreise.
   * @param {Project} p @param {string} id @param {string} dep
   */
  function addDependency(p, id, dep) {
    const s = find(p, id);
    if (!s || id === dep || !find(p, dep) || s.dependsOn.includes(dep)) return false;
    if (reaches(p, dep, id)) return false;
    s.dependsOn.push(dep);
    touch(p, s);
    return true;
  }

  /** Führt eine Kette von Abhängigkeiten von `from` zu `to`? @param {Project} p @param {string} from @param {string} to */
  function reaches(p, from, to) {
    const seen = new Set();
    const stack = [from];
    while (stack.length) {
      const cur = /** @type {string} */ (stack.pop());
      if (cur === to) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      const s = find(p, cur);
      if (s) stack.push(...s.dependsOn);
    }
    return false;
  }

  /** @param {Project} p @param {string} id @param {string} dep */
  function removeDependency(p, id, dep) {
    const s = find(p, id);
    if (!s) return false;
    s.dependsOn = s.dependsOn.filter(d => d !== dep);
    touch(p, s);
    return true;
  }

  /**
   * Entscheidung aus der Conversation als Akzeptanzkriterium (Checklistenpunkt) übernehmen.
   * @param {Story} s @param {string} entryId @returns {Criterion | null}
   */
  function criterionFromEntry(s, entryId) {
    const e = s.conversation.find(x => x.id === entryId);
    if (!e || e.criterionId) return null;
    const c = Model.createCriterion({ format: 'check', text: e.text });
    s.criteria.push(c);
    e.criterionId = c.id;
    return c;
  }

  /** Akzeptanzkriterium löschen (Verweis aus der Conversation entfällt). @param {Story} s @param {string} id */
  function deleteCriterion(s, id) {
    s.criteria = s.criteria.filter(c => c.id !== id);
    for (const e of s.conversation) if (e.criterionId === id) e.criterionId = null;
  }

  /** Element einer Liste um eine Stelle verschieben. @template T @param {T[]} list @param {number} i @param {-1 | 1} dir */
  function step(list, i, dir) {
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return false;
    [list[i], list[j]] = [list[j], list[i]];
    return true;
  }

  /**
   * Story aufteilen: neue Stories (mit Rolle, Epic, Priorität des Originals) an der Stelle
   * des Originals. `asEpic` wandelt das Original in ein Epic um (es entfällt als Story,
   * die neuen Stories gehören zum Epic); sonst bleibt es erhalten.
   * @param {Project} p @param {string} id
   * @param {{ role: string, want: string, benefit: string, size?: string | null }[]} parts
   * @param {boolean} asEpic
   * @returns {Story[]}
   */
  function splitStory(p, id, parts, asEpic) {
    const src = find(p, id);
    const filled = parts.filter(x => x.want.trim());
    if (!src || !filled.length) return [];
    let epicId = src.epicId;
    if (asEpic) {
      const epic = Model.createEpic({
        name: Model.title(src),
        color: Model.COLORS[p.epics.length % Model.COLORS.length],
        description: Model.sentence(src),
      });
      p.epics.push(epic);
      epicId = epic.id;
    }
    let index = p.stories.indexOf(src) + 1;
    const created = filled.map(x => addStory(p, {
      role: x.role, want: x.want, benefit: x.benefit, size: x.size || null,
      epicId, priority: src.priority,
      notes: Util.fill(Texts.split.origin, { code: Model.code(p, src) }),
    }, index++));
    if (asEpic) {
      // Wer vom Original abhing, hängt nun von allen Teilen ab
      for (const s of p.stories) {
        if (s.dependsOn.includes(src.id)) s.dependsOn = [...new Set([...s.dependsOn.filter(d => d !== src.id), ...created.map(c => c.id)])];
      }
      deleteStory(p, src.id);
    }
    touch(p);
    return created;
  }

  /** Epic löschen; seine Stories verlieren die Zuordnung. @param {Project} p @param {string} id */
  function deleteEpic(p, id) {
    p.epics = p.epics.filter(e => e.id !== id);
    for (const s of p.stories) if (s.epicId === id) s.epicId = null;
    touch(p);
  }

  /** Skala wechseln: Größen werden ungefähr übertragen. @param {Project} p @param {SizeScale} scale */
  function setSizeScale(p, scale) {
    const from = p.settings.sizeScale;
    if (from === scale) return;
    const a = Model.SIZES[from];
    const b = Model.SIZES[scale];
    /** @param {string | null} v */
    const map = v => (v == null || v === '?' ? v : b[Math.round(a.indexOf(v) / (a.length - 1) * (b.length - 1))]);
    for (const s of p.stories) s.size = map(s.size);
    p.settings.smallLimit = /** @type {string} */ (map(p.settings.smallLimit));
    p.settings.sizeScale = scale;
    touch(p);
  }

  /**
   * Kennzahlen eines Projekts.
   * @param {Project} p
   */
  function stats(p) {
    /** @type {Record<StoryStatus, number>} */
    const byStatus = { draft: 0, ready: 0, progress: 0, review: 0, done: 0 };
    /** @type {Record<InvestLetter, number>} */
    const letters = { I: 0, N: 0, V: 0, E: 0, S: 0, T: 0 };
    let compliant = 0, criteria = 0, noBenefit = 0, tooBig = 0, readyNoCriteria = 0, openQuestions = 0, unestimated = 0, problems = 0;
    for (const s of p.stories) {
      byStatus[s.status]++;
      const r = Invest.check(p, s);
      let ok = 0;
      for (const l of Model.LETTERS) if (r[l].state === 'ok') { letters[l]++; ok++; }
      if (ok === 6) compliant++;
      if (Model.LETTERS.some(l => r[l].state === 'bad' || r[l].state === 'warn')) problems++;
      criteria += s.criteria.length;
      if (!s.benefit.trim()) noBenefit++;
      if (r.S.hint === 'tooBig') tooBig++;
      if (s.size == null || s.size === '?') unestimated++;
      if (s.status !== 'draft' && !s.criteria.length) readyNoCriteria++;
      openQuestions += s.conversation.filter(e => e.kind === 'question' && !e.resolved).length;
    }
    const n = p.stories.length;
    return {
      count: n, byStatus, letters, compliant, problems,
      compliantPct: n ? Math.round(compliant / n * 100) : null,
      avgCriteria: n ? criteria / n : 0,
      noBenefit, tooBig, readyNoCriteria, openQuestions, unestimated,
      points: Model.pointSum(p),
      readyCount: p.stories.filter(s => s.status === 'ready' && Invest.missing(Invest.ready(p, s)).length === 0).length,
    };
  }

  return {
    find, touch, addStory, deleteStory, duplicateStory, moveStory, stepStory, setStatus,
    addDependency, removeDependency, reaches, criterionFromEntry, deleteCriterion, step, splitStory,
    deleteEpic, setSizeScale, stats,
  };
})();
