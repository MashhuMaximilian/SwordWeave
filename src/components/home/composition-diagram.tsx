// =============================================================================
// SwordWeave composition diagram — inline SVG taxonomy.
//
// Editorial / engineering-schematic aesthetic. Renders responsively: scales to
// the container width, fills the height in proportion. No external assets.
//
// The diagram shows the actual structural relationships in the engine:
//
//   PRIMITIVES (you BUY with BU)
//     verb tier · domain tier · output · geometry · stat
//                            ↓ compile (FREE)
//   CAPABILITY        EFFECT                 (both are compiled lists)
//     primitives +    primitives (status lives here)
//     effects
//            ↓ slot into
//   HERITAGE                    ITEM
//     (Lineage/Upbringing/       primitives +
//      Manifest) — story slot    capabilities +
//     primitives + capabilities  effects
//
// Status conditions are NOT predefined — the table decides what "Stun",
// "Prone", etc. actually mean in the fiction. The diagram tags this with a
// small note beside the Effect node.
//
// Color palette: ink (foreground) on parchment (background), teal accent for
// primitives, forge orange for compiled lists, muted slate for composition
// slots. Border-radius 0 — these are printed plates, not cards.
// =============================================================================

export function CompositionDiagram() {
  return (
    <div className="sw-diagram relative border border-border bg-background p-4 sm:p-6 lg:p-8">
      {/* Tiny corner ticks — printer crop marks */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-[-1px] top-[-1px] h-3 w-3 border-l border-t border-primary"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-[-1px] right-[-1px] h-3 w-3 border-b border-r border-primary"
      />

      <svg
        viewBox="0 0 880 460"
        role="img"
        aria-label="SwordWeave composition diagram. Primitives are the only thing you buy with Build Units. Capabilities and Effects are compiled lists of primitives, free to make. Heritages and Items are composition slots that reference primitives and capabilities."
        className="block h-auto w-full"
      >
        <defs>
          {/* Arrow markers */}
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
          <marker
            id="arrow-soft"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" opacity="0.55" />
          </marker>
        </defs>

        {/* ===== ROW 1 — PRIMITIVES (the things you BUY) ======================= */}
        <g>
          {/* Container band */}
          <rect
            x="20"
            y="20"
            width="840"
            height="100"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.25"
            strokeDasharray="3 4"
          />
          <text
            x="32"
            y="44"
            className="fill-foreground"
            fontFamily="var(--font-sword-display), sans-serif"
            fontSize="11"
            fontWeight="700"
            letterSpacing="2"
          >
            §01 · PRIMITIVES
          </text>
          <text
            x="848"
            y="44"
            textAnchor="end"
            className="fill-primary"
            fontFamily="var(--font-sword-display), sans-serif"
            fontSize="10"
            letterSpacing="2"
          >
            YOU BUY · BU ONLY
          </text>

          {/* The 5 primitive families.
              Tier labels match the codex seed vocabulary: each primitive carries
              a costTier label (e.g. "Tier 1: Minor", "Tier 2: Standard") and an
              individual buCost. The ranges below are illustrative anchors, not
              hard caps — buy any tier at any level as long as you have the BU. */}
          {[
            { x: 36, label: "VERB", sub: "tier · varies", note: "action shape" },
            { x: 200, label: "DOMAIN", sub: "tier · varies", note: "the medium" },
            { x: 364, label: "OUTPUT", sub: "damage · status", note: "what lands" },
            { x: 528, label: "GEOMETRY", sub: "range · targeting", note: "how far, how wide" },
            { x: 692, label: "STAT", sub: "attribute · skill", note: "your baseline" },
          ].map((p, i) => (
            <g key={p.label} transform={`translate(${p.x}, 60)`}>
              <rect
                width="152"
                height="50"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.55"
                strokeWidth="1"
              />
              <text
                x="8"
                y="18"
                className="fill-foreground"
                fontFamily="var(--font-sword-display), sans-serif"
                fontSize="11"
                fontWeight="700"
                letterSpacing="1.4"
              >
                {p.label}
              </text>
              <text
                x="8"
                y="34"
                className="fill-primary"
                fontFamily="var(--font-sword-body), sans-serif"
                fontSize="9"
                letterSpacing="0.8"
              >
                {p.sub}
              </text>
              <text
                x="8"
                y="46"
                className="fill-muted-foreground"
                fontFamily="var(--font-sword-body), sans-serif"
                fontSize="9"
                fontStyle="italic"
              >
                {p.note}
              </text>
              {/* Right-side index mark */}
              <text
                x="146"
                y="14"
                textAnchor="end"
                className="fill-muted-foreground"
                fontFamily="var(--font-sword-display), sans-serif"
                fontSize="9"
                opacity="0.6"
              >
                {String(i + 1).padStart(2, "0")}
              </text>
            </g>
          ))}
        </g>

        {/* Compile-arrow band (PRIMITIVES → COMPILED LISTS) */}
        <g className="text-primary">
          <line
            x1="440"
            y1="128"
            x2="440"
            y2="170"
            stroke="currentColor"
            strokeWidth="1.4"
            markerEnd="url(#arrow)"
          />
          <text
            x="448"
            y="155"
            className="fill-primary"
            fontFamily="var(--font-sword-display), sans-serif"
            fontSize="10"
            letterSpacing="2"
          >
            COMPILE · FREE · AT RUNTIME OR PRESET
          </text>
        </g>

        {/* ===== ROW 2 — COMPILED LISTS (Capability + Effect) ================== */}
        <g>
          {/* Capability — bigger because it slots effects in */}
          <g transform="translate(60, 180)">
            <rect
              width="380"
              height="120"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.55"
              strokeWidth="1.2"
            />
            <text
              x="14"
              y="22"
              className="fill-foreground"
              fontFamily="var(--font-sword-display), sans-serif"
              fontSize="13"
              fontWeight="700"
              letterSpacing="2"
            >
              CAPABILITY
            </text>
            <text
              x="14"
              y="38"
              className="fill-muted-foreground"
              fontFamily="var(--font-sword-body), sans-serif"
              fontSize="10"
              fontStyle="italic"
            >
              an action card. verb · your domains · your outputs · your geometry
            </text>
            {/* Slot contents */}
            {[
              { y: 56, label: "verb (from verb tier)" },
              { y: 74, label: "domains you own (free-use, not slot-bound)" },
              { y: 92, label: "output · geometry (your owned primitives)" },
              { y: 110, label: "effects (see right) · status (table-defined)" },
            ].map((s) => (
              <g key={s.label} transform={`translate(14, ${s.y})`}>
                <rect width="6" height="6" fill="currentColor" opacity="0.6" />
                <text
                  x="14"
                  y="6"
                  className="fill-foreground"
                  fontFamily="var(--font-sword-body), sans-serif"
                  fontSize="10"
                >
                  {s.label}
                </text>
              </g>
            ))}
          </g>

          {/* Effect — smaller, narrower, with the status-condition aside */}
          <g transform="translate(480, 180)">
            <rect
              width="340"
              height="120"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.55"
              strokeWidth="1.2"
            />
            <text
              x="14"
              y="22"
              className="fill-foreground"
              fontFamily="var(--font-sword-display), sans-serif"
              fontSize="13"
              fontWeight="700"
              letterSpacing="2"
            >
              EFFECT
            </text>
            <text
              x="14"
              y="38"
              className="fill-muted-foreground"
              fontFamily="var(--font-sword-body), sans-serif"
              fontSize="10"
              fontStyle="italic"
            >
              a maintained state. primitives + duration
            </text>
            {[
              { y: 56, label: "primitives you own" },
              { y: 74, label: "duration (instant · short · persistent …)" },
              { y: 92, label: "upkeep cost. pay each turn to keep it" },
            ].map((s) => (
              <g key={s.label} transform={`translate(14, ${s.y})`}>
                <rect width="6" height="6" fill="currentColor" opacity="0.6" />
                <text
                  x="14"
                  y="6"
                  className="fill-foreground"
                  fontFamily="var(--font-sword-body), sans-serif"
                  fontSize="10"
                >
                  {s.label}
                </text>
              </g>
            ))}
            {/* Status aside — pulled out as a footnote */}
            <g transform="translate(14, 108)">
              <text
                className="fill-primary"
                fontFamily="var(--font-sword-display), sans-serif"
                fontSize="9"
                letterSpacing="1.4"
              >
                NOTE ·
              </text>
              <text
                x="40"
                className="fill-muted-foreground"
                fontFamily="var(--font-sword-body), sans-serif"
                fontSize="9"
                fontStyle="italic"
              >
                Stun / Prone / Blind · the table defines what they do.
              </text>
            </g>
          </g>

          {/* Arrow from Capability → Effect (effect slots into capability) */}
          <g className="text-primary">
            <line
              x1="440"
              y1="240"
              x2="480"
              y2="240"
              stroke="currentColor"
              strokeWidth="1.2"
              markerEnd="url(#arrow)"
            />
            <text
              x="446"
              y="234"
              className="fill-primary"
              fontFamily="var(--font-sword-display), sans-serif"
              fontSize="8"
              letterSpacing="1.2"
            >
              slots
            </text>
          </g>
        </g>

        {/* Slot-arrow band (COMPILED LISTS → COMPOSITION SLOTS) */}
        <g className="text-muted-foreground">
          <line
            x1="250"
            y1="304"
            x2="160"
            y2="348"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeDasharray="2 3"
            markerEnd="url(#arrow-soft)"
          />
          <line
            x1="630"
            y1="304"
            x2="720"
            y2="348"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeDasharray="2 3"
            markerEnd="url(#arrow-soft)"
          />
        </g>

        {/* ===== ROW 3 — COMPOSITION SLOTS (Heritage + Item) =================== */}
        <g>
          {/* Heritage */}
          <g transform="translate(40, 358)">
            <rect
              width="380"
              height="90"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.55"
              strokeWidth="1"
            />
            <text
              x="14"
              y="22"
              className="fill-foreground"
              fontFamily="var(--font-sword-display), sans-serif"
              fontSize="13"
              fontWeight="700"
              letterSpacing="2"
            >
              HERITAGE
            </text>
            <text
              x="14"
              y="38"
              className="fill-muted-foreground"
              fontFamily="var(--font-sword-body), sans-serif"
              fontSize="10"
              fontStyle="italic"
            >
              where you came from. a story slot for primitives + capabilities
            </text>
            {/* Lineage / Upbringing / Manifest as three inline tags */}
            {[
              { x: 14, label: "Lineage" },
              { x: 110, label: "Upbringing" },
              { x: 226, label: "Manifest" },
            ].map((t) => (
              <g key={t.label} transform={`translate(${t.x}, 50)`}>
                <rect
                  width="90"
                  height="22"
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.55"
                />
                <text
                  x="45"
                  y="15"
                  textAnchor="middle"
                  className="fill-foreground"
                  fontFamily="var(--font-sword-display), sans-serif"
                  fontSize="10"
                  letterSpacing="1.4"
                  fontWeight="700"
                >
                  {t.label.toUpperCase()}
                </text>
              </g>
            ))}
            <text
              x="14"
              y="84"
              className="fill-primary"
              fontFamily="var(--font-sword-body), sans-serif"
              fontSize="9"
              fontStyle="italic"
            >
              three flavors. same structure. pick the story that fits.
            </text>
          </g>

          {/* Item */}
          <g transform="translate(460, 358)">
            <rect
              width="380"
              height="90"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.55"
              strokeWidth="1"
            />
            <text
              x="14"
              y="22"
              className="fill-foreground"
              fontFamily="var(--font-sword-display), sans-serif"
              fontSize="13"
              fontWeight="700"
              letterSpacing="2"
            >
              ITEM
            </text>
            <text
              x="14"
              y="38"
              className="fill-muted-foreground"
              fontFamily="var(--font-sword-body), sans-serif"
              fontSize="10"
              fontStyle="italic"
            >
              a capability carrier. slots primitives, capabilities, and effects
            </text>
            <text
              x="14"
              y="58"
              className="fill-foreground"
              fontFamily="var(--font-sword-body), sans-serif"
              fontSize="10"
            >
              the only thing here with a real BU cost. the slots inside are
              free.
            </text>
            <text
              x="14"
              y="78"
              className="fill-primary"
              fontFamily="var(--font-sword-body), sans-serif"
              fontSize="9"
              fontStyle="italic"
            >
              a burning blade, an attuned ring, a cloak that mistforms you.
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}
