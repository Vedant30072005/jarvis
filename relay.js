#!/usr/bin/env node
// @ts-check
/* ============================================================
   J.A.R.V.I.S — local relay server
   ORD-201 (+ ORD-1509 hardening merged in, + ORD-1304 polish)

   A zero-dependency Node proxy that runs ONLY on this machine, so the
   frontend gets reliable RSS/quote fetches without depending on flaky
   public CORS relays. It is NOT a general-purpose proxy:

     - binds 127.0.0.1 ONLY — never reachable from the LAN/wifi
     - fetches ONLY exact-hostname-whitelisted upstream hosts
     - GET only, 8s upstream timeout, 2MB response cap
     - never forwards upstream response headers (so no stray
       Set-Cookie, no cache-poisoning headers) — every response header
       sent to the browser is one this file constructs itself
     - logs to stdout only, never to disk

   Run:  node jarvis/relay.js
   Then FETCH LIVE / SYNC PRICES in the app will prefer this over the
   public proxy fallbacks automatically (see js/live.js).
   ============================================================ */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.JARVIS_RELAY_PORT) || 5510;
const HOST = '127.0.0.1'; // ORD-1509: never 0.0.0.0 — this must not be reachable from the LAN

/* ---------------- durability: token-gated disk store (Threat Model Boundary 2b) ----------------
   The relay may now WRITE — a deliberate, bounded relaxation of the
   original GET-only rule, ONLY for the /store endpoints below, so
   irreplaceable personal data (ledger, journal, predictions, goals,
   Sunday-review commitments, taught phrases, portfolio) survives a
   browser-profile wipe by mirroring to disk.

   The threat this defends against is "another browser tab / local
   process blindly POSTing garbage to the ledger" — NOT a remote
   attacker (the 127.0.0.1 bind already excludes those). Two layers:
     1. A per-startup random token, required on every write via the
        X-Jarvis-Token header. A tab that can't read the token can't
        write.
     2. The token is served (GET /token) only to exact-localhost
        origins via the existing CORS reflection, so a page at
        evil.com can't read it cross-origin. The residual — an
        attacker already running a server on a localhost origin —
        already has filesystem access, so the token isn't the weak
        link there. This limit is documented, not hidden. */
const WRITE_TOKEN = crypto.randomBytes(24).toString('hex');
const DATA_DIR = path.join(__dirname, 'data');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch(e){ /* already exists — fine */ }

/* Only these exact keys may be persisted — the regex alone forbids any
   path-traversal shape (no slashes, no "..", version-suffixed), and the
   allowlist keeps it to real jarvis data classes. */
const DURABLE_KEYS = new Set([
  'jarvis.ledger.v1', 'jarvis.journal.v1', 'jarvis.predictions.v1',
  'jarvis.goals.v1', 'jarvis.sundayreview.v1', 'jarvis.taught.v1',
  'jarvis.portfolio.v1'
]);
const KEY_RX = /^jarvis\.[a-z]+\.v\d+$/;
function validKey(k){ return typeof k === 'string' && KEY_RX.test(k) && DURABLE_KEYS.has(k); }
function keyPath(k){ return path.join(DATA_DIR, k + '.json'); }

/* Exact-hostname whitelist for outbound fetches. Exact match only — no
   substring/suffix checks (those are how "evil-host.com.attacker.io"
   bypasses a careless filter). Amfi is whitelisted here now for when the
   AMFI NAV endpoint (Sprint 12 / ORD-1503) lands; harmless unused today. */
const ALLOWED_HOSTS = new Set([
  'news.google.com',
  'pib.gov.in', 'www.pib.gov.in',
  'rbi.org.in', 'www.rbi.org.in',
  'sebi.gov.in', 'www.sebi.gov.in',
  'moneycontrol.com', 'www.moneycontrol.com',
  'economictimes.indiatimes.com',
  'livemint.com', 'www.livemint.com',
  'thehindubusinessline.com', 'www.thehindubusinessline.com',
  'cnbctv18.com', 'www.cnbctv18.com',
  'query1.finance.yahoo.com',
  'amfiindia.com', 'www.amfiindia.com'
]);

const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB cap
const UPSTREAM_TIMEOUT_MS = 8000;
const RSS_FRESH_MS = 5 * 60 * 1000;      // serve straight from cache
const RSS_STALE_TOLERABLE_MS = 15 * 60 * 1000; // serve stale + refresh in background
// 15s, not 60s: the app now refreshes the tape every ~20s while NSE is
// open, and a 60s cache would have served the same print three times over
// and called it "live". The cache exists to stop request storms, not to
// flatten the freshness the exchange is actually giving us.
const QUOTE_TTL_MS = 15 * 1000;

/** @type {Map<string, {body:string, contentType:string, ts:number, refreshing?:boolean}>} */
const rssCache = new Map();
/** @type {Map<string, {price:number, changePct:number, prevClose:number, ts:number}>} */
const quoteCache = new Map();

const startedAt = Date.now();
/** @type {Array<{time:string, message:string}>} */
const lastErrors = [];
function logError(message){
  const entry = { time: new Date().toISOString(), message: String(message).slice(0, 300) };
  lastErrors.unshift(entry);
  if (lastErrors.length > 20) lastErrors.length = 20;
  console.error('[jarvis-relay]', entry.time, message);
}
function logLine(host, ms, status){
  console.log(`[jarvis-relay] ${host} ${status} ${ms}ms`);
}

/* Origin gate for the browser response (not the outbound-fetch whitelist
   above — a separate concern). This is a personal local tool whose dev
   server's port can float (see .claude/launch.json autoPort), so instead
   of one hardcoded origin we reflect the request's Origin back ONLY when
   it parses as http(s)://localhost:<port> or http(s)://127.0.0.1:<port>.
   That still refuses every non-local origin — nowhere near `*`. */
function corsOriginFor(reqOrigin){
  if (!reqOrigin) return null;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(reqOrigin) ? reqOrigin : null;
}

function withCors(res, req, extra = {}){
  const origin = corsOriginFor(req.headers.origin);
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Jarvis-Token',
    'Vary': 'Origin', ...extra
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

async function fetchUpstream(url){
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { 'User-Agent': 'JarvisPersonalRelay/1.0 (local, single-user)' }
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const contentType = res.headers.get('content-type') || 'text/plain';
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BODY_BYTES) throw new Error('upstream body exceeded 2MB cap');
    return { body: Buffer.from(buf).toString('utf8'), contentType };
  } finally {
    clearTimeout(t);
  }
}

async function handleRss(req, res, url){
  const target = url.searchParams.get('url');
  if (!target) return send(res, req, 400, { error: 'missing url param' });
  let parsed;
  try { parsed = new URL(target); } catch(e){ return send(res, req, 400, { error: 'invalid url' }); }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
    return send(res, req, 400, { error: 'only http(s) urls allowed' });
  if (!ALLOWED_HOSTS.has(parsed.hostname))
    return send(res, req, 403, { error: `host not whitelisted: ${parsed.hostname}` });

  const key = parsed.toString();
  const cached = rssCache.get(key);
  const now = Date.now();

  if (cached && now - cached.ts < RSS_FRESH_MS){
    logLine(parsed.hostname, 0, 'HIT');
    return sendRaw(res, req, 200, cached.body, cached.contentType);
  }
  if (cached && now - cached.ts < RSS_STALE_TOLERABLE_MS){
    // ORD-1304 stale-while-revalidate: answer instantly, refresh quietly
    logLine(parsed.hostname, 0, 'STALE');
    sendRaw(res, req, 200, cached.body, cached.contentType);
    if (!cached.refreshing){
      cached.refreshing = true;
      const t0 = Date.now();
      fetchUpstream(key)
        .then(result => { rssCache.set(key, { ...result, ts: Date.now() }); logLine(parsed.hostname, Date.now() - t0, 'REFRESHED'); })
        .catch(e => logError(`background refresh failed for ${parsed.hostname}: ${e.message}`));
    }
    return;
  }
  const t0 = Date.now();
  try {
    const result = await fetchUpstream(key);
    rssCache.set(key, { ...result, ts: Date.now() });
    logLine(parsed.hostname, Date.now() - t0, 'MISS');
    sendRaw(res, req, 200, result.body, result.contentType);
  } catch(e){
    logError(`${parsed.hostname}: ${e.message}`);
    if (cached){ logLine(parsed.hostname, Date.now() - t0, 'STALE-FALLBACK'); return sendRaw(res, req, 200, cached.body, cached.contentType); }
    send(res, req, 502, { error: 'upstream fetch failed' });
  }
}

async function fetchOneQuote(symbol){
  const cached = quoteCache.get(symbol);
  if (cached && Date.now() - cached.ts < QUOTE_TTL_MS) return cached;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
  const { body } = await fetchUpstream(url);
  const json = JSON.parse(body);
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== 'number') throw new Error('no meta in chart response');
  const price = meta.regularMarketPrice;
  const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
  // quoteTime is the EXCHANGE's timestamp for this print, not our fetch
  // time — the only figure that can honestly answer "how stale is this?".
  // Measured against NSE it runs ~10-15s behind live, but that has to be
  // shown rather than assumed: a freshly-fetched quote can carry a print
  // that is hours old (market closed, instrument halted, or illiquid).
  const entry = {
    price, prevClose,
    changePct: prevClose ? +(100 * (price - prevClose) / prevClose).toFixed(2) : 0,
    quoteTime: typeof meta.regularMarketTime === 'number' ? meta.regularMarketTime * 1000 : null,
    shortName: meta.shortName || meta.longName || meta.symbol || symbol,
    currency: meta.currency || (symbol.endsWith('.NS') || symbol.endsWith('.BO') ? 'INR' : 'USD'),
    dayHigh: meta.regularMarketDayHigh ?? null,
    dayLow: meta.regularMarketDayLow ?? null,
    ts: Date.now()
  };
  quoteCache.set(symbol, entry);
  return entry;
}

async function handleQuote(req, res, url){
  const raw = (url.searchParams.get('symbols') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 30);
  if (!raw.length) return send(res, req, 400, { error: 'missing symbols param' });
  const out = {};
  await Promise.all(raw.map(async symbol => {
    const t0 = Date.now();
    try {
      out[symbol] = await fetchOneQuote(symbol);
      logLine(`yahoo:${symbol}`, Date.now() - t0, 'OK');
    } catch(e){
      out[symbol] = null;
      logError(`quote ${symbol}: ${e.message}`);
    }
  }));
  send(res, req, 200, out);
}

/* POST /llm — narrow passthrough to a LOCAL Ollama (ORD-1511 seam).
   The browser cannot call Ollama directly: its CORS policy rejects the
   app's origin, and the alternative — telling the user to set
   OLLAMA_ORIGINS=* — would expose their local model to EVERY website
   they visit. Routing through this relay instead keeps that door shut,
   reuses the exact-localhost CORS reflection already trusted here, and
   confines the surface to two endpoints.

   Deliberately NOT a general proxy: only /api/generate and /api/tags are
   reachable, so this can't be walked into Ollama's model-management API
   (pull/create/delete). Traffic never leaves the machine — 127.0.0.1 to
   127.0.0.1 — so Constitution Art. 7 is untouched.

   No write token here (unlike /store): the worst a rogue local page can
   do through this is spend GPU time, not corrupt the ledger. The
   exact-localhost CORS check remains the gate. */
const OLLAMA_PORT = Number(process.env.JARVIS_OLLAMA_PORT) || 11434;
const LLM_PATHS = new Set(['/api/generate', '/api/chat', '/api/tags']);
const LLM_TIMEOUT_MS = 60000; // local inference is slow; ~13s cold, ~3s warm

function handleLlm(req, res){
  if (req.method !== 'POST') return send(res, req, 405, { error: 'POST only on /llm' });
  let size = 0; const chunks = [];
  req.on('data', c => {
    size += c.length;
    if (size > MAX_BODY_BYTES){ req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => {
    if (size > MAX_BODY_BYTES) return send(res, req, 413, { error: 'body exceeded 2MB cap' });
    let parsed;
    try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch(e){ return send(res, req, 400, { error: 'body is not valid JSON' }); }

    const path = String(parsed.path || '');
    if (!LLM_PATHS.has(path))
      return send(res, req, 400, { error: `path not allowed: ${path}` });

    const payload = Buffer.from(JSON.stringify(parsed.body || {}), 'utf8');
    const isGet = path === '/api/tags';
    const t0 = Date.now();
    // Content-Length must NOT be set on the GET: Ollama would then block
    // waiting for a body we never send, and the call dies on timeout.
    const up = http.request({
      host: '127.0.0.1', port: OLLAMA_PORT, path, method: isGet ? 'GET' : 'POST',
      headers: isGet ? {} : { 'Content-Type': 'application/json', 'Content-Length': payload.length }
    }, upRes => {
      let body = '';
      upRes.setEncoding('utf8');
      upRes.on('data', d => {
        body += d;
        if (body.length > MAX_BODY_BYTES) upRes.destroy();
      });
      upRes.on('end', () => {
        logLine(`ollama:${path}`, Date.now() - t0, 'OK');
        sendRaw(res, req, 200, body, 'application/json');
      });
    });
    up.setTimeout(LLM_TIMEOUT_MS, () => { up.destroy(new Error('ollama timeout')); });
    up.on('error', e => {
      logError(`llm ${path}: ${e.message}`);
      send(res, req, 502, { error: 'local model unreachable — is Ollama running?' });
    });
    if (!isGet) up.write(payload);
    up.end();
  });
}

function handleHealth(req, res){
  send(res, req, 200, {
    ok: true,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    rssCacheEntries: rssCache.size,
    quoteCacheEntries: quoteCache.size,
    diskStore: true,
    lastErrors
  });
}

/* GET /token — hands the app its write token. Protected purely by the
   CORS reflection: a foreign origin gets no Access-Control-Allow-Origin,
   so the browser refuses to expose the body to that page's JS. */
function handleToken(req, res){
  send(res, req, 200, { token: WRITE_TOKEN });
}

/* GET /store/<key> — read a persisted blob (empty string if none yet).
   POST /store/<key> — write it, requires the X-Jarvis-Token header. */
function handleStore(req, res, url){
  const key = decodeURIComponent(url.pathname.slice('/store/'.length));
  if (!validKey(key)) return send(res, req, 400, { error: 'invalid or non-durable key' });

  if (req.method === 'GET'){
    let body = '';
    try { body = fs.readFileSync(keyPath(key), 'utf8'); } catch(e){ /* missing — return empty */ }
    logLine(`store:${key}`, 0, 'READ');
    return sendRaw(res, req, 200, body, 'application/json');
  }

  if (req.method === 'POST'){
    if (req.headers['x-jarvis-token'] !== WRITE_TOKEN){
      logError(`rejected write to ${key}: bad or missing token`);
      return send(res, req, 403, { error: 'missing or invalid X-Jarvis-Token' });
    }
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY_BYTES){ req.destroy(); return; } // 2MB write cap, same as reads
      chunks.push(c);
    });
    req.on('end', () => {
      if (size > MAX_BODY_BYTES) return send(res, req, 413, { error: 'body exceeded 2MB cap' });
      const body = Buffer.concat(chunks).toString('utf8');
      try { JSON.parse(body); } catch(e){ return send(res, req, 400, { error: 'body is not valid JSON' }); }
      try {
        fs.writeFileSync(keyPath(key), body);
        logLine(`store:${key}`, 0, 'WRITE');
        send(res, req, 200, { ok: true, bytes: size });
      } catch(e){ logError(`write ${key}: ${e.message}`); send(res, req, 500, { error: 'disk write failed' }); }
    });
    return;
  }
  send(res, req, 405, { error: 'GET or POST only on /store' });
}

function send(res, req, status, obj){
  const headers = withCors(res, req, { 'Content-Type': 'application/json' });
  res.writeHead(status, headers);
  res.end(JSON.stringify(obj));
}
function sendRaw(res, req, status, body, contentType){
  const headers = withCors(res, req, { 'Content-Type': contentType });
  res.writeHead(status, headers);
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS'){ res.writeHead(204, withCors(res, req)); res.end(); return; }

  let url;
  try { url = new URL(req.url, `http://${HOST}:${PORT}`); }
  catch(e){ send(res, req, 400, { error: 'bad request url' }); return; }

  // POST is allowed ONLY on /store (the durability write path); every
  // other route stays GET-only, preserving the original proxy's posture.
  if (url.pathname.startsWith('/store/')) return handleStore(req, res, url);
  if (url.pathname === '/llm') return handleLlm(req, res);
  if (req.method !== 'GET'){ send(res, req, 405, { error: 'GET only (POST allowed on /store and /llm only)' }); return; }

  if (url.pathname === '/health') return handleHealth(req, res);
  if (url.pathname === '/token') return handleToken(req, res);
  if (url.pathname === '/rss') return void handleRss(req, res, url).catch(e => { logError(e.message); send(res, req, 500, { error: 'internal error' }); });
  if (url.pathname === '/quote') return void handleQuote(req, res, url).catch(e => { logError(e.message); send(res, req, 500, { error: 'internal error' }); });
  send(res, req, 404, { error: 'not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`[jarvis-relay] listening on http://${HOST}:${PORT} (personal use only, not reachable from the LAN)`);
  console.log(`[jarvis-relay] disk store at ${DATA_DIR} — irreplaceable data mirrors here, surviving browser-profile wipes`);
});

process.on('uncaughtException', err => logError(`uncaughtException: ${err?.message || err}`));
process.on('unhandledRejection', reason => logError(`unhandledRejection: ${reason?.message || reason}`));
