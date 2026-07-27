# UX Language of Uncertainty — Session #12

A consistent visual grammar so honesty is legible at a glance, without
reading a word. Built directly on the existing palette in `css/main.css`
(not inventing new colors) — reusing `--green`/`--gold`/`--red`/`--violet`/
`--txt-3` and the established glass/border system, so this integrates
without a redesign. Every later panel (honesty panel, threat board,
cross-currents, sonar, alert center, ledger) inherits this system rather
than inventing its own.

---

## The five uncertainty dimensions that need a visual language

1. **Evidence grade** (A/B/C/D — how solid is this claim)
2. **Confirmation state** (confirmed / single-source / hype-flagged)
3. **Freshness** (as-of timestamp — how old is this number)
4. **Calibration/warm-up state** (does this feature have enough history yet)
5. **Contested state** (bull-mass vs bear-mass both present — not net-zero)

Each needs its own visual treatment because they answer different
questions, and conflating them (e.g., using red for both "low evidence
grade" and "bearish") would make the grammar ambiguous exactly where clarity
matters most.

---

## 1. Evidence Grade — a persistent corner-badge, not a color wash

**Values**: A (official/confirmed), B (multi-source corroborated),
C (single-source claim), D (hype-flagged)

**Rule**: Evidence grade is never conveyed by background color (that's
reserved for sentiment — bull/bear — and would collide). It's a small
monospace letter-badge, top-right corner of any card/number, using the
existing `--f-mono` font and a neutral-to-warm scale:

```css
--grade-a: var(--cyan-2);      /* official/confirmed — cool, trustworthy */
--grade-b: var(--txt-2);        /* corroborated — neutral, unremarkable-on-purpose */
--grade-c: var(--gold);         /* single-source — same amber as "caution," deliberately */
--grade-d: var(--red);          /* hype — same red as "risk," deliberately */
```

```html
<span class="grade-badge grade-a">A</span>
```
```css
.grade-badge {
  font-family: var(--f-mono);
  font-size: .68rem;
  font-weight: 700;
  width: 18px; height: 18px;
  border-radius: 5px;
  display: grid; place-items: center;
  border: 1px solid currentColor;
  opacity: .85;
}
.grade-badge.grade-a { color: var(--grade-a); }
.grade-badge.grade-b { color: var(--grade-b); }
.grade-badge.grade-c { color: var(--grade-c); }
.grade-badge.grade-d { color: var(--grade-d); background: rgba(255,107,122,.08); }
```

**Why grade-C reuses gold and grade-D reuses red**: grades aren't a separate
color family from the rest of the app's risk language — a single-source
claim IS a minor caution, hype-flagged content IS a risk signal. Reusing
the existing semantic colors (rather than inventing a 4-color grade-specific
palette) means the user's existing color intuition transfers immediately;
a new grammar that needs to be learned from scratch is a worse grammar.

**Placement rule**: grade badge sits top-right of the smallest addressable
unit that can carry evidence — an individual Intel card, a flow-bar row, a
cluster card. It does NOT appear on aggregates (a sector total isn't "grade
B," it's a composition of grades — see the flow-map treatment below).

---

## 2. Confirmation state — inline chip, not badge

Distinct from evidence grade because it's about **sourcing**, not
**content trustworthiness** — a hype-flagged item can still be
multi-sourced (many low-tier outlets syndicating the same rumor).

```css
.src-chip {
  font-size: .72rem;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--glass-line);
  color: var(--txt-2);
}
.src-chip.confirmed {
  border-color: var(--green);
  color: var(--green);
  background: rgba(61,220,151,.08);
}
.src-chip.confirmed::before { content: '✓ '; }
```
`CONFIRMED` (green check chip, N sources) / unmarked default (single
source, no chip needed — absence of a chip IS the signal, avoiding
"single-source" chip clutter on the majority-case).

The existing `hype-badge` styling (already shipped in Sprint 5,
`app.js:583`) stays as-is — amber/warning `⚠ HYPE` — and is the D-grade's
natural companion chip. Grade badge (top-right corner) and confirmation
chip (inline, near the title) never occupy the same visual position, so
they layer without collision.

---

## 3. Freshness — a relative-time chip that DEGRADES VISUALLY with age

**The core idea**: don't just show "2h ago" — let the chip's own opacity
and color desaturate as data ages, so staleness is felt peripherally before
it's read.

```css
--fresh-live:    var(--green);   /* < 15 min — actively fresh */
--fresh-recent:  var(--txt-2);   /* 15 min – 4h — normal */
--fresh-aging:   var(--gold);    /* 4h – 24h — worth noting */
--fresh-stale:   var(--red);     /* > 24h — flag it */

.asof-chip {
  font-family: var(--f-mono);
  font-size: .68rem;
  opacity: 1;
  transition: opacity var(--t-slow) var(--ease-out);
}
/* opacity itself decays continuously via inline style, not just discrete color bands: */
/* style="opacity: max(0.4, 1 - ageHours/48)" set by JS per-render */
```

**Rule**: every derived number (XIRR, sector conviction, quote-based P&L)
carries an `.asof-chip` showing both the relative time ("3h ago") and the
color/opacity band. This is the literal implementation of the "every
derived number gets an as-of timestamp" rule from the premortem — giving
it one consistent visual form so it's recognizable everywhere instead of
reinvented per panel.

**Special case — quotes vs news**: quote-derived numbers (Sprint 12) use
tighter bands (live/15min/1h/stale) since intraday price relevance decays
fast; news-derived numbers (impact, conviction) use the wider bands above
since a headline's relevance decays over hours, not minutes. Same chip
component, different threshold constants passed in — not two components.

---

## 4. Calibrating / warm-up state — a diagonal-hatch overlay, not a hidden panel

**The trap this avoids**: a feature with insufficient history (sonar
before 21 days, calibration curve before N=15) either gets hidden (user
doesn't know it exists) or shows fake-confident numbers (dishonest). Both
are wrong.

**The rule**: the feature is always visible, but rendered behind a subtle
diagonal-hatch texture with a corner label, using the neutral `--violet`
(distinct from red/gold/green because "not enough data yet" is not a
health judgment — it's a temporal fact, not a warning):

```css
.calibrating {
  position: relative;
  opacity: .55;
}
.calibrating::before {
  content: '';
  position: absolute; inset: 0;
  background: repeating-linear-gradient(
    135deg, transparent 0 8px, rgba(167,139,250,.06) 8px 16px
  );
  pointer-events: none;
  border-radius: inherit;
}
.calibrating::after {
  content: 'CALIBRATING · ' attr(data-progress);
  position: absolute; top: 6px; right: 8px;
  font-family: var(--f-mono); font-size: .64rem;
  color: var(--violet); letter-spacing: .04em;
}
```
```html
<div class="sonar-panel calibrating" data-progress="12/21 DAYS">...</div>
```

The panel underneath still renders its real (partial) numbers — hatched
and dimmed, not blanked — so the user can see it's *becoming* real, which
matters for a tool whose whole thesis is "don't fake confidence."

---

## 5. Contested state — a split-fill bar, never a net-only number

**The trap this avoids** (flagged in round 3 of the earlier thinking):
+50 bull-mass and −50 bear-mass net to a flat, boring-looking zero,
visually indistinguishable from "nobody is talking about this sector" —
but contested is the most informationally rich state on the board, not
the emptiest.

**The rule**: any bull/bear pair is rendered as a **single bar split into
two opposing fills from a center origin**, never collapsed to one net
number first:

```css
.contest-bar {
  position: relative;
  height: 8px;
  border-radius: 999px;
  background: var(--glass);
  overflow: hidden;
}
.contest-bar .bull-fill {
  position: absolute; left: 50%; top: 0; height: 100%;
  background: var(--green);
  transform-origin: left;
}
.contest-bar .bear-fill {
  position: absolute; right: 50%; top: 0; height: 100%;
  background: var(--red);
  transform-origin: right;
}
```
Widths set inline per-render: `bull-fill` width = `bullMass / maxMass * 50%`,
`bear-fill` width = `bearMass / maxMass * 50%`. A genuinely quiet sector
shows a thin, centered sliver on both sides (small but visible); a
genuinely contested sector shows two roughly-equal bars pushing outward
from center — visually distinct from "quiet" at a glance, which a single
net-zero number could never achieve.

**Label rule**: when `min(bullMass, bearMass) > 0.3 * max(bullMass, bearMass)`
(both sides substantial), the sector gets a `CONTESTED` text label in
`--violet` (matching the calibrating state's "this is a distinct condition,
not a health judgment" semantics) — contested isn't bullish or bearish, so
it doesn't borrow green/red.

---

## 6. Precision — typographic discipline, not a new component

**The rule**: displayed decimal precision is capped by input precision,
enforced as a formatting convention rather than a visual widget:
- Percentile-based impact: integer only, never `73.4` (Sprint 5 already
  does this correctly — keep it that way going forward)
- XIRR: one decimal place max (`14.4%`, never `14.37%`) — the day-count
  and price-staleness uncertainty in the inputs doesn't support a second
  decimal
- Flow amounts: two significant figures for anything above ₹1,000cr
  (`₹75,000 cr`, not `₹74,987 cr` — the underlying number is itself a
  rounded press-release figure)
- Conviction scores: integer, already established

This isn't a CSS token, it's a formatting rule that belongs in `U.fmtCr`/
a new `U.fmtPct`/`U.fmtXirr` — flagged here so it's not lost as "just a
detail" when Sprint 7 builds the XIRR display.

---

## Composition example — how all five layer on one Intel card

```
┌─────────────────────────────────────── [A] ← evidence grade badge
│  ✓ CONFIRMED · 3 sources        3h ago │ ← confirmation chip · asof chip
│                                          │
│  Cabinet approves ₹50,000 crore         │
│  infrastructure package                 │
│                                          │
│  ▸ Entities: Infrastructure, Capex      │
└──────────────────────────────────────────┘
```
A hype-flagged, single-source, stale item looks visibly different without
reading anything:
```
┌─────────────────────────────────────── [D] ← red grade badge
│  ⚠ HYPE                          19h ago│ ← warning chip · faded/red asof chip
│  (card at reduced opacity overall)      │
│  This multibagger could be the next...  │
└──────────────────────────────────────────┘
```

---

## What this unblocks

- **Sprint 6**: the honesty panel (Session #7) and threat board render
  their health bands using these exact tokens (green/gold/red already
  match Section-header verdicts in that spec) — no new palette decisions
  needed when building it.
- **Sprint 6's cross-currents**: implements the split-fill contested bar
  directly from section 5 — this was flagged as a requirement in the
  original thinking rounds and now has a concrete, buildable component.
- **Sprint 9's sonar**: uses the calibrating-state hatch pattern from
  section 4 verbatim for its "N/21 days" warm-up.
- **Every sprint from 6 onward**: inherits the grade badge, confirmation
  chip, and asof chip as shared components rather than reinventing
  per-panel styling — the single biggest risk this session prevents is
  five different sprints independently choosing five different ways to
  say "this is stale" or "this is unconfirmed."
