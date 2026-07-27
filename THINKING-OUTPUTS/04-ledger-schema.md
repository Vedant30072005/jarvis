# Ledger Event Schema — Session #4

Append-only event sourcing for Indian retail portfolios. Every transaction is
an immutable event; current state (holdings, cost basis, P&L) is computed by
replaying all events in date order. No edit-in-place. Corrections are new
events that reference the original. XIRR is computed from all cash flows
(buys, sells, dividends) in date order with the test vectors below verifying
edge cases real portfolios hit.

---

## Event Schema (TypeScript)

```typescript
/** Base event shape — every event has these fields */
interface LedgerEvent {
  id: string;                 // uuid or 'YYYY-MM-DD-HH:mm:ss-type-N'
  date: string;               // YYYY-MM-DD only (no intraday sequencing; same-day events sorted by type order below)
  type: EventType;            // enum below
  symbol: string;             // NSE ticker (HDFC, INFY, GOLDBEES, etc) or fund code (AAPL for US stocks)
  quantity: number;           // signed: +100 = buy/receive, -50 = sell/exit
  price: number;              // per unit, in INR (USD prices convert at entry-day rate or user-specified rate)
  currencyCode?: 'INR' | 'USD'; // defaults to INR; USD stocks must specify
  usdRate?: number;           // INR/USD rate used for conversion (only when currencyCode='USD')
  // optional fields by event type (see details below)
  dividendPerShare?: number;  // for dividend events
  splitFrom?: number;         // for split events: 1-for-splitFrom ratio
  bonusRatio?: number;        // for bonus: 1-for-bonusRatio ratio
  buybackPrice?: number;      // for buyback (user-entered, for accounting; not used for nav)
  newSymbol?: string;         // for fund merger: the symbol of the receiving fund
  newUnits?: number;          // for fund merger: units received in the new fund (may differ from quantity sold)
  cashAdjustment?: number;    // for fund merger: any cash paid/received as part of the swap
  refersTo?: string;          // for correction events: the id of the event being corrected
  note?: string;              // optional user memo
}

type EventType = 'buy' | 'sell' | 'sip-start' | 'sip-pause' | 'sip-resume' 
               | 'dividend' | 'split' | 'bonus' | 'buyback-acceptance' 
               | 'delisting' | 'fund-merger' | 'correction' | 'void';

/** A correction event cancels a prior event without deleting it.
    Current state = replay all events, skip any with id = some_correction.refersTo.
    Example: user realized they entered the wrong price; create a correction
    event that references the original, stating the correct price. The original
    stays in the ledger (audit trail) but is ignored in replayed state. */
interface CorrectionEvent extends LedgerEvent {
  type: 'correction';
  refersTo: string;  // required
  // all other fields describe the corrected transaction
}

/** A void event is for "this never happened, erase it from history."
    Different from correction: no replacement data, just a marker.
    Use sparingly (duplicate entries, data-entry errors from years ago). */
interface VoidEvent extends LedgerEvent {
  type: 'void';
  refersTo: string;  // required
  reason?: string;   // "duplicate entry", "fat-finger error", etc.
}
```

---

## Event Types — Detailed Semantics

### 1. **buy** — Purchase (inflow, cost increase)
```
date: "2024-01-15"
type: "buy"
symbol: "HDFC"
quantity: 50          // +50 units
price: 2500           // ₹2500/unit
// total inflow: ₹125,000
```
**XIRR impact**: −₹125,000 cash outflow on 2024-01-15  
**Edge case**: buying the same stock twice on the same day (e.g., two brokers)
is legal and common; both events fire as separate buys, same date, sum their
quantities/costs for the day's net state.

### 2. **sell** — Sale (outflow, cost decrease)
```
date: "2024-06-20"
type: "sell"
symbol: "HDFC"
quantity: -25         // −25 units
price: 2750           // ₹2750/unit
// total outflow: ₹68,750 received
```
**XIRR impact**: +₹68,750 cash inflow on 2024-06-20  
**Edge case**: selling more than currently held (illegal; the replayed state
should error or warn; but the event itself is structurally valid, so the
ledger stores it and the UI enforces validation, not the schema).

### 3. **dividend** — Cash dividend (inflow, no quantity change)
```
date: "2024-03-31"
type: "dividend"
symbol: "INFY"
quantity: 0           // dividends don't change share count
price: 0              // not used; dividendPerShare is the meaningful field
dividendPerShare: 20  // ₹20 per share held
// (replayed state knows current holdings of INFY, multiplies by 20 to compute total inflow)
```
**XIRR impact**: +₹(current holdings × 20) cash inflow on 2024-03-31  
**Edge case**: dividend declared date vs record date vs payment date — the
event date should be the payment date (when cash arrives), matching XIRR
semantics (money actually moved).

### 4. **split** — Stock split (no quantity cost change, share count changes)
```
date: "2024-05-10"
type: "split"
symbol: "RELIANCE"
quantity: 0           // not used for splits; quantity is derived (old × splitFrom)
splitFrom: 5          // 1-for-5 split: each old share becomes 5 new ones
// (replayed state: holdings × 5; cost per share ÷ 5, total cost same)
```
**XIRR impact**: none (no cash flows)  
**Edge case**: user had 100 shares at ₹500/share (cost ₹50,000 total) →
after 1-for-5 split, they have 500 shares at ₹100/share (cost still ₹50,000
total). Subsequent XIRR calculations use the new per-share cost to match
current market prices (which also adjust for the split).

### 5. **bonus** — Bonus shares (no cost, share count increases)
```
date: "2024-04-15"
type: "bonus"
symbol: "TCS"
quantity: 0           // not used; quantity derived as (old × bonusRatio)
bonusRatio: 3         // 1-for-3 bonus: 100 shares → 133 shares
// (replayed state: holdings × (1 + 1/bonusRatio); cost per share adjusted proportionally, total cost same)
```
**XIRR impact**: none  
**Edge case**: a 1-for-1 bonus (doubling) on a holding bought for ₹100,000
now costs ₹50,000 per share (half). The holding's total cost basis stays
₹100,000, but the per-share cost halves so future sells compute cost-per-unit
correctly.

### 6. **dividend** with reinvestment (rare; explicit event)
If the user elected DRIP (dividend reinvestment), it's not a single "dividend"
event — it's a dividend event *plus* an immediate buy event on the same date,
at the dividend reinvestment price. Two events, two lines in the ledger,
computed separately. This is explicit and auditable (the rate at which DRIP
executed is visible).

### 7. **sip-start** / **sip-pause** / **sip-resume** (metadata, not cash flows)
```
date: "2024-01-01"
type: "sip-start"
symbol: "VANGUARD-EMERGING-MARKETS"
quantity: 5000        // ₹5000 monthly SIP amount
price: 0              // not used
// replayed state: marks this symbol as "SIP active, ₹5000/month from this date"
```
**XIRR impact**: none directly (each month's actual SIP debit is a separate
"buy" event). These are calendar/metadata events that let the UI show "you've
been SIPing this for 18 months" without computing it from accumulated buy
events. They're also the anchor for auto-generating monthly buy events if
the user wants a "replay all my SIPs" feature later.

**pause/resume** events let the ledger show gaps (e.g., "paused during
maternity leave, resumed 6 months later") without having to delete/recreate
buy events.

### 8. **buyback-acceptance** — Tendered shares in a buyback (partial exit)
```
date: "2024-07-20"
type: "buyback-acceptance"
symbol: "BHARTIARTL"
quantity: -100        // −100 shares tendered
price: 850            // buyback price per share
// total received: ₹85,000
```
**XIRR impact**: +₹85,000 inflow on 2024-07-20  
**Edge case**: buybacks are usually oversubscribed; the user may have
tendered more shares than accepted. The ledger stores the accepted quantity
(the actual cash event). If they tendered 150 and 100 were accepted, the
ledger shows the "sell" as −100 @ ₹850, not the tendered 150; the rejected
50 stay in holdings.

### 9. **delisting** — Forced exit (compulsory or initiated by company)
```
date: "2024-12-31"
type: "delisting"
symbol: "OLDPSU"
quantity: -200        // −200 shares (all holdings compulsorily exited)
price: 45             // delisting price set by regulator
// total received: ₹9,000
```
**XIRR impact**: +₹9,000 inflow  
**Edge case**: the price may be below market (regulatory decision); the user
can't refuse. The event is the final forced sale. Separately, they might have
received a "delisting event" memo from the exchange months prior (metadata,
not an event in this schema).

### 10. **fund-merger** — Mutual fund merger (units of fund A → units of fund B)
```
date: "2024-08-15"
type: "fund-merger"
symbol: "OLD-FUND",    // the fund being merged away
quantity: -1000,       // −1000 units of OLD-FUND
price: 35,             // NAV at merger (not used for cost, informational)
newSymbol: "NEW-FUND", // the receiving fund
newUnits: 1050,        // 1050 units of NEW-FUND received (ratio may differ from units merged)
cashAdjustment: 500    // ₹500 cash paid to the investor (if any)
// XIRR: if cashAdjustment > 0, it's a +₹500 inflow on the merger date
//       the cost basis of the original 1000 units transfers to the 1050 units of the new fund
```
**XIRR impact**: if `cashAdjustment > 0`, +cashAdjustment inflow; else, no
cash movement (just a swap).  
**Cost basis handling**: cost basis of the exiting fund's units transfers
in full to the new fund's units. If the user had 1000 units @ ₹20/unit cost
(₹20,000 total), and receives 1050 units of the new fund, the new fund's
cost per unit is ₹20,000 / 1050 ≈ ₹19.05.  
**Edge case**: the new fund already existed in the portfolio; the merger
combines holdings. Post-merge, the old fund symbol is no longer relevant
(replayed state can archive it or keep it with 0 holdings).

### 11. **correction** — Correcting a prior entry (e.g., wrong price entered)
```
date: "2024-01-16"  // day after the error
type: "correction"
refersTo: "buy-1234",  // the id of the original buy event
symbol: "HDFC"
quantity: 50
price: 2480          // corrected price (was 2500)
// replayed state: ignore the event with id=buy-1234, use this event's data instead
```
**XIRR impact**: depends on the original event's XIRR contribution; the
replayed state uses the corrected data.  
**Audit trail**: the original event stays in the ledger (immutable), but is
shadowed by this correction. A UI could show both (original with a strikethrough,
correction highlighted) or just the correction. The replay logic skips the
original.

### 12. **void** — Erasing an event entirely (rare; usually for data-entry errors)
```
date: "2024-01-20"
type: "void"
refersTo: "buy-1235"  // the id of the duplicate/erroneous event
reason: "duplicate entry: same transaction logged twice yesterday"
// replayed state: skip this event entirely; the referred event is also skipped
```
**XIRR impact**: none (the void event itself has no cash flow; it just marks
another event as ignored).  
**Use sparingly**: void is for "this never happened." Use correction if the
event happened but with wrong details.

---

## XIRR Test Vectors

Each test vector is a portfolio's complete transaction history, its expected
IRR range (because XIRR can vary slightly with rounding/time-of-day assumptions),
and the edge case it covers. All use realistic Indian amounts and dates.

### Test 1: Simple buy-hold, one year
```
Events:
- 2024-01-15, buy HDFC, 50 units @ ₹2500 = −₹125,000
- 2025-01-15, sell HDFC, 50 units @ ₹2750 = +₹137,500
- 2025-01-15, dividend collected = +₹2,500

Total gain: ₹15,000 on ₹125,000 invested over 1 year
Expected XIRR: ~12–13%
```
**Edge case**: annual holding period; validates basic XIRR formula.

### Test 2: SIP (monthly buy, then lump-sum sell)
```
Events:
- 2024-01-05, buy MF (SIP start), ₹5000 NAV=₹50 → 100 units
- 2024-02-05, buy MF (SIP month 2), ₹5000 NAV=₹51 → 98 units
- 2024-03-05, buy MF (SIP month 3), ₹5000 NAV=₹52 → 96 units
...
- 2025-01-05, sell all 1200 units @ ₹55 = +₹66,000

Total invested: ₹60,000 over 12 months
Total received: ₹66,000 after 1 year
Expected XIRR: ~10–11% (gain is smaller relative to capital because capital was deployed gradually, not all at once)
```
**Edge case**: distributed cash flows over time (SIP); XIRR is lower than a
lump-sum investor's XIRR over the same period because SIP capital arrives
later, so it has less time to grow.

### Test 3: Stock split during holding (Reliance historical split 2020)
```
Events:
- 2020-01-01, buy RELIANCE, 100 units @ ₹1500 = −₹150,000
- 2020-08-21, split 1-for-5 (100 → 500 units, cost/unit now ₹300)
- 2025-01-15, sell RELIANCE, 500 units @ ₹3000 = +₹1,500,000

Total invested: ₹150,000
Total received: ₹1,500,000
Gain: ₹1,350,000 over ~5 years
Expected XIRR: ~52% (a 10x return over 5 years)
```
**Edge case**: split adjustment doesn't change cost basis (still ₹150,000
total), but share count changes. The per-unit cost is halved to match the
split. XIRR uses the actual cash in/out (₹150K in, ₹1.5M out), not per-unit
costs.

### Test 4: Dividend reinvestment (explicit two-event flow)
```
Events:
- 2024-01-15, buy INFY, 100 units @ ₹3000 = −₹300,000
- 2024-06-15, dividend, 100 units @ ₹30/unit = +₹3,000 (cash received)
- 2024-06-15, buy INFY (reinvestment), 1 unit @ ₹3000 = −₹3,000 (same day, DRIP price)
- 2025-01-15, sell 101 units @ ₹3300 = +₹333,300

Total invested: ₹300,000 + ₹3,000 = ₹303,000
Total received: ₹333,300
Gain: ₹30,300 over ~1 year
Expected XIRR: ~10% (dividend harvest + small price appreciation)
```
**Edge case**: same-day dividend + reinvestment; validates that same-day
events sort correctly (dividend first, then the buy, so the dividend cash
is "received" before being reinvested immediately).

### Test 5: Multiple transactions on the same date (collision)
```
Events:
- 2024-01-15 09:30, buy HDFC, 50 @ ₹2500 = −₹125,000
- 2024-01-15 10:45, buy ICICI, 100 @ ₹600 = −₹60,000
- 2024-01-15 14:20, dividend (RELIANCE), ₹5,000

Total outflow on 2024-01-15: ₹185,000 (net, treating dividend as the last inflow)
Expected behavior: all three events are sorted by type order (dividend last),
date is the same, final portfolio shows both holdings + dividend cash.
```
**Edge case**: XIRR computes a single cash flow per date (the sum of all
flows on that date). Validates that same-day collisions aggregate correctly.

### Test 6: Buyback acceptance (partial exit)
```
Events:
- 2023-06-01, buy BHARTIARTL, 1000 @ ₹600 = −₹600,000
- 2024-12-20, tendered 800 units in buyback @ ₹800 = +₹640,000 (only 500 accepted)
  → event type: buyback-acceptance, quantity: −500, price: ₹800
- 2025-01-15, sell remaining 500 units @ ₹900 = +₹450,000

Total invested: ₹600,000
Total received: ₹640,000 (buyback) + ₹450,000 (sale) = ₹1,090,000
Gain: ₹490,000 over ~1.5 years
Expected XIRR: ~43% (high return due to buyback at premium to then-current price)
```
**Edge case**: oversubscribed buyback; only accepted quantity flows through
the ledger.

### Test 7: Fund merger with cash adjustment
```
Events:
- 2023-01-01, buy OLDFUND, 1000 @ ₹50 = −₹50,000 cost basis
- 2024-06-15, fund-merger: OLDFUND → NEWFUND
  quantity: −1000 units of OLDFUND
  newUnits: 1050 units of NEWFUND
  cashAdjustment: ₹1,000 (cash paid to investor)
  → total inflow: ₹1,000 cash
  → cost basis transferred: ₹50,000 for the 1050 new units @ ₹47.62/unit
- 2025-01-15, sell NEWFUND, 1050 @ ₹65 = +₹68,250

Total invested (original + cash adjustment considered as additional invested amount? No — cash adjustment is inflow): ₹50,000 − ₹1,000 = ₹49,000 net invested
Total received: ₹68,250
Gain: ₹19,250 over ~2 years
Expected XIRR: ~20%
```
**Edge case**: merger mechanics; cost basis transfer; cash adjustment inflow.

### Test 8: Delisting at a loss
```
Events:
- 2020-06-01, buy OLDPSU, 5000 @ ₹100 = −₹500,000
- 2025-01-15, delisting, 5000 @ ₹20 = +₹100,000 (regulator-set price, < original)

Total invested: ₹500,000
Total received: ₹100,000
Loss: ₹400,000 over ~4.5 years
Expected XIRR: −18% to −20% (negative return; no way to avoid it)
```
**Edge case**: forced exit; negative IRR; validates that XIRR handles losses correctly.

### Test 9: Correction of an entry
```
Original events:
- 2024-01-15, buy HDFC (id: buy-123), 50 @ ₹2500 = −₹125,000
- 2024-12-20, sell HDFC, 50 @ ₹2750 = +₹137,500

User realizes they entered ₹2500 but it was actually ₹2480. Add correction:
- 2024-01-16, correction (id: corr-001), refersTo: buy-123, 50 @ ₹2480 = −₹124,000

Replayed state: ignores buy-123, uses corr-001 instead.
XIRR recalculated: −₹124,000 in, +₹137,500 out → gain ₹13,500 vs prior ₹12,500
Expected XIRR: same time period but ₹1,000 higher gain
```
**Edge case**: correction updates prior transaction data without destroying history.

### Test 10: Volatility test (sign changes in cash flow)
```
Events:
- 2023-01-01, buy, −₹100,000
- 2023-06-01, sell, +₹80,000 (loss)
- 2023-06-15, buy (re-entry), −₹85,000
- 2024-06-01, sell (final), +₹140,000 (gain)

Total invested: ₹185,000 across two tranches
Total received: ₹220,000 across two sales
Net gain: ₹35,000 over ~1.5 years
Expected XIRR: ~12–15% (lower than if it were a single buy-hold, due to the sale at loss resetting the basis)
```
**Edge case**: multiple sign changes in cash flows. Newton-Raphson (standard
XIRR solver) can fail to converge on some multi-sign-change cash flows; test
that bisection fallback works.

---

## Replay Algorithm (pseudocode for current state)

```
holdings := {}  // symbol → {quantity, costBasis, costPerUnit}
dividends := 0  // total dividend received (cash, not reinvested)

for event in events.sorted_by_date():
  if event.type == 'void':
    skip any event where .id == event.refersTo
    skip this void event itself
    continue
  
  if event.type == 'correction':
    skip any event where .id == event.refersTo
    // treat this correction event as if it were the original event type
    // with the corrected data; proceed to process it normally
  
  if event.type == 'buy':
    holdings[symbol].quantity += event.quantity
    holdings[symbol].costBasis += event.quantity * event.price
    holdings[symbol].costPerUnit = costBasis / quantity
  
  if event.type == 'sell':
    holdings[symbol].quantity += event.quantity  // quantity is negative
    proceeds = -event.quantity * event.price
    // cost of goods sold = -event.quantity * holdings[symbol].costPerUnit
    // realized gain/loss is proceeds - cogs (tracked separately if needed)
  
  if event.type == 'dividend':
    totalDiv = event.dividendPerShare * holdings[symbol].quantity
    dividends += totalDiv
  
  if event.type == 'split':
    holdings[symbol].quantity *= event.splitFrom
    holdings[symbol].costPerUnit /= event.splitFrom
    // costBasis stays the same
  
  if event.type == 'bonus':
    oldQuantity = holdings[symbol].quantity
    holdings[symbol].quantity = oldQuantity * (1 + 1/event.bonusRatio)
    holdings[symbol].costPerUnit = costBasis / quantity
    // costBasis stays the same
  
  if event.type == 'fund-merger':
    holdings[event.symbol].quantity = 0  // old fund holdings exit
    holdings[event.newSymbol].quantity += event.newUnits
    holdings[event.newSymbol].costBasis = holdings[event.symbol].costBasis  // transfer
    if event.cashAdjustment != 0:
      dividends += event.cashAdjustment
  
  // ... similar for buyback-acceptance, delisting, SIP events
```

---

## Storage & Recovery

- **IndexedDB (primary)**: append-only event log, one document per event.
  Query by date range for UI replay.
- **localStorage (backup)**: daily rollup of "holdings as of end-of-day" so
  the UI doesn't have to replay 1000+ events every page load. On load, replay
  events since the last rollup date, then add the rollup's starting holdings.
- **OneDrive export (Sprint 7)**: JSON export of all events, readable by Excel
  or any tool (audit trail, portability).

---

## What This Unblocks

- Sprint 7 builds the ledger UI, import, and XIRR engine directly from this schema.
- Sprint 8's tax module queries holdings as of specific dates (replay as of
  March 31, FY-end).
- Sprint 12's horse-race lane uses this ledger's trades and XIRR to compute
  the counterfactual.
- Sprint 16's restore drill uses an exported event JSON to rebuild the full
  ledger from zero.
