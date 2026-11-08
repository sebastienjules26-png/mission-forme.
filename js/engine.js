/*
 * MISSION FORME V3 — moteur (logique pure, sans DOM).
 * Utilisable dans le navigateur (window.MFEngine) et dans Node (require) pour les tests.
 *
 * Principes non négociables :
 *  - une donnée non renseignée reste null : elle n'est jamais interprétée comme 0 ;
 *  - aucune hausse de charge en présence de douleur, de fatigue ou d'efforts durs récents ;
 *  - les sports de garde et les activités en famille comptent dans la charge ;
 *  - pas de rattrapage automatique d'une séance manquée.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MFEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SCHEMA = 3;
  const DEFAULT_START = '2026-11-10'; // mardi : début du cycle de reprise

  /* ---------------------------------------------------------------- dates */
  const pad = n => String(n).padStart(2, '0');
  const toISO = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12, 0, 0, 0); }
  function isISO(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && toISO(parseISO(s)) === s; }
  function addDays(s, n) { const d = parseISO(s); d.setDate(d.getDate() + n); return toISO(d); }
  function diffDays(a, b) { return Math.round((parseISO(a) - parseISO(b)) / 864e5); } // a - b, en jours
  const weekday = s => parseISO(s).getDay(); // 0 = dimanche
  const mondayOf = s => addDays(s, -((weekday(s) + 6) % 7));
  const todayISO = (now = new Date()) => toISO(now);
  const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const DAY_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  function fmtDate(s, { weekday: wd = true } = {}) {
    const d = parseISO(s);
    return (wd ? DAY_LONG[d.getDay()] + ' ' : '') + d.getDate() + ' ' + MONTHS[d.getMonth()];
  }
  const round5 = n => Math.round(n / 5) * 5;

  /* ------------------------------------------------------------ référentiels */
  const ACTIVITIES = {
    course:   { label: 'Course à pied', short: 'Course', emoji: '🏃', run: true },
    trail:    { label: 'Trail', short: 'Trail', emoji: '⛰️', run: true },
    natation: { label: 'Natation', short: 'Natation', emoji: '🏊' },
    renfo:    { label: 'Renforcement', short: 'Renfo', emoji: '💪' },
    crossfit: { label: 'CrossFit / WOD', short: 'CrossFit', emoji: '🔥' },
    hyrox:    { label: 'HYROX', short: 'HYROX', emoji: '🏋️' },
    velo:     { label: 'Vélo', short: 'Vélo', emoji: '🚴' },
    marche:   { label: 'Marche / mobilité', short: 'Marche', emoji: '🚶' },
    autre:    { label: 'Autre / à préciser', short: 'Autre', emoji: '✨' }
  };
  const CONTEXTS = { perso: 'Perso', garde: 'En garde', famille: 'En famille' };
  const PAIN = ['non', 'legere', 'importante'];
  const SLEEP = ['correct', 'court', 'trescourt'];
  const RESULTS = ['facile', 'ok', 'difficile'];
  const DAY_TYPES = ['bureau', 'garde', 'repos', 'libre'];
  const FORCED = ['', 'course', 'natation', 'autre'];
  const FOCUS = { course: 'Course', pompes: 'Pompes', tirage: 'Tirage / corde', gainage: 'Gainage', nage: 'Nage', squat: 'Squat / jambes', autre: 'Autre' };
  const TERRAINS = ['route', 'trail', 'piste', 'tapis'];
  const isRun = s => !!(s && ACTIVITIES[s.activity] && ACTIVITIES[s.activity].run);

  /* --------------------------------------------------------- normalisation */
  function num(v, min, max, { int = false } = {}) {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
    if (!Number.isFinite(n) || n < min || n > max) return null;
    if (int && !Number.isInteger(n)) return Math.round(n);
    return n;
  }
  const oneOf = (v, list) => (list.includes(v) ? v : null);
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  let _seq = 0;
  const uid = () => 's' + Date.now().toString(36) + (++_seq).toString(36) + Math.random().toString(36).slice(2, 7);

  /** Convertit une séance (V1.x–V2.5 ou V3) en séance V3. Renvoie null si inutilisable. */
  function normalizeSession(raw, warnings = []) {
    if (!raw || typeof raw !== 'object') return null;
    if (!isISO(raw.date)) { warnings.push('Séance ignorée : date invalide.'); return null; }
    const duration = num(raw.duration, 1, 600, { int: true });
    if (duration === null) { warnings.push('Séance du ' + raw.date + ' ignorée : durée invalide.'); return null; }

    let activity = oneOf(raw.activity, Object.keys(ACTIVITIES));
    let context = oneOf(raw.context, Object.keys(CONTEXTS));
    let needsReview = raw.needsReview === true;
    if (!activity) { // format V1.x / V2.x : champ "type" + "movement"
      const t = raw.type, m = raw.movement;
      const fromMovement = m === 'course' ? 'course' : m === 'nage' ? 'natation' : null;
      const map = { course: 'course', natation: 'natation', force: 'renfo', wod: 'crossfit', trail: 'trail' };
      if (t === 'garde' || t === 'famille') {
        context = t;
        activity = fromMovement;
        if (!activity) { activity = 'autre'; needsReview = true; }
      } else {
        activity = map[t] || fromMovement || 'autre';
      }
    }
    context = context || 'perso';

    const s = {
      id: typeof raw.id === 'string' && raw.id.length <= 64 ? raw.id : uid(),
      date: raw.date,
      activity, context, duration,
      rpe: num(raw.rpe, 1, 10, { int: true }),
      pleasure: num(raw.pleasure, 1, 10, { int: true }),
      energy: num(raw.energy !== undefined ? raw.energy : raw.vitality, 1, 10, { int: true }),
      sleep: oneOf(raw.sleep, SLEEP),
      pain: oneOf(raw.pain, PAIN),
      painArea: str(raw.painArea, 60),
      result: oneOf(raw.result, RESULTS),
      focus: oneOf(raw.focus !== undefined ? raw.focus : raw.movement, Object.keys(FOCUS)),
      notes: str(raw.notes, 2000),
      source: oneOf(raw.source, ['manuel', 'express', 'planning', 'import', 'garmin']) || (raw.source === 'planned-inline' ? 'planning' : 'manuel'),
      planId: typeof raw.planId === 'string' ? raw.planId.slice(0, 40) : null,
      externalId: typeof raw.externalId === 'string' ? raw.externalId.slice(0, 80) : null, // réservé Garmin
      needsReview,
      createdAt: num(raw.createdAt, 0, 9e15) || null,
      updatedAt: num(raw.updatedAt, 0, 9e15) || null
    };
    // anciens bilans express : la note « données non précisées » n'est pas une donnée
    if (/^Bilan express/.test(s.notes)) { s.notes = ''; if (s.source === 'manuel') s.source = 'express'; }
    const r = raw.running || {};
    const running = {
      distanceKm: num(r.distanceKm, 0.01, 300),
      avgHr: num(r.avgHr !== undefined ? r.avgHr : r.averageHr, 30, 240, { int: true }),
      elevationM: num(r.elevationM, 0, 10000, { int: true }),
      terrain: oneOf(r.terrain, TERRAINS)
    };
    if (Object.values(running).some(v => v !== null)) s.running = running;
    const d = raw.detail || {};
    const detail = {
      sets: num(d.sets, 1, 30, { int: true }), reps: num(d.reps, 1, 500, { int: true }),
      load: num(d.load, 0, 500), seconds: num(d.seconds, 1, 7200, { int: true })
    };
    if (Object.values(detail).some(v => v !== null)) s.detail = detail;
    return s;
  }

  function normalizeCheckin(raw) {
    if (!raw || !isISO(raw.date)) return null;
    const c = {
      id: typeof raw.id === 'string' ? raw.id.slice(0, 64) : uid(), date: raw.date,
      energy: num(raw.energy, 1, 10, { int: true }), sleep: oneOf(raw.sleep, SLEEP),
      pain: oneOf(raw.pain, PAIN), painArea: str(raw.painArea, 60),
      createdAt: num(raw.createdAt, 0, 9e15) || Date.now()
    };
    return c.energy === null && c.sleep === null && c.pain === null ? null : c;
  }

  const DEFAULT_TESTS = () => ([
    { key: 'pompes', label: 'Pompes', unit: 'reps', target: 50, higher: true, confirmed: false },
    { key: 'course2400', label: '2 400 m', unit: 'time', target: 495, higher: false, confirmed: false },
    { key: 'nage100', label: '100 m nage libre', unit: 'time', target: 90, higher: false, confirmed: false },
    { key: 'corde', label: 'Corde', unit: 'count', target: 2, higher: true, confirmed: false },
    { key: 'planche', label: 'Planche', unit: 'value', target: 20, higher: true, confirmed: false }
  ]);
  const TEST_UNITS = { reps: 'répétitions', time: 'mm:ss', sec: 'secondes', count: 'montées', value: 'valeur' };

  function defaultState() {
    return {
      schema: SCHEMA,
      settings: { programStart: DEFAULT_START, slots: [2, 4], weeklyRuns: 2, weeklyMinutes: 60, lastExportAt: null },
      days: {}, sessions: [], checkins: [],
      plan: { overrides: {}, moves: {}, skips: {} },
      tests: { defs: DEFAULT_TESTS(), results: [] },
      meta: { createdAt: Date.now(), migratedFrom: null }
    };
  }

  /**
   * Accepte un état V3, une sauvegarde V1.4–V2.5 ou un export, et renvoie { state, warnings }.
   * Lève une erreur si l'objet n'a aucune structure reconnaissable.
   */
  function normalizeState(raw, { legacyGoals = null } = {}) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Fichier non reconnu : objet attendu.');
    const legacy = raw.schema !== SCHEMA;
    if (legacy && !Array.isArray(raw.sessions) && typeof raw.days !== 'object') throw new Error('Fichier non reconnu : ni sauvegarde MISSION FORME V2, ni V3.');
    const warnings = [];
    const st = defaultState();
    st.meta.migratedFrom = legacy ? 'v2' : (raw.meta && raw.meta.migratedFrom) || null;
    if (raw.meta && num(raw.meta.createdAt, 0, 9e15)) st.meta.createdAt = raw.meta.createdAt;

    const set = raw.settings || {};
    if (isISO(set.programStart)) st.settings.programStart = set.programStart;
    if (Array.isArray(set.slots)) {
      const slots = [...new Set(set.slots.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      if (slots.length >= 1 && slots.length <= 4) st.settings.slots = slots;
    }
    const goals = legacyGoals || {};
    st.settings.weeklyRuns = num(set.weeklyRuns, 1, 4, { int: true }) || num(goals.runs, 1, 4, { int: true }) || 2;
    st.settings.weeklyMinutes = num(set.weeklyMinutes, 15, 400, { int: true }) || num(goals.minutes, 15, 400, { int: true }) || 60;
    st.settings.lastExportAt = num(set.lastExportAt, 0, 9e15) || null;

    for (const [date, v] of Object.entries(raw.days || {})) {
      if (!isISO(date) || !v || typeof v !== 'object') continue;
      const type = oneOf(v.type, DAY_TYPES);
      if (!type) continue;
      st.days[date] = { type, forced: oneOf(v.forced !== undefined ? v.forced : v.forcedSport || '', FORCED) || '' };
    }
    const ids = new Set();
    for (const r of Array.isArray(raw.sessions) ? raw.sessions : []) {
      const s = normalizeSession(r, warnings);
      if (!s) continue;
      if (ids.has(s.id)) s.id = uid();
      ids.add(s.id);
      st.sessions.push(s);
    }
    st.sessions.sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));
    const review = st.sessions.filter(s => s.needsReview).length;
    if (review) warnings.push(review + ' séance(s) en garde ou en famille sans discipline connue : précise-les dans le Journal (badge « À préciser »).');

    for (const c of Array.isArray(raw.checkins) ? raw.checkins : []) { const n = normalizeCheckin(c); if (n) st.checkins.push(n); }

    const plan = raw.plan || {};
    const overrides = plan.overrides || raw.sessionOverrides || {};
    for (const [date, o] of Object.entries(overrides)) {
      if (!isISO(date) || !o) continue;
      const title = str(o.title, 100), minutes = num(o.minutes, 0, 240, { int: true });
      const steps = Array.isArray(o.steps) ? o.steps.map(x => str(x, 300)).filter(Boolean).slice(0, 30) : [];
      if (title && minutes !== null && steps.length) st.plan.overrides[date] = { title, minutes, steps };
    }
    for (const [from, to] of Object.entries(plan.moves || {})) if (isISO(from) && isISO(to) && from !== to) st.plan.moves[from] = to;
    for (const [date, v] of Object.entries(plan.skips || {})) if (isISO(date) && v) st.plan.skips[date] = true;

    // tests BSPP
    if (raw.tests && Array.isArray(raw.tests.defs)) {
      const defs = [];
      for (const d of raw.tests.defs) {
        if (!d || typeof d.key !== 'string' || !/^[a-z0-9_]{1,30}$/.test(d.key)) continue;
        defs.push({
          key: d.key, label: str(d.label, 60) || d.key, unit: oneOf(d.unit, Object.keys(TEST_UNITS)) || 'value',
          target: num(d.target, 0, 100000), higher: d.higher !== false, confirmed: d.confirmed === true
        });
      }
      if (defs.length) st.tests.defs = defs;
      for (const r of Array.isArray(raw.tests.results) ? raw.tests.results : []) {
        const value = num(r && r.value, 0, 100000);
        if (value === null || !st.tests.defs.some(d => d.key === r.key)) continue;
        st.tests.results.push({ id: typeof r.id === 'string' ? r.id.slice(0, 64) : uid(), key: r.key, value, date: isISO(r.date) ? r.date : null, note: str(r.note, 200) });
      }
    } else if (raw.tests && typeof raw.tests === 'object') {
      const legacyMap = { pompes: 'pompes', course: 'course2400', natation: 'nage100', cordes: 'corde', planche: 'planche' };
      for (const [k, key] of Object.entries(legacyMap)) {
        const value = num(raw.tests[k], 0, 100000);
        if (value !== null) st.tests.results.push({ id: uid(), key, value, date: null, note: 'Repère importé de la V2' });
      }
    }
    return { state: st, warnings };
  }

  /* -------------------------------------------------------------- disponibilité */
  const byRecency = (a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0);

  /**
   * État de forme pour une séance prévue le `date`.
   * Prend en compte les bilans AVANT ce jour et les ressentis (check-ins) jusqu'à ce jour inclus.
   * Renvoie { level: 'ok'|'adapt'|'recup'|'stop', scale ≤ 1, noProgress, ranYesterday, reasons[] }.
   */
  function readiness(state, date) {
    const sessions = state.sessions.filter(s => s.date < date);
    const records = sessions.concat(state.checkins.filter(c => c.date <= date)).sort(byRecency);
    const out = { level: 'ok', scale: 1, noProgress: false, ranYesterday: false, reasons: [] };
    const reduce = (f, reason, noProgress = true) => { out.scale = Math.min(out.scale, f); if (noProgress) out.noProgress = true; out.reasons.push(reason); };

    const pain = records.find(r => r.pain !== null && r.pain !== undefined);
    if (pain && pain.pain === 'importante') {
      out.level = 'stop'; out.scale = 0; out.noProgress = true;
      out.reasons.push('Douleur importante signalée le ' + fmtDate(pain.date, { weekday: false }) + (pain.painArea ? ' (' + pain.painArea + ')' : '') + ' : pas de course ni d’effort sur la zone. Avis médical si elle persiste. Quand tu n’as plus mal, indique-le avec « Je me sens bien ».');
      return out;
    }
    if (pain && pain.pain === 'legere') {
      const age = diffDays(date, pain.date);
      if (age <= 10) reduce(0.7, 'Douleur légère signalée le ' + fmtDate(pain.date, { weekday: false }) + ' : volume réduit, aucune progression, évite le mouvement qui fait mal.');
      else reduce(0.85, 'Une douleur légère a été signalée il y a ' + age + ' jours sans nouvelle info : refais le point avant de progresser.');
    }
    const energy = records.find(r => r.energy !== null && r.energy !== undefined);
    if (energy && diffDays(date, energy.date) <= 2) {
      if (energy.energy <= 3) { out.level = 'recup'; out.scale = 0; out.noProgress = true; out.reasons.push('Énergie très basse signalée (' + energy.energy + '/10) : récupération prioritaire.'); }
      else if (energy.energy === 4) reduce(0.8, 'Énergie basse (4/10) : séance allégée.');
    }
    const sleep = records.find(r => r.sleep);
    if (sleep && diffDays(date, sleep.date) <= 2) {
      if (sleep.sleep === 'trescourt') { out.level = 'recup'; out.scale = 0; out.noProgress = true; out.reasons.push('Sommeil très insuffisant signalé : récupération prioritaire, pas de compensation.'); }
      else if (sleep.sleep === 'court') reduce(0.85, 'Sommeil court : intensité facile, volume légèrement réduit.');
    }
    if (out.level === 'recup') return out;

    const hard = sessions.filter(s => diffDays(date, s.date) <= 3 && ((s.rpe !== null && s.rpe >= 9) || s.result === 'difficile'));
    if (hard.length) reduce(0.8, 'Effort très dur récent (' + fmtDate(hard.sort(byRecency)[0].date, { weekday: false }) + ') : volume réduit de 20 %.');
    const hard7 = sessions.filter(s => diffDays(date, s.date) <= 7 && s.rpe !== null && s.rpe >= 8).length;
    if (hard7 >= 3) reduce(0.75, hard7 + ' efforts intenses sur 7 jours : charge limitée.');

    const prev = state.days[addDays(date, -1)];
    if (prev && prev.type === 'garde') reduce(0.75, 'Lendemain de garde : récupération supplémentaire.', false);
    if (sessions.some(s => isRun(s) && s.date === addDays(date, -1))) {
      out.ranYesterday = true;
      out.reasons.push('Course enregistrée la veille : pas deux courses à impact d’affilée.');
    }
    if (out.scale < 1 || out.ranYesterday) out.level = 'adapt';
    return out;
  }

  /** Plus longue course sans douleur importante dans les 21 jours précédents (en minutes), ou null. */
  function recentLongest(state, date) {
    const runs = state.sessions.filter(s => isRun(s) && s.date < date && diffDays(date, s.date) <= 21 && s.pain !== 'importante');
    return runs.length ? Math.max(...runs.map(s => s.duration)) : null;
  }

  /** Plafond de durée de course : progression liée à ce qui a réellement été couru. */
  function runCap(state, date, noProgress, today = todayISO()) {
    let longest = recentLongest(state, date);
    // séance future : on ne pénalise pas un « trou » qui n'a pas encore eu lieu
    if (longest === null && date > today) longest = recentLongest(state, addDays(today, 1));
    if (longest === null) {
      const anyRun = state.sessions.some(s => isRun(s) && s.date < date);
      return { cap: anyRun ? 25 : 30, why: anyRun ? 'Pas de course depuis plus de 3 semaines : reprise à 25 min.' : 'Base déclarée : 30 min continues.' };
    }
    if (noProgress) return { cap: Math.max(15, longest), why: 'Pas de progression : plafond à ta plus longue sortie récente (' + longest + ' min).' };
    return { cap: Math.max(longest, round5(longest * 1.15)), why: 'Progression plafonnée à +15 % de ta plus longue sortie récente (' + longest + ' min).' };
  }

  /* ---------------------------------------------------------------- programme */
  const PHASES = [
    { id: 1, from: 0, to: 3, name: 'Reprendre plaisir et régularité', goal: 'Finir chaque sortie avec l’envie de recommencer.', run: '2 sorties faciles de 25 à 40 min, 4e semaine allégée.', other: 'Renforcement doux, natation plaisir, aucun test maximal.' },
    { id: 2, from: 4, to: 7, name: 'Consolider l’endurance', goal: 'Régularité sans douleur, récupération satisfaisante.', run: 'Sortie longue vers 45–50 min si tout va bien.', other: 'Technique de nage, pompes et tirages progressifs, WOD léger facultatif.' },
    { id: 3, from: 8, to: 11, name: 'Retrouver de la variété', goal: 'Courir plus facilement, pas forcément plus vite.', run: 'Lignes droites souples le mardi, sortie longue jusqu’à 55 min, trail facile possible.', other: 'Circuit fonctionnel ou natation, initiation corde encadrée.' },
    { id: 4, from: 12, to: 15, name: 'Préparation BSPP progressive', goal: 'Se familiariser avec les épreuves sans multiplier les efforts maximaux.', run: 'Fractionné doux orienté 2 400 m, seulement si la base est solide.', other: 'Pompes, corde, gainage, 100 m nage libre, tests sous-maximaux.' },
    { id: 5, from: 16, to: 20, name: 'Approche des évaluations', goal: 'Arriver frais et confiant le jour J.', run: 'Volume en baisse, rappels d’allure courts.', other: 'Rappels techniques, sommeil et récupération prioritaires.' }
  ];
  // [séance A (1er créneau), séance B (2e créneau)] par semaine : type et minutes de course
  const WEEKS = [
    [['easyRenfo', 30], ['easy', 30]], [['easyRenfo', 30], ['long', 35]], [['easyRenfo', 30], ['long', 40]], [['easyRenfo', 25], ['easy', 30]],
    [['easyRenfo', 30], ['long', 40]], [['easyRenfo', 35], ['long', 45]], [['easyRenfo', 35], ['long', 50]], [['easyRenfo', 30], ['easy', 35]],
    [['strides', 35], ['long', 45]], [['strides', 35], ['long', 50]], [['strides', 40], ['long', 55]], [['easyRenfo', 30], ['easy', 40]],
    [['fartlek', 40], ['long', 50]], [['fartlek', 40], ['long', 55]], [['fartlek', 40], ['long', 50]], [['easyRenfo', 30], ['easy', 40]],
    [['rappel', 35], ['long', 45]], [['rappel', 35], ['long', 40]], [['rappel', 30], ['easy', 35]], [['easy', 30], ['easy', 30]], [['easy', 25], ['easy', 30]]
  ];
  const DELOAD = new Set([3, 7, 11, 15]);
  const QUALITY = new Set(['strides', 'fartlek', 'rappel']);
  const RENFO = 'Renforcement BSPP 15 min (facultatif) : 3 × 5–8 pompes adaptées, 3 × 6 tirages (élastique ou barre), 3 × 20–30 s de gainage, sans aller à l’échec.';

  function runSteps(kind, m) {
    const warm = 'Échauffement : 5 min de marche active et mobilité des chevilles et hanches.';
    const cool = 'Retour au calme : 5 min de marche et étirements doux.';
    switch (kind) {
      case 'easyRenfo': return [warm, 'Course : ' + m + ' min en aisance respiratoire (tu peux parler).', cool, RENFO];
      case 'long': return [warm, 'Sortie endurance : ' + m + ' min très faciles. Terrain souple ou parcours varié bienvenu, sans chercher le dénivelé.', cool];
      case 'strides': return [warm, 'Course facile : ' + Math.max(15, m - 8) + ' min.', '6 lignes droites de 20 s en accélération progressive, sans sprint, 1 min de marche entre chaque.', cool];
      case 'fartlek': return ['Échauffement : 15 min de course très facile.', '5 × 2 min à allure soutenue mais contrôlée (effort 7/10), 2 min de trot entre chaque.', 'Retour au calme : 10 min très faciles puis marche.', 'Si les sensations ne sont pas bonnes, reste en footing facile : c’est une option, pas une obligation.'];
      case 'rappel': return [warm, 'Course facile : ' + Math.max(15, m - 10) + ' min.', '3 × 1 min à l’allure visée sur 2 400 m, 2 min de marche ou trot entre chaque.', cool];
      default: return [warm, 'Course : ' + m + ' min en aisance respiratoire.', cool];
    }
  }
  const RUN_TITLES = { easyRenfo: 'Course facile + renfo BSPP', easy: 'Course facile', long: 'Sortie endurance', strides: 'Course + lignes droites', fartlek: 'Fractionné doux 2 400 m', rappel: 'Rappel d’allure 2 400 m' };
  const BONUS = [
    { activity: 'natation', title: 'Natation technique', steps: ['4 × 25 m très faciles.', '4 × 25 m d’éducatifs (respiration, glisse).', '6 × 25 m à allure confortable, 30 s de récupération.', '2 × 25 m souples.'] },
    { activity: 'crossfit', title: 'Circuit fonctionnel plaisir', steps: ['8 min d’échauffement et de mobilité.', '3 tours sans chrono : 8 squats, 6 tirages élastique, 6 pompes adaptées, 1 min de rameur facile.', '1–2 min de récupération entre les tours, effort 5/10 maximum.'] },
    { activity: 'hyrox', title: 'Découverte HYROX', steps: ['Échauffement 8 min sur ergomètre.', '3 tours : 250 m de rameur, 10 fentes marchées, 10 wall-balls légers, 1 min de marche.', 'Technique avant intensité ; aucun chrono.'] },
    { activity: 'renfo', title: 'Renfo BSPP ciblé', steps: ['Mobilité épaules et hanches 5 min.', '4 × 5–8 pompes propres.', 'Corde : 3 × suspensions de 15 s et 3 × tirages assistés, avec sécurité.', '3 × 30 s de planche, 3 × 10 squats.'] }
  ];

  function weekIndex(state, date) { return Math.floor(diffDays(mondayOf(date), mondayOf(state.settings.programStart)) / 7); }
  function phaseOf(w) { return PHASES.find(p => w >= p.from && w <= p.to) || (w > 20 ? { id: 6, name: 'Entretien', goal: 'Garder le plaisir de courir.', run: '2 sorties faciles.', other: 'Libre.' } : null); }
  function weekTemplate(w) { return WEEKS[w] || [['easyRenfo', 35], ['long', 45]]; }

  /** Courses (et gardes avec course imposée non saisies) de la semaine, avant `date`. */
  function runsThisWeek(state, date) {
    const mon = mondayOf(date);
    const logged = state.sessions.filter(s => isRun(s) && s.date >= mon && s.date < date);
    const loggedDates = new Set(logged.map(s => s.date));
    const guards = Object.entries(state.days).filter(([d, v]) => d >= mon && d < date && v.type === 'garde' && v.forced === 'course' && !loggedDates.has(d) && !state.sessions.some(s => s.date === d));
    return { count: logged.length + guards.length, unloggedGuards: guards.length };
  }

  /** Construit la séance planifiée d'un créneau à sa date effective. */
  function buildItem(state, origDate, date, slotIndex) {
    const w = weekIndex(state, origDate);
    const tpl = weekTemplate(w)[Math.min(slotIndex, 1)];
    const kind = slotIndex > 1 ? 'easy' : tpl[0];
    const target = slotIndex > 1 ? 30 : tpl[1];
    const id = 'slot-' + origDate;
    const item = { id, origDate, date, slotIndex, week: w, phase: phaseOf(w), deload: DELOAD.has(w), kind, activity: 'course', targetMinutes: target, minutes: target, title: RUN_TITLES[kind], steps: [], status: 'prevue', reasons: [], custom: false, moved: origDate !== date, readiness: null, doneSessions: [] };
    const day = state.days[date] || {};
    const done = state.sessions.filter(s => s.planId === id || (s.date === date && !s.planId && isRun(s)));
    const other = state.sessions.filter(s => s.date === date && !done.includes(s));

    if (done.length) {
      Object.assign(item, { status: 'faite', doneSessions: done, title: 'Séance réalisée', minutes: done.reduce((a, s) => a + s.duration, 0), steps: done.map(s => ACTIVITIES[s.activity].label + (s.context !== 'perso' ? ' (' + CONTEXTS[s.context].toLowerCase() + ')' : '') + ' — ' + s.duration + ' min' + (s.rpe ? ', effort ' + s.rpe + '/10' : '')) });
      item.reasons.push('Bilan enregistré : la séance est comptabilisée.');
      const other = done.find(s => s.date !== date);
      if (other) item.reasons.push('Réalisée le ' + fmtDate(other.date) + '.');
      return item;
    }
    if (state.plan.skips[origDate]) { Object.assign(item, { status: 'passee', minutes: 0, steps: ['Séance passée volontairement. Pas de rattrapage.'] }); return item; }
    if (day.type === 'repos') { Object.assign(item, { status: 'repos', title: 'Repos / indisponible', minutes: 0, steps: ['Jour indisponible : aucune séance à rattraper.'] }); return item; }
    if (day.type === 'garde') {
      const f = day.forced;
      Object.assign(item, { status: 'garde', title: 'Garde — sport obligatoire', minutes: 0, activity: f === 'natation' ? 'natation' : f === 'course' ? 'course' : 'autre',
        steps: [f === 'course' ? 'Course imposée en garde : elle remplace ta sortie et compte comme une course.' : f === 'natation' ? 'Natation imposée en garde : elle compte dans ta charge.' : 'Le sport de garde remplace la séance.', 'Après la garde, saisis la durée et le ressenti avec « Évaluer ».', 'Pas de séance personnelle en plus.'] });
      item.reasons.push('La garde remplace le créneau.');
      return item;
    }

    const r = readiness(state, date);
    item.readiness = r;
    const week = runsThisWeek(state, date);
    if (r.level === 'stop') {
      Object.assign(item, { status: 'stop', title: 'Pause course', minutes: 0, activity: 'marche', steps: ['Pas de course, pas de mouvement douloureux.', 'Repos, ou mobilité et marche si c’est indolore.', 'Si la douleur persiste, revient ou s’accompagne de gonflement : avis médical.'] });
    } else if (r.level === 'recup') {
      Object.assign(item, { status: 'recup', title: 'Récupération', minutes: 0, activity: 'marche', steps: ['Repos complet, ou 20 min de marche et mobilité douce.', 'Rien à compenser plus tard.'] });
    } else if (r.ranYesterday) {
      Object.assign(item, { status: 'adaptee', title: 'Pas de course aujourd’hui', minutes: 20, activity: 'natation', steps: ['Tu as couru hier : on évite l’impact.', 'Option : 20 min de natation douce, de vélo facile ou de mobilité.', 'Ou repos, sans culpabilité.'] });
    } else {
      const cap = runCap(state, date, r.noProgress);
      let kind = item.kind;
      if (QUALITY.has(kind) && (r.noProgress || r.scale < 1)) { kind = 'easy'; item.reasons.push('Séance de qualité remplacée par une course facile tant que les signaux ne sont pas au vert.'); }
      else if (QUALITY.has(kind) && (recentLongest(state, date) || 0) < 35) { kind = 'easy'; item.reasons.push('Base d’endurance encore courte (moins de 35 min récemment) : course facile plutôt que du travail d’allure.'); }
      const base = Math.min(target, cap.cap);
      const minutes = Math.max(15, round5(base * r.scale));
      if (base < target) item.reasons.push(cap.why);
      Object.assign(item, { kind, title: RUN_TITLES[kind], minutes, steps: runSteps(kind, minutes) });
      if (minutes < target || kind !== tpl[0]) item.status = 'adaptee';
      if (week.count >= state.settings.weeklyRuns) {
        item.status = 'bonus';
        item.title = 'Sortie bonus (facultative)';
        item.minutes = Math.min(item.minutes, 30);
        item.steps = runSteps('easy', item.minutes);
        item.reasons.push('Objectif de ' + state.settings.weeklyRuns + ' sorties atteint cette semaine' + (week.unloggedGuards ? ' (garde avec course comprise — pense à saisir son bilan)' : '') + ' : cette sortie est facultative.');
      }
      if (other.length) item.reasons.push('Déjà enregistré aujourd’hui : ' + other.map(s => ACTIVITIES[s.activity].short + ' ' + s.duration + ' min').join(', ') + '. Écoute tes sensations.');
    }
    item.reasons.unshift(...r.reasons);
    if (item.deload && ['prevue', 'adaptee'].includes(item.status)) item.reasons.push('Semaine allégée pour assimiler.');

    const o = state.plan.overrides[origDate];
    if (o) {
      if (['stop', 'recup'].includes(item.status)) item.reasons.push('Ta séance personnalisée « ' + o.title + ' » est mise de côté tant que ce signal est présent.');
      else Object.assign(item, { custom: true, title: o.title, minutes: o.minutes, steps: o.steps.slice() });
    }
    if (item.moved) item.reasons.push('Déplacée depuis le ' + fmtDate(origDate) + '.');
    return item;
  }

  /** Séances planifiées entre `from` (inclus) et `from + days` (exclu). */
  function generatePlan(state, from, days = 28) {
    const to = addDays(from, days);
    const start = state.settings.programStart;
    const movedTo = state.plan.moves;
    const items = [];
    // on parcourt une fenêtre élargie pour attraper les séances déplacées vers la période
    for (let d = addDays(from, -14); d < addDays(to, 14); d = addDays(d, 1)) {
      if (d < start) continue;
      const slotIndex = state.settings.slots.indexOf(weekday(d));
      if (slotIndex < 0) continue;
      const date = movedTo[d] || d;
      if (date < from || date >= to) continue;
      items.push(buildItem(state, d, date, slotIndex));
    }
    // jours de garde hors créneau : à afficher pour saisir le sport obligatoire
    for (let d = from; d < to; d = addDays(d, 1)) {
      const day = state.days[d];
      if (day && day.type === 'garde' && !items.some(i => i.date === d)) {
        const it = buildItem(state, d, d, 9);
        it.id = 'garde-' + d; it.offSlot = true;
        items.push(it);
      }
    }
    items.sort((a, b) => a.date.localeCompare(b.date) || a.slotIndex - b.slotIndex);
    // Les séances prévues sont des intentions, pas des efforts réalisés : on avertit,
    // sans modifier silencieusement une séance ou une personnalisation.
    const activeRun = it => ['prevue', 'adaptee', 'bonus'].includes(it.status) && isRun(it) && it.minutes > 0;
    for (let i = 0; i < items.length; i++) {
      const current = items[i];
      if (!activeRun(current)) continue;
      const neighbors = items.filter((other, j) => j !== i && activeRun(other) && Math.abs(diffDays(other.date, current.date)) <= 1);
      if (!neighbors.length) continue;
      current.proximityWarning = true;
      current.proximityDates = neighbors.map(n => n.date);
      const sameDay = neighbors.some(n => n.date === current.date);
      const message = sameDay
        ? 'Attention : deux courses sont prévues le même jour. Vérifie la charge avant de les cumuler.'
        : 'Deux courses sont prévues sur deux jours consécutifs. En reprise, envisage de décaler l’une des séances ou de remplacer la seconde par de la récupération.';
      current.reasons.push(message);
    }
    return items;
  }

  function bonusForWeek(state, monday) { const w = weekIndex(state, monday); return w < 0 ? null : Object.assign({ week: w }, BONUS[((w % 4) + 4) % 4]); }

  /** Prochaine séance à faire à partir d'aujourd'hui (inclus). */
  function nextItem(state, today) {
    return generatePlan(state, today, 21).find(i => !['passee', 'faite', 'repos'].includes(i.status) || i.date === today) || null;
  }

  /* --------------------------------------------------------------- statistiques */
  function weekSummary(state, monday) {
    const sun = addDays(monday, 6);
    const list = state.sessions.filter(s => s.date >= monday && s.date <= sun);
    const runs = list.filter(isRun);
    const withPleasure = list.filter(s => s.pleasure !== null);
    return {
      monday, sunday: sun, sessions: list.length, minutes: list.reduce((a, s) => a + s.duration, 0),
      runs: runs.length, runMinutes: runs.reduce((a, s) => a + s.duration, 0),
      runKm: runs.reduce((a, s) => a + ((s.running && s.running.distanceKm) || 0), 0),
      pleasure: withPleasure.length ? withPleasure.reduce((a, s) => a + s.pleasure, 0) / withPleasure.length : null,
      guardOrFamily: list.filter(s => s.context !== 'perso').length
    };
  }
  function pace(s) {
    const d = s.running && s.running.distanceKm;
    if (!d) return null;
    const t = Math.round(s.duration * 60 / d);
    return Math.floor(t / 60) + ':' + pad(t % 60) + ' /km';
  }

  /** Conseil par mouvement suivi (focus), sans jamais traiter une donnée absente comme mauvaise. */
  function focusAdvice(state, focus) {
    const rows = state.sessions.filter(s => s.focus === focus).sort(byRecency);
    if (!rows.length) return null;
    const last = rows[0];
    if (last.pain === 'importante') return { kind: 'stop', text: 'Douleur importante sur ce mouvement : suspends-le et demande un avis avant de reprendre.' };
    if (last.pain === 'legere') return { kind: 'reduce', text: 'Douleur légère : n’augmente pas, réduis ou remplace ce qui fait mal.' };
    if ((last.rpe !== null && last.rpe >= 9) || last.result === 'difficile') return { kind: 'reduce', text: 'Dernier passage difficile : environ 20 % de répétitions ou de charge en moins, sans échec.' };
    const clean = rows.filter(s => s.pain === 'non').slice(0, 3);
    if (clean.length === 3 && clean.every(s => s.result === 'facile' || (s.rpe !== null && s.rpe <= 5)) && rows[0] === clean[0])
      return { kind: 'progress', text: 'Trois passages faciles sans douleur : +1 répétition par série OU +2 à 5 % de charge, pas les deux.' };
    return { kind: 'hold', text: 'Garde les mêmes paramètres et réévalue après le prochain passage.' };
  }

  /* --------------------------------------------------------------- tests BSPP */
  function fmtTestValue(def, v) {
    if (v === null || v === undefined) return '—';
    if (def.unit === 'time') return Math.floor(v / 60) + ':' + pad(Math.round(v % 60));
    return String(v) + (def.unit === 'sec' ? ' s' : '');
  }
  function parseTestValue(def, text) {
    const t = String(text || '').trim();
    if (!t) return null;
    if (def.unit === 'time') {
      const m = t.match(/^(\d{1,2})[:'’](\d{1,2})(?:["”])?$/);
      if (m && Number(m[2]) < 60) return Number(m[1]) * 60 + Number(m[2]);
      const n = num(t, 1, 3600);
      return n;
    }
    return num(t, 0, 100000);
  }
  function testStatus(state, key) {
    const def = state.tests.defs.find(d => d.key === key);
    const rows = state.tests.results.filter(r => r.key === key).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const last = rows[0] || null;
    let reached = null;
    if (last && def.target !== null) reached = def.higher ? last.value >= def.target : last.value <= def.target;
    return { def, last, history: rows, reached };
  }

  return {
    SCHEMA, DEFAULT_START, ACTIVITIES, CONTEXTS, PAIN, SLEEP, FOCUS, TERRAINS, DAY_TYPES, FORCED, PHASES, TEST_UNITS, DAY_SHORT, DAY_LONG, MONTHS,
    toISO, parseISO, isISO, addDays, diffDays, weekday, mondayOf, todayISO, fmtDate, uid, isRun,
    normalizeSession, normalizeCheckin, normalizeState, defaultState,
    readiness, recentLongest, runCap, weekIndex, phaseOf, generatePlan, buildItem, nextItem, bonusForWeek, runsThisWeek,
    weekSummary, pace, focusAdvice, fmtTestValue, parseTestValue, testStatus
  };
});
