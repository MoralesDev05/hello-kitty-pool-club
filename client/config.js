// Personagens, cenários e decoração. Imagens em client/assets/characters/:
//   <id>.png       512x512 transparente  -> marca d'água, estampa da mesa, fundo da tela
//   <id>-icon.png  128x128 transparente  -> avatar do jogador, cantos e bordas da mesa
// Se algum arquivo faltar, o jogo usa o emoji (e) automaticamente.
const CHARS = [
  { id: 'hello-kitty', n: 'Hello Kitty', e: '🐱', felt: '#f6a6c8', rail: '#ffe3ee', trim: '#e5486e', cenario: 'Sala da Hello Kitty', deco: ['🎀', '🍎', '💖'], bg: ['#ffe3ef', '#ffc2d9'] },
  { id: 'my-melody', n: 'My Melody', e: '🐰', felt: '#9be0b5', rail: '#ffd1e0', trim: '#ff7aa8', cenario: 'Jardim da My Melody', deco: ['🌸', '🍓', '🌷'], bg: ['#e6ffee', '#ffd9e8'] },
  { id: 'kuromi', n: 'Kuromi', e: '😈', felt: '#8f6ac8', rail: '#3a2457', trim: '#ff5fa8', cenario: 'Salão da Kuromi', deco: ['💀', '🖤', '🦇'], bg: ['#d9c8f5', '#9b7fd1'] },
  { id: 'cinnamoroll', n: 'Cinnamoroll', e: '🐶', felt: '#8fd3ff', rail: '#ffffff', trim: '#9ab8ff', cenario: 'Céu do Cinnamoroll', deco: ['☁️', '⭐', '🩵'], bg: ['#e3f4ff', '#bfe3ff'] },
  { id: 'pompompurin', n: 'Pompompurin', e: '🍮', felt: '#ffe08a', rail: '#fff4cf', trim: '#b5793a', cenario: 'Café do Pompompurin', deco: ['🍮', '🥐', '☕'], bg: ['#fff6d6', '#ffe6a0'] },
  { id: 'keroppi', n: 'Keroppi', e: '🐸', felt: '#8fdc7a', rail: '#e6ffd9', trim: '#2f8f3a', cenario: 'Lagoa do Keroppi', deco: ['🍀', '🪷', '💧'], bg: ['#e6ffd9', '#b8ecc0'] },
  { id: 'badtz-maru', n: 'Badtz-Maru', e: '🐧', felt: '#7a8aa8', rail: '#2b3245', trim: '#ffd23f', cenario: 'Garagem do Badtz-Maru', deco: ['⚡', '🎸', '🔧'], bg: ['#d5dbe8', '#9aa6c0'] },
  { id: 'chococat', n: 'Chococat', e: '🐈‍⬛', felt: '#6f7fd0', rail: '#232a5a', trim: '#ffcf4d', cenario: 'Biblioteca do Chococat', deco: ['⭐', '📚', '🐾'], bg: ['#d8dcf7', '#9aa5e6'] }
];
const IMG = {};
const load = src => (IMG[src] ||= Object.assign(new Image(), { src, onload() { HKP.loaded++; HKP.onload && HKP.onload(); } }));
CHARS.forEach(c => { c.img = load(`assets/characters/${c.id}.png`); c.ico = load(`assets/characters/${c.id}-icon.png`); });
window.HKP = {
  loaded: 0, onload: null, CHARS,
  AVATARS: CHARS.map(c => c.e),
  THEMES: CHARS.map(c => ({ n: c.cenario, felt: c.felt, rail: c.rail, trim: c.trim, char: c }))
};
