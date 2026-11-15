(() => {
  'use strict';
  const D = window.DXDATA;
  const { h, esc, col, dot, card, post, toast, confetti, rulesModal } = window.UI;
  const $ = (s, el = document) => el.querySelector(s);
  let token = localStorage.getItem('dx_token'), S = null, lastJson = '', es = null, lastMsg = Date.now();
  const L = { sel: [], one: null, name: localStorage.getItem('dx_name') || '', color: null, clue: '', ctx: '' };
  let rulesOpen = false;
  const P = (id) => S.players.find((p) => p.id === id);
  const me = () => (S && S.you ? P(S.you) : null);
  const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* */ } };
  let actx = null, soundOn = localStorage.getItem('dx_psound') !== '0';
  const ensure = () => { if (!soundOn) return false; if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; } } if (actx.state !== 'running') actx.resume(); return actx.state === 'running'; };
  ['pointerdown', 'touchend'].forEach((e) => document.addEventListener(e, ensure, { passive: true }));
  const tone = (f, t0, d, type, vol) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = type || 'sine'; const t = actx.currentTime + t0; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol || 0.15, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d + 0.05); };
  const SFX = { tap: () => tone(560, 0, 0.05, 'triangle', 0.06), ok: () => { tone(523, 0, 0.1, 'sine', 0.12); tone(784, 0.08, 0.2, 'sine', 0.12); }, turn: () => { tone(660, 0, 0.2, 'sine', 0.15); tone(880, 0.14, 0.4, 'sine', 0.15); }, win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.5, 'sine', 0.14)) };
  const sfx = (k) => { if (soundOn && ensure() && SFX[k]) SFX[k](); };

  function connect() {
    if (es) { try { es.close(); } catch (e) { /* */ } }
    lastMsg = Date.now();
    es = new EventSource('/events' + (token ? '?token=' + encodeURIComponent(token) : ''));
    es.onmessage = (ev) => { lastMsg = Date.now(); if (ev.data === lastJson) return; lastJson = ev.data; try { onState(JSON.parse(ev.data)); } catch (e) { console.error(e); } };
    es.addEventListener('ping', () => { lastMsg = Date.now(); });
    es.onerror = async () => { if (token) { const r = await post('/api/act', { token, type: 'noop' }); if (/Sessione scaduta/.test(r.error || '')) return logout(); } if (es.readyState === 2) setTimeout(connect, 1500); };
  }
  setInterval(() => { if (Date.now() - lastMsg > 20000) { lastJson = ''; connect(); } }, 5000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { lastJson = ''; connect(); } });
  window.addEventListener('online', () => { lastJson = ''; connect(); });
  window.addEventListener('pageshow', () => { lastJson = ''; connect(); });
  function logout() { token = null; localStorage.removeItem('dx_token'); lastJson = ''; connect(); }
  let busy = 0;
  async function act(a) { if (Date.now() < busy) return { ok: false }; busy = Date.now() + 300; const r = await post('/api/act', Object.assign({ token }, a)); if (!r.ok && r.error) { if (/Sessione scaduta/.test(r.error)) logout(); else { toast(r.error, true); buzz(120); } } return r; }

  const myTurnToAct = (s) => s && s.you && s.status === 'playing' && ((s.phase === 'clue' && s.tellerId === s.you) || (s.phase === 'pick' && s.tellerId !== s.you && !s.me.picked) || (s.phase === 'vote' && s.tellerId !== s.you && !s.me.voted));
  function onState(s) {
    const prev = S; S = s;
    if (s.you && !me()) return logout();
    if (prev && myTurnToAct(s) && !myTurnToAct(prev)) { buzz([90, 60, 90, 60, 200]); sfx('turn'); }
    if (prev && s.phase === 'reveal' && prev.phase !== 'reveal' && s.result) { const g = s.result.gains[s.you]; buzz(g >= 3 ? [60, 40, 60, 40, 200] : g > 0 ? [80] : [200]); }
    if (prev && prev.status !== 'ended' && s.status === 'ended') { if (s.winners.includes(s.you)) { sfx('win'); buzz([100, 50, 100, 50, 400]); confetti(120); } }
    const ctx = [s.round, s.phase, s.status].join('|'); if (ctx !== L.ctx) { L.ctx = ctx; L.sel = []; L.one = null; L.clue = ''; }
    if (me() && !localStorage.getItem('dx_rules_seen') && !rulesOpen) { rulesOpen = true; setTimeout(() => rulesModal(() => localStorage.setItem('dx_rules_seen', '1')), 400); }
    render();
  }

  const handHTML = (cards, multi) => `<div class="hand" id="hand">${cards.map((c) => `<div class="hc${L.sel.includes(c) ? ' sel' : ''}" data-hc="${c}"><div class="cd" style="background-image:url(${card(c)})"></div><button class="zm" data-zoom="${c}">🔍</button></div>`).join('')}</div>`;
  function joinScreen() {
    const taken = new Set(S.players.map((p) => p.color)), started = S.status !== 'lobby';
    let body;
    if (started) body = `<div class="card"><h2>La partita è già iniziata</h2><p class="muted">Se hai perso il collegamento, tocca il tuo nome per rientrare:</p>${S.players.filter((p) => !p.left).map((p) => `<div class="prow">${dot(p.color)}<b>${esc(p.name)}</b>${p.connected ? '<small>collegata</small>' : `<button class="btn small" data-claim="${p.id}">Sono io!</button>`}</div>`).join('')}</div>`;
    else body = `<div class="card"><h2>Entra in gioco</h2><input id="nm" maxlength="14" placeholder="Il tuo nome" value="${esc(L.name)}" autocomplete="off"><h3>Scegli il tuo colore</h3><div class="colgrid">${D.COLORS.map((c) => `<button class="cg${L.color === c.id ? ' sel' : ''}" data-col="${c.id}" ${taken.has(c.id) ? 'disabled' : ''}><span class="dot" style="--c:${c.hex}"></span>${c.name}</button>`).join('')}</div><button class="btn" id="go" ${S.players.length >= 8 ? 'disabled' : ''}>Entra!</button></div>${S.players.length ? `<div class="card"><h3>Già dentro</h3>${S.players.map((p) => `<div class="prow">${dot(p.color)}<b>${esc(p.name)}</b></div>`).join('')}</div>` : ''}`;
    return `<div class="wrap"><div class="logo">DIXIT</div><div class="sub">Racconta con un indizio. Inganna con una carta.</div>${body}<button class="btn ghost" data-rules>📖 Come si gioca</button></div>`;
  }
  function lobbyScreen() {
    const host = S.hostId === S.you, n = S.players.length;
    return `<div class="wrap"><div class="card center"><div class="bigi">🎴</div><h2>Sala d'attesa</h2><p>${n} giocatric${n === 1 ? 'e' : 'i'} · da 3 a 8</p>${S.players.map((p) => `<div class="prow">${dot(p.color)}<b>${esc(p.name)}${p.id === S.hostId ? ' ⭐' : ''}</b></div>`).join('')}</div>
      ${host ? `<div class="card"><h3>Obiettivo punti</h3><div style="display:flex;gap:8px">${[20, 30, 40].map((v) => `<button class="btn small ${S.target === v ? '' : 'ghost'}" style="flex:1" data-target="${v}">${v}</button>`).join('')}</div><p class="muted">Vince chi lo raggiunge per prima (o chi ha più punti quando finiscono le carte).</p></div><button class="btn" data-start ${n < 3 ? 'disabled' : ''}>🎴 Inizia la partita</button>` : `<p class="muted center">Aspetta che ${esc(P(S.hostId).name)} avvii la partita…</p>`}
      <button class="btn ghost" data-rules>📖 Come si gioca</button></div>`;
  }
  function gameBody() {
    const m = S.me, T = P(S.tellerId), amT = S.tellerId === S.you;
    if (m.left) return `<div class="wrap"><div class="card center"><div class="bigi">👋</div><h2>Sei uscita dalla partita</h2></div></div>`;
    const clueBox = S.clue ? `<div class="clueBox"><small>L'indizio di ${esc(T.name)}</small>“${esc(S.clue)}”</div>` : '';
    if (S.phase === 'clue') {
      if (!amT) return `<div class="wrap"><div class="card center"><div class="bigi">🗣️</div><h2>${dot(T.color)} ${esc(T.name)} è la Narratrice</h2><p class="muted">Sta scegliendo una carta e un indizio. Intanto guarda la tua mano:</p></div>${handHTML(m.hand)}</div>`;
      return `<div class="wrap"><div class="card mine"><h2>Sei la Narratrice</h2><p>1. Tocca la carta che vuoi usare<br>2. Scrivi un indizio<br>3. Invia</p><input class="txt" id="clue" maxlength="90" placeholder="Il tuo indizio…" value="${esc(L.clue)}" autocomplete="off"><button class="btn" style="margin-top:10px" data-sendclue ${L.sel.length === 1 ? '' : 'disabled'}>✨ Invia indizio</button></div>${handHTML(m.hand)}</div>`;
    }
    if (S.phase === 'pick') {
      if (amT) return `<div class="wrap"><div class="card center">${clueBox}<p class="muted">Aspetta che le altre scelgano la carta (${S.picked}/${S.players.filter((p) => !p.left).length - 1}).</p></div>${m.tellerCard ? `<div class="one"><div class="cd" style="background-image:url(${card(m.tellerCard)})"></div></div><p class="center muted">La tua carta</p>` : ''}</div>`;
      if (m.picked) return `<div class="wrap"><div class="card center">${clueBox}<p class="muted">Hai giocato. Aspetta le altre…</p></div><div class="row" style="display:flex;gap:10px;justify-content:center">${m.picked.map((c) => `<div style="width:42%"><div class="cd" style="background-image:url(${card(c)})"></div></div>`).join('')}</div></div>`;
      return `<div class="wrap"><div class="card mine center">${clueBox}<p>Scegli ${S.need === 2 ? '<b>2 carte</b>' : 'la carta'} che si abbina meglio all'indizio… o che inganna di più.</p></div>${handHTML(m.hand)}<button class="btn" data-play ${L.sel.length === S.need ? '' : 'disabled'}>🃏 Gioca ${S.need === 2 ? 'le carte' : 'la carta'}</button></div>`;
    }
    if (S.phase === 'vote') {
      const grid = `<div class="tgrid">${S.table.map((e, i) => `<div class="hc${e.mine ? ' own' : ''}${L.one === e.card ? ' sel' : ''}" ${e.mine ? '' : `data-vc="${e.card}"`}><div class="num">${i + 1}</div><div class="cd" style="background-image:url(${card(e.card)})"></div>${e.mine ? '<div class="tag">LA TUA</div>' : ''}<button class="zm" data-zoom="${e.card}">🔍</button></div>`).join('')}</div>`;
      if (amT) return `<div class="wrap"><div class="card center">${clueBox}<p class="muted">Le altre stanno votando (${S.voted}/${S.players.filter((p) => !p.left).length - 1}). Non puoi votare: è la tua carta!</p></div>${grid}</div>`;
      if (m.voted) return `<div class="wrap"><div class="card center">${clueBox}<p class="muted">Voto dato! Aspetta le altre… (${S.voted}/${S.players.filter((p) => !p.left).length - 1})</p></div>${grid}</div>`;
      return `<div class="wrap"><div class="card mine center">${clueBox}<p>Quale carta è di ${esc(T.name)}?</p></div>${grid}<button class="btn" data-vote ${L.one ? '' : 'disabled'}>🗳️ Vota</button></div>`;
    }
    if (S.phase === 'reveal') {
      const r = S.result, g = r.gains[S.you] || 0, K = { normal: 'Qualcuna ha indovinato!', all: 'L\'hanno indovinata tutte', none: 'Non l\'ha indovinata nessuna' }[r.kind];
      return `<div class="wrap"><div class="card center">${clueBox}<div class="gain">+${g}</div><p>${K}</p></div><div class="card"><h3>Punti del round</h3>${S.players.filter((p) => !p.left).map((p) => `<div class="rr">${dot(p.color)}<b>${esc(p.name)}${p.id === S.tellerId ? ' 🗣️' : ''}</b><span>+${r.gains[p.id] || 0}</span><small>${p.score}</small></div>`).join('')}</div><div class="tgrid">${r.rows.map((x, i) => `<div class="hc"><div class="num">${i + 1}</div><div class="cd" style="background-image:url(${card(x.card)});${x.teller ? 'box-shadow:0 0 0 4px var(--gold),0 0 24px 4px rgba(242,196,107,.8)' : ''}"></div><div class="tag">${dot(P(x.owner).color)} ${esc(P(x.owner).name)}</div></div>`).join('')}</div><button class="btn violet" data-next>Prossimo round ▶</button></div>`;
    }
    return '';
  }
  function endScreen() {
    const rest = [...S.players].sort((a, b) => b.score - a.score);
    return `<div class="wrap"><div class="card center"><div class="bigi">🏆</div><h2>${S.winners.map((i) => esc(P(i).name)).join(' e ')} ${S.winners.length > 1 ? 'vincono' : 'vince'}!</h2><p class="muted">${esc(S.winReason)}</p></div><div class="card">${rest.map((p) => `<div class="rr">${dot(p.color)}<b>${esc(p.name)}</b><span style="color:var(--gold2)">${p.score}</span></div>`).join('')}</div></div>`;
  }
  function render() {
    const app = $('#app'); if (!S) return; const keep = window.scrollY; const hs = $('#hand') ? $('#hand').scrollLeft : 0; const m = me(); const clueKeep = $('#clue') ? $('#clue').value : null; if (clueKeep != null) L.clue = clueKeep;
    if (!m) { app.innerHTML = joinScreen(); const i = $('#nm'); if (i) i.oninput = () => { L.name = i.value; }; return; }
    const body = S.status === 'lobby' ? lobbyScreen() : S.status === 'ended' ? endScreen() : gameBody();
    const sub = S.status === 'playing' ? (myTurnToAct(S) ? '🎴 TOCCA A TE' : S.tellerId === S.you ? 'Sei la Narratrice' : 'Round ' + S.round) : S.status === 'lobby' ? 'Sala d\'attesa' : 'Finita';
    app.innerHTML = `<div class="top"><div class="who">${dot(m.color)}<div><b>${esc(m.name)}</b><small>${sub}</small></div></div><div class="pts">${m.score}</div><button class="hq" data-snd>${soundOn ? '🔊' : '🔇'}</button><button class="hq" data-rules>?</button></div>${body}`;
    window.scrollTo(0, keep); const nh = $('#hand'); if (nh) nh.scrollLeft = hs;
  }
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('button,[data-hc],[data-vc]'); if (!t) return; const d = t.dataset; if (!d.zoom) sfx('tap');
    if (d.zoom) { e.stopPropagation(); const z = h('div', { class: 'zoom', onclick: () => z.remove() }, h('div', { class: 'cd', style: `background-image:url(${card(d.zoom)})` })); document.body.append(z); return; }
    if (d.col) { L.color = d.col; const i = $('#nm'); if (i) L.name = i.value; return render(); }
    if (t.id === 'go') { const nm = ($('#nm').value || '').trim(); if (!nm) return toast('Scrivi il tuo nome', true); if (!L.color) return toast('Scegli un colore', true); localStorage.setItem('dx_name', nm); const r = await post('/api/join', { name: nm, color: L.color }); if (!r.ok) return toast(r.error, true); token = r.token; localStorage.setItem('dx_token', token); sfx('ok'); return connect(); }
    if (d.claim) { const r = await post('/api/claim', { id: Number(d.claim) }); if (!r.ok) return toast(r.error, true); token = r.token; localStorage.setItem('dx_token', token); return connect(); }
    if ('rules' in d) return rulesModal();
    if ('snd' in d) { soundOn = !soundOn; localStorage.setItem('dx_psound', soundOn ? '1' : '0'); return render(); }
    if (d.target) return act({ type: 'target', value: Number(d.target) });
    if ('start' in d) return act({ type: 'start' });
    if (d.hc) { const c = Number(d.hc), need = S.phase === 'pick' ? S.need : 1; L.sel = L.sel.includes(c) ? L.sel.filter((x) => x !== c) : need === 1 ? [c] : [...L.sel, c].slice(-need); return render(); }
    if (d.vc) { L.one = Number(d.vc); return render(); }
    if ('sendclue' in d) { const text = ($('#clue').value || '').trim(); if (!text) return toast('Scrivi un indizio', true); const r = await act({ type: 'clue', card: L.sel[0], text }); if (r.ok) { sfx('ok'); buzz(40); } return; }
    if ('play' in d) { const r = await act({ type: 'pick', cards: L.sel }); if (r.ok) { sfx('ok'); buzz(40); } return; }
    if ('vote' in d) { const r = await act({ type: 'vote', card: L.one }); if (r.ok) { sfx('ok'); buzz(40); } return; }
    if ('next' in d) return act({ type: 'next' });
  });
  connect();
})();
