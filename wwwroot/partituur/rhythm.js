/* ═══════════════════════════════════════════════════════════════
   rhythm.js — Tile Board Part 2: Rhythm Module  v1.2
   Key fixes:
     - Ball LANDS on the beat (arc ends at beat time, not starts)
     - Arc duration = note length (half note arcs over 2 beats)
     - xLand = visual centre of note glyph (not raw beat slot)
     - Arc height 5× previous value
     - Timing: arc anchored to scheduled beat time, not rAF wall clock
═══════════════════════════════════════════════════════════════ */

/* ── Constants ─────────────────────────────────────────────── */
const BEAT_VALUES  = { quarter: 1, half: 2, whole: 4 };
const DEFAULT_BPM  = 180;
const STORAGE_BPM  = "tileboard_bpm";

const NOTE_GLYPHS  = { quarter: "♩", half: "𝅗𝅥", whole: "𝅝" };

/* These fractions MUST match paintNoteCanvas exactly */
const BEAT_X_FRAC  = [0.125, 0.375, 0.625, 0.875];  // per quarter-beat slot
const NOTE_Y_FRAC  = 0.44;   // glyph centre y within overlay
const OVERLAY_FRAC = 0.38;   // overlay height / tile height

/* ── DOM refs ──────────────────────────────────────────────── */
const btnMode        = document.getElementById("btn-mode");
const btnPlay        = document.getElementById("btn-play");
const iconPlay       = document.getElementById("icon-play");
const iconStop       = document.getElementById("icon-stop");
const tempoSlider    = document.getElementById("tempo-slider");
const tempoDisplay   = document.getElementById("tempo-display");
const rhythmControls = document.getElementById("rhythm-controls");
const editControls   = document.getElementById("controls");
const bounceBall     = document.getElementById("bounce-ball");
const btnFullscreenR = document.getElementById("btn-fullscreen-r");
const btnRepeat      = document.getElementById("btn-repeat");
const btnShowNotes   = document.getElementById("btn-show-notes");
const btnShowSyls    = document.getElementById("btn-show-syls");
const btnShowBall    = document.getElementById("btn-show-ball");
const btnSound       = document.getElementById("btn-sound");

/* ── Module state ──────────────────────────────────────────── */
let rhythmMode        = false;
let playing           = false;
let bpm               = DEFAULT_BPM;
let noteSeq           = [];   // sequence of NOTE objects (not beat objects)
let tickTimer         = null;
let rafHandle         = null;
let playbackStartTime = 0;    // performance.now() when beat-0 lands

/* ── Persistent settings (cookies) ────────────────────────── */
let autoRepeat  = false;
let showNotes   = true;
let showSyls    = true;
let showBall    = true;
let soundOn     = true;

/* ── Audio ─────────────────────────────────────────────────── */
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */
(function initRhythm() {
  loadBpm();
  validateAllTiles();

  /* btn-mode wired as toggleRhythmMode below */
  btnPlay.addEventListener("click", togglePlayback);
  btnFullscreenR.addEventListener("click", () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  });

  tempoSlider.addEventListener("input", () => {
    bpm = +tempoSlider.value;
    tempoDisplay.textContent = bpm;
    saveBpm();
  });

  document.addEventListener("keydown", e => {
    if (e.code === "Space" && rhythmMode) { e.preventDefault(); togglePlayback(); }
  });

  /* Load cookie settings */
  loadSettings();

  /* btn-mode now TOGGLES between edit and rhythm */
  btnMode.addEventListener("click", toggleRhythmMode);

  btnRepeat.addEventListener("click", () => {
    autoRepeat = !autoRepeat;
    btnRepeat.classList.toggle("on", autoRepeat);
    saveSetting("tb_repeat", autoRepeat);
  });

  btnShowNotes.addEventListener("click", () => {
    showNotes = !showNotes;
    btnShowNotes.classList.toggle("on", showNotes);
    saveSetting("tb_notes", showNotes);
    if (rhythmMode) drawAllOverlays();
  });

  btnShowSyls.addEventListener("click", () => {
    showSyls = !showSyls;
    btnShowSyls.classList.toggle("on", showSyls);
    saveSetting("tb_syls", showSyls);
    if (rhythmMode) drawAllOverlays();
  });

  btnShowBall.addEventListener("click", () => {
    showBall = !showBall;
    btnShowBall.classList.toggle("on", showBall);
    saveSetting("tb_ball", showBall);
    if (!showBall) bounceBall.classList.add("hidden");
    else if (playing) bounceBall.classList.remove("hidden");
  });

  btnSound.addEventListener("click", () => {
    soundOn = !soundOn;
    btnSound.classList.toggle("on", soundOn);
    saveSetting("tb_sound", soundOn);
  });

  new MutationObserver(() => { if (rhythmMode) drawAllOverlays(); })
    .observe(document.getElementById("board-grid"), { childList: true });
})();

/* ═══════════════════════════════════════════════════════════
   MODE SWITCHING
═══════════════════════════════════════════════════════════ */
function toggleRhythmMode() {
  if (rhythmMode) exitRhythmMode(); else enterRhythmMode();
}

function enterRhythmMode() {
  rhythmMode = true;
  document.body.classList.add("rhythm-mode");
  editControls.classList.add("hidden");
  rhythmControls.classList.remove("hidden");
  btnMode.classList.add("active");
  window.dispatchEvent(new Event("resize"));
  drawAllOverlays();
}

function exitRhythmMode() {
  if (playing) stopPlayback();
  rhythmMode = false;
  document.body.classList.remove("rhythm-mode");
  editControls.classList.remove("hidden");
  rhythmControls.classList.add("hidden");
  btnMode.classList.remove("active");
  clearAllOverlays();
  clearActiveTile();
  window.dispatchEvent(new Event("resize"));
}

/* ═══════════════════════════════════════════════════════════
   VALIDATION
═══════════════════════════════════════════════════════════ */
function validateAllTiles() {
  const VALID_NOTES = Object.keys(BEAT_VALUES);
  TILE_TYPES.forEach(tDef => {
    if (!tDef.rhythm) return;
    tDef.rhythm.forEach((b, i) => {
      if (!VALID_NOTES.includes(b.note)) {
        console.warn(`[Rhythm] tile "${tDef.lbl}" beat ${i}: unknown note value "${b.note}". Use: ${VALID_NOTES.join(", ")}`);
      }
    });
    const sum = tDef.rhythm.reduce((a, b) => a + (b.new ? (BEAT_VALUES[b.note] || 0) : 0), 0);
    if (sum !== 4) console.warn(`[Rhythm] tile "${tDef.lbl}" beats sum to ${sum}, expected 4.`);
  });
}

/* ═══════════════════════════════════════════════════════════
   NOTE OVERLAYS
═══════════════════════════════════════════════════════════ */
function drawAllOverlays() {
  document.querySelectorAll("#board-grid .tile").forEach(drawOverlay);
}

function clearAllOverlays() {
  document.querySelectorAll(".note-overlay, .no-rhythm-badge").forEach(e => e.remove());
}

function drawOverlay(tileDiv) {
  tileDiv.querySelectorAll(".note-overlay, .no-rhythm-badge").forEach(e => e.remove());
  const tDef = TILE_TYPES.find(t => t._id === tileDiv.dataset.type);
  if (!tDef) return;

  tileDiv.style.position = "relative";
  tileDiv.style.overflow = "hidden";

  if (!tDef.rhythm) {
    const badge = document.createElement("div");
    badge.className = "no-rhythm-badge";
    badge.textContent = "!";
    tileDiv.appendChild(badge);
    return;
  }

  const w = tileDiv.offsetWidth;
  const h = tileDiv.offsetHeight;
  const overlayH = Math.round(h * OVERLAY_FRAC);

  const overlay = document.createElement("div");
  overlay.className = "note-overlay";
  const canvas = document.createElement("canvas");
  canvas.width  = w;
  canvas.height = overlayH;
  canvas.style.width  = w + "px";
  canvas.style.height = overlayH + "px";
  overlay.appendChild(canvas);
  tileDiv.appendChild(overlay);
  paintNoteCanvas(canvas, tDef.rhythm, w, overlayH);
}

function paintNoteCanvas(canvas, rhythm, w, h) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);

  const beatX        = BEAT_X_FRAC.map(f => w * f);
  const noteFontSize = Math.max(10, Math.round(h * 0.42));
  const syllFontSize = Math.max(7,  Math.round(h * 0.22));
  const noteY        = Math.round(h * NOTE_Y_FRAC);
  const syllY        = Math.round(h * 0.88);

  const groups = rhythmToGroups(rhythm);

  groups.forEach(g => {
    const cx = (beatX[g.startBeat] + beatX[g.endBeat]) / 2;

    if (showNotes) {
      ctx.font         = `${noteFontSize}px serif`;
      ctx.fillStyle    = "#2d2016";
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(NOTE_GLYPHS[g.note], cx, noteY);
    }

    if (showSyls) {
      ctx.font      = `bold ${syllFontSize}px 'Nunito','Segoe UI',sans-serif`;
      ctx.fillStyle = "#7a5c44";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(g.syl, cx, syllY);
    }
  });

  ctx.strokeStyle = "rgba(45,32,22,0.12)";
  ctx.lineWidth   = 1;
  [0.25, 0.5, 0.75].forEach(f => {
    ctx.beginPath();
    ctx.moveTo(w * f, h * 0.05);
    ctx.lineTo(w * f, h * 0.78);
    ctx.stroke();
  });
}

/* Group a 4-beat rhythm array into note objects */
function rhythmToGroups(rhythm) {
  const groups = [];
  let cur = null;
  rhythm.forEach((beat, i) => {
    if (beat.new) {
      if (cur) groups.push(cur);
      cur = { note: beat.note, syl: beat.syl, startBeat: i, endBeat: i };
    } else if (cur) {
      cur.endBeat = i;
    }
  });
  if (cur) groups.push(cur);
  return groups;
}

/* ═══════════════════════════════════════════════════════════
   NOTE SEQUENCE BUILDER

   Builds noteSeq — one entry per NOTE (not per beat).
   Each entry has:
     xLand        — screen x of the note glyph centre
     yLand        — screen y of the note glyph centre
     landMs       — wall-clock ms (relative to playbackStartTime)
                    when ball must land here
     durationMs   — how long this note lasts (= noteBeats * beatMs)
                    = the travel time of the arc that ends here
     tileDiv      — the tile DOM element

   The ball arc for note[i] departs from note[i-1].xLand/yLand
   at time note[i-1].landMs and arrives at note[i].xLand/yLand
   at time note[i].landMs.
═══════════════════════════════════════════════════════════ */
function buildNoteSequence() {
  noteSeq = [];
  const beatMs  = 60000 / bpm;
  let   beatIdx = 0;   // running absolute quarter-beat counter

  const tileDivs = Array.from(document.querySelectorAll("#board-grid .tile"));

  tileDivs.forEach(tileDiv => {
    const tDef = TILE_TYPES.find(t => t._id === tileDiv.dataset.type);
    const rect = tileDiv.getBoundingClientRect();
    const tileW = rect.width;
    const tileH = rect.height;
    const tileX = rect.left;
    const tileY = rect.top;

    const overlayH    = tileH * OVERLAY_FRAC;
    const noteScreenY = tileY + tileH - overlayH + overlayH * NOTE_Y_FRAC;

    /* Use tile's rhythm or 4 silent quarter notes */
    const rhythm = (tDef && tDef.rhythm) ? tDef.rhythm : [
      { note: "quarter", syl: "", new: true  },
      { note: "quarter", syl: "", new: true  },
      { note: "quarter", syl: "", new: true  },
      { note: "quarter", syl: "", new: true  },
    ];

    const groups = rhythmToGroups(rhythm);

    groups.forEach(g => {
      const noteBeats = BEAT_VALUES[g.note];

      /* xLand = centre of the note group's beat span
         — same calculation as paintNoteCanvas uses for cx */
      const beatX = BEAT_X_FRAC.map(f => tileW * f);
      const xLand = tileX + (beatX[g.startBeat] + beatX[g.endBeat]) / 2;

      /* landMs: this note lands at the beat where it STARTS */
      const landMs = (beatIdx + g.startBeat) * beatMs;

      noteSeq.push({
        xLand,
        yLand:       noteScreenY,
        landMs,
        durationMs:  noteBeats * beatMs,   // arc travel time = note length
        tileDiv,
        noteValue:   g.note,
      });
    });

    beatIdx += 4; // each tile = 4 quarter beats
  });
}

/* ═══════════════════════════════════════════════════════════
   AUDIO — synthesised woodblock click
═══════════════════════════════════════════════════════════ */
function playClick(atAudioTime) {
  if (!soundOn) return;
  try {
    const ctx  = getAudioCtx();
    const when = (atAudioTime != null) ? atAudioTime : ctx.currentTime;

    const bufLen = Math.round(ctx.sampleRate * 0.05);
    const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const src    = ctx.createBufferSource();
    src.buffer   = buf;

    const filter = ctx.createBiquadFilter();
    filter.type  = "bandpass";
    filter.frequency.value = 800;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(0.55, when + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.055);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(when);
    src.stop(when + 0.06);
  } catch (_) {}
}

/* ═══════════════════════════════════════════════════════════
   PLAYBACK
═══════════════════════════════════════════════════════════ */
function togglePlayback() {
  if (playing) stopPlayback(); else startPlaybackDirect();
}



function startPlaybackDirect() {
  tempoSlider.disabled = true;
  /* Set playbackStartTime to now so beat 0 lands immediately */
  playbackStartTime = performance.now();
  startPlayback();
}

function startPlayback() {
  if (state.tiles.length === 0) return;
  buildNoteSequence();
  if (!noteSeq.length) return;

  playing = true;

  iconPlay.style.display = "none";
  iconStop.style.display = "";
  btnPlay.classList.add("playing");

  const ballSize = Math.max(20, Math.min(48, Math.round(currentTileSize * 0.18)));
  bounceBall.style.width  = ballSize + "px";
  bounceBall.style.height = ballSize + "px";
  if (showBall) bounceBall.classList.remove("hidden");

  /* Pre-schedule all note clicks in audio time now,
     so the audio engine handles them with zero jitter */
  const ctx = getAudioCtx();
  noteSeq.forEach(note => {
    /* Wall-clock ms when this note lands → audio time */
    const wallMs    = playbackStartTime + note.landMs;
    const offsetSec = (wallMs - performance.now()) / 1000;
    if (offsetSec >= -0.05) {   // skip if already passed
      playClick(ctx.currentTime + Math.max(0, offsetSec));
    }
  });

  dropInBall();
  scheduleAllNotes();
}

function stopPlayback() {
  playing = false;
  clearTimeout(tickTimer);
  tickTimers.forEach(clearTimeout);
  tickTimers = [];
  cancelAnimationFrame(rafHandle);
  tickTimer = null;
  rafHandle = null;

  iconPlay.style.display = "";
  iconStop.style.display = "none";
  btnPlay.classList.remove("playing");

  bounceBall.classList.add("hidden");
  clearActiveTile();
  tempoSlider.disabled = false;
}

/* ── Drop-in: ball falls from top-left corner to first note ── */
function dropInBall() {
  if (!noteSeq.length) return;
  const first    = noteSeq[0];
  const beatMs   = 60000 / bpm;
  /* Drop takes one beat duration — starts now, lands at playbackStartTime */
  const dropDur  = beatMs;
  const dropStart = playbackStartTime - dropDur;

  /* Start position: top-left of viewport */
  const fromX = 60;
  const fromY = 60;

  /* Arc height for the drop */
  const dx        = Math.abs(first.xLand - fromX);
  const dy        = Math.abs(first.yLand - fromY);
  const arcHeight = Math.max(80, Math.max(dx, dy) * 0.4) * 5;

  if (showBall) bounceBall.classList.remove("hidden");
  animateBallArc(fromX, fromY, first.xLand, first.yLand,
                 arcHeight, dropDur, dropStart);
}

/* ═══════════════════════════════════════════════════════════
   SCHEDULER — all timers scheduled upfront

   All arcs are scheduled at startPlayback() time using
   individual setTimeout handles stored in tickTimers[].
   This avoids the chained-single-timer bug where note[i]'s
   setTimeout overwrites note[i-1]'s handle before it fires.
═══════════════════════════════════════════════════════════ */
let tickTimers = [];  // one handle per note

function scheduleAllNotes() {
  tickTimers.forEach(clearTimeout);
  tickTimers = [];

  noteSeq.forEach((note, i) => {
    /* ── Tile highlight ──────────────────────────────────────
       Fire exactly when the ball LANDS on this note.        */
    const landWall  = playbackStartTime + note.landMs;
    const landDelay = Math.max(0, landWall - performance.now());
    tickTimers.push(setTimeout(() => {
      if (!playing) return;
      setActiveTile(note.tileDiv);
    }, landDelay));

    /* ── Ball arc ────────────────────────────────────────────
       Note 0 arc is handled by dropInBall() — skip here.
       For note i>0: arc starts at end of previous note,
       arrives at note[i].landMs.                            */
    if (i === 0) return;

    /* Arc departs from where the PREVIOUS note landed.
       Never use (landMs - durationMs): for a half note following
       two quarters, that reaches back 2 beats instead of 1. */
    const prev         = noteSeq[i - 1];
    const arcStartWall = playbackStartTime + prev.landMs;
    const arcDuration  = note.landMs - prev.landMs;   // exact gap between landings
    const arcDelay     = Math.max(0, arcStartWall - performance.now() - 8);

    tickTimers.push(setTimeout(() => {
      if (!playing) return;
      const fromX     = prev.xLand;
      const fromY     = prev.yLand;
      const dx        = Math.abs(note.xLand - fromX);
      const arcHeight = Math.max(40, dx * 0.55) * 5;
      animateBallArc(fromX, fromY, note.xLand, note.yLand, arcHeight,
                     arcDuration, arcStartWall);
    }, arcDelay));
  });

  /* ── End-of-sequence ────────────────────────────────────── */
  const lastNote = noteSeq[noteSeq.length - 1];
  const endWall  = playbackStartTime + lastNote.landMs + lastNote.durationMs;
  tickTimer = setTimeout(() => {
    if (autoRepeat && playing) {
      playbackStartTime = performance.now();
      dropInBall();
      startPlayback();
    } else {
      stopPlayback();
    }
  }, Math.max(0, endWall - performance.now()));
}

/* ═══════════════════════════════════════════════════════════
   PARABOLIC ARC via requestAnimationFrame

   The arc is anchored to arcStartWall (wall-clock ms).
   t is derived from performance.now() relative to that
   anchor, so the ball's position is always in sync with
   wall time regardless of when rAF fires.

   t=0 → ball at (fromX, fromY)      ← arc departs
   t=1 → ball at (toX, toY)          ← ball LANDS (on the beat)

   y(t) = lerp(from,to,t) − arcHeight × 4t(1−t)
             parabola peaks at t=0.5 (midpoint of travel)
═══════════════════════════════════════════════════════════ */
function animateBallArc(fromX, fromY, toX, toY, arcHeight, durationMs, arcStartWall) {
  /* Each arc cancels the global rafHandle so only the latest arc
     drives the ball position — avoids two arcs fighting over the
     same element. The previous arc simply stops rendering when its
     rAF callback isn't re-requested. */
  cancelAnimationFrame(rafHandle);

  const ballSize = bounceBall.offsetWidth;
  const halfBall = ballSize / 2;
  let   myRaf    = null;

  function frame() {
    if (!playing) return;

    let t = (performance.now() - arcStartWall) / durationMs;
    t = Math.max(0, Math.min(1, t));

    const x    = fromX + (toX - fromX) * t;
    const y    = fromY + (toY - fromY) * t;
    const lift = arcHeight * 4 * t * (1 - t);

    bounceBall.style.left = (x - halfBall) + "px";
    bounceBall.style.top  = (y - lift - halfBall) + "px";

    if (t < 1) {
      myRaf = requestAnimationFrame(frame);
      rafHandle = myRaf;  // keep global in sync so stopPlayback can cancel it
    }
  }

  myRaf = requestAnimationFrame(frame);
  rafHandle = myRaf;
}

/* ═══════════════════════════════════════════════════════════
   ACTIVE TILE HIGHLIGHTING
═══════════════════════════════════════════════════════════ */
let _activeTileDiv = null;

function setActiveTile(tileDiv) {
  if (_activeTileDiv === tileDiv) return;
  clearActiveTile();
  _activeTileDiv = tileDiv;
  tileDiv.classList.add("rhythm-active");
  document.querySelectorAll("#board-grid .tile").forEach(t => {
    if (t !== tileDiv) t.classList.add("rhythm-dim");
  });
}

function clearActiveTile() {
  document.querySelectorAll("#board-grid .tile").forEach(t =>
    t.classList.remove("rhythm-active", "rhythm-dim"));
  _activeTileDiv = null;
}

/* ═══════════════════════════════════════════════════════════
   SETTINGS — cookie persistence
═══════════════════════════════════════════════════════════ */
function saveSetting(key, val) {
  document.cookie = `${key}=${val ? "1" : "0"};path=/;max-age=31536000`;
}

function readCookie(key) {
  const match = document.cookie.match(new RegExp("(?:^|; )" + key + "=([^;]*)"));
  return match ? match[1] : null;
}

function loadSettings() {
  const r = readCookie("tb_repeat");
  const n = readCookie("tb_notes");
  const sy = readCookie("tb_syls");

  const bl = readCookie("tb_ball");
  const so = readCookie("tb_sound");

  autoRepeat = r  === "1";
  showNotes  = n  === null ? true : n  === "1";
  showSyls   = sy === null ? true : sy === "1";
  showBall   = bl === null ? true : bl === "1";
  soundOn    = so === null ? true : so === "1";

  btnRepeat.classList.toggle("on",    autoRepeat);
  btnShowNotes.classList.toggle("on", showNotes);
  btnShowSyls.classList.toggle("on",  showSyls);
  btnShowBall.classList.toggle("on",  showBall);
  btnSound.classList.toggle("on",     soundOn);
}

/* ═══════════════════════════════════════════════════════════
   TEMPO PERSISTENCE
═══════════════════════════════════════════════════════════ */
function saveBpm() {
  try { localStorage.setItem(STORAGE_BPM, bpm); } catch (_) {}
}

function loadBpm() {
  try {
    const s = localStorage.getItem(STORAGE_BPM);
    if (s) bpm = Math.max(60, Math.min(240, +s));
  } catch (_) {}
  tempoSlider.value        = bpm;
  tempoDisplay.textContent = bpm;
}
