/* ─────────────────────────────────────────────
   tilelist.js — Tile definitions
   Safe to edit. Never overwritten by updates.

   Fields:
     lbl      display name
     img      image path relative to index.html
     rhythm   4 beat objects — must sum to 4
                note  "quarter"(1) | "half"(2) | "whole"(4)
                syl   syllable text under note symbol
                new   true = new note starts here
   ───────────────────────────────────────────── */

const TILE_TYPES = [

  {
    lbl: "Kakkerlak",
    img: "images/kakkerlak.jpg",
    // kak - ker - lak  →  ♩ ♩ 𝅗𝅥
    rhythm: [
      { note: "quarter", syl: "kak", new: true  },
      { note: "quarter", syl: "ker", new: true  },
      { note: "half",    syl: "lak", new: true  },
      { note: "half",    syl: "lak", new: false },
    ],
  },

  {
    lbl: "Kever",
    img: "images/kever.jpg",
    // ke - ver  →  𝅗𝅥 𝅗𝅥
    rhythm: [
      { note: "half", syl: "ke",  new: true  },
      { note: "half", syl: "ke",  new: false },
      { note: "half", syl: "ver", new: true  },
      { note: "half", syl: "ver", new: false },
    ],
  },

  {
    lbl: "Krekel",
    img: "images/krekel.jpg",
    // kre - kel  →  𝅗𝅥 𝅗𝅥
    rhythm: [
      { note: "half", syl: "kre", new: true  },
      { note: "half", syl: "kre", new: false },
      { note: "half", syl: "kel", new: true  },
      { note: "half", syl: "kel", new: false },
    ],
  },

  {
    lbl: "Mestkever",
    img: "images/mestkever.jpg",
    // mest - ke - ver  →  ♩ ♩ 𝅗𝅥
    rhythm: [
      { note: "half", 			syl: "mest", new: true  },
      { note: "half", 			syl: "mest",   new: false  },
      { note: "quarter",    syl: "ke",  new: true  },
      { note: "quarter",    syl: "ver",  new: true },
    ],
  },

  {
    lbl: "Mier",
    img: "images/mier.jpg",
    // mier  →  𝅝
    rhythm: [
      { note: "whole", syl: "mier", new: true  },
      { note: "whole", syl: "mier", new: false },
      { note: "whole", syl: "mier", new: false },
      { note: "whole", syl: "mier", new: false },
    ],
  },

  {
    lbl: "Regenworm",
    img: "images/regenworm.jpg",
    // re - gen - worm  →  ♩ ♩ 𝅗𝅥
    rhythm: [
      { note: "quarter", syl: "re",   new: true  },
      { note: "quarter", syl: "gen",  new: true  },
      { note: "half",    syl: "worm", new: true  },
      { note: "half",    syl: "worm", new: false },
    ],
  },

  {
    lbl: "Rode mier",
    img: "images/rode_mier.jpg",
    // ro - de - mier  →  ♩ ♩ 𝅗𝅥
    rhythm: [
      { note: "quarter", syl: "ro",   new: true  },
      { note: "quarter", syl: "de",   new: true  },
      { note: "half",    syl: "mier", new: true  },
      { note: "half",    syl: "mier", new: false },
    ],
  },
 
  {
    lbl: "Sprinkhaan",
    img: "images/sprinkhaan.jpg",
    // sprink - haan  →  𝅗𝅥 𝅗𝅥
    rhythm: [
      { note: "half", syl: "sprink", new: true  },
      { note: "half", syl: "sprink", new: false },
      { note: "half", syl: "haan",   new: true  },
      { note: "half", syl: "haan",   new: false },
    ],
  },
  {
    lbl: "Syncope",
    img: "images/vraagteken.jpg",

    rhythm: [
      { note: "quarter", syl: "syn", 	new: true  },
      { note: "half",  syl: "co", 	new: true },
      { note: "half",  syl: "co",   new: false  },
      { note: "quarter", syl: "pe",   new: true },
    ],
  },

];
