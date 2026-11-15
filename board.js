(() => {
  'use strict';
  const D = window.DXDATA;
  const { h, esc, col, dot, card, post, confetti } = window.UI;
  const $ = (s, el = document) => el.querySelector(s);
  let S = null, key = '', info = null, es = null, lastMsg = Date.now(), shownRound = -1, shownPhase = '';

  // ---------- suoni ----------
  let actx = null, master = null, soundOn = localStorage.getItem('dx_sound') !== '0';
  const ensure = () => { if (!soundOn) return false; if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.gain.value = 0.9; master.connect(actx.destination); } catch (e) { return false; } } if (actx.state !== 'running') actx.resume(); return actx.state === 'running'; };
  ['pointerdown', 'click', 'touchend', 'keydown'].forEach((e) => document.addEventListener(e, ensure, { passive: true }));
  const tone = (f, t0, d, type, vol, f2) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = type || 'sine'; const t = actx.currentTime + t0; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol || 0.2, t + Math.min(0.03, d / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.05); };
  const noise = (t0, d, vol, lp) => { const n = Math.floor(actx.sampleRate * d), b = actx.createBuffer(1, n, actx.sampleRate), c = b.getChannelData(0); for (let i = 0; i < n; i++) c[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = actx.createBufferSource(); s.buffer = b; const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 1500; const g = actx.createGain(); g.gain.value = vol || 0.2; s.connect(f); f.connect(g); g.connect(master); s.start(actx.currentTime + t0); };
  const SFX = {
    deal: () => { noise(0, 0.12, 0.25, 3500); tone(900, 0.02, 0.08, 'triangle', 0.05); },
    clue: () => { [523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.7, 'sine', 0.16)); tone(262, 0, 1, 'triangle', 0.1); },
    vote: () => { tone(740, 0, 0.1, 'triangle', 0.12); },
    flip: () => { noise(0, 0.18, 0.3, 2500); tone(300, 0, 0.18, 'sine', 0.1, 600); },
    good: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.08, 0.6, 'sine', 0.15)); },
    meh: () => { tone(330, 0, 0.5, 'triangle', 0.14, 220); tone(247, 0.2, 0.7, 'triangle', 0.12, 165); },
    start: () => { [262, 330, 392, 523].forEach((f, i) => tone(f, i * 0.14, 0.7, 'sine', 0.17)); },
    win: () => { [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, i * 0.14, 0.6, 'sine', 0.17)); },
  };
  const sfx = (k) => { if (soundOn && ensure() && SFX[k]) SFX[k](); };

  // ---------- rete ----------
  function connect() {
    if (es) { try { es.close(); } catch (e) { /* */ } }
    lastMsg = Date.now();
    es = new EventSource('/events?role=board');
    es.onmessage = (ev) => { lastMsg = Date.now(); let s; try { s = JSON.parse(ev.data); } catch (e) { return; } const k = JSON.stringify(s, (n, v) => (n === 'connected' ? undefined : v)); if (k === key) return; key = k; onState(s); };
    es.addEventListener('ping', () => { lastMsg = Date.now(); });
    es.onerror = () => { if (es.readyState === 2) setTimeout(connect, 1500); };
  }
  setInterval(() => { if (Date.now() - lastMsg > 20000) { key = ''; connect(); } }, 5000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { key = ''; connect(); } });
  window.addEventListener('online', () => { key = ''; connect(); });
  fetch('/api/info').then((r) => r.json()).then((i) => { info = i; if (S) render(); }).catch(() => {});
  const P = (id) => S.players.find((p) => p.id === id);
  const joinUrl = () => { const hn = location.hostname; if (hn && hn !== 'localhost' && hn !== '127.0.0.1') return `${location.protocol}//${location.host}/play`; if (info && info.addresses && info.addresses.length) return `http://${info.addresses[0]}:${info.port}/play`; return `${location.origin}/play`; };

  function onState(s) {
    const a = S; S = s;
    if (a) {
      if (a.status === 'lobby' && s.status === 'playing') sfx('start');
      if (s.phase === 'pick' && a.phase !== 'pick') sfx('clue');
      if (s.phase === 'pick' && a.phase === 'pick' && s.picked > a.picked) sfx('deal');
      if (s.phase === 'vote' && a.phase === 'pick') sfx('deal');
      if (s.phase === 'vote' && a.phase === 'vote' && s.voted > a.voted) sfx('vote');
      if (s.phase === 'reveal' && a.phase !== 'reveal') { sfx('flip'); setTimeout(() => sfx(s.result.kind === 'normal' ? 'good' : 'meh'), 900); }
      if (a.status !== 'ended' && s.status === 'ended') { sfx('win'); setTimeout(() => confetti(140), 300); }
    }
    render();
  }

  // ---------- disegno ----------
  const cw = (n) => { const w = (document.querySelector('main') || document.body).clientWidth - 60, hgt = (window.innerHeight - 62) * 0.58; const byW = (w - (n - 1) * 16) / n, byH = hgt * 380 / 615; return Math.max(90, Math.min(byW, byH, 270)); };
  function mainHTML() {
    const T = P(S.tellerId);
    const waiting = S.players.filter((p) => p.waiting && !p.left);
    const chips = S.players.filter((p) => !p.left && p.id !== S.tellerId).map((p) => `<div class="chip ${p.waiting ? 'wait' : 'ok'}">${dot(p.color)}${esc(p.name)}${p.waiting ? ' …' : ' ✓'}</div>`).join('');
    if (S.phase === 'clue') return `<div class="say">${dot(T.color)} <b>${esc(T.name)}</b> è la Narratrice</div><div class="slot" style="--cw:${cw(1)}px"><div class="cd back"></div></div><div class="hint">Sta scegliendo una carta e inventando l'indizio…</div>`;
    if (S.phase === 'pick') {
      const n = S.players.filter((p) => !p.left).length - 1, tot = 1 + S.picked * S.need + (n - S.picked) * S.need;
      const slots = Array.from({ length: tot }, (_, i) => `<div class="slot ${i <= S.picked * S.need ? 'in' : 'empty'}" style="--cw:${cw(tot)}px"><div class="cd ${i <= S.picked * S.need ? 'back' : ''}"></div></div>`).join('');
      return `<div class="clue"><small>L'indizio di ${esc(T.name)}</small>“${esc(S.clue)}”</div><div class="row">${slots}</div><div class="hint">Le altre scelgono una carta${S.need === 2 ? ' (due, in tre giocatrici)' : ''}</div><div class="chips">${chips}</div>`;
    }
    if (S.phase === 'vote') {
      const cards = S.table.map((e, i) => `<div class="slot in" style="--cw:${cw(S.table.length)}px;animation-delay:${i * 0.08}s"><div class="num">${i + 1}</div><div class="cd" style="background-image:url(${card(e.card)})"></div></div>`).join('');
      return `<div class="clue"><small>L'indizio di ${esc(T.name)}</small>“${esc(S.clue)}”</div><div class="row">${cards}</div><div class="hint">Dal telefono, vota la carta che pensi sia di ${esc(T.name)}</div><div class="chips">${chips}</div>`;
    }
    if (S.phase === 'reveal') {
      const r = S.result, K = { normal: 'Qualcuna ha indovinato!', all: 'Tutte hanno indovinato: troppo facile!', none: 'Nessuna ha indovinato: troppo difficile!' }[r.kind];
      const cards = r.rows.map((x, i) => { const o = P(x.owner); return `<div class="slot flip ${x.teller ? 'teller' : ''}" style="--cw:${cw(r.rows.length)}px">${x.teller ? '<div class="crown">👑</div>' : ''}<div class="num">${i + 1}</div><div class="cd" style="background-image:url(${card(x.card)})"></div><div class="who">${dot(o.color)} ${esc(o.name)}${x.teller ? ' ✦' : ''}</div><div class="vt">${x.voters.map((v) => dot(P(v).color)).join('')}</div></div>`; }).join('');
      const g = S.players.filter((p) => r.gains[p.id] != null && !p.left).map((p) => `<div class="chip ok">${dot(p.color)}${esc(p.name)} <b style="color:var(--gold2)">+${r.gains[p.id]}</b></div>`).join('');
      return `<div class="clue"><small>La carta di ${esc(T.name)} era la ${r.rows.findIndex((x) => x.teller) + 1}</small>“${esc(S.clue)}”</div><div class="row">${cards}</div><div class="kind">${K}</div><div class="chips">${g}</div><button class="btn violet nextBtn" id="nxt" style="width:auto;padding:12px 34px">Prossimo round ▶</button>`;
    }
    return '';
  }
  function sideHTML() {
    const sc = [...S.players].sort((a, b) => b.score - a.score).map((p) => `<div class="sc${p.id === S.tellerId && S.status === 'playing' ? ' t' : ''}${p.left ? ' left' : ''}"><div class="r1">${dot(p.color)}<span class="n">${esc(p.name)}${p.id === S.tellerId && S.status === 'playing' ? ' 🗣️' : ''}</span><b>${p.score}</b></div><div class="bar" style="--c:${col(p.color).hex}"><i style="width:${Math.min(100, (p.score / S.target) * 100)}%"></i></div></div>`).join('');
    const hist = [...S.history].reverse().map((x) => `<div>${esc(P(x.teller) ? P(x.teller).name : '')}: <em>“${esc(x.clue)}”</em></div>`).join('');
    return `<h3>Classifica · obiettivo ${S.target}</h3>${sc}<h3 style="margin-top:6px">Indizi passati</h3><div class="hist">${hist}</div>`;
  }
  function render() {
    const app = $('#app'); if (!S) return;
    const ov = $('.over'); if (ov) ov.remove();
    app.innerHTML = `<header class="top"><div class="meta"><span>Round <b>${S.round}</b></span><span>Mazzo <b>${S.deckLeft}</b></span></div><div class="logo">DIXIT</div><button class="gear" id="gear">⚙</button></header><main>${S.status === 'playing' ? mainHTML() : ''}</main><aside>${sideHTML()}</aside>`;
    $('#gear').onclick = openMenu;
    const nb = $('#nxt'); if (nb) nb.onclick = () => post('/api/board', { type: 'next' });
    if (S.status === 'lobby') lobby(); if (S.status === 'ended') ended();
  }
  function lobby() {
    let qr = ''; try { const q = window.qrcode(0, 'M'); q.addData(joinUrl()); q.make(); qr = q.createSvgTag(5, 0); } catch (e) { /* */ }
    const chips = S.players.map((p) => `<div class="chip">${dot(p.color)}${esc(p.name)}${p.id === S.hostId ? ' ⭐' : ''}</div>`).join('') || '<span class="hint">Nessuna ancora…</span>';
    document.body.append(h('div', { class: 'over', html: `<div class="cbox"><h2>DIXIT</h2><div style="font:700 28px var(--hand);color:var(--gold2)">Racconta con un indizio. Inganna con una carta.</div><div class="qr">${qr}</div><p class="url">${esc(joinUrl().replace(/^https?:\/\//, ''))}</p><p class="hint">Scansiona il QR, scrivi il tuo nome e scegli un colore.<br>Da 3 a 8 giocatrici · ⭐ avvia dal telefono.</p><div class="chips">${chips}</div></div>` }));
  }
  function ended() {
    const win = S.winners.map(P), rest = [...S.players].sort((a, b) => b.score - a.score);
    document.body.append(h('div', { class: 'over', html: `<div class="cbox"><div style="font-size:70px">🏆</div><h2>${win.map((p) => esc(p.name)).join(' e ')} ${win.length > 1 ? 'vincono' : 'vince'}!</h2><p class="hint">${esc(S.winReason)}</p><div class="pod">${rest.map((p) => `<div class="${S.winners.includes(p.id) ? 'w' : ''}">${dot(p.color)} ${esc(p.name)}<br><span style="font:900 28px var(--display);color:var(--gold2)">${p.score}</span></div>`).join('')}</div><button class="btn" id="again">Nuova partita</button></div>` }));
    $('#again').onclick = () => post('/api/board', { type: 'reset' });
  }
  function openMenu() {
    const m = $('#menu') || h('div', { id: 'menu' }); if (!m.parentNode) document.body.append(m);
    const kicks = S.players.filter((p) => !p.left).map((p) => `<div class="kick"><span>${dot(p.color)} ${esc(p.name)}</span><button class="btn small ghost" data-kick="${p.id}">Fai uscire</button></div>`).join('');
    m.innerHTML = `<div class="menuBox"><h3>Menu</h3><button class="btn ghost" data-a="sound">${soundOn ? '🔊 Suoni attivi' : '🔇 Suoni spenti'}</button><button class="btn ghost" data-a="rules">📖 Regole</button>
      ${S.status === 'playing' ? '<button class="btn ghost" data-a="skip">⏭ Salta questo round</button><button class="btn ghost" data-a="end">🏁 Chiudi la partita ora</button>' + kicks : ''}
      <button class="btn violet" data-a="reset">Ricomincia da zero</button><button class="btn" data-a="close">Chiudi</button></div>`;
  }
  document.addEventListener('click', async (e) => {
    const m = $('#menu'); if (!m || !m.contains(e.target)) return;
    const k = e.target.closest('[data-kick]'), b = e.target.closest('[data-a]');
    if (k) { if (confirm('Far uscire questa giocatrice?')) { const r = await post('/api/board', { type: 'kick', id: Number(k.dataset.kick) }); if (!r.ok) alert(r.error); m.remove(); } return; }
    if (!b) { if (e.target === m) m.remove(); return; }
    const a = b.dataset.a;
    if (a === 'close') m.remove();
    else if (a === 'sound') { soundOn = !soundOn; localStorage.setItem('dx_sound', soundOn ? '1' : '0'); openMenu(); if (soundOn) sfx('clue'); }
    else if (a === 'rules') { m.remove(); window.UI.rulesModal(); }
    else if (a === 'skip') { await post('/api/board', { type: 'skip' }); m.remove(); }
    else if (a === 'end') { if (confirm('Chiudere la partita adesso?')) await post('/api/board', { type: 'endgame' }); m.remove(); }
    else if (a === 'reset') { if (confirm('Cancellare tutto e ricominciare?')) await post('/api/board', { type: 'reset' }); m.remove(); }
  });
  window.addEventListener('resize', () => { if (S) render(); });
  connect();
})();
