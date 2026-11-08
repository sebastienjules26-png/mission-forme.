/*
 * MISSION FORME V3 — persistance locale, migration, import/export.
 * Toutes les écritures sont vérifiées par relecture ; la version précédente est conservée
 * dans une clé de secours pour permettre une restauration.
 */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./engine.js') : root.MFEngine);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MFStore = api;
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';
  const KEYS = {
    main: 'mission-forme-v3',
    prev: 'mission-forme-v3-prev',          // version précédente (restauration)
    undo: 'mission-forme-v3-undo',          // état avant le dernier import / effacement
    corrupt: 'mission-forme-v3-corrupt',    // contenu illisible mis de côté, jamais supprimé automatiquement
    legacy: 'mission-forme-v1',             // V1.4 → V2.5 (laissé intact)
    legacyGoals: 'mission-forme-running-goals-v17'
  };

  function createStore(storage) {
    const read = k => { try { return storage.getItem(k); } catch (e) { return null; } };

    /** Charge l'état, migre si besoin. Renvoie { state, notices[], migrated, error }. */
    function load() {
      const notices = [];
      const raw = read(KEYS.main);
      if (raw) {
        try { return { state: E.normalizeState(JSON.parse(raw)).state, notices, migrated: false, error: null }; }
        catch (e) {
          try { storage.setItem(KEYS.corrupt, raw); } catch (_) { /* rien */ }
          const prev = read(KEYS.prev);
          if (prev) {
            try {
              const st = E.normalizeState(JSON.parse(prev)).state;
              notices.push('Les données principales étaient illisibles : la version précédente a été restaurée. Le contenu illisible est conservé à part.');
              return { state: st, notices, migrated: false, error: null };
            } catch (_) { /* on continue */ }
          }
          return { state: E.defaultState(), notices: ['Données illisibles : rien n’a été effacé, mais l’appli démarre vide. Réimporte ta dernière sauvegarde JSON.'], migrated: false, error: 'corrupt' };
        }
      }
      const legacy = read(KEYS.legacy);
      if (legacy) {
        try {
          let goals = null;
          try { goals = JSON.parse(read(KEYS.legacyGoals) || 'null'); } catch (_) { goals = null; }
          const { state, warnings } = E.normalizeState(JSON.parse(legacy), { legacyGoals: goals });
          notices.push('Données de la V2 reprises automatiquement (' + state.sessions.length + ' séance(s)). L’ancienne sauvegarde est conservée telle quelle.', ...warnings);
          const res = save(state);
          if (!res.ok) notices.push(res.error);
          return { state, notices, migrated: true, error: null };
        } catch (e) {
          notices.push('Ancienne sauvegarde V2 illisible : elle est conservée, l’appli démarre vide.');
        }
      }
      return { state: E.defaultState(), notices, migrated: false, error: null };
    }

    /** Écrit l'état et vérifie la relecture. Ne lève jamais d'exception. */
    function save(state) {
      let json;
      try { json = JSON.stringify(state); } catch (e) { return { ok: false, error: 'Données impossibles à enregistrer (format).' }; }
      try {
        const current = storage.getItem(KEYS.main);
        if (current && current !== json) storage.setItem(KEYS.prev, current);
        storage.setItem(KEYS.main, json);
        if (storage.getItem(KEYS.main) !== json) throw new Error('relecture');
        return { ok: true };
      } catch (e) {
        return { ok: false, error: 'Enregistrement impossible sur cet appareil (stockage plein, bloqué ou navigation privée). Exporte tes données dès que possible.' };
      }
    }

    function snapshotForUndo(state, label) {
      try { storage.setItem(KEYS.undo, JSON.stringify({ label, at: Date.now(), state })); return true; } catch (e) { return false; }
    }
    function readUndo() {
      try { const u = JSON.parse(read(KEYS.undo) || 'null'); return u && u.state ? { label: u.label, at: u.at, state: E.normalizeState(u.state).state } : null; }
      catch (e) { return null; }
    }
    function clearUndo() { try { storage.removeItem(KEYS.undo); } catch (e) { /* rien */ } }

    /** Efface les données de l'appli (l'appelant DOIT avoir demandé confirmation). Garde un état d'annulation. */
    function clearAll(state) {
      snapshotForUndo(state, 'effacement');
      for (const k of [KEYS.main, KEYS.prev, KEYS.legacy, KEYS.legacyGoals, KEYS.corrupt]) { try { storage.removeItem(k); } catch (e) { /* rien */ } }
    }
    return { load, save, snapshotForUndo, readUndo, clearUndo, clearAll, KEYS };
  }

  function exportJSON(state, now = Date.now()) {
    return JSON.stringify(Object.assign({ app: 'MISSION FORME', exportedAt: new Date(now).toISOString() }, state), null, 2);
  }

  /** Analyse un fichier importé (V2.x ou V3). Lève une erreur lisible si invalide. */
  function parseImport(text) {
    if (typeof text !== 'string' || text.length > 5e6) throw new Error('Fichier trop volumineux ou vide.');
    let raw;
    try { raw = JSON.parse(text); } catch (e) { throw new Error('Ce fichier n’est pas un JSON valide.'); }
    const { state, warnings } = E.normalizeState(raw);
    return { state, warnings, summary: { sessions: state.sessions.length, days: Object.keys(state.days).length, tests: state.tests.results.length, from: raw.schema === E.SCHEMA ? 'V3' : 'V2' } };
  }

  const sessionKey = s => [s.date, s.activity, s.context, s.duration, s.rpe].join('|');
  /** Fusion : n'écrase rien de l'existant, ajoute ce qui manque. */
  function merge(current, incoming) {
    const out = JSON.parse(JSON.stringify(current));
    const ids = new Set(out.sessions.map(s => s.id)), keys = new Set(out.sessions.map(sessionKey));
    let added = 0;
    for (const s of incoming.sessions) {
      if (ids.has(s.id) || keys.has(sessionKey(s))) continue;
      out.sessions.push(s); ids.add(s.id); keys.add(sessionKey(s)); added++;
    }
    out.sessions.sort((a, b) => a.date.localeCompare(b.date));
    for (const [d, v] of Object.entries(incoming.days)) if (!out.days[d]) out.days[d] = v;
    for (const c of incoming.checkins) if (!out.checkins.some(x => x.id === c.id)) out.checkins.push(c);
    for (const k of ['overrides', 'moves', 'skips']) for (const [d, v] of Object.entries(incoming.plan[k])) if (!(d in out.plan[k])) out.plan[k][d] = v;
    for (const r of incoming.tests.results) if (!out.tests.results.some(x => x.id === r.id || (x.key === r.key && x.value === r.value && x.date === r.date))) out.tests.results.push(r);
    return { state: out, added };
  }

  return { createStore, exportJSON, parseImport, merge, KEYS: { main: 'mission-forme-v3' } };
});
