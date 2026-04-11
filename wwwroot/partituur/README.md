# Tile Board App

Fullscreen classroom digiboard tile app.

## Files
- `index.html` — app entry point
- `style.css`  — all styles
- `app.js`     — all logic + configuration

## Setup

1. Open `index.html` in a browser (or serve it with any static server).
2. To add images, put them in an `images/` folder next to `index.html`.

## Adding tile types

Open `app.js` and find the `TILE_TYPES` array near the top:

```js
const TILE_TYPES = [
  { id: "typeA", label: "Type A", color: "#3b5bdb", letter: "A", imageSrc: null },
  { id: "typeB", label: "Type B", color: "#2f9e44", letter: "B", imageSrc: null },
];
```

For each tile you want:
- Set `imageSrc` to the image path, e.g. `"images/apple.png"` — or leave `null` for a coloured placeholder.
- Set `label` and `letter` for the placeholder display.
- Set `color` to any CSS hex colour.

Add as many entries as you like — they all appear in the bottom tray.

## Tweaking layout

All sizing/behaviour is in the `CONFIG` object at the top of `app.js`:

```js
const CONFIG = {
  MIN_TILE_SIZE:    120,   // px — smallest a tile can shrink to
  MAX_TILE_SIZE:    300,   // px — largest a tile can grow to
  TILE_GAP:         12,   // px — space between tiles
  DEFAULT_ROWS:     2,    // rows shown on first load
  TRAY_HEIGHT:      100,  // px — bottom tray height
  BOARD_PADDING:    16,   // px — board edge padding
  UNDO_STEPS:       7,    // max undo history depth
  MODAL_DURATION:   3000, // ms — how long the full-board warning shows
  PLACEHOLDER_TEXT: "Drag tiles here"
};
```
