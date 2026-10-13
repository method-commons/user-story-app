/*
 * Model – Datenmodell eines Projekts: Konstanten, Anlegen, Normalisieren (Import/Speicher),
 * Standardformat (Satz zusammensetzen und zerlegen). Exportiert den Namensraum `Model`.
 */
import { Texts } from './texts.js';
import { Util } from './util.js';

export const Model = (() => {
  const SCHEMA_VERSION = 1;

  /** @type {StoryStatus[]} */
  const STATUSES = ['draft', 'ready', 'progress', 'review', 'done'];
  /** @type {Priority[]} */
  const PRIORITIES = ['must', 'should', 'could', 'wont'];
  /** @type {ConversationKind[]} */
  const KINDS = ['note', 'question', 'decision'];
  /** @type {InvestLetter[]} */
  const LETTERS = ['I', 'N', 'V', 'E', 'S', 'T'];

  /** Größen je Skala, aufsteigend; „?“ = nicht schätzbar. @type {Record<SizeScale, string[]>} */
  const SIZES = {
    tshirt: ['XS', 'S', 'M', 'L', 'XL'],
    points: ['1', '2', '3', '5', '8', '13', '20', '40'],
  };
  /** Vorgabe für die Grenze „Small“. @type {Record<SizeScale, string>} */
  const DEFAULT_SMALL = { tshirt: 'M', points: '8' };

  /** Farben für Projekte und Epics (aus der Matrix-App, auf Farbsehschwächen geprüft) */
  const COLORS = ['#f59f00', '#4f46e5', '#2b8a3e', '#0e7490', '#c2255c', '#7048e8', '#e8590c', '#495057'];

  /** @param {any} v @returns {string} */
  const str = v => (typeof v === 'string' ? v : v == null ? '' : String(v));
  /** @param {any} v @param {string} fallback */
  const color = (v, fallback) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fallback);
  /** @param {any} v @param {string} fallback */
  const iso = (v, fallback) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : fallback);

  /** @param {string} text @returns {ChecklistItem} */
  const item = text => ({ id: Util.uid('c'), text });

  /**
   * Neues, leeres Projekt.
   * @param {{ name?: string, key?: string, description?: string, sizeScale?: SizeScale, color?: string }} [opts]
   * @returns {Project}
   */
  function createProject(opts = {}) {
    const scale = opts.sizeScale === 'points' ? 'points' : 'tshirt';
    const name = (opts.name || '').trim() || Texts.project.untitled;
    const stamp = Util.now();
    return {
      version: SCHEMA_VERSION,
      id: Util.uid('p'),
      key: Util.sanitizeKey(opts.key || '') || Util.keyFromName(name),
      name,
      description: opts.description || '',
      color: color(opts.color, COLORS[Math.floor(Math.random() * COLORS.length)]),
      settings: {
        sizeScale: scale,
        smallLimit: DEFAULT_SMALL[scale],
        dor: Texts.defaults.dor.map(item),
        dod: Texts.defaults.dod.map(item),
      },
      epics: [],
      stories: [],
      nextNumber: 1,
      createdAt: stamp,
      updatedAt: stamp,
    };
  }

  /**
   * Neue Story (ohne Nummer; die vergibt `Ops.addStory`).
   * @param {Partial<Story>} [fields]
   * @returns {Story}
   */
  function createStory(fields = {}) {
    const stamp = Util.now();
    return {
      id: Util.uid('s'), number: 0, title: '', role: '', want: '', benefit: '', notes: '',
      size: null, priority: null, epicId: null, status: 'draft', dependsOn: [],
      conversation: [], criteria: [], invest: {}, dor: {}, dod: {},
      createdAt: stamp, updatedAt: stamp,
      ...fields,
    };
  }

  /** @param {Partial<Criterion>} [fields] @returns {Criterion} */
  function createCriterion(fields = {}) {
    return { id: Util.uid('a'), title: '', format: 'gwt', given: '', when: '', then: '', text: '', confirmed: false, ...fields };
  }

  /** @param {Partial<ConversationEntry>} [fields] @returns {ConversationEntry} */
  function createEntry(fields = {}) {
    return { id: Util.uid('k'), kind: 'note', author: '', text: '', date: Util.today(), resolved: false, criterionId: null, ...fields };
  }

  /** @param {Partial<Epic>} [fields] @returns {Epic} */
  function createEpic(fields = {}) {
    return { id: Util.uid('e'), name: '', color: COLORS[0], description: '', ...fields };
  }

  /** Gültige Größe auf der Skala, sonst `null`. @param {any} v @param {SizeScale} scale */
  function normalizeSize(v, scale) {
    if (v == null || v === '') return null;
    const s = str(v).toUpperCase();
    if (s === '?') return '?';
    return SIZES[scale].includes(s) ? s : null;
  }

  /** @param {any} raw @returns {ChecklistItem[]} */
  function normalizeItems(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    return raw.filter(x => x && typeof x === 'object').map(x => {
      let id = str(x.id) || Util.uid('c');
      if (seen.has(id)) id = Util.uid('c');
      seen.add(id);
      return { id, text: str(x.text) };
    });
  }

  /** @param {any} raw @param {Set<string>} ids @returns {Record<string, boolean>} */
  function normalizeChecks(raw, ids) {
    /** @type {Record<string, boolean>} */
    const out = {};
    if (raw && typeof raw === 'object') for (const k of Object.keys(raw)) if (ids.has(k) && raw[k] === true) out[k] = true;
    return out;
  }

  /**
   * Rohdaten (Import, Speicher, ältere Version) in ein vollständiges, gültiges Projekt
   * umwandeln. Unbekannte Felder entfallen, fehlende werden ergänzt, Verweise geprüft.
   * @param {any} raw
   * @returns {Project}
   */
  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(Texts.io.invalid);
    if (typeof raw.version === 'number' && raw.version > SCHEMA_VERSION) throw new Error(Texts.io.tooNew);
    const base = createProject({ name: str(raw.name), key: str(raw.key) });
    const s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    /** @type {SizeScale} */
    const scale = s.sizeScale === 'points' ? 'points' : 'tshirt';
    const settings = {
      sizeScale: scale,
      smallLimit: SIZES[scale].includes(str(s.smallLimit).toUpperCase()) ? str(s.smallLimit).toUpperCase() : DEFAULT_SMALL[scale],
      dor: Array.isArray(s.dor) ? normalizeItems(s.dor) : base.settings.dor,
      dod: Array.isArray(s.dod) ? normalizeItems(s.dod) : base.settings.dod,
    };
    const dorIds = new Set(settings.dor.map(x => x.id));
    const dodIds = new Set(settings.dod.map(x => x.id));

    const epicIds = new Set();
    /** @type {Epic[]} */
    const epics = (Array.isArray(raw.epics) ? raw.epics : []).filter((/** @type {any} */ e) => e && typeof e === 'object').map((/** @type {any} */ e, /** @type {number} */ i) => {
      let id = str(e.id) || Util.uid('e');
      if (epicIds.has(id)) id = Util.uid('e');
      epicIds.add(id);
      return { id, name: str(e.name), color: color(e.color, COLORS[i % COLORS.length]), description: str(e.description) };
    });

    const storyIds = new Set();
    const numbers = new Set();
    let maxNumber = 0;
    /** @type {Story[]} */
    const stories = (Array.isArray(raw.stories) ? raw.stories : []).filter((/** @type {any} */ x) => x && typeof x === 'object').map((/** @type {any} */ x) => {
      let id = str(x.id) || Util.uid('s');
      if (storyIds.has(id)) id = Util.uid('s');
      storyIds.add(id);
      let number = Number.isInteger(x.number) && x.number > 0 ? x.number : 0;
      if (numbers.has(number)) number = 0;
      if (number) numbers.add(number);
      maxNumber = Math.max(maxNumber, number);
      const critIds = new Set();
      /** @type {Criterion[]} */
      const criteria = (Array.isArray(x.criteria) ? x.criteria : []).filter((/** @type {any} */ c) => c && typeof c === 'object').map((/** @type {any} */ c) => {
        let cid = str(c.id) || Util.uid('a');
        if (critIds.has(cid)) cid = Util.uid('a');
        critIds.add(cid);
        return {
          id: cid, title: str(c.title), format: c.format === 'check' ? 'check' : 'gwt',
          given: str(c.given), when: str(c.when), then: str(c.then), text: str(c.text), confirmed: c.confirmed === true,
        };
      });
      const entryIds = new Set();
      /** @type {ConversationEntry[]} */
      const conversation = (Array.isArray(x.conversation) ? x.conversation : []).filter((/** @type {any} */ c) => c && typeof c === 'object').map((/** @type {any} */ c) => {
        let kid = str(c.id) || Util.uid('k');
        if (entryIds.has(kid)) kid = Util.uid('k');
        entryIds.add(kid);
        return {
          id: kid, kind: KINDS.includes(c.kind) ? c.kind : 'note', author: str(c.author), text: str(c.text),
          date: typeof c.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.date) ? c.date : Util.today(),
          resolved: c.resolved === true,
          criterionId: typeof c.criterionId === 'string' && critIds.has(c.criterionId) ? c.criterionId : null,
        };
      });
      /** @type {Partial<Record<InvestLetter, boolean>>} */
      const invest = {};
      if (x.invest && typeof x.invest === 'object') for (const l of LETTERS) if (x.invest[l] === true) invest[l] = true;
      const stamp = iso(x.createdAt, Util.now());
      return {
        id, number, title: str(x.title), role: str(x.role), want: str(x.want), benefit: str(x.benefit), notes: str(x.notes),
        size: normalizeSize(x.size, scale),
        priority: PRIORITIES.includes(x.priority) ? x.priority : null,
        epicId: typeof x.epicId === 'string' && epicIds.has(x.epicId) ? x.epicId : null,
        status: STATUSES.includes(x.status) ? x.status : 'draft',
        dependsOn: Array.isArray(x.dependsOn) ? x.dependsOn.filter((/** @type {any} */ d) => typeof d === 'string') : [],
        conversation, criteria, invest,
        dor: normalizeChecks(x.dor, dorIds), dod: normalizeChecks(x.dod, dodIds),
        createdAt: stamp, updatedAt: iso(x.updatedAt, stamp),
      };
    });
    // Nummern ergänzen, Abhängigkeiten nur auf vorhandene, andere Stories
    for (const st of stories) {
      if (!st.number) { st.number = ++maxNumber; }
      st.dependsOn = [...new Set(st.dependsOn)].filter(d => d !== st.id && storyIds.has(d));
    }
    const next = Number.isInteger(raw.nextNumber) && raw.nextNumber > maxNumber ? raw.nextNumber : maxNumber + 1;
    const created = iso(raw.createdAt, base.createdAt);
    return {
      version: SCHEMA_VERSION,
      id: str(raw.id) || base.id,
      key: base.key,
      name: base.name,
      description: str(raw.description),
      color: color(raw.color, base.color),
      settings, epics, stories,
      nextNumber: next,
      createdAt: created,
      updatedAt: iso(raw.updatedAt, created),
    };
  }

  /** Anzeige-Nummer „KEY-n“. @param {Project} p @param {Story} s */
  function code(p, s) {
    return `${p.key}-${s.number}`;
  }

  /** Kurztitel: eigener Titel, sonst „möchte ich …“, sonst Platzhalter. @param {Story} s */
  function title(s) {
    const t = s.title.trim() || s.want.trim();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : Texts.story.untitled;
  }

  /** Satz im Standardformat (leere Teile entfallen). @param {Story} s */
  function sentence(s) {
    const f = Texts.format;
    const parts = [];
    if (s.role.trim()) parts.push(`${f.as} ${s.role.trim()}`);
    if (s.want.trim()) parts.push(`${f.want} ${s.want.trim()}`);
    let out = parts.join(' ');
    if (s.benefit.trim()) out += `${out ? ', ' : ''}${f.so} ${s.benefit.trim().replace(/\.$/, '')}`;
    return out ? out + '.' : '';
  }

  /**
   * Satz im Standardformat zerlegen (Deutsch und Englisch), z. B. aus der Schnelleingabe.
   * Ohne erkennbares Muster landet der ganze Text in `want`.
   * @param {string} text
   * @returns {{ role: string, want: string, benefit: string }}
   */
  function parseSentence(text) {
    const t = String(text || '').trim().replace(/\s+/g, ' ').replace(/\.$/, '');
    const de = /^als\s+(?:ein(?:e|en|er)?\s+)?(.+?),?\s+(?:möchte|will|muss|kann)\s+ich\s+(.+?)(?:,?\s+(?:damit|um)\s+(.+))?$/i;
    // Englisch: Artikel gehört zur Rolle („As a guest“), „to“ zum Schlüsselwort („I want to“)
    const en = /^as\s+(.+?),?\s+i\s+(?:want|would like|need|can)\s+(?:to\s+)?(.+?)(?:,?\s+so\s+(?:that\s+)?(.+))?$/i;
    const m = t.match(de) || t.match(en);
    if (!m) return { role: '', want: t, benefit: '' };
    return { role: m[1].trim(), want: m[2].trim(), benefit: (m[3] || '').trim() };
  }

  /** Größen der Skala des Projekts. @param {Project} p */
  function sizes(p) {
    return SIZES[p.settings.sizeScale];
  }

  /** Summe der Story Points (nur Skala „points“, ohne „?“). @param {Project} p @param {Story[]} [list] */
  function pointSum(p, list = p.stories) {
    if (p.settings.sizeScale !== 'points') return null;
    return list.reduce((sum, s) => sum + (s.size && s.size !== '?' ? Number(s.size) : 0), 0);
  }

  return {
    SCHEMA_VERSION, STATUSES, PRIORITIES, KINDS, LETTERS, SIZES, DEFAULT_SMALL, COLORS,
    createProject, createStory, createCriterion, createEntry, createEpic,
    normalize, normalizeSize, code, title, sentence, parseSentence, sizes, pointSum,
  };
})();
