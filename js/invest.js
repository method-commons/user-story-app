/*
 * Invest – Prüfung einer Story nach der INVEST-Regel (Independent, Negotiable, Valuable,
 * Estimable, Small, Testable) sowie Definition of Ready und Definition of Done.
 *
 * Die automatische Prüfung liefert je Buchstabe „ok“, „warn“ (prüfen), „bad“ (verletzt) oder
 * „none“ (keine Aussage) mit einem Hinweis. Die eigene Bestätigung (story.invest) macht aus
 * „warn“ bzw. „none“ ein „erfüllt“ – ein „bad“ lässt sich nicht wegbestätigen.
 * Exportiert den Namensraum `Invest`.
 */
import { Model } from './model.js';
import { Util } from './util.js';

export const Invest = (() => {
  /**
   * Begriffe, die auf Lösungs- statt Problembeschreibung hindeuten (Negotiable).
   * Deutsch und Englisch, da Stories in beiden Sprachen vorkommen.
   */
  const TECH_TERMS = [
    'datenbank', 'database', 'sql', 'postgres', 'postgresql', 'mysql', 'mongodb', 'api', 'rest', 'graphql', 'endpoint', 'server',
    'backend', 'frontend', 'framework', 'react', 'angular', 'vue', 'java', 'python', 'javascript', 'json', 'xml',
    'cloud', 'aws', 'azure', 'microservice', 'dropdown', 'button', 'checkbox', 'popup', 'modal', 'cache', 'tabelle',
    'table', 'spalte', 'column', 'algorithmus', 'algorithm', 'docker', 'kubernetes', 'html', 'css',
  ];
  /** Unscharfe Wörter in Akzeptanzkriterien (Testable) */
  const VAGUE_TERMS = [
    'schnell', 'einfach', 'intuitiv', 'benutzerfreundlich', 'nutzerfreundlich', 'ansprechend', 'schön', 'gut', 'optimal',
    'angemessen', 'flexibel', 'robust', 'modern', 'fast', 'easy', 'simple', 'intuitive', 'user-friendly', 'nice',
    'appropriate', 'optimal', 'flexible', 'etc', 'usw',
  ];
  /** Zu allgemeine Rollen (Valuable) */
  const GENERIC_ROLES = ['nutzer', 'benutzer', 'user', 'anwender', 'anwenderin', 'nutzerin', 'benutzerin', 'kunde', 'person', 'jemand', 'someone', 'customer', 'system', 'entwickler', 'developer'];

  /** Wörter eines Texts (klein, ohne Akzente; Bindestrich trennt). @param {string} text */
  const tokens = text => Util.fold(text).split(/[^a-z0-9ß]+/).filter(Boolean);

  /**
   * Gefundene Begriffe aus einer Liste. Mit `partial` zählen längere Begriffe (ab 5 Zeichen)
   * auch als Teil eines Worts, z. B. „datenbank“ in „Kundendatenbank“.
   * @param {string} text @param {string[]} list @param {boolean} [partial]
   */
  function findTerms(text, list, partial = false) {
    const words = tokens(text);
    const set = new Set(words);
    const found = [...new Set(list.filter(t => set.has(t) || (partial && t.length >= 5 && words.some(w => w.includes(t)))))];
    // „postgres“ nicht zusätzlich zu „postgresql“ nennen
    return found.filter(t => !found.some(o => o !== t && o.includes(t)));
  }

  /** Ist die Rolle zu allgemein („Nutzer“, „ein User“)? @param {string} role */
  function genericRole(role) {
    return GENERIC_ROLES.includes(Util.fold(role).trim().replace(/^(ein|eine|einer|a|an|the)\s+/, ''));
  }

  /** Ist das Kriterium vollständig ausgefüllt? @param {Criterion} c */
  function criterionComplete(c) {
    return c.format === 'check' ? !!c.text.trim() : !!(c.given.trim() && c.when.trim() && c.then.trim());
  }

  /** Text eines Kriteriums (für die Suche nach unscharfen Wörtern). @param {Criterion} c */
  function criterionText(c) {
    return c.format === 'check' ? c.text : `${c.given} ${c.when} ${c.then}`;
  }

  /** Rang einer Größe auf der Skala, `-1` = unbekannt. @param {Project} p @param {string | null} size */
  function sizeRank(p, size) {
    return size == null ? -1 : Model.sizes(p).indexOf(size);
  }

  /**
   * Automatische Prüfung je Buchstabe.
   * @param {Project} p
   * @param {Story} s
   * @returns {Record<InvestLetter, { auto: InvestAuto, hint: string, params: Record<string, string | number> }>}
   */
  function auto(p, s) {
    const byId = new Map(p.stories.map(x => [x.id, x]));
    const openDeps = s.dependsOn.map(id => byId.get(id)).filter(x => x && x.status !== 'done');
    const tech = findTerms(`${s.want} ${s.benefit}`, TECH_TERMS, true);
    const openQuestions = s.conversation.filter(e => e.kind === 'question' && !e.resolved).length;
    const rank = sizeRank(p, s.size);
    const limit = sizeRank(p, p.settings.smallLimit);
    const ands = (` ${Util.fold(s.want)} `.match(/ (und|and|sowie|oder|or) |, /g) || []).length;
    const incomplete = s.criteria.filter(c => !criterionComplete(c)).length;
    const vague = findTerms(s.criteria.map(criterionText).join(' '), VAGUE_TERMS);

    return {
      I: openDeps.length
        ? { auto: 'warn', hint: 'depends', params: { list: openDeps.map(x => Model.code(p, /** @type {Story} */ (x))).join(', '), n: openDeps.length } }
        : { auto: 'ok', hint: 'independent', params: {} },
      N: tech.length
        ? { auto: 'warn', hint: 'tech', params: { list: tech.join(', ') } }
        : !s.want.trim() ? { auto: 'none', hint: 'noWant', params: {} }
          : { auto: 'ok', hint: 'negotiable', params: {} },
      V: !s.benefit.trim()
        ? { auto: 'bad', hint: 'noBenefit', params: {} }
        : !s.role.trim() ? { auto: 'warn', hint: 'noRole', params: {} }
          : genericRole(s.role) ? { auto: 'warn', hint: 'genericRole', params: { role: s.role.trim() } }
            : { auto: 'ok', hint: 'valuable', params: {} },
      E: s.size == null
        ? { auto: 'bad', hint: 'notEstimated', params: {} }
        : s.size === '?' ? { auto: 'bad', hint: 'unestimable', params: {} }
          : openQuestions ? { auto: 'warn', hint: 'openQuestions', params: { n: openQuestions } }
            : { auto: 'ok', hint: 'estimated', params: { size: s.size } },
      S: rank < 0
        ? { auto: 'none', hint: 'sizeUnknown', params: {} }
        : rank > limit ? { auto: 'bad', hint: 'tooBig', params: { size: /** @type {string} */ (s.size), limit: p.settings.smallLimit } }
          : ands >= 2 ? { auto: 'warn', hint: 'manyParts', params: { n: ands + 1 } }
            : { auto: 'ok', hint: 'small', params: { size: /** @type {string} */ (s.size), limit: p.settings.smallLimit } },
      T: !s.criteria.length
        ? { auto: 'bad', hint: 'noCriteria', params: {} }
        : incomplete ? { auto: 'warn', hint: 'incomplete', params: { n: incomplete } }
          : vague.length ? { auto: 'warn', hint: 'vague', params: { list: vague.join(', ') } }
            : { auto: 'ok', hint: 'testable', params: { n: s.criteria.length } },
    };
  }

  /**
   * Vollständiges Ergebnis: Automatik + eigene Bestätigung.
   * @param {Project} p @param {Story} s
   * @returns {Record<InvestLetter, InvestResult>}
   */
  function check(p, s) {
    const a = auto(p, s);
    /** @type {any} */
    const out = {};
    for (const l of Model.LETTERS) {
      const r = a[l];
      const confirmed = s.invest[l] === true;
      /** @type {InvestState} */
      const state = r.auto === 'bad' ? 'bad' : r.auto === 'ok' || confirmed ? 'ok' : r.auto === 'warn' ? 'warn' : 'open';
      out[l] = { ...r, confirmed, state };
    }
    return out;
  }

  /** Anzahl erfüllter Buchstaben (0–6). @param {Project} p @param {Story} s */
  function score(p, s) {
    const r = check(p, s);
    return Model.LETTERS.filter(l => r[l].state === 'ok').length;
  }

  /** Alle sechs erfüllt? @param {Project} p @param {Story} s */
  function compliant(p, s) {
    return score(p, s) === 6;
  }

  /** Hat die Story ein Problem (verletzt oder zu prüfen)? @param {Project} p @param {Story} s */
  function hasProblem(p, s) {
    const r = check(p, s);
    return Model.LETTERS.some(l => r[l].state === 'bad' || r[l].state === 'warn');
  }

  /**
   * Definition of Ready: automatische Punkte + eigene Punkte des Projekts.
   * @param {Project} p @param {Story} s @returns {CheckItem[]}
   */
  function ready(p, s) {
    return [
      { id: 'format', auto: true, text: 'format', done: !!(s.role.trim() && s.want.trim() && s.benefit.trim()) },
      { id: 'criteria', auto: true, text: 'criteria', done: s.criteria.length > 0 && s.criteria.every(criterionComplete) },
      { id: 'estimated', auto: true, text: 'estimated', done: s.size != null && s.size !== '?' },
      { id: 'small', auto: true, text: 'small', done: sizeRank(p, s.size) >= 0 && sizeRank(p, s.size) <= sizeRank(p, p.settings.smallLimit) },
      ...p.settings.dor.map(x => ({ id: x.id, auto: false, text: x.text, done: s.dor[x.id] === true })),
    ];
  }

  /**
   * Definition of Done: alle Akzeptanzkriterien bestätigt + eigene Punkte des Projekts.
   * @param {Project} p @param {Story} s @returns {CheckItem[]}
   */
  function done(p, s) {
    return [
      { id: 'confirmed', auto: true, text: 'confirmed', done: s.criteria.length > 0 && s.criteria.every(c => c.confirmed) },
      ...p.settings.dod.map(x => ({ id: x.id, auto: false, text: x.text, done: s.dod[x.id] === true })),
    ];
  }

  /** Fehlende Punkte einer Liste. @param {CheckItem[]} items */
  const missing = items => items.filter(x => !x.done);

  /**
   * Welche Prüfung greift beim Wechsel in einen Status? `ready` ab „Bereit“, `done` bei „Fertig“.
   * @param {StoryStatus} from @param {StoryStatus} to @returns {('ready' | 'done')[]}
   */
  function gatesFor(from, to) {
    const i = Model.STATUSES.indexOf(from);
    const j = Model.STATUSES.indexOf(to);
    /** @type {('ready' | 'done')[]} */
    const gates = [];
    if (j > i && i < 1 && j >= 1) gates.push('ready');
    if (to === 'done' && from !== 'done') gates.push('done');
    return gates;
  }

  return { TECH_TERMS, VAGUE_TERMS, GENERIC_ROLES, genericRole, auto, check, score, compliant, hasProblem, ready, done, missing, gatesFor, criterionComplete, sizeRank };
})();
