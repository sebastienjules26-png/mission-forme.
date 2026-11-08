/* MISSION FORME V3 — interface. Toute la logique sportive est dans engine.js. */
(function () {
  'use strict';
  const E = window.MFEngine, S = window.MFStore;
  const VERSION = '3.3.2';
  if (!E || !S || E.API_VERSION !== VERSION || S.API_VERSION !== VERSION) {
    document.getElementById('view').textContent = 'Mise à jour en cours : ferme puis rouvre MISSION FORME dans quelques minutes. Tes données restent sur cet appareil.';
    return;
  }
  const $ = sel => document.querySelector(sel);

  /* ------------------------------------------------------------ sécurité HTML */
  class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
  const esc = v => String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const part = v => v instanceof Raw ? v.s : Array.isArray(v) ? v.map(part).join('') : (v === false || v === null || v === undefined) ? '' : esc(v);
  /** Gabarit HTML : toute valeur interpolée est échappée, sauf les fragments déjà construits avec h``. */
  function h(strings, ...vals) { let out = ''; strings.forEach((s, i) => { out += s; if (i < vals.length) out += part(vals[i]); }); return new Raw(out); }

  const ICONS = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="18" r="1.2"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/>',
    move: '<path d="M4 12h15M14 7l5 5-5 5"/>',
    skip: '<path d="M6 6l12 12M18 6 6 18"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    heart: '<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
    chevL: '<path d="m15 6-6 6 6 6"/>', chevR: '<path d="m9 6 6 6-6 6"/>',
    shield: '<path d="M12 3.5 5 6v6c0 4.2 3 7.4 7 8.5 4-1.1 7-4.3 7-8.5V6l-7-2.5z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'
  };
  const icon = (n, label) => new Raw('<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"' + (label ? ' role="img" aria-label="' + esc(label) + '"' : ' aria-hidden="true"') + '>' + ICONS[n] + '</svg>');
  function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.outerHTML = icon(el.dataset.icon).s; }); }

  /* ------------------------------------------------------------ stockage */
  function memoryStorage() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
  let storage, storageOK = true;
  try { storage = window.localStorage; storage.setItem('mf-probe', '1'); storage.removeItem('mf-probe'); }
  catch (e) { storage = memoryStorage(); storageOK = false; }
  const store = S.createStore(storage);
  const loaded = store.load();
  let state = loaded.state;
  const banners = [];
  if (!storageOK) banners.push({ kind: 'error', text: 'Le stockage de ce navigateur est bloqué : tes saisies seront perdues à la fermeture. Ouvre l’appli depuis son adresse web habituelle ou exporte tes données.' });
  if (loaded.notices.length) banners.push({ kind: loaded.error ? 'error' : 'info', text: loaded.notices[0], list: loaded.notices.slice(1), dismiss: true });

  const ui = { view: 'today', agendaMonth: E.todayISO().slice(0, 7), guardMode: false, journalFilter: 'all', programWeeks: 3, sheet: null, form: null, saveError: null };
  const today = () => E.todayISO();
  const clone = o => JSON.parse(JSON.stringify(o));

  /** Applique une modification, enregistre, rafraîchit, et propose l'annulation. */
  function commit(mutate, message, { undo = true } = {}) {
    if (loaded.readOnly) { toast('Modification bloquée : mets à jour l’application pour accéder à tes données.', { error: true }); return false; }
    const before = clone(state);
    mutate(state);
    const res = store.save(state);
    ui.saveError = res.ok ? null : res.error;
    render();
    if (!res.ok) toast(res.error, { error: true });
    else if (message) toast(message, undo ? { action: 'Annuler', onAction: () => { state = before; const r = store.save(state); ui.saveError = r.ok ? null : r.error; render(); toast(r.ok ? 'Modification annulée.' : r.error, { error: !r.ok }); } } : {});
    return res.ok;
  }
  window.addEventListener('storage', e => {
    if (e.key !== store.KEYS.main || !e.newValue) return;
    try { state = E.normalizeState(JSON.parse(e.newValue)).state; render(); toast('Données mises à jour depuis un autre onglet.'); } catch (_) { /* ignore */ }
  });

  /* ------------------------------------------------------------ toast */
  let toastTimer;
  function toast(text, { action, onAction, error = false } = {}) {
    const el = $('#toast');
    el.className = 'toast' + (error ? ' error' : '');
    el.innerHTML = h`<span>${text}</span>${action ? h`<button type="button" data-toast-action>${action}</button>` : ''}`.s;
    el.hidden = false;
    if (action) el.querySelector('[data-toast-action]').onclick = () => { el.hidden = true; onAction(); };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, action ? 7000 : 3500);
  }

  /* ------------------------------------------------------------ formatage */
  const A = E.ACTIVITIES;
  const STATUS = { prevue: 'Prévue', adaptee: 'Adaptée', bonus: 'Facultative', faite: 'Faite', stop: 'Pause douleur', recup: 'Récupération', garde: 'Garde', repos: 'Repos', passee: 'Passée' };
  function whenLabel(date) {
    const d = E.diffDays(date, today());
    if (d === 0) return 'Aujourd’hui';
    if (d === 1) return 'Demain';
    if (d === -1) return 'Hier';
    const base = E.fmtDate(date);
    return base.charAt(0).toUpperCase() + base.slice(1) + (d > 1 && d < 7 ? ' · dans ' + d + ' jours' : '');
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const fmtShort = d => { const x = E.parseISO(d); return x.getDate() + ' ' + E.MONTHS[x.getMonth()]; };
  function sessionLine(s) {
    const bits = [s.duration + ' min'];
    if (s.running && s.running.distanceKm) bits.push(String(s.running.distanceKm).replace('.', ',') + ' km');
    if (s.rpe) bits.push('effort ' + s.rpe + '/10');
    if (s.pleasure) bits.push('plaisir ' + s.pleasure + '/10');
    if (s.pain && s.pain !== 'non') bits.push('douleur ' + (s.pain === 'legere' ? 'légère' : 'importante'));
    return bits.join(' · ');
  }

  /* ------------------------------------------------------------ rendu */
  function render() {
    document.querySelectorAll('.tabbar button').forEach(b => { if (b.dataset.view === ui.view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const t = today(), w = E.weekIndex(state, t);
    $('#weekChip').textContent = w < 0 ? 'Départ ' + fmtShort(state.settings.programStart) : 'Semaine ' + (w + 1);
    const views = { today: viewToday, program: viewProgram, agenda: viewAgenda, journal: viewJournal, goals: viewGoals, settings: viewSettings };
    $('#view').innerHTML = h`<div class="view">${renderBanners()}${views[ui.view]()}</div>`.s;
  }
  function renderBanners() {
    const list = banners.filter(b => !b.hidden).map((b, i) => h`<div class="banner ${b.kind}"><div class="grow">${b.text}${b.list && b.list.length ? h`<ul>${b.list.map(x => h`<li>${x}</li>`)}</ul>` : ''}</div>${b.dismiss ? h`<button class="link" data-action="dismiss-banner" data-i="${i}">OK</button>` : ''}</div>`);
    if (ui.saveError) list.push(h`<div class="banner error"><div class="grow">${ui.saveError}</div><button class="btn sm" data-action="export">Exporter</button></div>`);
    const last = state.settings.lastExportAt;
    if (ui.view === 'today' && state.sessions.length >= 5 && (!last || Date.now() - last > 30 * 864e5))
      list.push(h`<div class="banner warn"><div class="grow">${last ? 'Dernière sauvegarde il y a plus de 30 jours.' : 'Aucune sauvegarde exportée pour l’instant.'} Tes données ne sont que sur cet appareil.</div><button class="btn sm" data-action="export">${icon('download')} Sauvegarder</button></div>`);
    return list;
  }

  /* ---------- Aujourd'hui */
  function heroActions(it) {
    const id = it.origDate;
    switch (it.status) {
      case 'faite': return h`<div class="actions"><button class="btn" data-action="edit-session" data-id="${it.doneSessions[0].id}">${icon('edit')} Voir / corriger le bilan</button></div>`;
      case 'passee': return h`<div class="actions"><button class="btn" data-action="unskip" data-orig="${id}">${icon('undo')} Rétablir la séance</button></div>`;
      case 'repos': return h`<div class="actions"><button class="btn" data-action="day" data-date="${it.date}">${icon('calendar')} Modifier ce jour</button></div>`;
      case 'garde': return h`<div class="actions"><button class="btn primary" data-action="log-plan" data-orig="${id}">${icon('shield')} Saisir le sport de garde</button><button class="btn" data-action="day" data-date="${it.date}">Modifier la garde</button></div>`;
      case 'stop': return h`<div class="actions"><button class="btn primary" data-action="feel-ok">${icon('heart')} Je n’ai plus mal</button><button class="btn" data-action="log-plan" data-orig="${id}">J’ai bougé quand même</button></div>`;
      case 'recup': return h`<div class="actions"><button class="btn primary" data-action="checkin-sheet">${icon('heart')} Je me sens mieux</button><button class="btn" data-action="log-plan" data-orig="${id}">J’ai bougé quand même</button></div>`;
      default: return h`<div class="actions"><button class="btn primary" data-action="log-plan" data-orig="${id}">${icon('check')} C’est fait</button><button class="btn sm" data-action="edit-plan" data-orig="${id}" aria-label="Modifier la séance">${icon('edit')} Modifier</button><button class="btn sm" data-action="move-plan" data-orig="${id}" aria-label="Déplacer la séance">${icon('move')} Déplacer</button><button class="btn sm ghost" data-action="skip" data-orig="${id}" aria-label="Passer la séance">${icon('skip')} Passer</button></div>`;
    }
  }
  function heroCard(it) {
    if (!it) return h`<section class="hero"><div class="hero-when">Programme</div><div class="hero-title">Aucune séance planifiée</div><p class="reason">Vérifie tes créneaux dans les réglages.</p></section>`;
    const cls = it.status === 'stop' || it.status === 'recup' ? 'stop' : it.status === 'faite' ? 'done' : '';
    const metric = it.minutes > 0 && !['faite', 'garde', 'repos', 'passee'].includes(it.status)
      ? h`<div class="hero-metric"><b>${it.minutes}</b><span>min${A[it.activity] && A[it.activity].run ? ' de course' : ''}</span></div>` : '';
    return h`<section class="hero ${cls}" aria-labelledby="heroTitle">
      <div class="row between"><span class="hero-when">${whenLabel(it.date)}</span><span class="row">${it.custom ? h`<span class="pill custom">Personnalisée</span>` : ''}<span class="pill ${it.status}">${STATUS[it.status]}</span></span></div>
      <div class="hero-title" id="heroTitle">${it.title}</div>
      ${metric}
      ${it.proximityWarning ? h`<div class="proximity-alert" role="status"><b>⚠ Séances rapprochées</b><p>${it.reasons[it.reasons.length - 1]}</p><button class="btn sm" data-action="move-plan" data-orig="${it.origDate}">Choisir un autre jour</button></div>` : ''}
      ${it.reasons.length ? h`<ul class="reasons">${it.reasons.slice(0, 3).map(r => h`<li>${r}</li>`)}</ul>` : ''}
      <details class="more"><summary>Voir le déroulé</summary><ol class="steps">${it.steps.map(s => h`<li>${s}</li>`)}</ol></details>
      ${heroActions(it)}
    </section>`;
  }
  function todayCheckin() { return state.checkins.find(c => c.date === today()) || null; }
  function checkinCard() {
    const c = todayCheckin() || {};
    const chip = (field, value, label, extra = '') => h`<button class="chip ${extra}" data-action="checkin" data-field="${field}" data-value="${value}" aria-pressed="${String(c[field] === value)}">${label}</button>`;
    return h`<section class="card" aria-labelledby="feelTitle">
      <div class="row between"><h2 id="feelTitle">Comment tu te sens ?</h2><span class="small muted">${todayCheckin() ? 'Enregistré' : 'Facultatif · 1 geste'}</span></div>
      <div class="checkin-grid">
        <div><div class="label">Énergie</div><div class="chips">${chip('energy', 3, '😴 Fatigué')}${chip('energy', 6, '🙂 Correct')}${chip('energy', 8, '⚡ En forme')}</div></div>
        <div><div class="label">Douleur</div><div class="chips">${chip('pain', 'non', 'Aucune')}${chip('pain', 'legere', 'Légère')}${chip('pain', 'importante', 'Importante', 'danger')}</div></div>
        <div><div class="label">Nuit</div><div class="chips">${chip('sleep', 'correct', 'Correcte')}${chip('sleep', 'court', 'Courte')}${chip('sleep', 'trescourt', 'Très courte')}</div></div>
      </div>
      <p class="small muted" style="margin-top:10px">Ce qui n’est pas renseigné reste inconnu : rien n’est supposé à ta place.</p>
    </section>`;
  }
  function weekCard() {
    const t = today(), mon = E.mondayOf(t), sum = E.weekSummary(state, mon);
    const target = state.settings.weeklyRuns, minT = state.settings.weeklyMinutes;
    const runsCounted = sum.runs + E.runsThisWeek(state, E.addDays(mon, 7)).unloggedGuards;
    const plan = E.generatePlan(state, mon, 7);
    const dots = [0, 1, 2, 3, 4, 5, 6].map(i => {
      const d = E.addDays(mon, i), done = state.sessions.some(s => s.date === d), it = plan.find(p => p.date === d), day = state.days[d];
      const cls = [d === t ? 'today' : '', done ? 'done' : day && day.type === 'garde' ? 'guard' : it && !['passee', 'repos'].includes(it.status) ? 'planned' : ''].join(' ');
      const mark = done ? '✓' : day && day.type === 'garde' ? '🛡' : it && !['passee', 'repos'].includes(it.status) ? '•' : '';
      return h`<div class="dot ${cls}">${E.DAY_SHORT[E.weekday(d)].charAt(0)}<i>${mark}</i></div>`;
    });
    const p = Math.min(100, Math.round(runsCounted / target * 100));
    const pm = Math.min(100, Math.round(sum.runMinutes / minT * 100));
    return h`<section class="card" aria-labelledby="weekTitle">
      <div class="row between"><h2 id="weekTitle">Ma semaine</h2><button class="link" data-action="go" data-view="journal">Journal</button></div>
      <div class="week-card">
        <div class="ring" style="--p:${p}" role="img" aria-label="${runsCounted} sorties sur ${target}"><span><b>${runsCounted}/${target}</b><small>sorties</small></span></div>
        <div>
          <div class="row between small"><span class="muted">Minutes de course</span><b>${sum.runMinutes} / ${minT}</b></div>
          <div class="bar" style="--p:${pm}"><i></i></div>
          <p class="small muted" style="margin-top:8px">${sum.guardOrFamily ? sum.guardOrFamily + ' activité(s) en garde ou en famille comptée(s). ' : ''}Objectif indicatif : rien à rattraper.</p>
        </div>
      </div>
      <div class="dots" aria-hidden="true">${dots}</div>
    </section>`;
  }
  function coachCard() {
    const c = E.coachWeek(state, today());
    const pleasure = c.pleasure === null ? 'Non renseigné' : c.pleasure.toFixed(1).replace('.', ',') + '/10';
    return h`<section class="card coach-card" aria-labelledby="coachWeekTitle">
      <div class="row between"><h2 id="coachWeekTitle">Le regard du coach</h2><span class="pill">7 derniers jours</span></div>
      <div class="coach-summary">
        <div><strong>${c.runs}</strong><span>sortie(s) course</span></div>
        <div><strong>${c.runMinutes} min</strong><span>course réalisée</span></div>
        <div><strong>${pleasure}</strong><span>plaisir renseigné</span></div>
      </div>
      <div class="coach-message ${c.level}"><b>${c.title}</b><p>${c.message}</p></div>
      <p class="small muted">Analyse fondée sur tes activités et ressentis enregistrés. Les valeurs absentes ne sont pas estimées. Aucun changement automatique du programme.</p>
    </section>`;
  }
  function viewToday() {
    const t = today(), it = E.nextItem(state, t), w = E.weekIndex(state, t), ph = E.phaseOf(Math.max(0, w));
    const recent = state.sessions.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 3);
    const review = state.sessions.filter(s => s.needsReview).length;
    return h`
      <div class="view-head"><div class="eyebrow">${cap(E.fmtDate(t))}</div><h1>${w < 0 ? 'Prêt pour la reprise' : 'Ta mission du jour'}</h1>
      <p>${w < 0 ? 'Le cycle démarre le ' + E.fmtDate(state.settings.programStart) + '.' : 'Phase ' + ph.id + ' · ' + ph.name}</p></div>
      ${review ? h`<div class="banner warn"><div class="grow">${review} activité(s) importée(s) à préciser (discipline inconnue).</div><button class="btn sm" data-action="review">Préciser</button></div>` : ''}
      <div class="stack">
        ${heroCard(it)}
        ${checkinCard()}
        ${weekCard()}
        ${coachCard()}
        <section class="card soft">
          <div class="row between"><h2>Dernières activités</h2><button class="link" data-action="log">+ Ajouter</button></div>
          ${recent.length ? recent.map(entryRow) : h`<p class="muted">Rien d’enregistré pour l’instant. Après ta prochaine séance, touche « C’est fait ».</p>`}
        </section>
      </div>`;
  }
  function entryRow(s) {
    return h`<button class="entry" data-action="edit-session" data-id="${s.id}">
      <span class="emo" aria-hidden="true">${A[s.activity].emoji}</span>
      <span><b>${A[s.activity].label}${s.context !== 'perso' ? ' · ' + E.CONTEXTS[s.context].toLowerCase() : ''}${s.needsReview ? h` <span class="pill adaptee">À préciser</span>` : ''}</b><small>${cap(E.fmtDate(s.date))} · ${sessionLine(s)}</small></span>
      <span class="right">${s.duration}′</span></button>`;
  }

  /* ---------- Programme */
  function sessionCard(it) {
    const t = today();
    const actions = ['prevue', 'adaptee', 'bonus'].includes(it.status)
      ? h`<div class="actions"><button class="btn sm primary" data-action="log-plan" data-orig="${it.origDate}">${icon('check')} Évaluer</button><button class="btn sm" data-action="edit-plan" data-orig="${it.origDate}">${icon('edit')} Modifier</button><button class="btn sm" data-action="move-plan" data-orig="${it.origDate}">${icon('move')} Déplacer</button><button class="btn sm ghost" data-action="skip" data-orig="${it.origDate}">${icon('skip')} Passer</button></div>`
      : heroActions(it);
    const sub = it.status === 'faite' ? 'Réalisée · ' + it.minutes + ' min' : it.minutes ? it.minutes + ' min' + (A[it.activity] && A[it.activity].run ? ' de course' : '') : '';
    return h`<article class="session ${it.date === t ? 'is-today' : ''}">
      <div class="session-top"><span class="session-date">${whenLabel(it.date)}${it.moved ? ' · déplacée' : ''}</span><span class="row">${it.custom ? h`<span class="pill custom">Perso</span>` : ''}<span class="pill ${it.status}">${STATUS[it.status]}</span></span></div>
      <div class="session-title">${it.title}</div>
      ${sub ? h`<div class="session-sub">${sub}</div>` : ''}
      ${it.proximityWarning ? h`<div class="proximity-alert" role="status"><b>⚠ Deux courses rapprochées</b><p>${it.reasons[it.reasons.length - 1]}</p><button class="btn sm" data-action="move-plan" data-orig="${it.origDate}">Déplacer cette séance</button></div>` : ''}
      <details class="more"><summary>Déroulé et explications</summary><ol class="steps">${it.steps.map(s => h`<li>${s}</li>`)}</ol>${it.reasons.length ? h`<ul class="reasons">${it.reasons.map(r => h`<li>${r}</li>`)}</ul>` : ''}</details>
      ${actions}
    </article>`;
  }
  function viewProgram() {
    const t = today(), start = E.mondayOf(t > state.settings.programStart ? t : state.settings.programStart);
    const plan = E.generatePlan(state, start, ui.programWeeks * 7);
    const weeks = [];
    for (let i = 0; i < ui.programWeeks; i++) {
      const mon = E.addDays(start, i * 7), w = E.weekIndex(state, mon), ph = E.phaseOf(Math.max(0, w));
      const items = plan.filter(p => p.date >= mon && p.date < E.addDays(mon, 7));
      const bonus = E.bonusForWeek(state, mon);
      weeks.push(h`<section class="week-block">
        <div class="week-head"><h2>Semaine ${w + 1} · ${fmtShort(mon)} – ${fmtShort(E.addDays(mon, 6))}</h2>${[3, 7, 11, 15].includes(w) ? h`<span class="pill">Allégée</span>` : ''}</div>
        <p class="small muted" style="margin:-4px 2px 10px">Phase ${ph.id} · ${ph.name}</p>
        ${items.length ? items.map(sessionCard) : h`<p class="muted">Aucun créneau cette semaine.</p>`}
        ${bonus ? h`<article class="session bonus-card"><div class="session-top"><span class="session-date">Bonus de la semaine · quand tu veux</span><span class="pill">Facultatif</span></div><div class="session-title">${A[bonus.activity].emoji} ${bonus.title}</div><details class="more"><summary>Déroulé</summary><ol class="steps">${bonus.steps.map(s => h`<li>${s}</li>`)}</ol><p class="small muted">Seulement si la récupération est bonne. Enregistre-la avec le bouton « Activité ».</p></details></article>` : ''}
      </section>`);
    }
    return h`<div class="view-head"><div class="eyebrow">Programme</div><h1>Mes séances</h1><p>La course d’abord. Chaque séance s’adapte à tes bilans, ressentis et gardes.</p></div>
      ${weeks}
      ${ui.programWeeks < 12 ? h`<button class="btn block" data-action="more-weeks">Voir les semaines suivantes</button>` : ''}`;
  }

  /* ---------- Agenda */
  function viewAgenda() {
    const [y, m] = ui.agendaMonth.split('-').map(Number);
    const first = ui.agendaMonth + '-01', days = new Date(y, m, 0).getDate(), offset = (E.weekday(first) + 6) % 7, t = today();
    const plan = E.generatePlan(state, first, days);
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(h`<div class="day out" aria-hidden="true"></div>`);
    for (let i = 1; i <= days; i++) {
      const d = ui.agendaMonth + '-' + String(i).padStart(2, '0'), day = state.days[d], it = plan.find(p => p.date === d), done = state.sessions.filter(s => s.date === d);
      const tags = [];
      if (day && day.type === 'garde') tags.push(h`<span class="tag garde">🛡${day.forced === 'course' ? '🏃' : day.forced === 'natation' ? '🏊' : ''}</span>`);
      if (day && day.type === 'repos') tags.push(h`<span class="tag repos">💤</span>`);
      if (day && day.type === 'bureau') tags.push(h`<span class="tag repos">💼</span>`);
      if (done.length) tags.push(h`<span class="tag done">✓${done.length > 1 ? done.length : ''}</span>`);
      else if (it && ['prevue', 'adaptee', 'bonus'].includes(it.status)) tags.push(h`<span class="tag run">${it.minutes}′</span>`);
      const label = E.fmtDate(d) + (day ? ', ' + day.type : '') + (done.length ? ', activité enregistrée' : '') + (it && !done.length ? ', séance ' + STATUS[it.status] : '');
      cells.push(h`<button class="day ${d === t ? 'today' : ''} ${d < t ? 'past' : ''}" data-action="day" data-date="${d}" aria-label="${label}"><b>${i}</b>${tags}</button>`);
    }
    const monthName = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return h`<div class="view-head"><div class="eyebrow">Agenda</div><h1>Gardes et disponibilités</h1><p>Touche un jour pour le modifier. Le programme se recalcule aussitôt.</p></div>
      <div class="stack ${ui.guardMode ? 'guard-mode' : ''}">
        <button class="toggle" data-action="guard-mode" aria-pressed="${String(ui.guardMode)}"><span><b>Saisie rapide des gardes</b><br><span class="small muted">${ui.guardMode ? 'Actif : chaque jour touché devient (ou n’est plus) une garde.' : 'Un geste par garde, idéal pour reporter ton planning du mois.'}</span></span><span class="switch" aria-hidden="true"></span></button>
        <section class="card">
          <div class="cal-head"><button class="icon-btn" data-action="month" data-delta="-1" aria-label="Mois précédent">${icon('chevL')}</button><h2>${monthName}</h2><button class="icon-btn" data-action="month" data-delta="1" aria-label="Mois suivant">${icon('chevR')}</button></div>
          <div class="cal">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => h`<div class="dow" aria-hidden="true">${x}</div>`)}${cells}</div>
          <p class="small muted" style="margin-top:10px">🛡 garde (🏃 course / 🏊 natation imposée) · 30′ séance prévue · ✓ activité faite · 💤 repos · 💼 bureau</p>
        </section>
      </div>`;
  }

  /* ---------- Journal */
  function viewJournal() {
    const t = today(), mon = E.mondayOf(t);
    const weeks = [7, 6, 5, 4, 3, 2, 1, 0].map(i => E.weekSummary(state, E.addDays(mon, -7 * i)));
    const max = Math.max(60, ...weeks.map(w => w.minutes));
    const runs = state.sessions.filter(E.isRun);
    const km = runs.reduce((a, s) => a + ((s.running && s.running.distanceKm) || 0), 0);
    const withP = state.sessions.filter(s => s.pleasure !== null);
    const filters = { all: 'Toutes', run: 'Course', other: 'Autres', review: 'À préciser' };
    let list = state.sessions.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
    if (ui.journalFilter === 'run') list = list.filter(E.isRun);
    if (ui.journalFilter === 'other') list = list.filter(s => !E.isRun(s));
    if (ui.journalFilter === 'review') list = list.filter(s => s.needsReview);
    const focusRows = Object.keys(E.FOCUS).map(f => ({ f, a: E.focusAdvice(state, f) })).filter(x => x.a && x.f !== 'autre');
    return h`<div class="view-head"><div class="eyebrow">Journal</div><h1>Mon historique</h1><p>Touche une activité pour la corriger ou la supprimer.</p></div>
      <div class="stack">
        <section class="card">
          <div class="row between"><h2>8 dernières semaines</h2><span class="small muted">minutes</span></div>
          <div class="chart" role="img" aria-label="Minutes d’activité par semaine">${weeks.map(w => h`<div class="col" title="${w.runMinutes} min de course, ${w.minutes - w.runMinutes} min autres"><span class="v">${w.minutes || ''}</span><div class="stack-bar" style="--h:${Math.round(w.minutes / max * 100)}"><div class="run" style="--r:${w.minutes ? Math.round(w.runMinutes / w.minutes * 100) : 0}"></div><div class="other" style="--o:${w.minutes ? Math.round((w.minutes - w.runMinutes) / w.minutes * 100) : 0}"></div></div><small>${fmtShort(w.monday).replace(/\.$/, '')}</small></div>`)}</div>
          <div class="legend"><span style="--c:var(--coral)">Course / trail</span><span style="--c:var(--plum-soft)">Autres sports</span></div>
        </section>
        <div class="stat-grid">
          <div class="stat"><small>Sorties course</small><b>${runs.length}</b></div>
          <div class="stat"><small>Temps de course</small><b>${runs.reduce((a, s) => a + s.duration, 0)} min</b></div>
          <div class="stat"><small>Distance saisie</small><b>${km.toFixed(1).replace('.', ',')} km</b></div>
          <div class="stat"><small>Plaisir moyen</small><b>${withP.length ? (withP.reduce((a, s) => a + s.pleasure, 0) / withP.length).toFixed(1).replace('.', ',') + '/10' : '—'}</b></div>
        </div>
        ${focusRows.length ? h`<section class="card soft"><h2>Suivi par mouvement</h2>${focusRows.map(x => h`<p><b>${E.FOCUS[x.f]}</b> — <span class="muted">${x.a.text}</span></p>`)}</section>` : ''}
        <div class="chips" role="group" aria-label="Filtrer">${Object.entries(filters).map(([k, l]) => h`<button class="chip" data-action="filter" data-value="${k}" aria-pressed="${String(ui.journalFilter === k)}">${l}</button>`)}</div>
        <div>${list.length ? list.map(entryRow) : h`<p class="muted">Aucune activité.</p>`}</div>
      </div>`;
  }

  /* ---------- Objectifs */
  function viewGoals() {
    const w = E.weekIndex(state, today());
    const phases = E.PHASES.map(p => {
      const from = E.addDays(E.mondayOf(state.settings.programStart), p.from * 7), to = E.addDays(E.mondayOf(state.settings.programStart), p.to * 7 + 6);
      const cls = w >= p.from && w <= p.to ? 'current' : w > p.to ? 'past' : '';
      return h`<article class="phase ${cls}"><div class="row between"><b>${p.id} · ${p.name}</b>${cls === 'current' ? h`<span class="pill prevue">En cours</span>` : ''}</div><p class="small muted">${fmtShort(from)} – ${fmtShort(to)}</p><p class="small"><b>Course :</b> ${p.run}</p><p class="small"><b>Compléments :</b> ${p.other}</p><p class="small muted"><b>Repère :</b> ${p.goal}</p></article>`;
    });
    const tests = state.tests.defs.map(d => {
      const st = E.testStatus(state, d.key);
      return h`<article class="card test-card">
        <div class="row between"><h3>${d.label}</h3>${d.confirmed ? h`<span class="pill faite">Barème confirmé</span>` : h`<span class="pill adaptee">À confirmer</span>`}</div>
        <div class="row between"><div><small class="muted">Dernier résultat</small><div class="test-val">${st.last ? E.fmtTestValue(d, st.last.value) : '—'}</div><small class="muted">${st.last ? (st.last.date ? fmtShort(st.last.date) : 'date inconnue') + (st.last.note ? ' · ' + st.last.note : '') : 'Pas encore de repère'}</small></div>
        <div style="text-align:right"><small class="muted">Objectif</small><div class="test-val" style="font-size:22px">${d.target !== null ? E.fmtTestValue(d, d.target) : '—'}</div><small class="muted">${E.TEST_UNITS[d.unit]}${st.reached === true ? ' · atteint ✓' : ''}</small></div></div>
        <div class="actions"><button class="btn sm primary" data-action="test-add" data-key="${d.key}">${icon('plus')} Résultat</button><button class="btn sm" data-action="test-edit" data-key="${d.key}">${icon('edit')} Objectif</button>${st.history.length ? h`<button class="btn sm ghost" data-action="test-history" data-key="${d.key}">Historique (${st.history.length})</button>` : ''}</div>
      </article>`;
    });
    return h`<div class="view-head"><div class="eyebrow">Objectifs</div><h1>Cap sur mars 2027</h1><p>Courir avec plaisir d’abord. Les tests BSPP viennent en complément, sans tests maximaux rapprochés.</p></div>
      <div class="stack">
        <section class="card"><h2>Objectif hebdomadaire</h2>
          <div class="two-cols">
            <div class="field"><span class="label">Sorties / semaine</span><div class="stepper"><button class="btn" data-action="goal" data-k="weeklyRuns" data-d="-1" aria-label="Moins de sorties">−</button><input type="text" readonly value="${state.settings.weeklyRuns}" aria-label="Sorties par semaine"><button class="btn" data-action="goal" data-k="weeklyRuns" data-d="1" aria-label="Plus de sorties">+</button></div></div>
            <div class="field"><span class="label">Minutes de course</span><div class="stepper"><button class="btn" data-action="goal" data-k="weeklyMinutes" data-d="-5" aria-label="Moins de minutes">−</button><input type="text" readonly value="${state.settings.weeklyMinutes}" aria-label="Minutes par semaine"><button class="btn" data-action="goal" data-k="weeklyMinutes" data-d="5" aria-label="Plus de minutes">+</button></div></div>
          </div><p class="small muted">Indicatif : au-delà, les séances deviennent facultatives. Jamais de rattrapage.</p></section>
        <div class="section-title"><h2>Tests BSPP</h2><span class="small muted">barèmes à confirmer</span></div>
        <div class="grid-2">${tests}</div>
        <div class="section-title"><h2>Mon parcours</h2></div>
        <div>${phases}</div>
      </div>`;
  }

  /* ---------- Réglages */
  function viewSettings() {
    const s = state.settings, theme = getTheme();
    const last = s.lastExportAt ? new Date(s.lastExportAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'jamais';
    const undo = store.readUndo();
    return h`<div class="view-head"><div class="eyebrow">Réglages</div><h1>Données et préférences</h1><p>Tout reste sur cet appareil. Pas de compte, pas de serveur, pas d’abonnement.</p></div>
      <div class="stack">
        <section class="card"><h2>Sauvegarde</h2>
          <p class="muted">Dernier export : <b>${last}</b>. ${state.sessions.length} activité(s), ${Object.keys(state.days).length} jour(s) d’agenda.</p>
          <div class="actions"><button class="btn primary" data-action="export">${icon('download')} Exporter (JSON)</button><button class="btn" data-action="import">${icon('upload')} Importer</button></div>
          <p class="small muted" style="margin-top:10px">L’import accepte les sauvegardes de la V2 (« mission_forme_sauvegarde.json ») et de la V3. Tu choisis ensuite de fusionner ou de remplacer.</p>
          ${undo ? h`<div class="banner" style="margin-top:12px"><div class="grow">Annuler le dernier ${undo.label} (${new Date(undo.at).toLocaleString('fr-FR')}).</div><button class="btn sm" data-action="undo-big">${icon('undo')} Restaurer</button></div>` : ''}
        </section>
        <section class="card"><h2>Programme</h2>
          <div class="field"><label for="startDate">Début du cycle de reprise</label><input id="startDate" type="date" value="${s.programStart}" data-action-change="start"></div>
          <div class="field"><span class="label">Jours de séance (1 à 4)</span><div class="chips">${[1, 2, 3, 4, 5, 6, 0].map(d => h`<button class="chip" data-action="slot" data-d="${d}" aria-pressed="${String(s.slots.includes(d))}">${E.DAY_SHORT[d]}</button>`)}</div></div>
          <p class="small muted">Par défaut : mardi et jeudi, tes créneaux de 90 min.</p>
        </section>
        <section class="card"><h2>Apparence</h2><div class="chips">${[['auto', 'Automatique'], ['dark', 'Sombre'], ['light', 'Clair']].map(([k, l]) => h`<button class="chip" data-action="theme" data-value="${k}" aria-pressed="${String(theme === k)}">${l}</button>`)}</div></section>
        <section class="card soft"><h2>Garmin Connect</h2><p class="muted">Pas encore connecté. L’appli est prête à recevoir des activités importées (champ source et identifiant externe), mais aucune synchronisation n’est active. Ne saisis jamais ton mot de passe Garmin dans une page tierce.</p></section>
        <section class="card soft"><h2>Installer sur l’appareil</h2><p class="muted small"><b>Android (Chrome)</b> : menu ⋮ → « Ajouter à l’écran d’accueil ». <b>Windows (Edge ou Chrome)</b> : icône d’installation dans la barre d’adresse. L’appli fonctionne ensuite hors connexion.</p><p class="small muted">Stockage : ${storageOK ? 'disponible' : 'bloqué'}${ui.persisted === true ? ' · protégé contre le nettoyage automatique' : ui.persisted === false ? ' · non protégé (installe l’appli pour le protéger)' : ''}.</p></section>
        <section class="card soft"><h2>Effacer</h2><p class="muted small">Supprime toutes les données de cet appareil. Une confirmation est demandée et une restauration reste possible juste après.</p><button class="btn danger" data-action="clear">${icon('trash')} Effacer les données locales</button></section>
        <p class="small muted" style="text-align:center">MISSION FORME ${VERSION} · Conseils indicatifs, pas un avis médical.</p>
      </div>`;
  }

  /* ------------------------------------------------------------ feuilles */
  function openSheet(html, onMount) {
    const root = $('#sheetRoot');
    $('#sheetBody').innerHTML = html.s;
    root.hidden = false;
    document.body.style.overflow = 'hidden';
    ui.lastFocus = document.activeElement;
    if (onMount) onMount($('#sheetBody'));
    const f = $('#sheetBody').querySelector('[autofocus]') || $('#sheetBody').querySelector('h2');
    if (f) { f.setAttribute('tabindex', '-1'); f.focus(); }
  }
  function closeSheet() {
    $('#sheetRoot').hidden = true; $('#sheetBody').innerHTML = ''; document.body.style.overflow = ''; ui.form = null;
    if (ui.lastFocus && document.contains(ui.lastFocus)) ui.lastFocus.focus();
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheetRoot').hidden) closeSheet(); });

  const chips = (field, options, value, { danger = [] } = {}) => h`<div class="chips" role="group">${options.map(([v, l]) => h`<button type="button" class="chip ${danger.includes(v) ? 'danger' : ''}" data-chip="${field}" data-value="${v}" aria-pressed="${String(value === v)}">${l}</button>`)}</div>`;
  const scale = (field, value, lo, hi) => h`<div class="scale" role="group">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => h`<button type="button" class="chip" data-chip="${field}" data-value="${n}" data-num="1" aria-pressed="${String(value === n)}">${n}</button>`)}</div><div class="scale-legend"><span>${lo}</span><span>${hi}</span></div>`;

  /** Bilan : nouvelle activité, séance du programme, ou correction d'une activité existante. */
  function openBilan({ session = null, plan = null, date = null } = {}) {
    const s = session || {};
    const isEdit = !!session;
    const it = plan;
    const defaultActivity = it ? (it.status === 'garde' ? (state.days[it.date] && state.days[it.date].forced === 'natation' ? 'natation' : state.days[it.date] && state.days[it.date].forced === 'course' ? 'course' : null) : it.activity) : null;
    const planDate = it ? (it.date > today() ? today() : it.date) : null;
    ui.form = {
      id: s.id || null, planId: s.planId || (it ? it.id : null), date: s.date || planDate || date || today(),
      activity: s.activity || defaultActivity || null, context: s.context || (it && it.status === 'garde' ? 'garde' : 'perso'),
      duration: s.duration || (it && it.minutes ? it.minutes : null), rpe: s.rpe || null, pleasure: s.pleasure || null, energy: s.energy || null, sleep: s.sleep || null,
      pain: s.pain || null, painArea: s.painArea || '', result: s.result || null, focus: s.focus || null, notes: s.notes || '',
      running: Object.assign({ distanceKm: null, avgHr: null, elevationM: null, terrain: null }, s.running || {}),
      detail: Object.assign({ sets: null, reps: null, load: null, seconds: null }, s.detail || {}),
      source: s.source || (it ? 'planning' : 'manuel'), createdAt: s.createdAt || null
    };
    const f = ui.form;
    const actOpts = Object.entries(A).map(([k, v]) => [k, v.emoji + ' ' + v.short]);
    const num = (name, label, val, attrs = '') => h`<div class="field"><label for="f_${name}">${label}</label><input id="f_${name}" type="number" inputmode="decimal" data-num-field="${name}" value="${val === null ? '' : val}" ${new Raw(attrs)}></div>`;
    openSheet(h`<h2 id="sheetTitle">${isEdit ? 'Corriger l’activité' : it ? 'Bilan : ' + it.title : 'Nouvelle activité'}</h2>
      ${it && it.date > today() ? h`<p class="small muted">Séance prévue ${whenLabel(it.date).toLowerCase()} : enregistrée à la date d’aujourd’hui (modifiable).</p>` : ''}
      ${s.needsReview ? h`<div class="banner warn"><div class="grow">Activité importée de la V2 sans discipline : choisis-la ci-dessous.</div></div>` : ''}
      <div class="field"><span class="label">Activité <span class="req">*</span></span>${chips('activity', actOpts, f.activity)}</div>
      <div class="field"><span class="label">Contexte</span>${chips('context', Object.entries(E.CONTEXTS), f.context)}</div>
      <div class="two-cols date-dur">
        <div class="field"><label for="f_date">Date <span class="req">*</span></label><input id="f_date" type="date" value="${f.date}" max="${today()}" data-text-field="date"></div>
        <div class="field"><label for="f_duration">Durée (min) <span class="req">*</span></label><div class="stepper"><button type="button" class="btn" data-step="duration" data-d="-5" aria-label="Moins 5 minutes">−</button><input id="f_duration" type="number" inputmode="numeric" min="1" max="600" data-num-field="duration" value="${f.duration === null ? '' : f.duration}"><button type="button" class="btn" data-step="duration" data-d="5" aria-label="Plus 5 minutes">+</button></div></div>
      </div>
      <div class="field"><span class="label">Effort ressenti <span class="req">*</span></span>${scale('rpe', f.rpe, 'Très facile', 'Maximal')}</div>
      <div class="field"><span class="label">Douleur <span class="req">*</span></span>${chips('pain', [['non', 'Aucune'], ['legere', 'Légère'], ['importante', 'Importante']], f.pain, { danger: ['importante'] })}
        <input type="text" maxlength="60" placeholder="Zone (genou, mollet…) — facultatif" data-text-field="painArea" value="${f.painArea}" aria-label="Zone de la douleur" ${f.pain && f.pain !== 'non' ? '' : new Raw('hidden')} id="f_painArea"></div>
      <div class="field"><span class="label">Plaisir <span class="muted">(facultatif)</span></span>${scale('pleasure', f.pleasure, 'Aucun', 'Énorme')}</div>
      <details class="more" ${s.energy || s.sleep || s.running || s.detail || s.notes ? new Raw('open') : ''}><summary>Plus de détails (facultatif)</summary>
        <div class="field" style="margin-top:10px"><span class="label">Énergie du jour</span>${scale('energy', f.energy, 'Épuisé', 'Au top')}</div>
        <div class="field"><span class="label">Sommeil récent</span>${chips('sleep', [['correct', 'Correct'], ['court', 'Court'], ['trescourt', 'Très insuffisant']], f.sleep)}</div>
        <div class="field"><span class="label">Résultat</span>${chips('result', [['facile', 'Facile'], ['ok', 'Réussi avec effort'], ['difficile', 'Difficile / incomplet']], f.result)}</div>
        <div class="field"><span class="label">Mouvement suivi</span>${chips('focus', Object.entries(E.FOCUS), f.focus)}</div>
        <div id="runFields" ${f.activity && A[f.activity].run ? '' : new Raw('hidden')}>
          <div class="two-cols">${num('distanceKm', 'Distance (km)', f.running.distanceKm, 'step="0.01" min="0"')}${num('avgHr', 'FC moyenne (bpm)', f.running.avgHr, 'min="30" max="240"')}</div>
          <div class="two-cols">${num('elevationM', 'Dénivelé + (m)', f.running.elevationM, 'min="0"')}<div class="field"><label for="f_terrain">Terrain</label><select id="f_terrain" data-text-field="terrain"><option value="">—</option>${E.TERRAINS.map(t => h`<option value="${t}" ${f.running.terrain === t ? new Raw('selected') : ''}>${cap(t)}</option>`)}</select></div></div>
        </div>
        <div class="two-cols">${num('sets', 'Séries', f.detail.sets, 'min="1" max="30"')}${num('reps', 'Répétitions / série', f.detail.reps, 'min="1"')}</div>
        <div class="two-cols">${num('load', 'Charge (kg)', f.detail.load, 'step="0.5" min="0"')}${num('seconds', 'Durée / série (s)', f.detail.seconds, 'min="1"')}</div>
        <div class="field"><label for="f_notes">Notes</label><textarea id="f_notes" maxlength="2000" data-text-field="notes" placeholder="Allure, sensations, exercices…">${f.notes}</textarea></div>
      </details>
      <p class="error" id="formError" role="alert"></p>
      <div class="sheet-foot">${isEdit ? h`<button type="button" class="btn danger" data-action="delete-session" data-id="${s.id}" aria-label="Supprimer">${icon('trash')}</button>` : ''}<button type="button" class="btn" data-action="close-sheet">Annuler</button><button type="button" class="btn primary" data-action="save-bilan">${icon('check')} Enregistrer</button></div>`);
  }

  function readBilan() {
    const f = ui.form, errs = [];
    if (!f.activity) errs.push('choisis l’activité');
    if (!E.isISO(f.date)) errs.push('date invalide');
    else if (f.date > today()) errs.push('date dans le futur');
    const dur = Number(f.duration);
    if (!Number.isInteger(dur) || dur < 1 || dur > 600) errs.push('durée entre 1 et 600 min');
    if (!f.rpe) errs.push('indique l’effort');
    if (!f.pain) errs.push('indique s’il y a une douleur');
    const nums = [['distanceKm', 0.01, 300], ['avgHr', 30, 240], ['elevationM', 0, 10000]];
    for (const [k, lo, hi] of nums) { const v = f.running[k]; if (v !== null && (v < lo || v > hi)) errs.push(k === 'avgHr' ? 'FC entre 30 et 240' : k === 'distanceKm' ? 'distance invalide' : 'dénivelé invalide'); }
    if (errs.length) return { error: 'À compléter : ' + errs.join(', ') + '.' };
    const raw = Object.assign({}, f, { duration: dur, needsReview: false, updatedAt: Date.now(), createdAt: f.createdAt || Date.now() });
    if (!A[f.activity].run) delete raw.running;
    const s = E.normalizeSession(raw);
    return s ? { session: s } : { error: 'Données invalides.' };
  }

  function openEditPlan(it) {
    openSheet(h`<h2 id="sheetTitle">Modifier la séance</h2><p class="small muted">${cap(E.fmtDate(it.date))}. Tes changements sont conservés ; tu peux revenir au programme proposé à tout moment.</p>
      <div class="field"><label for="p_title">Nom</label><input id="p_title" type="text" maxlength="100" value="${it.title}"></div>
      <div class="field"><label for="p_min">Durée prévue (min)</label><input id="p_min" type="number" min="0" max="240" value="${it.minutes}"></div>
      <div class="field"><label for="p_steps">Contenu (une consigne par ligne)</label><textarea id="p_steps" rows="7">${it.steps.join('\n')}</textarea></div>
      <p class="error" id="formError" role="alert"></p>
      <div class="sheet-foot">${it.custom ? h`<button class="btn" data-action="plan-reset" data-orig="${it.origDate}">${icon('undo')} Programme proposé</button>` : h`<button class="btn" data-action="close-sheet">Annuler</button>`}<button class="btn primary" data-action="plan-save" data-orig="${it.origDate}">Enregistrer</button></div>`);
  }

  function openMove(it) {
    const t = today(), opts = [];
    for (let i = -3; i <= 7; i++) {
      const d = E.addDays(it.origDate, i);
      if (d < t) continue;
      const day = state.days[d], busy = E.generatePlan(state, d, 1).some(p => p.date === d && p.origDate !== it.origDate);
      const trial = clone(state);
      if (d === it.origDate) delete trial.plan.moves[it.origDate]; else trial.plan.moves[it.origDate] = d;
      const preview = E.generatePlan(trial, E.addDays(d, -1), 3).find(p => p.origDate === it.origDate);
      const near = !!(preview && preview.proximityWarning);
      opts.push(h`<button class="chip" data-action="move-to" data-orig="${it.origDate}" data-date="${d}" aria-pressed="${String(d === it.date)}">${E.DAY_SHORT[E.weekday(d)]} ${E.parseISO(d).getDate()}${day && day.type === 'garde' ? ' 🛡' : day && day.type === 'repos' ? ' · repos' : busy ? ' · séance' : ''}${near ? ' ⚠ courses proches' : ''}</button>`);
    }
    openSheet(h`<h2 id="sheetTitle">Déplacer la séance</h2><p class="small muted">Initialement prévue ${E.fmtDate(it.origDate)}. Choisis le nouveau jour : les séances rapprochées seront signalées, sans déplacement automatique.</p>
      <div class="chips">${opts}</div>
      <div class="sheet-foot"><button class="btn" data-action="close-sheet">Fermer</button></div>`);
  }

  function openDay(date) {
    const day = state.days[date] || { type: null, forced: '' };
    const sessions = state.sessions.filter(s => s.date === date);
    ui.form = { date, type: day.type, forced: day.forced || '' };
    openSheet(h`<h2 id="sheetTitle">${cap(E.fmtDate(date))}</h2>
      <div class="field"><span class="label">Type de journée</span>${chips('type', [['bureau', 'Bureau'], ['garde', '🛡 Garde 24 h'], ['repos', 'Repos / indispo'], ['libre', 'Disponible']], day.type)}</div>
      <div class="field" id="forcedField" ${day.type === 'garde' ? '' : new Raw('hidden')}><span class="label">Sport imposé pendant la garde</span>${chips('forced', [['', 'Non connu'], ['course', 'Course'], ['natation', 'Natation'], ['autre', 'Autre']], day.forced || '')}</div>
      ${sessions.length ? h`<div class="field"><span class="label">Activités ce jour</span>${sessions.map(entryRow)}</div>` : ''}
      <div class="sheet-foot">${state.days[date] ? h`<button class="btn" data-action="day-clear" data-date="${date}">Effacer</button>` : ''}<button class="btn" data-action="log-on" data-date="${date}">${icon('plus')} Activité</button><button class="btn primary" data-action="day-save">Enregistrer</button></div>`);
  }

  function confirmSheet({ title, text, ok = 'Confirmer', danger = false, onOk }) {
    ui.confirm = onOk;
    openSheet(h`<h2 id="sheetTitle">${title}</h2><p class="muted">${text}</p><div class="sheet-foot"><button class="btn" data-action="close-sheet" autofocus>Annuler</button><button class="btn ${danger ? 'danger' : 'primary'}" data-action="confirm-ok">${ok}</button></div>`);
  }

  function openTestAdd(key) {
    const d = state.tests.defs.find(x => x.key === key);
    openSheet(h`<h2 id="sheetTitle">Résultat · ${d.label}</h2><p class="small muted">Inutile de faire le test à fond : un repère sous-maximal suffit pour suivre la progression.</p>
      <div class="two-cols"><div class="field"><label for="t_date">Date</label><input id="t_date" type="date" value="${today()}" max="${today()}"></div>
      <div class="field"><label for="t_val">Valeur (${E.TEST_UNITS[d.unit]})</label><input id="t_val" type="text" inputmode="${d.unit === 'time' ? 'text' : 'decimal'}" placeholder="${d.unit === 'time' ? 'ex. 9:45' : 'ex. 30'}" autofocus></div></div>
      <div class="field"><label for="t_note">Note</label><input id="t_note" type="text" maxlength="200" placeholder="Conditions, sous-maximal…"></div>
      <p class="error" id="formError" role="alert"></p>
      <div class="sheet-foot"><button class="btn" data-action="close-sheet">Annuler</button><button class="btn primary" data-action="test-save" data-key="${key}">Enregistrer</button></div>`);
  }
  function openTestEdit(key) {
    const d = state.tests.defs.find(x => x.key === key);
    openSheet(h`<h2 id="sheetTitle">Objectif · ${d.label}</h2>
      <div class="field"><label for="t_label">Nom de l’épreuve</label><input id="t_label" type="text" maxlength="60" value="${d.label}"></div>
      <div class="two-cols"><div class="field"><label for="t_unit">Unité</label><select id="t_unit">${Object.entries(E.TEST_UNITS).map(([k, l]) => h`<option value="${k}" ${d.unit === k ? new Raw('selected') : ''}>${l}</option>`)}</select></div>
      <div class="field"><label for="t_target">Objectif</label><input id="t_target" type="text" value="${d.target !== null ? E.fmtTestValue(d, d.target).replace(/ s$/, '') : ''}"></div></div>
      <div class="field"><span class="label">Sens</span>${chips('higher', [['1', 'Plus = mieux'], ['0', 'Moins = mieux (temps)']], d.higher ? '1' : '0')}</div>
      <div class="field"><span class="label">Barème</span>${chips('confirmed', [['0', 'À confirmer'], ['1', 'Confirmé (officiel)']], d.confirmed ? '1' : '0')}</div>
      <p class="error" id="formError" role="alert"></p>
      <div class="sheet-foot"><button class="btn" data-action="close-sheet">Annuler</button><button class="btn primary" data-action="test-def-save" data-key="${key}">Enregistrer</button></div>`, () => { ui.form = { higher: d.higher ? '1' : '0', confirmed: d.confirmed ? '1' : '0' }; });
  }
  function openTestHistory(key) {
    const st = E.testStatus(state, key);
    openSheet(h`<h2 id="sheetTitle">Historique · ${st.def.label}</h2>
      ${st.history.map(r => h`<div class="entry" style="grid-template-columns:1fr auto auto"><span><b>${E.fmtTestValue(st.def, r.value)}</b><small>${r.date ? cap(E.fmtDate(r.date)) : 'Date inconnue'}${r.note ? ' · ' + r.note : ''}</small></span><span></span><button class="icon-btn" data-action="test-del" data-id="${r.id}" aria-label="Supprimer ce résultat">${icon('trash')}</button></div>`)}
      <div class="sheet-foot"><button class="btn" data-action="close-sheet">Fermer</button></div>`);
  }
  function openCheckinSheet() {
    openSheet(h`<h2 id="sheetTitle">Comment tu te sens ?</h2>${checkinCard()}<div class="sheet-foot"><button class="btn primary" data-action="close-sheet">Terminé</button></div>`);
  }

  /* ------------------------------------------------------------ import / export */
  function exportData() {
    const now = Date.now();
    if (loaded.readOnly) {
      const raw = store.rawExport();
      if (!raw) { toast('Sauvegarde impossible : données originales introuvables.', { error: true }); return; }
      download(new Blob([raw], { type: 'application/json' }), 'mission_forme_donnees_originales_' + today() + '.json');
      toast('Copie brute des données originales téléchargée, sans modification.');
      return;
    }
    state.settings.lastExportAt = now;
    const res = store.save(state);
    const json = S.exportJSON(state, now);
    const name = 'mission_forme_' + today() + '.json';
    const blob = new Blob([json], { type: 'application/json' });
    const fileOK = typeof File === 'function';
    if (fileOK && navigator.canShare && navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
      const file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'Sauvegarde MISSION FORME' }).then(() => toast('Sauvegarde partagée.')).catch(() => download(blob, name));
        render(); return;
      }
    }
    download(blob, name);
    render();
    if (res.ok) toast('Sauvegarde téléchargée : ' + name);
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function handleImportText(text) {
    let parsed;
    try { parsed = S.parseImport(text); } catch (e) { toast(e.message, { error: true }); return; }
    ui.pendingImport = parsed;
    const sm = parsed.summary;
    openSheet(h`<h2 id="sheetTitle">Importer une sauvegarde ${sm.from}</h2>
      <p>${sm.sessions} activité(s), ${sm.days} jour(s) d’agenda, ${sm.tests} résultat(s) de test.</p>
      ${parsed.warnings.length ? h`<div class="banner warn"><div class="grow">À savoir :<ul>${parsed.warnings.slice(0, 6).map(w => h`<li>${w}</li>`)}</ul></div></div>` : ''}
      <p class="small muted"><b>Fusionner</b> ajoute ce qui manque sans rien écraser. <b>Remplacer</b> repart du fichier ; tes données actuelles restent restaurables depuis les réglages.</p>
      <div class="sheet-foot"><button class="btn" data-action="close-sheet">Annuler</button><button class="btn" data-action="import-replace">Remplacer</button><button class="btn primary" data-action="import-merge">Fusionner</button></div>`);
  }

  /* ------------------------------------------------------------ thème */
  function getTheme() { try { return storage.getItem('mission-forme-theme') || 'auto'; } catch (e) { return 'auto'; } }
  function applyTheme(t) { if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }

  /* ------------------------------------------------------------ actions */
  const planItem = orig => {
    const d = state.plan.moves[orig] || orig;
    return E.generatePlan(state, d, 1).find(i => i.origDate === orig) || E.generatePlan(state, orig, 1).find(i => i.origDate === orig);
  };
  const go = view => { ui.view = view; render(); window.scrollTo && window.scrollTo({ top: 0 }); $('#view').focus({ preventScroll: true }); };

  const actions = {
    go: el => go(el.dataset.view),
    log: () => openBilan(),
    'log-on': el => openBilan({ date: el.dataset.date }),
    'log-plan': el => { const it = planItem(el.dataset.orig); if (it) openBilan({ plan: it }); },
    'edit-session': el => { const s = state.sessions.find(x => x.id === el.dataset.id); if (s) openBilan({ session: s }); },
    review: () => { const s = state.sessions.find(x => x.needsReview); if (s) openBilan({ session: s }); },
    'close-sheet': closeSheet,
    'dismiss-banner': el => { banners[Number(el.dataset.i)].hidden = true; render(); },
    'save-bilan': () => {
      const r = readBilan();
      if (r.error) { $('#formError').textContent = r.error; return; }
      const s = r.session, isEdit = !!ui.form.id;
      closeSheet();
      commit(st => {
        const i = st.sessions.findIndex(x => x.id === s.id);
        if (i >= 0) st.sessions[i] = s; else st.sessions.push(s);
        st.sessions.sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));
      }, isEdit ? 'Activité corrigée · programme recalculé.' : s.pain === 'importante' ? 'Enregistré. Pause course jusqu’à ce que tu n’aies plus mal.' : 'Bravo, c’est enregistré · programme recalculé.');
    },
    'delete-session': el => {
      const id = el.dataset.id, s = state.sessions.find(x => x.id === id);
      confirmSheet({ title: 'Supprimer cette activité ?', text: A[s.activity].label + ' du ' + E.fmtDate(s.date) + ' (' + s.duration + ' min). Tu pourras annuler juste après.', ok: 'Supprimer', danger: true,
        onOk: () => commit(st => { st.sessions = st.sessions.filter(x => x.id !== id); }, 'Activité supprimée.') });
    },
    'confirm-ok': () => { const fn = ui.confirm; ui.confirm = null; closeSheet(); if (fn) fn(); },
    'edit-plan': el => { const it = planItem(el.dataset.orig); if (it) openEditPlan(it); },
    'plan-save': el => {
      const title = $('#p_title').value.trim(), minutes = Number($('#p_min').value), steps = $('#p_steps').value.split('\n').map(x => x.trim()).filter(Boolean);
      if (!title || !Number.isInteger(minutes) || minutes < 0 || minutes > 240 || !steps.length) { $('#formError').textContent = 'Il faut un nom, une durée entière entre 0 et 240 min et au moins une consigne.'; return; }
      const orig = el.dataset.orig; closeSheet();
      commit(st => { st.plan.overrides[orig] = { title: title.slice(0, 100), minutes, steps: steps.slice(0, 30).map(x => x.slice(0, 300)) }; }, 'Séance personnalisée.');
    },
    'plan-reset': el => { const orig = el.dataset.orig; closeSheet(); commit(st => { delete st.plan.overrides[orig]; }, 'Retour au programme proposé.'); },
    'move-plan': el => { const it = planItem(el.dataset.orig); if (it) openMove(it); },
    'move-to': el => { const orig = el.dataset.orig, d = el.dataset.date; closeSheet(); commit(st => { if (d === orig) delete st.plan.moves[orig]; else st.plan.moves[orig] = d; }, 'Séance déplacée au ' + E.fmtDate(d) + '.'); },
    skip: el => { const orig = el.dataset.orig; commit(st => { st.plan.skips[orig] = true; }, 'Séance passée, sans rattrapage.'); },
    unskip: el => { const orig = el.dataset.orig; commit(st => { delete st.plan.skips[orig]; }, 'Séance rétablie.'); },
    checkin: el => {
      const field = el.dataset.field, raw = el.dataset.value, value = field === 'energy' ? Number(raw) : raw;
      const inSheet = !!el.closest('#sheetBody');
      commit(st => {
        let c = st.checkins.find(x => x.date === today());
        if (!c) { c = { id: E.uid(), date: today(), energy: null, sleep: null, pain: null, painArea: '', createdAt: Date.now() }; st.checkins.push(c); }
        c[field] = c[field] === value ? null : value; // second appui = effacer
        c.createdAt = Date.now();
        if (c.energy === null && c.sleep === null && c.pain === null) st.checkins = st.checkins.filter(x => x !== c);
      }, field === 'pain' && value === 'importante' ? 'Noté : pause course et avis médical si la douleur persiste.' : null, { undo: false });
      if (inSheet) openCheckinSheet();
    },
    'feel-ok': () => commit(st => {
      let c = st.checkins.find(x => x.date === today());
      if (!c) { c = { id: E.uid(), date: today(), energy: null, sleep: null, pain: null, painArea: '', createdAt: Date.now() }; st.checkins.push(c); }
      c.pain = 'non'; c.createdAt = Date.now();
    }, 'Noté. Reprise prudente, sans progression immédiate.'),
    'checkin-sheet': openCheckinSheet,
    'more-weeks': () => { ui.programWeeks += 3; render(); },
    day: el => {
      const d = el.dataset.date;
      if (ui.guardMode && ui.view === 'agenda') {
        commit(st => { if (st.days[d] && st.days[d].type === 'garde') delete st.days[d]; else st.days[d] = { type: 'garde', forced: (st.days[d] && st.days[d].forced) || '' }; }, null, { undo: false });
        return;
      }
      openDay(d);
    },
    'day-save': () => {
      const f = ui.form; closeSheet();
      commit(st => { if (!f.type) delete st.days[f.date]; else st.days[f.date] = { type: f.type, forced: f.type === 'garde' ? f.forced : '' }; }, 'Journée enregistrée · programme recalculé.');
    },
    'day-clear': el => { const d = el.dataset.date; closeSheet(); commit(st => { delete st.days[d]; }, 'Journée réinitialisée.'); },
    'guard-mode': () => { ui.guardMode = !ui.guardMode; render(); },
    month: el => { const [y, m] = ui.agendaMonth.split('-').map(Number); const d = new Date(y, m - 1 + Number(el.dataset.delta), 1); ui.agendaMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); render(); },
    filter: el => { ui.journalFilter = el.dataset.value; render(); },
    goal: el => {
      const k = el.dataset.k, d = Number(el.dataset.d), lim = k === 'weeklyRuns' ? [1, 4] : [15, 400];
      const v = Math.min(lim[1], Math.max(lim[0], state.settings[k] + d));
      if (v !== state.settings[k]) commit(st => { st.settings[k] = v; }, null, { undo: false });
    },
    'test-add': el => openTestAdd(el.dataset.key),
    'test-edit': el => openTestEdit(el.dataset.key),
    'test-history': el => openTestHistory(el.dataset.key),
    'test-save': el => {
      const d = state.tests.defs.find(x => x.key === el.dataset.key), date = $('#t_date').value, value = E.parseTestValue(d, $('#t_val').value);
      if (!E.isISO(date) || date > today()) { $('#formError').textContent = 'Date invalide.'; return; }
      if (value === null) { $('#formError').textContent = d.unit === 'time' ? 'Format attendu : minutes:secondes (ex. 9:45).' : 'Valeur numérique attendue.'; return; }
      const note = $('#t_note').value.trim().slice(0, 200); closeSheet();
      commit(st => { st.tests.results.push({ id: E.uid(), key: d.key, value, date, note }); }, 'Résultat enregistré.');
    },
    'test-def-save': el => {
      const key = el.dataset.key, unit = $('#t_unit').value, label = $('#t_label').value.trim();
      const tmp = { unit }, target = $('#t_target').value.trim() === '' ? null : E.parseTestValue(tmp, $('#t_target').value);
      if (!label) { $('#formError').textContent = 'Donne un nom à l’épreuve.'; return; }
      if ($('#t_target').value.trim() !== '' && target === null) { $('#formError').textContent = 'Objectif invalide.'; return; }
      const higher = ui.form.higher === '1', confirmed = ui.form.confirmed === '1'; closeSheet();
      commit(st => { const d = st.tests.defs.find(x => x.key === key); Object.assign(d, { label: label.slice(0, 60), unit, target, higher, confirmed }); }, 'Objectif mis à jour.');
    },
    'test-del': el => {
      const id = el.dataset.id;
      confirmSheet({ title: 'Supprimer ce résultat ?', text: 'Tu pourras annuler juste après.', ok: 'Supprimer', danger: true, onOk: () => commit(st => { st.tests.results = st.tests.results.filter(r => r.id !== id); }, 'Résultat supprimé.') });
    },
    export: exportData,
    import: () => { if (loaded.readOnly) { toast('Import bloqué : mets à jour l’application.', { error: true }); return; } const inp = $('#importFile'); inp.value = ''; inp.click(); },
    'import-merge': () => { if (loaded.readOnly) return; const p = ui.pendingImport; closeSheet(); store.snapshotForUndo(state, 'import'); let added = 0; commit(st => { const m = S.merge(st, p.state); added = m.added; Object.assign(st, m.state); }, null); toast('Fusion terminée : ' + added + ' activité(s) ajoutée(s).', { action: 'Annuler', onAction: undoBig }); },
    'import-replace': () => {
      if (loaded.readOnly) return;
      const p = ui.pendingImport; closeSheet();
      confirmSheet({ title: 'Remplacer toutes tes données ?', text: 'Les données actuelles (' + state.sessions.length + ' activité(s)) seront remplacées par le fichier. Elles restent restaurables depuis les réglages.', ok: 'Remplacer', danger: true,
        onOk: () => { store.snapshotForUndo(state, 'import'); const keepExport = state.settings.lastExportAt; commit(st => { Object.keys(st).forEach(k => delete st[k]); Object.assign(st, clone(p.state)); st.settings.lastExportAt = st.settings.lastExportAt || keepExport; }, null); toast('Données remplacées.', { action: 'Annuler', onAction: undoBig }); } });
    },
    'undo-big': () => { if (loaded.readOnly) return; undoBig(); },
    clear: () => { if (loaded.readOnly) { toast('Effacement bloqué : données d’une version plus récente.', { error: true }); return; } confirmSheet({ title: 'Effacer toutes les données ?', text: 'Activités, agenda, objectifs et tests de cet appareil seront supprimés. Pense à exporter avant. Une restauration reste possible depuis les réglages.', ok: 'Tout effacer', danger: true,
      onOk: () => { const cleared = store.clearAll(state); if (!cleared.ok) { toast(cleared.error, { error: true }); return; } state = E.defaultState(); const r = store.save(state); ui.saveError = r.ok ? null : r.error; render(); toast('Données effacées.', { action: 'Annuler', onAction: undoBig }); } }); },
    slot: el => {
      const d = Number(el.dataset.d), slots = state.settings.slots.includes(d) ? state.settings.slots.filter(x => x !== d) : state.settings.slots.concat(d);
      if (slots.length < 1 || slots.length > 4) { toast('Choisis entre 1 et 4 jours.', { error: true }); return; }
      commit(st => { st.settings.slots = slots.sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)); }, 'Jours de séance mis à jour.');
    },
    theme: el => { try { storage.setItem('mission-forme-theme', el.dataset.value); } catch (e) { /* rien */ } applyTheme(el.dataset.value); render(); }
  };
  function undoBig() {
    const u = store.readUndo();
    if (!u) { toast('Rien à restaurer.', { error: true }); return; }
    state = u.state; const r = store.save(state); store.clearUndo(); ui.saveError = r.ok ? null : r.error; render(); toast(r.ok ? 'Données restaurées.' : r.error, { error: !r.ok });
  }

  /* délégation des événements */
  document.addEventListener('click', e => {
    const chip = e.target.closest('[data-chip]');
    if (chip && ui.form) {
      const field = chip.dataset.chip, v = chip.dataset.num ? Number(chip.dataset.value) : chip.dataset.value;
      ui.form[field] = ui.form[field] === v && !['activity', 'context', 'type', 'higher', 'confirmed'].includes(field) ? null : v;
      chip.parentElement.querySelectorAll('[data-chip]').forEach(c => c.setAttribute('aria-pressed', String((c.dataset.num ? Number(c.dataset.value) : c.dataset.value) === ui.form[field])));
      if (field === 'activity') { const rf = $('#runFields'); if (rf) rf.hidden = !A[ui.form.activity].run; }
      if (field === 'pain') { const pa = $('#f_painArea'); if (pa) pa.hidden = !ui.form.pain || ui.form.pain === 'non'; }
      if (field === 'type') { const ff = $('#forcedField'); if (ff) ff.hidden = ui.form.type !== 'garde'; }
      return;
    }
    const step = e.target.closest('[data-step]');
    if (step && ui.form) {
      const inp = $('#f_duration'), v = Math.min(600, Math.max(1, (Number(inp.value) || 0) + Number(step.dataset.d)));
      inp.value = v; ui.form.duration = v; return;
    }
    const el = e.target.closest('[data-action]');
    if (el && actions[el.dataset.action]) { e.preventDefault(); actions[el.dataset.action](el); }
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (!ui.form) return;
    if (t.dataset.numField) {
      const v = t.value === '' ? null : Number(t.value);
      const k = t.dataset.numField, val = Number.isFinite(v) ? v : null;
      if (['distanceKm', 'avgHr', 'elevationM'].includes(k)) ui.form.running[k] = val;
      else if (['sets', 'reps', 'load', 'seconds'].includes(k)) ui.form.detail[k] = val;
      else ui.form[k] = val;
    }
    if (t.dataset.textField) {
      if (t.dataset.textField === 'terrain') ui.form.running.terrain = t.value || null;
      else ui.form[t.dataset.textField] = t.value;
    }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'importFile' && t.files && t.files[0]) {
      const file = t.files[0];
      if (file.size > 5e6) { toast('Fichier trop volumineux.', { error: true }); return; }
      const reader = new FileReader();
      reader.onload = () => handleImportText(String(reader.result));
      reader.onerror = () => toast('Lecture du fichier impossible.', { error: true });
      reader.readAsText(file);
    }
    if (t.dataset.actionChange === 'start') {
      if (!E.isISO(t.value)) { toast('Date invalide.', { error: true }); return; }
      commit(st => { st.settings.programStart = t.value; }, 'Début du cycle : ' + E.fmtDate(t.value) + '.');
    }
  });

  /* ------------------------------------------------------------ démarrage */
  applyTheme(getTheme());
  hydrateIcons();
  render();
  if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(p => {
    if (p) { ui.persisted = true; return; }
    if (navigator.storage.persist) navigator.storage.persist().then(ok => { ui.persisted = ok; });
  }).catch(() => {});
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) toast('Nouvelle version disponible.', { action: 'Recharger', onAction: () => location.reload() }); });
      });
    }).catch(() => {});
  }
  window.MissionForme = { get state() { return state; }, render, actions, version: VERSION };
})();
