// =============================================================================
// game-icons-known-authors — allowlist of game-icons.net authors we ship.
//
// Phase 8 icon system. The user uploaded a 4180-icon pack from
// game-icons.net. The license requires per-icon attribution and only
// these specific authors contributed icons to that pack. We use this
// set as defense-in-depth in /api/icons/game/[author]/[slug]: any
// request for an author outside this set returns 404 so the edge cache
// can't fill with junk URLs.
//
// Source: license.txt in the user-provided zip + the actual directory
// listing under icons/ffffff/transparent/1x1/. Regenerate with
//   node -e "console.log(JSON.stringify([...require('./game-icons-index.json').authors].sort()))"
// and paste the result into the array below.
//
// Total authors: 36.
// =============================================================================

export const KNOWN_AUTHORS: ReadonlySet<string> = new Set([
  "andymeneely",
  "aussiesim",
  "carl-olsen",
  "caro-asercion",
  "cathelineau",
  "catsu",
  "darkzaitzev",
  "delapouite",
  "faithtoken",
  "felbrigg",
  "generalace135",
  "guard13007",
  "heavenly-dog",
  "irongamer",
  "john-colburn",
  "john-redman",
  "kier-heyl",
  "lorc",
  "lord-berandas",
  "lucasms",
  "pepijn-poolman",
  "pierre-leducq",
  "priorblue",
  "quoting",
  "rihlsul",
  "sbed",
  "seregacthtuf",
  "skoll",
  "sparker",
  "spencerdub",
  "starseeker",
  "various-artists",
  "viscious-speed",
  "willdabeast",
  "zajkonur",
  "zeromancer",
]);