'use strict';
// Dixit: logica server-autoritativa. Nessun timer: si avanza quando tutti hanno agito.
const crypto = require('crypto');
const D = require('./data.js');
class GameError extends Error {}
const MIN_PLAYERS = 3, MAX_PLAYERS = 8, HAND = 6;
const fail = (m) => { throw new GameError(m); };

class Game {
  constructor(rng) {
    this.rng = rng || Math.random;
    this.players = []; this.nextId = 1; this.hostId = null;
    this.status = 'lobby'; this.phase = null;
    this.target = 30; this.round = 0;
    this.deck = []; this.discard = [];
    this.tellerId = null; this.tellerCard = null; this.clue = '';
    this.picks = {}; this.table = []; this.votes = {};
    this.result = null; this.winners = []; this.winReason = ''; this.history = [];
  }
  toJSON() { const o = {}; for (const k of Object.keys(this)) if (k !== 'rng') o[k] = this[k]; return o; }
  static fromJSON(obj, rng) { const g = new Game(rng); Object.assign(g, obj); return g; }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  player(id) { return this.players.find((p) => p.id === id); }
  byToken(t) { return t ? this.players.find((p) => p.token === t) : undefined; }
  get active() { return this.players.filter((p) => !p.left); }
  get others() { return this.active.filter((p) => p.id !== this.tellerId); }
  get need() { return this.active.length === 3 ? 2 : 1; } // con 3 giocatrici ogni non-narratrice gioca 2 carte

  join(name, color) {
    if (this.status !== 'lobby') fail('La partita è già iniziata.');
    name = String(name || '').trim().slice(0, 14); if (!name) fail('Scrivi il tuo nome.');
    if (this.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) fail('Questo nome è già preso.');
    const c = D.COLORS.find((x) => x.id === color); if (!c) fail('Scegli un colore.');
    if (this.players.some((p) => p.color === c.id)) fail('Questo colore è già preso.');
    if (this.players.length >= MAX_PLAYERS) fail('La sala è piena.');
    const p = { id: this.nextId++, token: crypto.randomBytes(12).toString('hex'), name, color: c.id, score: 0, hand: [], left: false };
    this.players.push(p); if (!this.hostId) this.hostId = p.id; return p;
  }
  leave(p) {
    if (this.status === 'lobby') { this.players = this.players.filter((x) => x.id !== p.id); if (this.hostId === p.id) this.hostId = this.players.length ? this.players[0].id : null; return; }
    this.kick(p.id);
  }
  start() {
    if (this.status !== 'lobby') fail('Già iniziata.');
    if (this.players.length < MIN_PLAYERS) fail(`Servono almeno ${MIN_PLAYERS} giocatrici.`);
    this.deck = this.shuffle(Array.from({ length: D.CARDS }, (_, i) => i + 1)); this.discard = [];
    for (const p of this.players) p.hand = this.deck.splice(0, HAND);
    this.status = 'playing'; this.round = 0; this.history = [];
    this.tellerId = this.players[Math.floor(this.rng() * this.players.length)].id;
    this.newRound(false);
  }
  newRound(advance) {
    if (advance) { const a = this.active; const i = a.findIndex((p) => p.id === this.tellerId); this.tellerId = a[(i + 1) % a.length].id; }
    this.round++; this.phase = 'clue'; this.clue = ''; this.tellerCard = null; this.picks = {}; this.table = []; this.votes = {}; this.result = null;
  }
  // ---- azioni ----
  clueCard(p, a) {
    if (this.phase !== 'clue' || p.id !== this.tellerId) fail('Non è il momento.');
    const card = Number(a.card); if (!p.hand.includes(card)) fail('Scegli una carta della tua mano.');
    const text = String(a.text || '').trim().slice(0, 90); if (!text) fail('Scrivi un indizio.');
    this.tellerCard = card; this.clue = text; p.hand = p.hand.filter((c) => c !== card); this.phase = 'pick';
  }
  pick(p, a) {
    if (this.phase !== 'pick' || p.id === this.tellerId || p.left) fail('Non è il momento.');
    if (this.picks[p.id]) fail('Hai già giocato.');
    const cards = [...new Set((a.cards || []).map(Number))];
    if (cards.length !== this.need) fail(this.need === 2 ? 'Scegli 2 carte.' : 'Scegli una carta.');
    if (!cards.every((c) => p.hand.includes(c))) fail('Carta non valida.');
    this.picks[p.id] = cards; p.hand = p.hand.filter((c) => !cards.includes(c));
    if (this.others.every((q) => this.picks[q.id])) this.toVote();
  }
  toVote() {
    const t = [{ card: this.tellerCard, owner: this.tellerId }];
    for (const q of this.others) for (const c of this.picks[q.id]) t.push({ card: c, owner: q.id });
    this.table = this.shuffle(t); this.votes = {}; this.phase = 'vote';
  }
  vote(p, a) {
    if (this.phase !== 'vote' || p.id === this.tellerId || p.left) fail('Non è il momento.');
    if (this.votes[p.id]) fail('Hai già votato.');
    const card = Number(a.card), e = this.table.find((x) => x.card === card); if (!e) fail('Carta non valida.');
    if (e.owner === p.id) fail('Non puoi votare una tua carta.');
    this.votes[p.id] = card;
    if (this.others.every((q) => this.votes[q.id])) this.score();
  }
  score() {
    const others = this.others, gains = {}; for (const p of this.active) gains[p.id] = 0;
    const votersOf = (card) => others.filter((q) => this.votes[q.id] === card).map((q) => q.id);
    const tv = votersOf(this.tellerCard); const kind = tv.length === 0 ? 'none' : tv.length === others.length ? 'all' : 'normal';
    if (kind === 'normal') { gains[this.tellerId] += 3; for (const id of tv) gains[id] += 3; } else for (const q of others) gains[q.id] += 2;
    for (const q of others) { const n = this.table.filter((e) => e.owner === q.id).reduce((s, e) => s + votersOf(e.card).length, 0); gains[q.id] += Math.min(3, n); }
    for (const p of this.active) p.score += gains[p.id];
    this.result = { kind, gains, rows: this.table.map((e) => ({ card: e.card, owner: e.owner, teller: e.card === this.tellerCard, voters: votersOf(e.card) })) };
    this.history.push({ round: this.round, teller: this.tellerId, clue: this.clue, kind });
    this.history = this.history.slice(-30); this.phase = 'reveal';
  }
  next(p) {
    if (this.phase !== 'reveal') fail('Non è il momento.');
    for (const e of this.table) this.discard.push(e.card); this.table = []; this.picks = {};
    if (this.active.some((q) => q.score >= this.target)) return this.finish(`Ha raggiunto ${this.target} punti.`);
    if (!this.refill()) return this.finish('Le carte sono finite.');
    this.newRound(true);
  }
  // pesca fino a 6; se il mazzo non basta si rimescolano gli scarti, se mancano ancora carte la partita finisce
  refill() {
    const need = this.active.reduce((s, p) => s + Math.max(0, HAND - p.hand.length), 0);
    if (this.deck.length < need) return false; // il mazzo è finito: ultima mano
    for (const p of this.active) while (p.hand.length < HAND) p.hand.push(this.deck.shift());
    return true;
  }
  finish(why) {
    const best = Math.max(...this.players.map((p) => p.score)); this.winners = this.players.filter((p) => p.score === best).map((p) => p.id);
    this.status = 'ended'; this.phase = null; this.winReason = why;
  }
  kick(id) {
    const p = this.player(id); if (!p || p.left) return;
    if (this.status === 'lobby') return this.leave(p);
    p.left = true; this.discard.push(...p.hand); p.hand = [];
    if (this.active.length < MIN_PLAYERS) return this.finish('Non ci sono abbastanza giocatrici.');
    if (this.hostId === id) this.hostId = this.active[0].id;
    this.abortRound(id === this.tellerId);
  }
  // il round in corso salta: le carte giocate tornano agli scarti
  abortRound(advance) {
    if (this.status !== 'playing') return;
    if (this.tellerCard) this.discard.push(this.tellerCard);
    for (const k of Object.keys(this.picks)) this.discard.push(...this.picks[k]);
    this.table = []; this.picks = {}; this.votes = {}; this.tellerCard = null;
    if (!this.refill()) return this.finish('Le carte sono finite.');
    if (advance || !this.active.some((p) => p.id === this.tellerId)) { const a = this.active; this.tellerId = a[Math.floor(this.rng() * a.length)].id; this.newRound(false); } else this.newRound(true);
  }
  // ---- ingressi ----
  act(pid, a) {
    try {
      const p = this.player(pid); if (!p) fail('Giocatrice non trovata.');
      switch (a.type) {
        case 'noop': break;
        case 'start': if (this.hostId !== pid) fail('Solo chi ha creato la partita può avviarla.'); this.start(); break;
        case 'target': if (this.status !== 'lobby' || this.hostId !== pid) fail('Non puoi.'); if (![20, 30, 40].includes(Number(a.value))) fail('Valore non valido.'); this.target = Number(a.value); break;
        case 'leave': this.leave(p); break;
        case 'clue': this.clueCard(p, a); break;
        case 'pick': this.pick(p, a); break;
        case 'vote': this.vote(p, a); break;
        case 'next': this.next(p); break;
        default: fail('Azione sconosciuta.');
      }
      return { ok: true };
    } catch (e) { if (e instanceof GameError) return { ok: false, error: e.message }; throw e; }
  }
  admin(a) {
    try {
      switch (a.type) {
        case 'kick': this.kick(Number(a.id)); break;
        case 'skip': if (this.status !== 'playing') fail('Nessun round in corso.'); this.abortRound(false); break;
        case 'next': this.next(); break;
        case 'endgame': if (this.status === 'playing') this.finish('Partita chiusa dal tabellone.'); break;
        default: fail('Azione sconosciuta.');
      }
      return { ok: true };
    } catch (e) { if (e instanceof GameError) return { ok: false, error: e.message }; throw e; }
  }
  view(pid, connected) {
    const me = pid ? this.player(pid) : null, conn = connected || new Set();
    const pend = (id) => (this.phase === 'pick' ? !this.picks[id] : this.phase === 'vote' ? !this.votes[id] : this.phase === 'clue' ? id === this.tellerId : false);
    const v = {
      title: D.TITLE, status: this.status, phase: this.phase, hostId: this.hostId, you: me ? me.id : null, round: this.round, target: this.target, cardsTotal: D.CARDS,
      deckLeft: this.deck.length, tellerId: this.tellerId, clue: this.phase && this.phase !== 'clue' ? this.clue : '', need: this.need,
      players: this.players.map((p) => ({ id: p.id, name: p.name, color: p.color, score: p.score, left: p.left, connected: conn.has(p.id), waiting: this.status === 'playing' && !p.left && pend(p.id), hand: p.hand.length })),
      history: this.history.slice(-6), winners: this.winners, winReason: this.winReason,
    };
    if (this.phase === 'pick') v.picked = this.others.filter((q) => this.picks[q.id]).length;
    if (this.phase === 'vote') v.table = this.table.map((e) => ({ card: e.card, mine: e.owner === pid }));
    if (this.phase === 'vote') v.voted = this.others.filter((q) => this.votes[q.id]).length;
    if (this.phase === 'reveal') v.result = this.result;
    if (me && this.status !== 'lobby') {
      v.me = { hand: me.hand.slice(), picked: this.picks[me.id] || null, voted: this.votes[me.id] || null, tellerCard: me.id === this.tellerId ? this.tellerCard : null, left: me.left };
    }
    return v;
  }
}
module.exports = { Game, GameError, MIN_PLAYERS, MAX_PLAYERS, HAND };
