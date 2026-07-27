/* ============================================================
   J.A.R.V.I.S — ambient type declarations (ORD-1302)
   No imports/exports on purpose: this makes the file a GLOBAL
   ambient script for the TS language service, so every plain
   <script>-loaded js file can reference these names directly in
   JSDoc (e.g. `@param {NewsItem} item`) with no import syntax.
   Keep in sync with Part III §3 of the UPGRADE-ORDERS data
   contracts as new fields are added sprint by sprint.
   ============================================================ */

/** One analyzed news signal (post-Engine.analyzeItem). */
interface NewsItem {
  id: string;
  cat: 'gov' | 'global' | 'markets' | 'corporate';
  s: string;   // source name
  h: number;   // hours ago
  t: string;   // title
  b?: string;  // body/summary
  url?: string | null;
  live?: boolean;
  entities: Array<{ tag: string; sector: string | null }>;
  sectors: string[];
  senti: 'bull' | 'bear' | 'neut';
  impact: number;       // ORD-903: corpus PERCENTILE, 1-99 (publicly displayed)
  impactBase: number;   // pre-corroboration-bonus raw score (0-99-ish)
  impactRaw: number;    // impactBase + confirmation bonus, pre-percentile (archive/internal use)
  amountCr: number;     // 0 if no amount parsed (always a positive magnitude)
  flow: FlowSeed | null;
  hype: boolean;        // ORD-1701(a-d): manufacture-shaped profile
  hypeScore: number;    // 0-100, see JDATA.hypeScore
  qMark: boolean;       // ORD-302/A4: headline ends "?" (verb weight halved)
  gid: string | null;   // ORD-301: corroboration group id
  confirmed: boolean;   // ORD-301: group has 2+ distinct sources
  groupSize?: number;
  groupSources?: string[];
}

/** Raw feed item shape before analysis (JDATA.FEED entries, Live.mkItem output). */
interface RawNewsItem {
  id?: string;
  cat: 'gov' | 'global' | 'markets' | 'corporate';
  s: string;
  h: number;
  t: string;
  b?: string;
  url?: string | null;
  live?: boolean;
}

/** The provisional flow attached to a NewsItem before aggregation. */
interface FlowSeed {
  from: 'gov' | 'foreign' | 'institution' | 'corporate';
  to: string; // sector key
  amountCr: number;
}

/** An aggregated row in Engine.flows — one per corroboration Group (ORD-901),
 *  not per raw item. amountCr is SIGNED: negative means a net outflow for
 *  that sector (ORD-302 direction). */
interface FlowRecord {
  id: string;
  from: 'gov' | 'foreign' | 'institution' | 'corporate';
  to: string;
  amountCr: number;      // signed: negative = outflow
  title: string;
  h: number;
  senti: 'bull' | 'bear' | 'neut';
  sources: string[];
  dedupedFrom: number;   // member count of the source group
}

/** ORD-301/901: a corroboration group — near-duplicate items merged by
 *  title-shingle Jaccard similarity or same-sector/company/amount match. */
interface SignalGroup {
  gid: string;
  memberIds: string[];
  canonicalId: string;
  sources: string[];
  confirmed: boolean;    // 2+ distinct sources
  amountCr: number;      // MAX across members (ORD-901 amendment — never SUM)
  sector: string | null;
  flow: FlowSeed | null;
  senti: 'bull' | 'bear' | 'neut';
  title: string;
  h: number;
}

/** A detected cross-source pattern. */
interface Cluster {
  sector: string;
  label: string;
  name: string;
  items: NewsItem[];
  momentum: number;
  flowsCr: number;
  bull: number;
  bear: number;
  neut: number;
  sources: number;
  topTag?: string;
  narrative: string;
  score: number; // 0-100, normalized against the corpus max
}

/** A drafted research idea. */
interface Idea {
  kind: 'long' | 'caution';
  sector: string;
  label: string;
  title: string;
  conviction: number;      // 0-100 — v1 or v2 depending on Engine.FLAGS.convictionV2
  convictionV1: number;    // M5/C6: kept alongside v2 for one sprint of comparison
  convictionV2: number;
  convComponents: { clusterScore: number; sourcesTerm: number; flowsTerm: number; sentiTerm: number };
  horizon: string;
  thesis: string;
  catalysts: string[];
  risks: string[];
  watch: string[];
  clusterName: string;
}

/** One portfolio holding (v1 snapshot shape; superseded by the Sprint-7 transaction ledger). */
interface Holding {
  id: string;
  name: string;
  type: 'Equity' | 'MF' | 'Gold' | 'Crypto' | 'Cash' | string;
  qty: number;
  buy: number;
  cur: number;
}

interface PortfolioState {
  holdings: Holding[];
  budget: { income: number; expense: number };
  watchlist: string[];
}

/** App-level persisted settings (jarvis.settings.v1). */
interface AppSettings {
  voiceOn: boolean;
  fxOff: boolean;
  bootAlways: boolean;
  usdInr: number;
}

/** One chat-log entry as persisted to jarvis.chat.v1. */
interface ChatHistoryEntry {
  role: 'user' | 'jarvis';
  html: string;
  t: number;
}

/** Shape returned by Engine.stats(). */
interface EngineStats {
  signals: number;
  patterns: number;
  trackedCr: number;
  bullPct: number;
  alerts: number;
  topSector: { sector: string; label: string; total: number; count: number } | null;
}

/* lib.dom.d.ts doesn't ship the (still-prefixed, non-standard) Web Speech
   constructors — declare them loosely so jarvis.js's feature-detect
   (`window.SpeechRecognition || window.webkitSpeechRecognition`) type-checks. */
interface Window {
  SpeechRecognition?: { new(): any };
  webkitSpeechRecognition?: { new(): any };
}

/* relay.js runs under plain Node, not the browser, and this project
   deliberately has no @types/node (would mean a package.json + node_modules
   for one small script) — loosely declare just the three Node globals it
   actually uses so `// @ts-check` stops flagging them as unknown, without
   pretending to model Node's full API surface. */
declare const require: (id: string) => any;
declare const process: { env: Record<string, string | undefined> };
declare const Buffer: { from(input: any, encoding?: string): { toString(encoding?: string): string } };
// Shorthand ambient module: tells TS "this exists, treat require('http') as any"
// instead of trying (and failing, with no @types/node) to resolve it as a real module.
declare module 'http';
