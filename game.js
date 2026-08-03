'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#f06292', // H - hueca (reto), rosa
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // H - hueca (reto)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const SKINS = {
  retro: {
    label: 'Retro',
    palette: ['#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#90caf9', '#ffb74d', '#f06292'],
    drawBlock(context, x, y, colorIndex, size, alpha) {
      const color = SKINS.retro.palette[colorIndex - 1];
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      context.globalAlpha = 1;
    },
  },
  neon: {
    label: 'Neon',
    palette: ['#00e5ff', '#fff176', '#e040fb', '#69f0ae', '#ff5252', '#448aff', '#ffab40', '#ff4081'],
    drawBlock(context, x, y, colorIndex, size, alpha) {
      const color = SKINS.neon.palette[colorIndex - 1];
      context.globalAlpha = alpha ?? 1;
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.fillStyle = color;
      context.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
      context.shadowBlur = 0;
      context.strokeStyle = color;
      context.lineWidth = 1;
      context.strokeRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.globalAlpha = 1;
    },
  },
  pastel: {
    label: 'Pastel',
    palette: ['#b3e5fc', '#fff9c4', '#e1bee7', '#c8e6c9', '#ffcdd2', '#bbdefb', '#ffe0b2', '#f8bbd0'],
    drawBlock(context, x, y, colorIndex, size, alpha) {
      const color = SKINS.pastel.palette[colorIndex - 1];
      context.globalAlpha = alpha ?? 1;
      const r = 6;
      const bx = x * size + 2, by = y * size + 2, bw = size - 4, bh = size - 4;
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(bx + r, by);
      context.arcTo(bx + bw, by, bx + bw, by + bh, r);
      context.arcTo(bx + bw, by + bh, bx, by + bh, r);
      context.arcTo(bx, by + bh, bx, by, r);
      context.arcTo(bx, by, bx + bw, by, r);
      context.closePath();
      context.fill();
      context.globalAlpha = 1;
    },
  },
  pixel: {
    label: 'Pixel Art',
    palette: ['#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#90caf9', '#ffb74d', '#f06292'],
    drawBlock(context, x, y, colorIndex, size, alpha) {
      const color = SKINS.pixel.palette[colorIndex - 1];
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      const px = Math.max(2, Math.floor(size / 8));
      context.fillStyle = 'rgba(0,0,0,0.15)';
      for (let i = 0; i < size; i += px * 2) {
        for (let j = 0; j < size; j += px * 2) {
          context.fillRect(x * size + 1 + i, y * size + 1 + j, px, px);
        }
      }
      context.globalAlpha = 1;
    },
  },
};

const SKIN_ORDER = ['retro', 'neon', 'pastel', 'pixel'];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const skinToggleBtn = document.getElementById('skin-toggle');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

// --- Skins ---
let skinCurrent = 'retro';

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  SKINS[skinCurrent].drawBlock(context, x, y, colorIndex, size, alpha);
}

function skinApply(name) {
  skinCurrent = SKINS[name] ? name : 'retro';
  if (skinToggleBtn) skinToggleBtn.textContent = SKINS[skinCurrent].label;
}

function skinCycle() {
  const idx = SKIN_ORDER.indexOf(skinCurrent);
  const next = SKIN_ORDER[(idx + 1) % SKIN_ORDER.length];
  skinApply(next);
  localStorage.setItem('skin', next);
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--grid-color').trim();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  themeToggleBtn.textContent = theme === 'light' ? '☀️' : '🌙';
}

function toggleTheme() {
  const next = document.body.classList.contains('light') ? 'dark' : 'light';
  applyTheme(next);
  localStorage.setItem('theme', next);
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
themeToggleBtn.addEventListener('click', toggleTheme);

applyTheme(localStorage.getItem('theme') || 'dark');
init();

skinToggleBtn.addEventListener('click', skinCycle);
skinApply(localStorage.getItem('skin') || 'retro');
