// @ts-check
/* ============================================================
   J.A.R.V.I.S — knowledge base
   Sector metadata, lexicons, and the SIMULATION feed.
   The simulation feed is machine-crafted sample intelligence so the
   system demonstrates end-to-end analysis offline. Hit FETCH LIVE
   in the Intel Feed to pull real headlines via RSS.
   ============================================================ */

const JDATA = {};

/* Bumped by any sprint that changes scoring math (impact, conviction,
   hype, sentiment, amount parsing). Stamped into every archived signal
   and daily rollup so future calibration/hit-rate analysis can segment
   by engine version instead of comparing incomparable scores. */
JDATA.ENGINE_VERSION = 6; // v6: attack-#13 fix — cluster momentum divides an item's impact by its sector count

/* ---------------- sector universe ---------------- */
JDATA.SECTORS = {
  defence:   { label:'Defence & Aerospace',  watch:['HAL','BEL','BDL','Bharat Forge','Solar Industries'], risk:'Order execution timelines and budget deferrals', angle:0 },
  semis:     { label:'Semiconductors',       watch:['Dixon','Kaynes Tech','CG Power','Tata Elxsi','Moschip'], risk:'Capital intensity; global cycle downturns', angle:32 },
  rail:      { label:'Railways & Logistics', watch:['RVNL','IRFC','Titagarh Rail','Texmaco','Container Corp'], risk:'Tender-driven lumpy revenue; policy shifts', angle:64 },
  infra:     { label:'Infrastructure',       watch:['L&T','KNR Constructions','NCC','IRB Infra'], risk:'Working-capital stress; execution delays', angle:96 },
  banks:     { label:'Banking & Finance',    watch:['HDFC Bank','ICICI Bank','SBI','Bajaj Finance'], risk:'Credit cycle turns; NIM compression', angle:128 },
  it:        { label:'IT & AI Services',     watch:['TCS','Infosys','HCLTech','Persistent','LTIMindtree'], risk:'US spending cuts; AI pricing deflation', angle:160 },
  energy:    { label:'Energy Transition',    watch:['NTPC','Tata Power','Adani Green','Reliance','Suzlon'], risk:'Policy subsidy dependence; PPA renegotiation', angle:192 },
  ev:        { label:'EV & Auto',            watch:['Tata Motors','M&M','Exide','Amara Raja','Sona BLW'], risk:'Price wars; battery input cost swings', angle:224 },
  pharma:    { label:'Pharma & Healthcare',  watch:['Sun Pharma','Cipla','Dr Reddys','Divis Labs'], risk:'US FDA actions; generic price erosion', angle:256 },
  metals:    { label:'Metals & Mining',      watch:['Tata Steel','JSW Steel','Hindalco','NMDC'], risk:'China demand; global commodity cycles', angle:288 },
  datacenter:{ label:'Data Centers & Power', watch:['Anant Raj','Techno Electric','ABB India','Siemens'], risk:'Power availability; hyperscaler capex pauses', angle:320 },
  gold:      { label:'Gold & Safe Havens',   watch:['Gold ETFs (GOLDBEES)','Sovereign Gold Bonds'], risk:'Real-rate spikes reduce appeal', angle:352 }
};

/* ---------------- entity keywords → sector/tag mapping ---------------- */
JDATA.KEYWORDS = [
  // sectors
  { rx:/defence|defense|missile|fighter jet|aerospace|artillery|drone|BrahMos|submarine|warship/i, sector:'defence', tag:'Defence' },
  { rx:/semiconductor|chip fab|foundry|wafer|chipmaker|OSAT|ATMP|silicon/i, sector:'semis', tag:'Semiconductors' },
  { rx:/railway|rail corridor|metro|freight corridor|wagon|locomotive|Vande Bharat/i, sector:'rail', tag:'Railways' },
  { rx:/infrastructure|highway|expressway|port |ports|airport|construction|housing/i, sector:'infra', tag:'Infrastructure' },
  { rx:/bank|NBFC|lender|credit growth|deposit|microfinance/i, sector:'banks', tag:'Banking' },
  { rx:/\bIT\b|software|AI services|GenAI|artificial intelligence|tech services|SaaS/i, sector:'it', tag:'IT & AI' },
  { rx:/solar|renewable|green hydrogen|wind energy|clean energy|battery storage|nuclear|power plant/i, sector:'energy', tag:'Energy' },
  { rx:/electric vehicle|\bEV\b|e-mobility|battery plant|charging network|automaker|auto sales/i, sector:'ev', tag:'EV & Auto' },
  { rx:/pharma|drug|biotech|vaccine|healthcare|hospital|API plant/i, sector:'pharma', tag:'Pharma' },
  { rx:/steel|aluminium|copper|mining|iron ore|zinc|rare earth/i, sector:'metals', tag:'Metals' },
  { rx:/data center|data centre|datacenter|hyperscaler|cloud region|GPU cluster|compute capacity/i, sector:'datacenter', tag:'Data Centers' },
  { rx:/gold|bullion|safe haven|sovereign gold/i, sector:'gold', tag:'Gold' },
  // macro tags (no sector)
  { rx:/repo rate|rate cut|rate hike|monetary policy|RBI|Federal Reserve|Fed |ECB|central bank/i, tag:'Central Banks' },
  { rx:/budget|capex|capital expenditure|outlay|allocation|fiscal/i, tag:'Capex' },
  { rx:/PLI|production linked|subsidy|incentive scheme|viability gap/i, tag:'Incentives' },
  { rx:/FII|FPI|foreign investors|foreign inflow|foreign outflow/i, tag:'Foreign Flows' },
  { rx:/DII|mutual fund|SIP|domestic institutions/i, tag:'Domestic Flows' },
  { rx:/tariff|trade deal|export curb|sanction|import duty|trade pact/i, tag:'Trade Policy' },
  { rx:/IPO|listing|public offer/i, tag:'IPO' },
  { rx:/merger|acquisition|acquires|stake|buyout|takeover/i, tag:'M&A' },
  { rx:/inflation|CPI|WPI|GDP|growth forecast/i, tag:'Macro Data' },
  { rx:/China|Beijing/i, tag:'China' },
  { rx:/United States|Washington|US |America/i, tag:'United States' },
  { rx:/Japan|Tokyo/i, tag:'Japan' },
  { rx:/Europe|EU |Brussels|Germany/i, tag:'Europe' },
  { rx:/Taiwan/i, tag:'Taiwan' },
  { rx:/Middle East|Gulf|Saudi|UAE/i, tag:'Middle East' },
  // ORD-303: additional macro tags beyond Part I's original set
  { rx:/\bGST\b|goods and services tax/i, tag:'GST' },
  { rx:/disinvestment|privati[sz]ation|stake sale/i, tag:'Disinvestment' },
  { rx:/\bPSU\b|public sector undertaking/i, tag:'PSU' },
  { rx:/bond yield|g-sec|gilt|yield curve/i, tag:'Bond Yields' },
  { rx:/rupee|\bINR\b|currency depreciation/i, tag:'Rupee' },
  { rx:/crude oil|\bcrude\b|Brent|WTI/i, tag:'Crude' },
  { rx:/monsoon|kharif|rabi|rainfall deficit/i, tag:'Monsoon' },
  { rx:/El Ni[nñ]o|La Ni[nñ]a/i, tag:'El Niño' },
  { rx:/critical minerals?|rare earth|lithium reserve|cobalt/i, tag:'Critical Minerals' },
  { rx:/GCC\b|global capability centre|data embassy|data embassies/i, tag:'GCC / Data Embassies' }
];

/* ---------------- ORD-303: curated entity universe (data-only) ----------------
   Real large/mid-cap Indian names mapped to sector + (approx.) trading
   symbol, spread across the existing sector taxonomy. JDATA.COMPANY_RX is
   built once below for fast matching, and each name is also folded into
   JDATA.KEYWORDS (type:'company') so Engine.analyzeItem needs no separate
   code path — entities render as clickable tags exactly like macro tags. */
/* Names deliberately use the SHORT/colloquial form real Indian financial
   headlines actually use (matching the style already established by
   JDATA.SECTORS[x].watch, e.g. 'L&T', 'M&M', 'Reliance', 'HAL') rather than
   full legal names ("Larsen & Toubro Limited") — a headline saying
   "Reliance commits ₹75,000 crore" would never match a "Reliance
   Industries" keyword. Verified against test.html's dedup case. */
JDATA.COMPANIES = [
  { name:'HDFC Bank', sector:'banks', sym:'HDFCBANK' },
  { name:'ICICI Bank', sector:'banks', sym:'ICICIBANK' },
  { name:'SBI', sector:'banks', sym:'SBIN' },
  { name:'Axis Bank', sector:'banks', sym:'AXISBANK' },
  { name:'Kotak Mahindra Bank', sector:'banks', sym:'KOTAKBANK' },
  { name:'Bajaj Finance', sector:'banks', sym:'BAJFINANCE' },
  { name:'IndusInd Bank', sector:'banks', sym:'INDUSINDBK' },
  { name:'HAL', sector:'defence', sym:'HAL' },
  { name:'BEL', sector:'defence', sym:'BEL' },
  { name:'BDL', sector:'defence', sym:'BDL' },
  { name:'Bharat Forge', sector:'defence', sym:'BHARATFORG' },
  { name:'Solar Industries', sector:'defence', sym:'SOLARINDS' },
  { name:'Mazagon Dock', sector:'defence', sym:'MAZDOCK' },
  { name:'Cochin Shipyard', sector:'defence', sym:'COCHINSHIP' },
  { name:'Dixon', sector:'semis', sym:'DIXON' },
  { name:'Kaynes Tech', sector:'semis', sym:'KAYNES' },
  { name:'CG Power', sector:'semis', sym:'CGPOWER' },
  { name:'Tata Elxsi', sector:'semis', sym:'TATAELXSI' },
  { name:'Moschip', sector:'semis', sym:'MOSCHIP' },
  { name:'RVNL', sector:'rail', sym:'RVNL' },
  { name:'IRFC', sector:'rail', sym:'IRFC' },
  { name:'Titagarh Rail', sector:'rail', sym:'TITAGARH' },
  { name:'Texmaco', sector:'rail', sym:'TEXRAIL' },
  { name:'Container Corp', sector:'rail', sym:'CONCOR' },
  { name:'L&T', sector:'infra', sym:'LT' },
  { name:'KNR Constructions', sector:'infra', sym:'KNRCON' },
  { name:'NCC', sector:'infra', sym:'NCC' },
  { name:'IRB Infra', sector:'infra', sym:'IRB' },
  { name:'Adani Ports', sector:'infra', sym:'ADANIPORTS' },
  { name:'GMR Airports', sector:'infra', sym:'GMRAIRPORT' },
  { name:'TCS', sector:'it', sym:'TCS' },
  { name:'Infosys', sector:'it', sym:'INFY' },
  { name:'HCLTech', sector:'it', sym:'HCLTECH' },
  { name:'Persistent', sector:'it', sym:'PERSISTENT' },
  { name:'LTIMindtree', sector:'it', sym:'LTIM' },
  { name:'Wipro', sector:'it', sym:'WIPRO' },
  { name:'Tech Mahindra', sector:'it', sym:'TECHM' },
  { name:'NTPC', sector:'energy', sym:'NTPC' },
  { name:'Tata Power', sector:'energy', sym:'TATAPOWER' },
  { name:'Adani Green', sector:'energy', sym:'ADANIGREEN' },
  { name:'Suzlon', sector:'energy', sym:'SUZLON' },
  { name:'Reliance', sector:'energy', sym:'RELIANCE' },
  { name:'JSW Energy', sector:'energy', sym:'JSWENERGY' },
  { name:'Tata Motors', sector:'ev', sym:'TATAMOTORS' },
  { name:'M&M', sector:'ev', sym:'M&M' },
  { name:'Exide', sector:'ev', sym:'EXIDEIND' },
  { name:'Amara Raja', sector:'ev', sym:'ARE&M' },
  { name:'Sona BLW', sector:'ev', sym:'SONACOMS' },
  { name:'Bajaj Auto', sector:'ev', sym:'BAJAJ-AUTO' },
  { name:'Sun Pharma', sector:'pharma', sym:'SUNPHARMA' },
  { name:'Cipla', sector:'pharma', sym:'CIPLA' },
  { name:'Dr Reddys', sector:'pharma', sym:'DRREDDY' },
  { name:'Divis Labs', sector:'pharma', sym:'DIVISLAB' },
  { name:'Lupin', sector:'pharma', sym:'LUPIN' },
  { name:'Tata Steel', sector:'metals', sym:'TATASTEEL' },
  { name:'JSW Steel', sector:'metals', sym:'JSWSTEEL' },
  { name:'Hindalco', sector:'metals', sym:'HINDALCO' },
  { name:'NMDC', sector:'metals', sym:'NMDC' },
  { name:'Vedanta', sector:'metals', sym:'VEDL' },
  { name:'SAIL', sector:'metals', sym:'SAIL' },
  { name:'Anant Raj', sector:'datacenter', sym:'ANANTRAJ' },
  { name:'Techno Electric', sector:'datacenter', sym:'TECHNOE' },
  { name:'ABB India', sector:'datacenter', sym:'ABB' },
  { name:'Siemens India', sector:'datacenter', sym:'SIEMENS' }
];
/** Escape a company name for use inside a RegExp alternation. */
JDATA._escRx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
JDATA.COMPANY_RX = new RegExp('\\b(' +
  JDATA.COMPANIES.slice().sort((a,b) => b.name.length - a.name.length)
    .map(c => JDATA._escRx(c.name)).join('|') + ')\\b', 'i');
JDATA.COMPANIES.forEach(c => {
  JDATA.KEYWORDS.push({ rx: new RegExp('\\b' + JDATA._escRx(c.name) + '\\b', 'i'), sector: c.sector, tag: c.name, type: 'company', sym: c.sym });
});

/* ---------------- sentiment lexicons ---------------- */
JDATA.BULL = /surge|record|wins?|approv|order book|bags?|boost|invest|stimulus|subsid|expand|inflow|upgrade|beat|rally|clears?|award|commission|breakthrough|milestone|double|soars?|jump|accelerat|green.?light|sign(s|ed)? (deal|pact|mou)|cuts? rates?|rate cut/i;
JDATA.BEAR = /probe|ban|slump|outflow|downgrade|default|crackdown|delay|cancel|war |sanction|strike|recall|miss|falls?|drops?|plunge|crisis|deficit|withdraw|halt|curb|freeze|layoff|tension|warns?|risk of/i;

/* ---------------- ORD-302: negation & direction awareness ----------------
   A lexicon match preceded within ~3 words by one of these negates the hit
   (Engine.countSentimentHits neutralises it) instead of counting as
   bull/bear. Kept broad on purpose — a missed negation (false bull/bear)
   costs more here than an occasional over-cautious neutralisation. */
JDATA.NEGATIONS = /\b(den(y|ies|ied)|rules?\s+out|ruled\s+out|no\s+plans?|not\s+planning|unlikely|won'?t|will\s+not|does\s?n'?t|does\s+not|did\s?n'?t|did\s+not|postpones?|postponed|rejects?|rejected|scraps?|scrapped|shelves?|shelved)\b/i;

/* Outflow-direction verbs: when present, the flow's amountCr is signed
   negative for that sector (money leaving, not arriving). */
JDATA.OUTFLOW_RX = /withdraws?|withdrawn|withdrawal|pulls?\s+out|pulled\s+out|sells?\s+stake|sold\s+stake|exits?|exited|outflow|divests?|divested|redemptions?/i;

/* ---------------- ORD-1701 (a-d): astroturf / hype heuristics ----------------
   Cheap, explainable, no AI: hedge density + superlative density + unnamed
   sourcing + untiered outlet. (e) coordination and (f) price-led-news are
   explicitly out of scope this sprint (see DECISIONS.md). */
JDATA.HEDGE_RX = /reportedly|sources?\s+say|\bmay\b|\bcould\b|mulls?|considering|in\s+talks|likely\s+to|planning\s+to|expected\s+to/gi;
JDATA.SUPERLATIVE_RX = /multibagger|massive|huge|golden\s+opportunity|game.?changer|guaranteed|unstoppable|next\s+(reliance|tcs|infosys|hdfc|apple|tesla|nvidia)/gi;
JDATA.UNNAMED_SOURCE_RX = /sources?\s+(said|say|close to)|people\s+familiar|persons?\s+aware|persons?\s+in\s+the\s+know/i;
/* Outlets considered "tiered" (official / wire / established financial media) —
   reuses ORD-202's weighted sources plus the rest of the sim feed's wires so
   the curated demo data doesn't false-flag itself as hype. */
JDATA.TIERED_OUTLETS_RX = /PIB|Press Information Bureau|\bRBI\b|Reserve Bank|Ministry of|\bSEBI\b|\bNSE\b|\bBSE\b|Exchange Filing|Government of India|Reuters|Bloomberg|\bPTI\b|\bANI\b|Associated Press|\bAFP\b|Nikkei|\bFT\b|Financial Times|\bWSJ\b|Wall Street Journal|Moneycontrol|\bMint\b|Business Line|ET Markets|ET Corporate|ET Tech|\bAMFI\b|Company Filing|Press Release|MeitY|MNRE|DPIIT|TechCrunch|NSE Data|BSE Notices|Tata Group/i;
/** Score 0-100: higher = more manufacture-shaped. Weighted sum of the four
 *  cheap heuristics; threshold (ORD-1701) at JDATA.HYPE_THRESHOLD.
 *  @param {string} text @param {string} sourceName @returns {number} */
JDATA.hypeScore = function(text, sourceName){
  const words = Math.max((text.match(/\S+/g) || []).length, 1);
  const hedgeHits = (text.match(JDATA.HEDGE_RX) || []).length;
  const hedgeDensity = hedgeHits / words * 100;
  const superHits = (text.match(JDATA.SUPERLATIVE_RX) || []).length;
  const unnamed = JDATA.UNNAMED_SOURCE_RX.test(text);
  const untiered = !JDATA.TIERED_OUTLETS_RX.test(sourceName || '');
  let score = 0;
  score += Math.min(hedgeDensity * 8, 40);   // up to 40 pts
  score += Math.min(superHits * 20, 30);     // up to 30 pts
  score += unnamed ? 15 : 0;                 // 15 pts
  score += untiered ? 15 : 0;                // 15 pts
  return Math.round(Math.max(0, Math.min(100, score)));
};
/* Threshold chosen so the sim feed (all tiered wires, no hedge/superlative
   language) scores 0 and stays clean, while a single superlative + unnamed
   sourcing + untiered outlet (30+15+15=60) clears the bar. Documented in
   DECISIONS.md as a judgment call — the order doesn't specify an exact number. */
JDATA.HYPE_THRESHOLD = 55;

/* ---------------- flow source classes ---------------- */
JDATA.FLOW_SOURCES = {
  gov:        { label:'Government',       color:'var(--d2)', hex:'#bd8a16' },
  foreign:    { label:'Foreign Capital',  color:'var(--d3)', hex:'#8a63f0' },
  institution:{ label:'Institutions',     color:'var(--d5)', hex:'#3b82f6' },
  corporate:  { label:'Corporate Capex',  color:'var(--d1)', hex:'#0096b8' }
};

/* ---------------- source credibility weights (ORD-202) ----------------
   Official releases and wire agencies get more benefit of the doubt than
   an unnamed blog. Applied once, multiplicatively, before the impact
   score's final clamp — never overrides the clamp ceiling. */
JDATA.SOURCE_WEIGHTS = [
  { rx:/PIB|Press Information Bureau|\bRBI\b|Reserve Bank|Ministry of|\bSEBI\b|\bNSE\b|\bBSE\b|Exchange Filing|Government of India/i, w:1.3 },
  { rx:/Reuters|Bloomberg|\bPTI\b|\bANI\b|Associated Press|\bAFP\b/i, w:1.15 }
];
/** @param {string} sourceName @returns {number} */
JDATA.sourceWeight = function(sourceName){
  for (const s of JDATA.SOURCE_WEIGHTS) if (s.rx.test(sourceName)) return s.w;
  return 1.0;
};

/* ---------------- glossary (Jarvis teaches) ---------------- */
JDATA.GLOSSARY = {
  'fii': 'Foreign Institutional Investors — overseas funds buying Indian securities. Sustained FII inflows tend to lift large-caps and the rupee; outflows do the reverse.',
  'dii': 'Domestic Institutional Investors — Indian mutual funds, insurers, pension funds. The SIP wave has made DIIs a stabilising counterweight to FII selling.',
  'capex': 'Capital expenditure — money spent building capacity: factories, roads, fabs. Rising capex today is usually revenue for industrials tomorrow.',
  'pli': 'Production Linked Incentive — a government scheme paying manufacturers a percentage of incremental sales to build in India. Follow the PLI money to find tomorrow\'s winners.',
  'repo rate': 'The rate at which the RBI lends to banks. Cuts make borrowing cheaper — typically bullish for banks, autos, and real estate.',
  'inflation': 'The rate at which prices rise. High inflation forces rate hikes (bearish); cooling inflation opens the door to cuts (bullish).',
  'order book': 'Confirmed future work a company holds. A swelling order book de-risks future revenue — watch book-to-bill ratios.',
  'sip': 'Systematic Investment Plan — fixed monthly investing into funds. It averages your cost through cycles and compounds quietly.',
  'market cap': 'Price × shares outstanding — what the market thinks the whole company is worth.',
  'valuation': 'What you pay versus what you get. A great story at 90× earnings can still be a bad investment, Sir.',
  'moat': 'A durable competitive advantage — brands, networks, switching costs — that protects profits from competition.'
};

/* ---------------- simulation feed ----------------
   h = hours ago · cat: gov | global | markets | corporate  */
JDATA.FEED = [
  { id:'s01', cat:'gov', s:'PIB Delhi', h:3,
    t:'Cabinet clears ₹1.2 lakh crore defence acquisition pipeline; indigenous content mandated above 65%',
    b:'The Cabinet Committee on Security approved a multi-year acquisition slate covering fighter jets, submarines and drone swarms, with production reserved for Indian facilities and export approvals fast-tracked.' },
  { id:'s02', cat:'gov', s:'Ministry of Finance', h:7,
    t:'Capex outlay stepped up: ₹11.8 lakh crore infrastructure spend front-loaded for FY27',
    b:'The finance ministry directed ministries to award 60% of infrastructure tenders in the first half, prioritising freight corridors, ports and power transmission.' },
  { id:'s03', cat:'gov', s:'MeitY', h:16,
    t:'Semiconductor Mission 2.0 notified with ₹85,000 crore for fabs, OSAT and design-linked incentives',
    b:'Two new fab proposals and five ATMP units cleared under the expanded scheme; officials say display fabs and compound semiconductors are next in the pipeline.' },
  { id:'s04', cat:'gov', s:'RBI Bulletin', h:26,
    t:'RBI signals room for a rate cut as CPI inflation cools to 3.4%, lowest in 5 years',
    b:'The central bank\'s bulletin notes durable disinflation and softening crude, giving the MPC space to support credit growth in the upcoming policy review.' },
  { id:'s05', cat:'gov', s:'Ministry of Railways', h:40,
    t:'Railways awards ₹38,000 crore in wagon and Vande Bharat orders; freight corridor phase-3 approved',
    b:'Rolling stock manufacturers received the largest single-year order slate on record, with delivery schedules compressed to 36 months.' },
  { id:'s06', cat:'gov', s:'MNRE', h:52,
    t:'Green hydrogen hubs get ₹24,000 crore viability gap funding; three coastal clusters named',
    b:'Ports at Kandla, Tuticorin and Paradip will anchor electrolyser parks with bundled renewable capacity and export terminals.' },
  { id:'s07', cat:'gov', s:'DPIIT', h:64,
    t:'Government probes surge in cheap steel imports; safeguard duty decision within 30 days',
    b:'Domestic mills flagged a jump in imports at predatory prices; a provisional safeguard duty is on the table to protect local capacity utilisation.' },

  { id:'g01', cat:'global', s:'Reuters World', h:2,
    t:'US Federal Reserve cuts rates 25 bps, signals two more cuts; emerging market funds see record weekly inflows',
    b:'The dovish dot plot pushed the dollar index lower. EPFR data shows EM equity funds absorbed $9.4 billion in the week, the strongest since 2021 — India took the largest single-country share.' },
  { id:'g02', cat:'global', s:'Bloomberg Asia', h:9,
    t:'China unveils $140 billion stimulus for chip self-sufficiency and grid upgrades',
    b:'Beijing\'s package concentrates on legacy-node fabs and ultra-high-voltage transmission, a signal that the tech decoupling race is accelerating supply-chain diversification to India and Vietnam.' },
  { id:'g03', cat:'global', s:'Nikkei', h:14,
    t:'Japan approves $30 billion subsidy tranche for overseas chip and battery plants — India named priority partner',
    b:'Japanese cabinet documents list India among three priority destinations for co-funded semiconductor assembly and battery cell capacity.' },
  { id:'g04', cat:'global', s:'FT Energy', h:22,
    t:'Global funds pour $52 billion into AI data-center buildouts this quarter; power supply is the new bottleneck',
    b:'Hyperscalers are signing 20-year power purchase agreements and reviving nuclear deals. Analysts say transmission equipment and generation capacity are the scarce assets of the decade.' },
  { id:'g05', cat:'global', s:'Reuters Commodities', h:30,
    t:'Central banks bought 290 tonnes of gold in H1 — reserves diversification away from the dollar continues',
    b:'The World Gold Council reports the eighth consecutive half-year of net official-sector buying, led by Asian central banks; bullion sits near record highs.' },
  { id:'g06', cat:'global', s:'WSJ', h:38,
    t:'US finalises tariff relief for allied-nation electronics; India-assembled smartphones gain duty edge',
    b:'The revised schedule cuts duties on electronics assembled in partner countries, widening the cost gap versus China-origin shipments.' },
  { id:'g07', cat:'global', s:'Bloomberg', h:47,
    t:'Taiwan tensions flare after naval drills; insurers reprice Asia supply-chain risk',
    b:'War-risk premiums on Taiwan Strait routes doubled. Boards are being told to budget for second-source manufacturing outside the strait — the China+1 trade hardens.' },
  { id:'g08', cat:'global', s:'Reuters Energy', h:58,
    t:'OPEC+ extends output cuts to year-end; Brent holds below $80 on soft China demand',
    b:'The extension failed to lift prices as Chinese refinery runs disappoint — a tailwind for India\'s import bill and inflation trajectory.' },

  { id:'m01', cat:'markets', s:'NSE Data', h:1,
    t:'FIIs turn buyers: ₹18,600 crore net equity inflow this week, largest in 14 months',
    b:'Foreign desks cite the Fed pivot and earnings resilience. Buying concentrated in financials, industrials and capital goods.' },
  { id:'m02', cat:'markets', s:'AMFI', h:11,
    t:'Monthly SIP flows hit record ₹31,400 crore; small-cap fund inflows moderate',
    b:'Domestic investors continue to automate equity buying. Fund houses report longer average SIP tenures — the retail base is maturing.' },
  { id:'m03', cat:'markets', s:'ET Markets', h:19,
    t:'Defence index up 34% YTD as export orders compound; analysts flag rich valuations',
    b:'Brokerages remain constructive on order momentum but note several names trade above 60× forward earnings — execution is now the differentiator.' },
  { id:'m04', cat:'markets', s:'Moneycontrol', h:28,
    t:'IPO pipeline swells: 42 companies file for ₹98,000 crore in listings led by energy and electronics manufacturers',
    b:'Merchant bankers say anchor demand is dominated by long-only foreign funds returning after the rate pivot.' },
  { id:'m05', cat:'markets', s:'BSE Notices', h:44,
    t:'Midcap valuations stretch to 92nd percentile; mutual funds raise cash levels to 6.1%',
    b:'Fund managers are rotating from momentum midcaps toward large-cap financials and underowned energy names, citing risk-reward.' },

  { id:'c01', cat:'corporate', s:'Company Filing', h:4,
    t:'Reliance commits ₹75,000 crore to giga-complex: solar modules, electrolysers and battery cells under one campus',
    b:'The Jamnagar expansion targets 20 GW module capacity by 2028 with captive green power — the largest single private energy-transition bet in India.' },
  { id:'c02', cat:'corporate', s:'Exchange Filing', h:8,
    t:'L&T bags ₹22,000 crore in orders across defence systems and high-speed rail in a single week',
    b:'The engineering major\'s order inflow guidance was raised to 15% growth; management cites a "decade-visible" public capex runway.' },
  { id:'c03', cat:'corporate', s:'Tata Group', h:13,
    t:'Tata Electronics begins pilot chip output at Dholera fab; ₹91,000 crore phase-2 planning starts',
    b:'First 28nm wafers cleared qualification with a major automotive customer. Phase-2 adds advanced packaging and a second fab line.' },
  { id:'c04', cat:'corporate', s:'Press Release', h:18,
    t:'NVIDIA and Indian hyperscalers announce $12 billion GPU cluster and cloud region expansion',
    b:'Three new AI data-center campuses totaling 900 MW will come up near Mumbai, Hyderabad and Chennai, with power tie-ups signed with two state utilities.' },
  { id:'c05', cat:'corporate', s:'Exchange Filing', h:24,
    t:'HAL signs $3.1 billion fighter export deal — largest Indian defence export ever',
    b:'The order includes a 10-year maintenance annuity. Management says the export pipeline now exceeds the domestic order book for the first time.' },
  { id:'c06', cat:'corporate', s:'ET Corporate', h:33,
    t:'Adani Ports acquires east-coast terminal for ₹8,500 crore, lifts FY27 cargo guidance',
    b:'The acquisition consolidates container share ahead of the freight-corridor completion; leverage stays within stated bands, per management.' },
  { id:'c07', cat:'corporate', s:'Reuters India', h:37,
    t:'Global pharma majors sign $4.2 billion in API and CDMO contracts with Indian manufacturers',
    b:'Supply-chain diversification away from single-country sourcing continues; Indian CDMO capacity is booked out to 2028, executives say.' },
  { id:'c08', cat:'corporate', s:'Business Line', h:49,
    t:'EV price war deepens: two automakers cut prices 8% as battery costs slide',
    b:'Margin pressure hits pure-play EV makers while component suppliers with cost-plus contracts stay insulated — a classic picks-and-shovels setup.' },
  { id:'c09', cat:'corporate', s:'Exchange Filing', h:55,
    t:'Banking credit growth accelerates to 16.2% YoY; corporate loan books grow fastest since 2012',
    b:'Private capex borrowing is finally broad-based — steel, cement, renewables and data centers lead fresh sanctions.' },
  { id:'c10', cat:'corporate', s:'TechCrunch', h:61,
    t:'Google commits $6 billion to Indian data-center and subsea cable expansion through 2028',
    b:'The investment includes a second landing station and a hyperscale campus in Vizag, deepening the compute-infrastructure buildout.' },
  { id:'c11', cat:'corporate', s:'ET Tech', h:68,
    t:'IT majors report record GenAI deal bookings; TCS wins $2.4 billion AI transformation contract',
    b:'Pricing shifts from headcount to outcomes. Mid-tier firms with AI platforms are growing bookings twice as fast as legacy peers.' },
  { id:'c12', cat:'corporate', s:'Mint', h:71,
    t:'Private equity deploys ₹42,000 crore into Indian infrastructure yieldcos in H1',
    b:'Global pension and sovereign funds bought operating road and transmission portfolios — patient capital keeps re-rating the sector.' }
];

/* ---------------- market ticker seeds ----------------
   FALLBACK ONLY. These are the values shown when the relay is down and
   the tape runs in SIM mode (badge reads "SIM FEED", cells dimmed). When
   the relay is up, js/market.js overwrites every one of these with a real
   Yahoo quote — see the honesty note at the top of that file.
   Labels match Market.SYMBOLS keys exactly; gold is quoted $/oz rather
   than ₹/10g because the international spot price it maps to sits below
   the duty- and GST-inclusive Indian domestic price. */
JDATA.TICKERS = [
  { k:'NIFTY 50',   v:24225.35, dec:2 },
  { k:'SENSEX',     v:77632.09, dec:2 },
  { k:'BANK NIFTY', v:57156.40, dec:2 },
  { k:'USD/INR',    v:85.62,    dec:2 },
  { k:'GOLD $/oz',  v:4032.90,  dec:2 },
  { k:'BRENT $',    v:77.90,    dec:2 },
  { k:'BTC $',      v:117940,   dec:0 },
  { k:'NASDAQ FUT', v:24310.5,  dec:1 }
];

/* ---------------- stopwords (ORD-1001 prep, Sprint 4) ----------------
   Used by Store's term-frequency counting so the future anomaly sonar
   counts meaningful nouns, not glue words. Deliberately generous —
   erring toward excluding a borderline word costs nothing, since real
   sector/company/macro terms are already excluded separately (they're
   matched entities, not raw tokens). */
JDATA.STOPWORDS = new Set([
  'the','a','an','and','or','but','of','to','in','on','at','for','with','by','from','as','is','are',
  'was','were','be','been','being','this','that','these','those','it','its','their','his','her','they',
  'he','she','we','you','i','has','have','had','will','would','could','should','can','may','might','not',
  'no','yes','do','does','did','so','than','then','there','here','what','which','who','whom','into','over',
  'under','after','before','between','about','against','during','without','within','across','per','via',
  'amid','among','up','down','out','off','also','more','most','some','any','all','each','other','such',
  'only','just','very','said','says','say','saying','new','india','indian','million','billion','crore',
  'lakh','rupees','rupee','percent','year','years','month','months','week','weeks','day','days','today',
  'yesterday','tomorrow','report','reports','reported','according','amid','set','sets','plans','plan',
  'planned','planning','likely','expected','expects','announcement','announced','announce','announces',
  'may','update','updates','updated','latest','news','times','ago','one','two','three','four','five',
  'first','second','third','next','last','now','still','even','much','many','while','because','since',
  'until','upon','above','below','around','through','toward','towards','including','include','includes',
  'company','companies','group','india\'s','government','ministry','sector','market','markets','share',
  'shares','stock','stocks','business','financial','finance','economy','economic','growth','deal','deals'
]);

/* ---------------- demo portfolio book ---------------- */
JDATA.DEMO_BOOK = [
  { name:'HDFC Bank',        type:'Equity', qty:40,  buy:1580,  cur:1712 },
  { name:'HAL',              type:'Equity', qty:12,  buy:3890,  cur:4485 },
  { name:'L&T',              type:'Equity', qty:10,  buy:3420,  cur:3688 },
  { name:'Nifty 50 Index Fund', type:'MF',  qty:520, buy:212.4, cur:231.8 },
  { name:'Parag Parikh Flexi Cap', type:'MF', qty:310, buy:68.2, cur:79.6 },
  { name:'GOLDBEES ETF',     type:'Gold',   qty:600, buy:78.9,  cur:86.2 },
  { name:'Bitcoin',          type:'Crypto', qty:0.04, buy:5100000, cur:10080000 },
  { name:'Liquid Fund',      type:'Cash',   qty:1,   buy:150000, cur:153200 }
];

/* ---------------- demo trade ledger (Sprint 13) ----------------
   A frozen, believable buy/sell history for the same names as
   DEMO_BOOK — spans over a year, includes a dollar-cost-averaged
   add and one full round-trip (RVNL) so Ledger.xirr() and the
   Nifty counterfactual have real, non-degenerate cash flows to
   show off in a demo. Independent of DEMO_BOOK (different subsystem,
   Sprint 7 vs the portfolio module) — not meant to reconcile 1:1. */
JDATA.DEMO_LEDGER = [
  { id:'demo-1', date:'2023-11-01', type:'buy',  symbol:'ITC',      quantity:200,  price:410,  source:'demo' },
  { id:'demo-2', date:'2024-01-15', type:'buy',  symbol:'HAL',      quantity:12,   price:3200, source:'demo' },
  { id:'demo-3', date:'2024-02-01', type:'buy',  symbol:'RVNL',     quantity:100,  price:210,  source:'demo' },
  { id:'demo-4', date:'2024-03-10', type:'buy',  symbol:'HDFCBANK', quantity:40,   price:1580, source:'demo' },
  { id:'demo-5', date:'2024-05-02', type:'buy',  symbol:'LT',       quantity:10,   price:3420, source:'demo' },
  { id:'demo-6', date:'2024-08-20', type:'buy',  symbol:'HAL',      quantity:5,    price:3890, source:'demo' },
  { id:'demo-7', date:'2024-11-15', type:'sell', symbol:'RVNL',     quantity:-40,  price:340,  source:'demo' }
];

/* ---------------- causal graph edges (Sprint 14 core slice) ----------------
   Session #3's signed, lagged edge list, transcribed as data (not yet
   wired into any propagation/scenario engine — that's Sprint 14's
   explicitly-deferred optional extension). sign: +1 favors the
   destination sector, -1 disfavors it. lagDays: how long the effect
   typically takes to show up. Signs and lags are net-average estimates
   from observed market mechanics, not point predictions — see the
   thinking doc's own validation-check caveats. */
JDATA.CAUSAL_EDGES = [
  // Monetary Policy & Rates
  { from:'RBI rate cut', to:'Banks', sign:-1, lagDays:10, category:'Monetary Policy & Rates', why:'Lower loan spreads (NIM compression initially); deposit outflows; only offsets after 6+ months of lending volume growth' },
  { from:'RBI rate cut', to:'IT & AI', sign:1, lagDays:5, category:'Monetary Policy & Rates', why:'Weaker rupee (export revenue boost); also lower acquisition costs for global M&A' },
  { from:'RBI rate cut', to:'Infra', sign:1, lagDays:14, category:'Monetary Policy & Rates', why:'Lower borrowing costs; capex projects become feasible; tender activity picks up in 2 weeks' },
  { from:'RBI rate cut', to:'Real Estate', sign:1, lagDays:7, category:'Monetary Policy & Rates', why:'Lower home-loan EMIs; affordability spike; demand surge in 1–2 weeks' },
  { from:'RBI rate cut', to:'Energy', sign:-1, lagDays:10, category:'Monetary Policy & Rates', why:'Weaker rupee pushes crude import bill up; renewable capex becomes relatively cheaper (minor factor)' },
  { from:'RBI rate cut', to:'Pharma', sign:1, lagDays:5, category:'Monetary Policy & Rates', why:'Weaker rupee (export boost for API; generic drugs more competitive globally)' },
  { from:'RBI rate hike', to:'Banks', sign:1, lagDays:21, category:'Monetary Policy & Rates', why:'Deposit inflows; higher spreads (delayed effect, takes 2–3 weeks to flow through)' },
  { from:'RBI rate hike', to:'IT & AI', sign:-1, lagDays:5, category:'Monetary Policy & Rates', why:'Stronger rupee headwind (export de facto costlier); also higher acquisition costs' },
  { from:'RBI rate hike', to:'Infra', sign:-1, lagDays:14, category:'Monetary Policy & Rates', why:'Higher borrowing costs; tenders delayed; project viability re-examined' },
  { from:'RBI rate hike', to:'EV & Auto', sign:-1, lagDays:14, category:'Monetary Policy & Rates', why:'Car loans become dearer; auto sales decline (lag of 2 weeks as consumer behaviour shifts)' },
  { from:'RBI rate hike', to:'Gold', sign:1, lagDays:3, category:'Monetary Policy & Rates', why:'Higher rates mean lower real returns on fixed income; gold becomes more attractive; repricing immediate' },
  { from:'Inflation spike', to:'Banks', sign:-1, lagDays:3, category:'Monetary Policy & Rates', why:'Rate hike cycle incoming (bearish signal immediately priced in); deposit pressure' },
  { from:'Inflation spike', to:'Metals', sign:1, lagDays:5, category:'Monetary Policy & Rates', why:'Supply-side inflation (often commodity-driven); mining/metal prices rise' },

  // Oil & Commodities
  { from:'Crude +20%', to:'Energy (Oil & Gas)', sign:1, lagDays:3, category:'Oil & Commodities', why:'OMC profit margins widen (international parity pricing); may be capped by government (India-specific discount)' },
  { from:'Crude +20%', to:'Paints', sign:-1, lagDays:14, category:'Oil & Commodities', why:'Feedstock cost (naptha, crude derivatives) rises; 2+ weeks to flow through inventory to P&L' },
  { from:'Crude +20%', to:'Aviation', sign:-1, lagDays:7, category:'Oil & Commodities', why:'Jet fuel cost spike; margins compressed within a week (fuel hedges may lag)' },
  { from:'Crude +20%', to:'Shipping/Logistics', sign:-1, lagDays:10, category:'Oil & Commodities', why:'Fuel surcharges spike; shipping costs up; affects all export-focused sectors downstream' },
  { from:'Crude +20%', to:'Pharma', sign:-1, lagDays:10, category:'Oil & Commodities', why:'API feedstock costs rise; margin pressure after 1-2 weeks as cost inflation flows' },
  { from:'Crude −20%', to:'Energy', sign:-1, lagDays:3, category:'Oil & Commodities', why:'OMC profits compress; capped upside but downside real' },
  { from:'Crude −20%', to:'Paints', sign:1, lagDays:14, category:'Oil & Commodities', why:'Feedstock deflation; margin expansion with 2-week lag' },
  { from:'Gold +15%', to:'Gold', sign:1, lagDays:1, category:'Oil & Commodities', why:'Direct; reflexive, not a causal edge per se, but included for scenario arithmetic' },
  { from:'Monsoon failure', to:'Metals & Mining', sign:-1, lagDays:90, category:'Oil & Commodities', why:'Agricultural crisis → lower rural demand → commodity demand destruction; also depresses export competitiveness; long lag (kharif harvest → prices by Oct–Nov)' },
  { from:'Monsoon failure', to:'Infra', sign:-1, lagDays:60, category:'Oil & Commodities', why:'Rural purchasing power collapses; government pivots to relief spending (capex projects delayed); 2-month lag as policy reorients' },

  // Currency (USD/INR)
  { from:'USD strength (INR weakens)', to:'IT & AI', sign:1, lagDays:2, category:'Currency (USD/INR)', why:'Export realisations improve immediately (offshore revenue now worth more in INR); repricing within days' },
  { from:'USD strength', to:'Pharma', sign:1, lagDays:2, category:'Currency (USD/INR)', why:'Generic drug exports more competitive; API exports improve; immediate repricing' },
  { from:'USD strength', to:'Metals & Mining', sign:-1, lagDays:5, category:'Currency (USD/INR)', why:'Export competitiveness for downstream users (autos, infra, mfg) weakens; metals seen as pricier in global markets; 5-day lag as supply chains reassess' },
  { from:'USD strength', to:'Banks', sign:-1, lagDays:3, category:'Currency (USD/INR)', why:'Dollar appreciation usually coincides with EM capital outflows; deposit pressure (FII selling); repriced in 3 days' },
  { from:'USD strength', to:'Energy', sign:-1, lagDays:7, category:'Currency (USD/INR)', why:'Crude import bill (in INR) spikes; OMC margin compression; 1-week lag as hedging positions settle' },
  { from:'USD weakness (INR strengthens)', to:'IT & AI', sign:-1, lagDays:2, category:'Currency (USD/INR)', why:'Export realisations compress' },
  { from:'USD weakness', to:'Pharma', sign:-1, lagDays:2, category:'Currency (USD/INR)', why:'Exports less competitive' },
  { from:'USD weakness', to:'Energy', sign:1, lagDays:7, category:'Currency (USD/INR)', why:'Crude import bill (in INR) shrinks; upside to OMC margins' },
  { from:'USD weakness', to:'Metals & Mining', sign:1, lagDays:5, category:'Currency (USD/INR)', why:'Export competitiveness improves' },

  // Geopolitics & Trade Policy
  { from:'China trade friction / tariff escalation', to:'Metals & Mining', sign:-1, lagDays:7, category:'Geopolitics & Trade Policy', why:"Demand destruction (China's capex/auto slows); global commodity glut; 1-week lag for repricing" },
  { from:'China trade friction', to:'Semis', sign:1, lagDays:10, category:'Geopolitics & Trade Policy', why:'Supply-chain diversification (India gains fab capacity / component orders); ATMP/foundry work flows to India; 10-day repricing lag' },
  { from:'China trade friction', to:'Pharma', sign:1, lagDays:7, category:'Geopolitics & Trade Policy', why:'API supply risk (China-dependent) drives onshoring; India API makers gain orders' },
  { from:'China weakness / slowdown', to:'IT & AI', sign:-1, lagDays:14, category:'Geopolitics & Trade Policy', why:'Tech spending in EM slows; BPO/ITeS capex deferrals; 2-week lag in client budgets' },
  { from:'India-China border tensions', to:'Defence', sign:1, lagDays:3, category:'Geopolitics & Trade Policy', why:'Immediate defence-spending announcements; repricing within days' },
  { from:'India-China border tensions', to:'Metals & Mining', sign:1, lagDays:10, category:'Geopolitics & Trade Policy', why:'Defence procurement (steel, rare earths) spike; 10-day lag as tenders materialize' },
  { from:'US recession signal', to:'IT & AI', sign:-1, lagDays:21, category:'Geopolitics & Trade Policy', why:'US is largest offshore revenue base; capex cuts, hiring freezes; 3-week lag in earnings revisions' },
  { from:'US recession signal', to:'Pharma', sign:-1, lagDays:21, category:'Geopolitics & Trade Policy', why:'Lower branded-drug volumes in US; generic deflation; 3-week repricing lag' },
  { from:'India export stimulus / trade deal', to:'IT & AI', sign:1, lagDays:30, category:'Geopolitics & Trade Policy', why:'Tariff reduction, new markets; capex increase; 1-month lag in visible deal flow' },
  { from:'Subsidy scheme (PLI, etc.) announced', to:'Semis', sign:1, lagDays:14, category:'Geopolitics & Trade Policy', why:'Capex attractiveness improves; fabs start planning; 2-week repricing lag' },
  { from:'Subsidy scheme (PLI) announced', to:'Defence', sign:1, lagDays:14, category:'Geopolitics & Trade Policy', why:'Production incentives; cluster capex; repricing lag' },

  // Policy & Fiscal
  { from:'Budget capex boost', to:'Infra', sign:1, lagDays:10, category:'Policy & Fiscal', why:'Direct allocation increase; tenders accelerate; 1-2 week repricing lag' },
  { from:'Budget capex boost', to:'Metals & Mining', sign:1, lagDays:14, category:'Policy & Fiscal', why:'Infra capex → steel, cement demand; construction orders pipeline; 2-week lag' },
  { from:'Budget defence spending boost', to:'Defence', sign:1, lagDays:7, category:'Policy & Fiscal', why:'Direct allocation; repricing within 1 week' },
  { from:'Budget defence spending boost', to:'Metals & Mining', sign:1, lagDays:14, category:'Policy & Fiscal', why:'Supply chain (steel, electronics, rare earths) demand; 2-week lag' },
  { from:'Disinvestment (PSU stake sale) announced', to:'Banks', sign:1, lagDays:3, category:'Policy & Fiscal', why:'Positive sentiment (reformist signal); repricing immediate' },
  { from:'Disinvestment announced', to:'Energy', sign:1, lagDays:3, category:'Policy & Fiscal', why:'If ONGC/NTPC, restructuring bullish; immediate repricing' },
  { from:'GST rate change (reduction)', to:'Pharma', sign:1, lagDays:5, category:'Policy & Fiscal', why:'Affordability spike; demand lift; repricing after 1 week' },
  { from:'GST rate change (increase)', to:'Real Estate', sign:-1, lagDays:7, category:'Policy & Fiscal', why:'Affordability hit; demand destruction; 1-week lag' },

  // Environmental & Agricultural
  { from:'Monsoon adequate-to-surplus', to:'Metals & Mining', sign:1, lagDays:90, category:'Environmental & Agricultural', why:'Strong kharif harvest → rural purchasing power → demand for vehicles, equipment, housing; 3-month lag' },
  { from:'Monsoon adequate', to:'Pharma', sign:1, lagDays:60, category:'Environmental & Agricultural', why:'Rural health spending picks up (agricultural prosperity); demand uplift after 2 months' },
  { from:'Monsoon adequate', to:'Banks', sign:1, lagDays:90, category:'Environmental & Agricultural', why:'Agricultural credit demand rises; deposit inflows from farm prosperity; 3-month lag' },
  { from:'Monsoon failure', to:'Energy (Renewables)', sign:1, lagDays:45, category:'Environmental & Agricultural', why:'Irrigation deficits incentivize renewable capex; also hydropower output collapses (headroom for thermal/renewable capacity); 1.5-month lag in policy pivot' },
  { from:'El Niño warning', to:'Monsoon', sign:-1, lagDays:60, category:'Environmental & Agricultural', why:'El Niño → monsoon failure risk (La Niña would be opposite); 2-month lead signal' },
  { from:'El Niño', to:'Metals & Mining', sign:-1, lagDays:120, category:'Environmental & Agricultural', why:'Via monsoon failure; 4-month lag' },
  { from:'El Niño', to:'Pharma', sign:1, lagDays:90, category:'Environmental & Agricultural', why:'Dry summers → anti-malarial/dengue/heat-related med demand; 3-month lag' },
  { from:'Cyclone in coastal region', to:'Shipping/Logistics', sign:-1, lagDays:5, category:'Environmental & Agricultural', why:'Port disruptions; shipping delays; repricing within week' },
  { from:'Cyclone in crop region', to:'Pharma', sign:-1, lagDays:30, category:'Environmental & Agricultural', why:'If flooding causes seed/fertilizer losses, agricultural income falls → rural health spending drops; 1-month lag' },

  // Cross-Sector Demand & Supply
  { from:'Infra capex momentum', to:'Metals & Mining', sign:1, lagDays:30, category:'Cross-Sector Demand & Supply', why:'Steel consumption; cement demand; mining activity; 1-month lag in order books' },
  { from:'Infra capex momentum', to:'Semis', sign:1, lagDays:45, category:'Cross-Sector Demand & Supply', why:'Signalling/telecom capex; power-distribution capex; 1.5-month lag in end-demand' },
  { from:'Infra capex momentum', to:'Paints', sign:1, lagDays:30, category:'Cross-Sector Demand & Supply', why:'Building/coating demand; 1-month lag' },
  { from:'Defence procurement surge', to:'Metals & Mining', sign:1, lagDays:60, category:'Cross-Sector Demand & Supply', why:'Supply chain ramp (steel, rare earths for avionics, armour); 2-month lag in production' },
  { from:'Defence procurement surge', to:'Semis', sign:1, lagDays:90, category:'Cross-Sector Demand & Supply', why:'Electronics, radar, avionics capex; 3-month lag' },
  { from:'EV adoption wave', to:'Semis', sign:1, lagDays:60, category:'Cross-Sector Demand & Supply', why:'Chip demand for EV powertrains, battery management, infotainment; 2-month lag in foundry capacity' },
  { from:'EV adoption wave', to:'Energy', sign:-1, lagDays:30, category:'Cross-Sector Demand & Supply', why:'Petrol demand destruction; crude import deflation; repricing within 1 month' },
  { from:'EV adoption wave', to:'Metals & Mining', sign:1, lagDays:45, category:'Cross-Sector Demand & Supply', why:'Lithium, cobalt, rare-earth demand; 1.5-month lag in new mining projects' },

  // Financial Market Sentiment
  { from:'VIX spike', to:'Banks', sign:-1, lagDays:1, category:'Financial Market Sentiment', why:'Capital preservation mode; credit demand freezes; FII outflows; immediate repricing' },
  { from:'VIX spike', to:'Gold', sign:1, lagDays:1, category:'Financial Market Sentiment', why:'Safe-haven demand; immediate repricing' },
  { from:'FII inflows (broad EM rotation)', to:'IT & AI', sign:1, lagDays:3, category:'Financial Market Sentiment', why:'Sector beneficiary of India-as-growth narrative; 3-day repricing lag' },
  { from:'FII inflows', to:'Infra', sign:1, lagDays:7, category:'Financial Market Sentiment', why:'Development story; 1-week repricing lag' },
  { from:'FII outflows (EM de-risking)', to:'Pharma', sign:-1, lagDays:5, category:'Financial Market Sentiment', why:'Defensive positioning (but pharma often seen as defensive — mixed signal; using − as average); 1-week lag' }
];
