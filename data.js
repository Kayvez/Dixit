(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.DXDATA = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  const TITLE = 'Dixit';
  const CARDS = 84; // le carte sono c1.jpg … c84.jpg
  const COLORS = [
    { id: 'rosa', name: 'Rosa', hex: '#ff5fa2' }, { id: 'azzurro', name: 'Azzurro', hex: '#3ec1ff' },
    { id: 'lime', name: 'Lime', hex: '#9be31f' }, { id: 'arancio', name: 'Arancio', hex: '#ff9a2e' },
    { id: 'viola', name: 'Viola', hex: '#a566ff' }, { id: 'turchese', name: 'Turchese', hex: '#20d3b0' },
    { id: 'rosso', name: 'Rosso', hex: '#ff4d4d' }, { id: 'giallo', name: 'Giallo', hex: '#ffd23f' },
  ];
  const RULES = [
    { icon: '🎴', t: 'Cos\'è Dixit', x: 'Ognuna ha 6 carte illustrate. A turno una di voi è la Narratrice: sceglie una sua carta e inventa un indizio, una parola, una frase, un\'emozione, anche un suono.', tip: 'Non c\'è una risposta giusta: conta quanto bene riesci a farti capire… ma non troppo!' },
    { icon: '🗣️', t: 'La Narratrice', x: 'Scegli una carta dalla tua mano e scrivi l\'indizio sul telefono. Poi aspetta: le altre cercano nella loro mano la carta che meglio ci si abbina.', tip: 'Né troppo ovvio né troppo oscuro: se lo capiscono tutte o nessuna, non prendi punti.' },
    { icon: '🃏', t: 'Le altre giocano una carta', x: 'Ognuna sceglie dalla sua mano una carta che sembri adatta all\'indizio e la gioca coperta. Le carte vengono mescolate e scoperte sul tabellone.', tip: 'Le tue carte sono esche: servono a ingannare chi vota.' },
    { icon: '🗳️', t: 'Si vota', x: 'Tutte tranne la Narratrice votano la carta che pensano sia la sua. Non puoi votare la tua.', tip: 'Con 3 giocatrici ognuna delle altre due gioca 2 carte, e si vota comunque una sola carta.' },
    { icon: '⭐', t: 'Punti', x: 'Se qualcuna ha indovinato ma non tutte: la Narratrice prende 3 punti e le giuste 3 punti. Se hanno indovinato tutte o nessuna: la Narratrice 0 e le altre 2 punti. In più, ogni voto che riceve la tua carta-esca vale 1 punto (massimo 3).', tip: 'Con un buon inganno si fanno molti punti anche senza essere Narratrice.' },
    { icon: '🏁', t: 'Come finisce', x: 'Si pescano carte fino a tornare a 6 e passa il turno di Narratrice. La partita finisce quando qualcuna arriva al punteggio obiettivo (di solito 30) o finiscono le carte del mazzo: vince chi ha più punti.', tip: 'Chi crea la partita può cambiare l\'obiettivo (20, 30 o 40) prima di cominciare.' },
  ];
  return { TITLE, CARDS, COLORS, RULES };
});
