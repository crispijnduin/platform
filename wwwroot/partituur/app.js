/* ─────────────────────────────────────────────
   Tile Board App — app.js  (v2)
   ───────────────────────────────────────────── */

const CONFIG = {
  MIN_TILE_SIZE:    120,
  MAX_TILE_SIZE:    300,
  TILE_GAP:         12,
  DEFAULT_ROWS:     1,
  TRAY_HEIGHT:      100,
  BOARD_PADDING:    16,
  UNDO_STEPS:       7,
  MODAL_DURATION:   3000,
  PLACEHOLDER_TEXT: "Drag tiles here",
  PEN_SIZE:         4,    // px — whiteboard pen stroke width
  ERASER_SIZE:      40,   // px — whiteboard eraser diameter
};

/* ── Tile definitions ─────────────────────────
   Defined in tilelist.js — edit that file instead.
   ─────────────────────────────────────────────── */

/* ── State ─────────────────────────────────── */
let state = {
  rows:    CONFIG.DEFAULT_ROWS,
  cols:    0,
  tiles:   [],     // ordered list of tileTypeIds (no nulls)
  history: [],
};

/* ── DOM refs ──────────────────────────────── */
const boardEl        = document.getElementById("board");
const boardGrid      = document.getElementById("board-grid");
const trayInner      = document.getElementById("tray-inner");
const bin            = document.getElementById("bin");
const btnUndo        = document.getElementById("btn-undo");
const btnClear       = document.getElementById("btn-clear");
const btnFullscreen  = document.getElementById("btn-fullscreen");
const iconExpand     = document.getElementById("icon-expand");
const iconShrink     = document.getElementById("icon-shrink");
const rowBtns        = document.querySelectorAll(".row-btn");
const placeholderTxt = document.getElementById("placeholder-text");
const modal          = document.getElementById("modal");

/* ── Drag state ────────────────────────────── */
let drag = {
  active:      false,
  ghost:       null,
  fromIndex:   null,   // index in state.tiles; null = from tray
  tileTypeId:  null,
  offsetX:     0,
  offsetY:     0,
  hoverIndex:  null,   // insertion preview index
  overBin:     false,
  _trayEl:     null,
  _boardTile:  null,
};

let modalTimer      = null;
let currentTileSize = 150;
let currentCols     = 1;

/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */
function init() {
  /* Assign stable _id to each tile based on index */
  TILE_TYPES.forEach((t, i) => { t._id = String(i); });
  loadState();
  buildTray();
  computeLayout(state.tiles.length || 1);
  renderBoard();
  updateUndoBtn();

  btnUndo.addEventListener("click", undo);
  btnClear.addEventListener("click", clearBoard);
  btnFullscreen.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", updateFullscreenIcon);
  rowBtns.forEach(b => b.addEventListener("click", () => setRows(+b.dataset.rows)));

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup",   onMouseUp);
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend",  onTouchEnd);
  window.addEventListener("resize",    () => { computeLayout(state.tiles.length || 1); renderBoard(); });
}

/* ═══════════════════════════════════════════
   LAYOUT
   Tiles always fill the board area perfectly.
   No empty slot DOM elements are ever rendered.
═══════════════════════════════════════════ */
function computeLayout(n) {
  const W = boardEl.clientWidth  - CONFIG.BOARD_PADDING * 2;
  const H = boardEl.clientHeight - CONFIG.BOARD_PADDING * 2;
  if (n <= 0) n = 1;

  let bestSize = 0, bestCols = 1;

  for (let c = 1; c <= n; c++) {
    const r  = Math.ceil(n / c);
    if (r > state.rows) continue;
    const tw = Math.floor((W - CONFIG.TILE_GAP * (c - 1)) / c);
    const th = Math.floor((H - CONFIG.TILE_GAP * (r - 1)) / r);
    const sz = Math.min(tw, th, CONFIG.MAX_TILE_SIZE);
    if (sz >= CONFIG.MIN_TILE_SIZE && sz > bestSize) { bestSize = sz; bestCols = c; }
  }

  if (bestSize === 0) {
    // Squeeze below MIN to fit
    bestCols = n;
    const r  = Math.ceil(n / bestCols);
    const tw = Math.floor((W - CONFIG.TILE_GAP * (bestCols - 1)) / bestCols);
    const th = Math.floor((H - CONFIG.TILE_GAP * (r - 1)) / r);
    bestSize = Math.max(Math.min(tw, th, CONFIG.MAX_TILE_SIZE), 40);
  }

  currentTileSize = bestSize;
  currentCols     = bestCols;
  state.cols      = bestCols;
  return bestSize;
}

/* ═══════════════════════════════════════════
   RENDER BOARD
   Always does a clean full rebuild — no diffing.
   preview=true: inserts one drop-placeholder at
   hoverIndex so tiles animate to make room.
═══════════════════════════════════════════ */
function renderBoard(opts = {}) {
  const { preview = false } = opts;

  // Build the display list
  let displayList = [...state.tiles];

  if (preview && drag.fromIndex !== null) {
    displayList.splice(drag.fromIndex, 1);
  }

  if (preview && drag.hoverIndex !== null && !drag.overBin) {
    const insertAt = Math.min(drag.hoverIndex, displayList.length);
    displayList.splice(insertAt, 0, "__placeholder__");
  }

  const n = displayList.length || 1;
  const tileSize = computeLayout(n);

  // Apply grid CSS
  boardGrid.style.gridTemplateColumns = `repeat(${currentCols}, ${tileSize}px)`;
  boardGrid.style.gridAutoRows        = `${tileSize}px`;
  boardGrid.style.gap                 = `${CONFIG.TILE_GAP}px`;

  // Full clean rebuild — no stale-children diffing bugs
  boardGrid.innerHTML = "";
  displayList.forEach((typeId, i) => {
    if (typeId === "__placeholder__") {
      boardGrid.appendChild(makePlaceholder(tileSize));
    } else {
      const tDef = TILE_TYPES.find(t => t._id === typeId);
      if (!tDef) return;
      const tile = createTileEl(tDef, tileSize);
      tile.dataset.listIdx = i;
      attachTileDragListeners(tile);
      boardGrid.appendChild(tile);
    }
  });

  // Placeholder text (empty board, not dragging)
  placeholderTxt.classList.toggle("hidden", state.tiles.length > 0 || preview);

  updateUndoBtn();
  if (!preview) saveState();
}

function makePlaceholder(size) {
  const ph = document.createElement("div");
  ph.className  = "drop-placeholder";
  ph.style.width  = size + "px";
  ph.style.height = size + "px";
  return ph;
}

/* ═══════════════════════════════════════════
   TILE CREATION
═══════════════════════════════════════════ */
function createTileEl(tDef, size) {
  const tile = document.createElement("div");
  tile.className    = "tile";
  tile.dataset.type = tDef._id;
  tile.style.width  = size + "px";
  tile.style.height = size + "px";

  if (tDef.img) {
    const img = document.createElement("img");
    img.src = tDef.img; img.alt = tDef.lbl;
    tile.appendChild(img);
  } else {
    tile.style.background  = "#e8d8c8";
    tile.style.borderColor = "#c8b090";
    const inner = document.createElement("div");
    inner.className = "tile-inner";
    inner.innerHTML = `
      <span class="tile-letter" style="color:#ff6b35;font-size:${Math.round(size*.35)}px">${tDef.lbl ? tDef.lbl[0] : "?"}</span>
      <span class="tile-name"   style="color:#ff6b3599">${tDef.lbl}</span>`;
    tile.appendChild(inner);
  }
  return tile;
}

function createGhostEl(tDef, size) {
  const g = document.createElement("div");
  g.id = "drag-ghost";
  g.style.cssText = `width:${size}px;height:${size}px;border-radius:10px;overflow:hidden;position:fixed;pointer-events:none;z-index:999;box-shadow:0 12px 32px rgba(0,0,0,.6);opacity:.88;transform:scale(1.08);`;

  if (tDef.img) {
    const img = document.createElement("img");
    img.src = tDef.img;
    img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
    g.appendChild(img);
  } else {
    g.style.background = "#e8d8c8";
    g.style.border     = "2px solid #c8b090";
    g.style.display    = "flex";
    g.style.alignItems = "center";
    g.style.justifyContent = "center";
    const sz = Math.round(size * .38);
    g.innerHTML = `<span style="font-size:${sz}px;font-weight:900;color:#ff6b35">${tDef.lbl ? tDef.lbl[0] : "?"}</span>`;
  }
  return g;
}

/* ═══════════════════════════════════════════
   TRAY
═══════════════════════════════════════════ */
function buildTray() {
  trayInner.innerHTML = "";
  TILE_TYPES.forEach(tDef => {
    const tt = document.createElement("div");
    tt.className    = "tray-tile";
    tt.dataset.type = tDef._id;

    if (tDef.img) {
      const img = document.createElement("img");
      img.src = tDef.img; img.alt = tDef.lbl;
      tt.appendChild(img);
    } else {
      tt.style.background  = "#e8d8c8";
      tt.style.borderColor = "#c8b090";
      tt.innerHTML = `
        <div class="tile-inner">
          <span class="tile-letter" style="color:#ff6b35">${tDef.lbl ? tDef.lbl[0] : "?"}</span>
          <span class="tile-name"   style="color:#ff6b3599">${tDef.lbl}</span>
        </div>`;
    }
    attachTrayDragListeners(tt);
    trayInner.appendChild(tt);
  });
}

/* ═══════════════════════════════════════════
   DRAG — START FROM TRAY
═══════════════════════════════════════════ */
function attachTrayDragListeners(el) {
  el.addEventListener("mousedown",  e => startDragTray(e, el, e.clientX, e.clientY));
  el.addEventListener("touchstart", e => startDragTray(e, el, e.touches[0].clientX, e.touches[0].clientY), { passive: true });
}

function startDragTray(e, el, cx, cy) {
  if (e.button !== undefined && e.button !== 0) return;
  const tDef = TILE_TYPES.find(t => t._id === el.dataset.type);
  if (!tDef) return;

  const sz = Math.min(CONFIG.TRAY_HEIGHT - 24, currentTileSize);
  drag.active     = true;
  drag.fromIndex  = null;
  drag.tileTypeId = tDef._id;
  drag.offsetX    = sz / 2;
  drag.offsetY    = sz / 2;
  drag.hoverIndex = null;
  drag.overBin    = false;
  drag._trayEl    = el;

  const ghost = createGhostEl(tDef, sz);
  document.body.appendChild(ghost);
  drag.ghost = ghost;
  moveGhost(cx, cy);
}

/* ═══════════════════════════════════════════
   DRAG — START FROM BOARD
═══════════════════════════════════════════ */
function attachTileDragListeners(tile) {
  tile.addEventListener("mousedown",  e => startDragBoard(e, tile, e.clientX, e.clientY));
  tile.addEventListener("touchstart", e => startDragBoard(e, tile, e.touches[0].clientX, e.touches[0].clientY), { passive: true });
}

function startDragBoard(e, tile, cx, cy) {
  if (e.button !== undefined && e.button !== 0) return;
  e.stopPropagation();
  const idx    = +tile.dataset.listIdx;
  const typeId = state.tiles[idx];
  const tDef   = TILE_TYPES.find(t => t._id === typeId);
  if (!tDef) return;

  const rect = tile.getBoundingClientRect();
  drag.active     = true;
  drag.fromIndex  = idx;
  drag.tileTypeId = typeId;
  drag.offsetX    = cx - rect.left;
  drag.offsetY    = cy - rect.top;
  drag.hoverIndex = null;
  drag.overBin    = false;
  drag._boardTile = null;  // source tile removed from DOM during preview render

  const ghost = createGhostEl(tDef, currentTileSize);
  document.body.appendChild(ghost);
  drag.ghost = ghost;
  moveGhost(cx, cy);
}

/* ═══════════════════════════════════════════
   DRAG — MOVE
═══════════════════════════════════════════ */
function onMouseMove(e) {
  if (!drag.active) return;
  moveGhost(e.clientX, e.clientY);
  updateBinHover(e.clientX, e.clientY);
  updateHoverIndex(e.clientX, e.clientY);
}

function onTouchMove(e) {
  if (!drag.active) return;
  e.preventDefault();
  const t = e.touches[0];
  moveGhost(t.clientX, t.clientY);
  updateBinHover(t.clientX, t.clientY);
  updateHoverIndex(t.clientX, t.clientY);
}

function moveGhost(cx, cy) {
  if (!drag.ghost) return;
  drag.ghost.style.left = (cx - drag.offsetX) + "px";
  drag.ghost.style.top  = (cy - drag.offsetY) + "px";
}

function updateBinHover(cx, cy) {
  const r    = bin.getBoundingClientRect();
  const over = cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;

  // Continuous distance-based shrink.
  // Starts shrinking from SHRINK_START_PX away from bin centre,
  // reaches scale(0.1) exactly at bin centre.
  const SHRINK_START_PX = Math.min(window.innerWidth, window.innerHeight) * 0.55;
  const SCALE_FAR  = 1.08;
  const SCALE_NEAR = 0.10;

  if (drag.ghost) {
    const binCx = r.left + r.width  / 2;
    const binCy = r.top  + r.height / 2;
    const dist  = Math.hypot(cx - binCx, cy - binCy);
    // t=0 → far away (full size), t=1 → at bin (smallest)
    const t     = Math.max(0, Math.min(1, 1 - dist / SHRINK_START_PX));
    const sc    = SCALE_FAR + (SCALE_NEAR - SCALE_FAR) * t;
    drag.ghost.style.transition = "none";   // remove transition so it follows cursor instantly
    drag.ghost.style.transform  = `scale(${sc.toFixed(3)})`;
  }

  if (over !== drag.overBin) {
    drag.overBin = over;
    bin.classList.toggle("active", over);
    renderBoard({ preview: true });
  }
}

function updateHoverIndex(cx, cy) {
  if (drag.overBin) return;

  const boardRect = boardEl.getBoundingClientRect();
  if (cx < boardRect.left || cx > boardRect.right ||
      cy < boardRect.top  || cy > boardRect.bottom) {
    if (drag.hoverIndex !== null) { drag.hoverIndex = null; renderBoard({ preview: true }); }
    return;
  }

  const displayCount = drag.fromIndex !== null
    ? state.tiles.length - 1
    : state.tiles.length;

  const cellW    = currentTileSize + CONFIG.TILE_GAP;
  const cellH    = currentTileSize + CONFIG.TILE_GAP;
  const cols     = currentCols;
  const gridRect = boardGrid.getBoundingClientRect();

  const relX = cx - gridRect.left;
  const relY = cy - gridRect.top;

  const col     = Math.floor(relX / cellW);
  const row     = Math.floor(relY / cellH);
  const baseIdx = row * cols + col;

  // Use cursor position within the cell to decide insert before or after.
  // Right half of cell → insert after (baseIdx + 1), left half → insert before (baseIdx).
  const posInCell = relX - col * cellW;
  const insertAfter = posInCell > currentTileSize / 2;
  let idx = insertAfter ? baseIdx + 1 : baseIdx;
  idx = Math.max(0, Math.min(idx, displayCount));

  if (idx !== drag.hoverIndex) {
    drag.hoverIndex = idx;
    renderBoard({ preview: true });
  }
}

/* ═══════════════════════════════════════════
   DRAG — END
═══════════════════════════════════════════ */
function onMouseUp(e) { if (drag.active) endDrag(); }
function onTouchEnd(e) { if (drag.active) endDrag(); }

function endDrag() {
  if (!drag.active) return;

  removeGhost();
  bin.classList.remove("active");

  drag._trayEl = null;

  const onBin   = drag.overBin;
  const onBoard = drag.hoverIndex !== null && !onBin;

  if (onBin && drag.fromIndex !== null) {
    pushHistory();
    state.tiles.splice(drag.fromIndex, 1);

  } else if (onBoard) {
    let insertIdx = drag.hoverIndex;

    if (drag.fromIndex !== null) {
      // Reorder
      pushHistory();
      const [removed] = state.tiles.splice(drag.fromIndex, 1);
      if (drag.fromIndex < insertIdx) insertIdx--;
      state.tiles.splice(insertIdx, 0, removed);
    } else {
      // From tray — check if there's still room
      const maxTiles = state.rows * Math.floor(
        (boardEl.clientWidth - CONFIG.BOARD_PADDING * 2 + CONFIG.TILE_GAP) /
        (CONFIG.MIN_TILE_SIZE + CONFIG.TILE_GAP)
      );
      if (state.tiles.length >= maxTiles) {
        showModal("Board is full — try adding a row!");
      } else {
        pushHistory();
        state.tiles.splice(insertIdx, 0, drag.tileTypeId);
      }
    }
  }
  // else: dropped outside — no change

  drag.active     = false;
  drag.fromIndex  = null;
  drag.tileTypeId = null;
  drag.hoverIndex = null;
  drag.overBin    = false;
  drag.ghost      = null;

  computeLayout(state.tiles.length || 1);
  renderBoard();
}

function removeGhost() {
  document.getElementById("drag-ghost")?.remove();
}

/* ═══════════════════════════════════════════
   CONTROLS
═══════════════════════════════════════════ */
function setRows(n) {
  if (n === state.rows) return;
  pushHistory();
  state.rows = n;
  rowBtns.forEach(b => b.classList.toggle("active", +b.dataset.rows === n));
  computeLayout(state.tiles.length || 1);
  renderBoard();
}

function clearBoard() {
  if (!state.tiles.length) return;
  pushHistory();
  state.tiles = [];
  computeLayout(1);
  renderBoard();
}

/* ═══════════════════════════════════════════
   UNDO
═══════════════════════════════════════════ */
function pushHistory() {
  state.history.push(JSON.stringify({ rows: state.rows, tiles: [...state.tiles] }));
  if (state.history.length > CONFIG.UNDO_STEPS) state.history.shift();
  updateUndoBtn();
}

function undo() {
  if (!state.history.length) return;
  const snap   = JSON.parse(state.history.pop());
  state.rows   = snap.rows;
  state.tiles  = snap.tiles;
  rowBtns.forEach(b => b.classList.toggle("active", +b.dataset.rows === state.rows));
  computeLayout(state.tiles.length || 1);
  renderBoard();
}

function updateUndoBtn() {
  btnUndo.disabled = state.history.length === 0;
}

/* ═══════════════════════════════════════════
   PERSISTENCE
═══════════════════════════════════════════ */
const STORAGE_KEY = "tileboard_v4";

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      rows: state.rows, tiles: state.tiles, history: state.history,
    }));
  } catch (_) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const s       = JSON.parse(raw);
    state.rows    = s.rows    ?? CONFIG.DEFAULT_ROWS;
    state.tiles   = s.tiles   ?? [];
    state.history = s.history ?? [];
    rowBtns.forEach(b => b.classList.toggle("active", +b.dataset.rows === state.rows));
  } catch (_) {}
}

/* ═══════════════════════════════════════════
   MODAL
═══════════════════════════════════════════ */
function showModal(msg) {
  document.getElementById("modal-msg").textContent = msg;
  modal.classList.remove("hidden");
  clearTimeout(modalTimer);
  modalTimer = setTimeout(() => modal.classList.add("hidden"), CONFIG.MODAL_DURATION);
}

/* ═══════════════════════════════════════════
   FULLSCREEN
═══════════════════════════════════════════ */
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

function updateFullscreenIcon() {
  const isFs = !!document.fullscreenElement;
  iconExpand.style.display = isFs ? "none"  : "";
  iconShrink.style.display = isFs ? ""      : "none";
}

/* ── Boot ── */
init();
