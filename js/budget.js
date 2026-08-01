// @ts-check
/* ============================================================
   J.A.R.V.I.S — Union Budget reference

   WHY THIS IS STATIC, AND WHY THAT IS HONEST
   ------------------------------------------
   Everything else in this app refuses to show a number it cannot
   attribute. This module is the one place holding figures that are not
   fetched — and it is legitimate for a specific reason: the Union Budget
   is an annual published document, not a stream. It changes once a year,
   on the day it is presented. There is nothing to poll.

   What would NOT be legitimate is letting these read as live. So every
   figure below carries its fiscal year, the date it was presented, and
   the source it came from, and the UI states all three. If the numbers
   are old, the screen says exactly how old rather than implying currency.

   VERIFY THESE. They were entered by hand from the published Budget at a
   Glance / Expenditure Profile. Budget documents are PDFs, so there is no
   feed to reconcile against automatically — which means transcription
   error is a real risk that no amount of code review removes. Treat this
   as a reference card to be checked against indiabudget.gov.in, not as an
   authority. `verifyUrl` is rendered as a link for exactly that purpose.

   TO UPDATE (once a year, after 1 Feb):
     1. Open indiabudget.gov.in → Budget at a Glance
     2. Replace FY, presentedOn, and the three tables below
     3. Bump `enteredOn` so the staleness notice resets
   ============================================================ */

const Budget = {
  /** The edition these figures describe. */
  FY: '2025-26',
  /** Date the budget was presented to Parliament (ISO). */
  presentedOn: '2025-02-01',
  /** When a human last transcribed these numbers — drives the "how old
   *  is this card" notice. Distinct from presentedOn: a budget presented
   *  in Feb might not be entered here until months later. */
  enteredOn: '2025-02-01',
  source: 'Union Budget 2025-26, Budget at a Glance (Ministry of Finance)',
  verifyUrl: 'https://www.indiabudget.gov.in/',

  /** Headline aggregates, ₹ crore. */
  totals: {
    expenditure: 5065345,      // ₹50.65 lakh crore
    receiptsExBorrowing: 3496000,
    capex: 1121090,            // ₹11.21 lakh crore
    fiscalDeficitPctGdp: 4.4
  },

  /** WHERE THE RUPEE COMES FROM — % of every ₹1 received.
   *  Percentages are the Budget's own presentation, not derived here. */
  sources: [
    { label: 'Borrowings & other liabilities', pct: 24, kind: 'debt' },
    { label: 'Income tax',                     pct: 22, kind: 'tax' },
    { label: 'GST & other taxes',              pct: 18, kind: 'tax' },
    { label: 'Corporation tax',                pct: 17, kind: 'tax' },
    { label: 'Non-tax receipts',               pct: 9,  kind: 'other' },
    { label: 'Union excise duties',            pct: 5,  kind: 'tax' },
    { label: 'Customs',                        pct: 4,  kind: 'tax' },
    { label: 'Non-debt capital receipts',      pct: 1,  kind: 'other' }
  ],

  /** WHERE THE RUPEE GOES — % of every ₹1 spent. */
  destinations: [
    { label: "States' share of taxes & duties", pct: 22, kind: 'transfer' },
    { label: 'Interest payments',               pct: 20, kind: 'debt' },
    { label: 'Central sector schemes',          pct: 16, kind: 'scheme' },
    { label: 'Centrally sponsored schemes',     pct: 8,  kind: 'scheme' },
    { label: 'Finance Commission transfers',    pct: 8,  kind: 'transfer' },
    { label: 'Defence',                         pct: 8,  kind: 'defence' },
    { label: 'Subsidies',                       pct: 6,  kind: 'subsidy' },
    { label: 'Pensions',                        pct: 4,  kind: 'pension' },
    { label: 'Other expenditure',               pct: 8,  kind: 'other' }
  ],

  /** Selected ministry/head allocations, ₹ crore — the "where is it
   *  actually going" detail behind the percentages above. */
  allocations: [
    { label: 'Defence',                  cr: 681210 },
    { label: 'Road Transport & Highways', cr: 287333 },
    { label: 'Railways',                 cr: 265200 },
    { label: 'Home Affairs',             cr: 233211 },
    { label: 'Food subsidy',             cr: 203420 },
    { label: 'Rural Development',        cr: 190406 },
    { label: 'Fertiliser subsidy',       cr: 167887 },
    { label: 'Agriculture & Farmers',    cr: 137757 },
    { label: 'Education',                cr: 128650 },
    { label: 'Health',                   cr: 98311 }
  ],

  /** Days since a human last verified these figures. */
  ageDays(now = Date.now()){
    return Math.max(0, Math.floor((now - new Date(this.enteredOn).getTime()) / 86400000));
  },

  /** A budget older than one cycle is very likely superseded — say so
   *  rather than presenting last year's allocations as current. ~400 days
   *  gives a Feb-to-Feb cycle plus slack before it starts nagging. */
  isLikelySuperseded(now = Date.now()){ return this.ageDays(now) > 400; },

  /** One honest line describing what the reader is looking at. */
  provenanceLine(now = Date.now()){
    const age = this.ageDays(now);
    const stale = this.isLikelySuperseded(now)
      ? ' ⚠ A newer Budget has almost certainly been presented since — verify before relying on these.'
      : '';
    return `Union Budget FY${this.FY} · presented ${new Date(this.presentedOn).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })} · ` +
           `static reference, entered by hand ${age} day${age === 1 ? '' : 's'} ago · not live.${stale}`;
  },

  /** Percentages must total 100 — a transcription slip that drops or
   *  duplicates a line shows up here rather than as a silently wrong
   *  river. Returns the actual sums so a failure is diagnosable.
   *  @returns {{sourcesPct:number, destinationsPct:number, ok:boolean}} */
  checksum(){
    const s = this.sources.reduce((a, x) => a + x.pct, 0);
    const d = this.destinations.reduce((a, x) => a + x.pct, 0);
    return { sourcesPct: s, destinationsPct: d, ok: s === 100 && d === 100 };
  },

  /** ₹ crore that a given percentage of total expenditure represents.
   *  @param {number} pct */
  crFromPct(pct){ return Math.round(this.totals.expenditure * pct / 100); }
};
