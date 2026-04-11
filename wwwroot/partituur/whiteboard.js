/* ═══════════════════════════════════════════════════════════════
   whiteboard.js — Tile Board Whiteboard Layer
   Self-contained. Reads PEN_SIZE and ERASER_SIZE from CONFIG.
   Annotations are in-memory only (cleared on page reload).
═══════════════════════════════════════════════════════════════ */

/* ── DOM refs ──────────────────────────────────────────────── */
const wbCanvas       = document.getElementById("wb-canvas");
const wbToolbar      = document.getElementById("wb-toolbar");
const wbBtnToggle    = document.getElementById("btn-wb");
const wbBtnPen       = document.getElementById("wb-pen");
const wbBtnEraser    = document.getElementById("wb-eraser");
const wbBtnClear     = document.getElementById("wb-clear");

/* ── Eraser cursor element ─────────────────────────────────── */
const eraserCursor = document.createElement("div");
eraserCursor.id    = "wb-eraser-cursor";
document.body.appendChild(eraserCursor);

/* ── State ─────────────────────────────────────────────────── */
let wbActive    = false;   // is whiteboard layer on?
let wbEraser    = false;   // pen or eraser mode?
let wbDrawing   = false;   // currently drawing a stroke?
let wbLastX     = 0;
let wbLastY     = 0;

/* ── Canvas context ────────────────────────────────────────── */
const ctx = wbCanvas.getContext("2d");

/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */
(function initWhiteboard() {
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  wbBtnToggle.addEventListener("click", toggleWhiteboard);
  wbBtnPen.addEventListener("click",    setPen);
  wbBtnEraser.addEventListener("click", setEraser);
  wbBtnClear.addEventListener("click",  clearWhiteboard);

  /* Mouse events */
  wbCanvas.addEventListener("mousedown",  onPointerDown);
  wbCanvas.addEventListener("mousemove",  onPointerMove);
  wbCanvas.addEventListener("mouseup",    onPointerUp);
  wbCanvas.addEventListener("mouseleave", onPointerUp);

  /* Touch events */
  wbCanvas.addEventListener("touchstart", onTouchStart, { passive: false });
  wbCanvas.addEventListener("touchmove",  onTouchMove,  { passive: false });
  wbCanvas.addEventListener("touchend",   onPointerUp);
})();

/* ═══════════════════════════════════════════════════════════
   CANVAS RESIZE
   Keep canvas pixel dimensions in sync with viewport.
   Preserve existing drawing on resize by copying to a
   temporary image first.
═══════════════════════════════════════════════════════════ */
function resizeCanvas() {
  /* Save current drawing */
  const img = wbCanvas.toDataURL();

  wbCanvas.width  = window.innerWidth;
  wbCanvas.height = window.innerHeight;

  /* Restore after resize */
  if (img !== "data:,") {
    const image = new Image();
    image.onload = () => ctx.drawImage(image, 0, 0);
    image.src = img;
  }

  applyCtxSettings();
}

function applyCtxSettings() {
  ctx.lineCap   = "round";
  ctx.lineJoin  = "round";
  ctx.lineWidth = CONFIG.PEN_SIZE;
  ctx.strokeStyle = "#000000";
}

/* ═══════════════════════════════════════════════════════════
   TOGGLE ON / OFF
═══════════════════════════════════════════════════════════ */
function toggleWhiteboard() {
  wbActive = !wbActive;

  wbCanvas.classList.toggle("active", wbActive);
  wbToolbar.classList.toggle("hidden", !wbActive);
  wbBtnToggle.classList.toggle("active", wbActive);

  if (!wbActive) {
    /* Leaving whiteboard — hide eraser cursor, stop any active stroke */
    wbDrawing = false;
    eraserCursor.style.display = "none";
  } else {
    /* Entering whiteboard — apply current tool cursor */
    updateCursor();
  }
}

/* ═══════════════════════════════════════════════════════════
   TOOL SELECTION
═══════════════════════════════════════════════════════════ */
function setPen() {
  wbEraser = false;
  wbBtnPen.classList.add("active");
  wbBtnEraser.classList.remove("active");
  wbCanvas.classList.remove("eraser-mode");
  eraserCursor.style.display = "none";
  applyCtxSettings();
}

function setEraser() {
  wbEraser = true;
  wbBtnEraser.classList.add("active");
  wbBtnPen.classList.remove("active");
  wbCanvas.classList.add("eraser-mode");
  /* Size the eraser cursor div */
  const d = CONFIG.ERASER_SIZE;
  eraserCursor.style.width  = d + "px";
  eraserCursor.style.height = d + "px";
}

function updateCursor() {
  if (wbEraser) setEraser(); else setPen();
}

/* ═══════════════════════════════════════════════════════════
   DRAWING

   The path is kept OPEN for the entire stroke (beginPath
   only on mousedown). Each mousemove calls lineTo + stroke
   on the same open path. With lineCap/lineJoin = "round"
   this produces a perfectly gapless line at any speed.
═══════════════════════════════════════════════════════════ */
function startStroke(x, y) {
  wbDrawing = true;
  wbLastX   = x;
  wbLastY   = y;

  if (wbEraser) {
    eraseAt(x, y);
    return;
  }

  /* Open a new path for this stroke */
  ctx.beginPath();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth   = CONFIG.PEN_SIZE;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";
  ctx.moveTo(x, y);

  /* Draw a dot in case the user just taps without moving */
  ctx.lineTo(x + 0.1, y + 0.1);
  ctx.stroke();
}

function continueStroke(x, y) {
  if (!wbDrawing) return;

  if (wbEraser) {
    eraseAt(x, y);
    wbLastX = x;
    wbLastY = y;
    return;
  }

  /* Extend the open path — no beginPath, no gap */
  ctx.lineTo(x, y);
  ctx.stroke();

  wbLastX = x;
  wbLastY = y;
}

function endStroke() {
  wbDrawing = false;
  /* Close the path so future strokes start fresh */
  ctx.beginPath();
}

function eraseAt(x, y) {
  const r = CONFIG.ERASER_SIZE / 2;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,1)";
  ctx.fill();
  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════
   CLEAR
═══════════════════════════════════════════════════════════ */
function clearWhiteboard() {
  ctx.clearRect(0, 0, wbCanvas.width, wbCanvas.height);
}

/* ═══════════════════════════════════════════════════════════
   MOUSE EVENT HANDLERS
═══════════════════════════════════════════════════════════ */
function onPointerDown(e) {
  startStroke(e.clientX, e.clientY);
}

function onPointerMove(e) {
  /* Move eraser cursor div */
  if (wbEraser && wbActive) {
    eraserCursor.style.display = "block";
    eraserCursor.style.left    = e.clientX + "px";
    eraserCursor.style.top     = e.clientY + "px";
  }
  continueStroke(e.clientX, e.clientY);
}

function onPointerUp() {
  endStroke();
}

/* ═══════════════════════════════════════════════════════════
   TOUCH EVENT HANDLERS
═══════════════════════════════════════════════════════════ */
function onTouchStart(e) {
  e.preventDefault();
  const t = e.touches[0];
  startStroke(t.clientX, t.clientY);
}

function onTouchMove(e) {
  e.preventDefault();
  const t = e.touches[0];
  continueStroke(t.clientX, t.clientY);
}
