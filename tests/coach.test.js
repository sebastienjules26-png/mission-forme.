const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/engine.js');
const run = (date, more = {}) => E.normalizeSession({date,activity:'course',duration:30,rpe:4,pain:'non',...more});
test('coach : aucune donnée ne devient un faux plaisir', () => {
 const s=E.defaultState(); const a=E.coachWeek(s,'2026-11-12');
 assert.equal(a.pleasure,null); assert.equal(a.runs,0);
});
test('coach : deux courses faciles donnent une lecture positive sans hausse automatique', () => {
 const s=E.defaultState();s.sessions=[run('2026-11-10',{pleasure:8}),run('2026-11-12',{pleasure:6})];
 const a=E.coachWeek(s,'2026-11-12');
 assert.equal(a.level,'positive');assert.equal(a.runMinutes,60);assert.equal(a.pleasure,7);
});
test('coach : efforts difficiles prioritaires sur le bilan positif',()=>{
 const s=E.defaultState();s.sessions=[run('2026-11-10',{rpe:9}),run('2026-11-12',{rpe:8})];
 assert.equal(E.coachWeek(s,'2026-11-12').level,'caution');
});
test('coach : douleur importante prioritaire',()=>{
 const s=E.defaultState();s.sessions=[run('2026-11-10',{pain:'importante'})];
 assert.equal(E.coachWeek(s,'2026-11-12').level,'caution');
});
test('coach : garde et famille comptent dans la charge sans devenir des courses',()=>{
 const s=E.defaultState();s.sessions=[E.normalizeSession({date:'2026-11-11',activity:'natation',context:'garde',duration:45,rpe:5})];
 const a=E.coachWeek(s,'2026-11-12');assert.equal(a.allMinutes,45);assert.equal(a.runs,0);
});
test('coach : plaisir faible identifié sans inventer de valeur absente',()=>{
 const s=E.defaultState();s.sessions=[run('2026-11-10',{pleasure:3}),run('2026-11-12',{pleasure:null})];
 assert.equal(E.coachWeek(s,'2026-11-12').level,'gentle');
});

test('V3.3.2 : deux courses faciles dont une aujourd’hui ne bloquent pas le coach', () => {
  const s = E.defaultState();
  s.sessions = [
    E.normalizeSession({date:'2026-11-10', activity:'course',duration:30,rpe:4,pain:'non',pleasure:8}),
    E.normalizeSession({date:'2026-11-12', activity:'course',duration:30,rpe:4,pain:'non',pleasure:7})
  ];
  assert.equal(E.coachWeek(s, '2026-11-12').level, 'positive');
});

test('V3.3.2 : jour de garde ne provoque pas de fausse pause', () => {
  const s = E.defaultState();
  s.sessions = ['2026-11-08','2026-11-10'].map(date => E.normalizeSession({date,activity:'course',duration:30,rpe:4,pain:'non'}));
  s.days['2026-11-12'] = {type:'garde',forced:''};
  assert.notEqual(E.coachWeek(s, '2026-11-12').title, 'Progression en pause');
});
