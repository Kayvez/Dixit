'use strict';
const assert = require('assert');
const { Game } = require('./game');
const D = require('./data.js');
let ok = 0; const t = (n, f) => { try { f(); ok++; console.log('ok -', n); } catch (e) { console.log('FAIL -', n, e.message); process.exitCode = 1; } };
const seeded = (s) => { let a = s >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let r = Math.imul(a ^ (a >>> 15), 1 | a); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; };
const mk = (n, s) => { const g = new Game(seeded(s || 1)); for (let i = 0; i < n; i++) g.join('P' + i, D.COLORS[i].id); g.start(); return g; };
const allCards = (g) => [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand), ...(g.tellerCard ? [g.tellerCard] : []), ...Object.values(g.picks).flat(), ...g.table.filter(() => g.phase === 'reveal' || g.phase === 'vote').map(() => null).filter((x) => x !== null)];
const conserve = (g) => { const all = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]; const inPlay = g.phase === 'vote' || g.phase === 'reveal' ? g.table.map((e) => e.card) : [...(g.tellerCard ? [g.tellerCard] : []), ...Object.values(g.picks).flat()]; const s = [...all, ...inPlay]; assert.strictEqual(s.length, D.CARDS, 'carte ' + s.length); assert.strictEqual(new Set(s).size, D.CARDS); };
t('sala e avvio', () => { const g = new Game(); g.join('A', 'rosa'); assert.throws(() => g.join('a', 'azzurro'), /nome/); assert.throws(() => g.join('B', 'rosa'), /colore/); assert.ok(!g.act(1, { type: 'start' }).ok); });
t('mano da 6, mazzo corretto', () => { const g = mk(4); for (const p of g.players) assert.strictEqual(p.hand.length, 6); conserve(g); });
t('punteggio: alcune indovinano', () => {
  const g = mk(4, 3); const T = g.tellerId, o = g.others;
  g.act(T, { type: 'clue', card: g.player(T).hand[0], text: 'mare' }); for (const q of o) g.act(q.id, { type: 'pick', cards: [q.hand[0]] });
  assert.strictEqual(g.phase, 'vote');
  const tc = g.tellerCard, dec = (q) => g.table.find((e) => e.owner === q.id).card;
  assert.ok(!g.act(o[0].id, { type: 'vote', card: dec(o[0]) }).ok); // non la propria
  g.act(o[0].id, { type: 'vote', card: tc }); g.act(o[1].id, { type: 'vote', card: dec(o[0]) }); g.act(o[2].id, { type: 'vote', card: dec(o[0]) });
  assert.strictEqual(g.result.kind, 'normal'); const s = (id) => g.player(id).score;
  assert.strictEqual(s(T), 3); assert.strictEqual(s(o[0].id), 3 + 2); assert.strictEqual(s(o[1].id), 0); conserve(g);
});
t('punteggio: tutte indovinano o nessuna', () => {
  for (const all of [true, false]) { const g = mk(4, 5); const T = g.tellerId, o = g.others;
    g.act(T, { type: 'clue', card: g.player(T).hand[0], text: 'x' }); for (const q of o) g.act(q.id, { type: 'pick', cards: [q.hand[0]] });
    const tc = g.tellerCard; for (const q of o) { const other = g.table.find((e) => e.owner !== q.id && e.owner !== T).card; g.act(q.id, { type: 'vote', card: all ? tc : other }); }
    assert.strictEqual(g.result.kind, all ? 'all' : 'none'); assert.strictEqual(g.player(T).score, 0); if (all) for (const q of o) assert.strictEqual(q.score, 2); }
});
t('3 giocatrici: due carte a testa', () => {
  const g = mk(3, 6); assert.strictEqual(g.need, 2); const T = g.tellerId; g.act(T, { type: 'clue', card: g.player(T).hand[0], text: 'x' });
  const q = g.others[0]; assert.ok(!g.act(q.id, { type: 'pick', cards: [q.hand[0]] }).ok); assert.ok(g.act(q.id, { type: 'pick', cards: [q.hand[0], q.hand[1]] }).ok); assert.ok(!g.act(q.id, { type: 'pick', cards: [q.hand[0], q.hand[1]] }).ok);
  const r = g.others[1]; g.act(r.id, { type: 'pick', cards: [r.hand[0], r.hand[1]] }); assert.strictEqual(g.table.length, 5);
});
t('carta non in mano rifiutata, narratrice non può giocare', () => { const g = mk(4, 7); const T = g.tellerId; assert.ok(!g.act(T, { type: 'clue', card: 999, text: 'x' }).ok); assert.ok(!g.act(g.others[0].id, { type: 'clue', card: g.others[0].hand[0], text: 'x' }).ok); assert.ok(!g.act(T, { type: 'clue', card: g.player(T).hand[0], text: '  ' }).ok); });
t('la vista nasconde mani e proprietari', () => {
  const g = mk(4, 8); const T = g.tellerId; g.act(T, { type: 'clue', card: g.player(T).hand[0], text: 'x' }); for (const q of g.others) g.act(q.id, { type: 'pick', cards: [q.hand[0]] });
  const v = g.view(g.others[0].id); assert.ok(v.table.every((e) => e.owner === undefined)); assert.strictEqual(v.table.filter((e) => e.mine).length, 1); assert.strictEqual(g.view(null).me, undefined);
  assert.ok(v.players.every((p) => p.hand === 6 || p.hand === 5 || typeof p.hand === 'number'));
});
t('kick a metà round non blocca e conserva le carte', () => { const g = mk(5, 9); const T = g.tellerId; g.act(T, { type: 'clue', card: g.player(T).hand[0], text: 'x' }); g.act(g.others[0].id, { type: 'pick', cards: [g.others[0].hand[0]] }); g.admin({ type: 'kick', id: g.others[1].id }); assert.strictEqual(g.phase, 'clue'); assert.strictEqual(g.active.length, 4); conserve(g); });
t('persistenza', () => { const g = mk(4, 10); const h = Game.fromJSON(JSON.parse(JSON.stringify(g))); assert.strictEqual(h.tellerId, g.tellerId); assert.deepStrictEqual(h.players[0].hand, g.players[0].hand); });
const N = 150; let ended = 0, rounds = 0;
for (let i = 0; i < N; i++) {
  const n = 3 + (i % 6), r = seeded(100 + i), g = mk(n, 500 + i); g.target = [20, 30, 40][i % 3]; let guard = 0;
  while (g.status === 'playing' && guard++ < 500) {
    conserve(g); const T = g.tellerId;
    if (g.phase === 'clue') g.act(T, { type: 'clue', card: g.player(T).hand[Math.floor(r() * 6)], text: 'indizio' });
    else if (g.phase === 'pick') { for (const q of g.others) if (!g.picks[q.id]) assert.ok(g.act(q.id, { type: 'pick', cards: q.hand.slice(0, g.need) }).ok); }
    else if (g.phase === 'vote') { for (const q of g.others) { const opts = g.table.filter((e) => e.owner !== q.id); assert.ok(g.act(q.id, { type: 'vote', card: opts[Math.floor(r() * opts.length)].card }).ok); } }
    else if (g.phase === 'reveal') { assert.ok(g.act(T, { type: 'next' }).ok); }
  }
  if (g.status === 'ended') { ended++; rounds += g.round; assert.ok(g.winners.length >= 1); }
}
t(`simulazione ${N} partite: tutte finiscono`, () => assert.strictEqual(ended, N));
console.log('Round medi:', Math.round(rounds / N)); console.log(ok + ' ok');
