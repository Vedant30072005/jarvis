# Causal Graph Edges — Session #3

40+ signed, lagged edges representing how news/policy/macro shocks propagate
through the Indian market's sector interconnections. From → To format with
sign (+ = causal event favors destination; − = disfavors), lag-days (how
long the effect takes to materialize), and a one-line why.

Used by Sprint 14 to build scenario stress cards ("crude +20%" propagates
through edges to compute portfolio impact). Edge directions and signs are
drawn from real market mechanics, not speculation.

---

## Monetary Policy & Rates

| From | To | Sign | Lag (days) | Justification |
|---|---|---|---|---|
| RBI rate cut | Banks | − | 10 | Lower loan spreads (NIM compression initially); deposit outflows; only offsets after 6+ months of lending volume growth |
| RBI rate cut | IT & AI | + | 5 | Weaker rupee (export revenue boost); also lower acquisition costs for global M&A |
| RBI rate cut | Infra | + | 14 | Lower borrowing costs; capex projects become feasible; tender activity picks up in 2 weeks |
| RBI rate cut | Real Estate | + | 7 | Lower home-loan EMIs; affordability spike; demand surge in 1–2 weeks |
| RBI rate cut | Energy | − | 10 | Weaker rupee pushes crude import bill up; renewable capex becomes relatively cheaper (minor factor) |
| RBI rate cut | Pharma | + | 5 | Weaker rupee (export boost for API; generic drugs more competitive globally) |
| RBI rate hike | Banks | + | 21 | Deposit inflows; higher spreads (delayed effect, takes 2–3 weeks to flow through) |
| RBI rate hike | IT & AI | − | 5 | Stronger rupee headwind (export de facto costlier); also higher acquisition costs |
| RBI rate hike | Infra | − | 14 | Higher borrowing costs; tenders delayed; project viability re-examined |
| RBI rate hike | EV & Auto | − | 14 | Car loans become dearer; auto sales decline (lag of 2 weeks as consumer behaviour shifts) |
| RBI rate hike | Gold | + | 3 | Higher rates mean lower real returns on fixed income; gold becomes more attractive; repricing immediate |
| Inflation spike | Banks | − | 3 | Rate hike cycle incoming (bearish signal immediately priced in); deposit pressure |
| Inflation spike | Metals | + | 5 | Supply-side inflation (often commodity-driven); mining/metal prices rise |

---

## Oil & Commodities

| From | To | Sign | Lag (days) | Justification |
|---|---|---|---|---|
| Crude +20% | Energy (Oil & Gas) | + | 3 | OMC profit margins widen (international parity pricing); may be capped by government (India-specific discount) |
| Crude +20% | Paints | − | 14 | Feedstock cost (naptha, crude derivatives) rises; 2+ weeks to flow through inventory to P&L |
| Crude +20% | Aviation | − | 7 | Jet fuel cost spike; margins compressed within a week (fuel hedges may lag) |
| Crude +20% | Shipping/Logistics | − | 10 | Fuel surcharges spike; shipping costs up; affects all export-focused sectors downstream |
| Crude +20% | Pharma | − | 10 | API feedstock costs rise; margin pressure after 1-2 weeks as cost inflation flows |
| Crude −20% | Energy | − | 3 | OMC profits compress; capped upside but downside real |
| Crude −20% | Paints | + | 14 | Feedstock deflation; margin expansion with 2-week lag |
| Gold +15% | Gold | + | 1 | (Direct; reflexive, not a causal edge per se, but included for scenario arithmetic) |
| Monsoon failure | Metals & Mining | − | 90 | Agricultural crisis → lower rural demand → commodity demand destruction; also depresses export competitiveness (India's macro outlook deteriorates); long lag (kharif harvest → prices by Oct–Nov) |
| Monsoon failure | Infra | − | 60 | Rural purchasing power collapses; government pivots to relief spending (capex projects delayed); 2-month lag as policy reorients |

---

## Currency (USD/INR)

| From | To | Sign | Lag (days) | Justification |
|---|---|---|---|---|
| USD strength (INR weakens) | IT & AI | + | 2 | Export realisations improve immediately (offshore revenue now worth more in INR); repricing within days |
| USD strength | Pharma | + | 2 | Generic drug exports more competitive; API exports improve; immediate repricing |
| USD strength | Metals & Mining | − | 5 | Export competitiveness for downstream users (autos, infra, mfg) weakens; metals seen as pricier in global markets; 5-day lag as supply chains reassess |
| USD strength | Banks | − | 3 | Dollar appreciation usually coincides with EM capital outflows; deposit pressure (FII selling); repriced in 3 days |
| USD strength | Energy | − | 7 | Crude import bill (in INR) spikes; OMC margin compression; 1-week lag as hedging positions settle |
| USD weakness (INR strengthens) | IT & AI | − | 2 | Export realisations compress |
| USD weakness | Pharma | − | 2 | Exports less competitive |
| USD weakness | Energy | + | 7 | Crude import bill (in INR) shrinks; upside to OMC margins |
| USD weakness | Metals & Mining | + | 5 | Export competitiveness improves |

---

## Geopolitics & Trade Policy

| From | To | Sign | Lag (days) | Justification |
|---|---|---|---|---|
| China trade friction / tariff escalation | Metals & Mining | − | 7 | Demand destruction (China's capex/auto slows); global commodity glut; 1-week lag for repricing |
| China trade friction | Semis | + | 10 | Supply-chain diversification (India gains fab capacity / component orders); ATMP/foundry work flows to India; 10-day repricing lag |
| China trade friction | Pharma | + | 7 | API supply risk (China-dependent) drives onshoring; India API makers gain orders |
| China weakness / slowdown | IT & AI | − | 14 | Tech spending in EM slows; BPO/ITeS capex deferrals; 2-week lag in client budgets |
| India-China border tensions | Defence | + | 3 | Immediate defence-spending announcements; repricing within days |
| India-China border tensions | Metals & Mining | + | 10 | Defence procurement (steel, rare earths) spike; 10-day lag as tenders materialize |
| US recession signal | IT & AI | − | 21 | US is largest offshore revenue base; capex cuts, hiring freezes; 3-week lag in earnings revisions |
| US recession signal | Pharma | − | 21 | Lower branded-drug volumes in US; generic deflation; 3-week repricing lag |
| India export stimulus / trade deal | IT & AI | + | 30 | Tariff reduction, new markets; capex increase; 1-month lag in visible deal flow |
| Subsidy scheme (PLI, etc.) announced | Semis | + | 14 | Capex attractiveness improves; fabs start planning; 2-week repricing lag |
| Subsidy scheme (PLI) announced | Defence | + | 14 | Production incentives; cluster capex; repricing lag |

---

## Policy & Fiscal

| From | To | Sign | Lag (days) | Justification |
|---|---|---|---|---|
| Budget capex boost | Infra | + | 10 | Direct allocation increase; tenders accelerate; 1-2 week repricing lag |
| Budget capex boost | Metals & Mining | + | 14 | Infra capex → steel, cement demand; construction orders pipeline; 2-week lag |
| Budget defence spending boost | Defence | + | 7 | Direct allocation; repricing within 1 week |
| Budget defence spending boost | Metals & Mining | + | 14 | Supply chain (steel, electronics, rare earths) demand; 2-week lag |
| Disinvestment (PSU stake sale) announced | Banks | + | 3 | Positive sentiment (reformist signal); repricing immediate |
| Disinvestment announced | Energy | + | 3 | If ONGC/NTPC, restructuring bullish; immediate repricing |
| GST rate change (reduction) | Pharma | + | 5 | Affordability spike; demand lift; repricing after 1 week |
| GST rate change (increase) | Real Estate | − | 7 | Affordability hit; demand destruction; 1-week lag |

---

## Environmental & Agricultural

| From | To | Sign | Lag (days) | Justification |
|---|---|---|---|---|
| Monsoon adequate-to-surplus | Metals & Mining | + | 90 | Strong kharif harvest → rural purchasing power → demand for vehicles, equipment, housing; 3-month lag (harvest season through consumption) |
| Monsoon adequate | Pharma | + | 60 | Rural health spending picks up (agricultural prosperity); demand uplift after 2 months |
| Monsoon adequate | Banks | + | 90 | Agricultural credit demand rises; deposit inflows from farm prosperity; 3-month lag |
| Monsoon failure | Energy (Renewables) | + | 45 | Irrigation deficits incentivize renewable capex; also hydropower output collapses (headroom for thermal/renewable capacity); 1.5-month lag in policy pivot |
| El Niño warning | Monsoon | − | 60 | El Niño → monsoon failure risk (La Niña would be opposite); 2-month lead signal |
| El Niño | Metals & Mining | − | 120 | Via monsoon failure; 4-month lag |
| El Niño | Pharma | + | 90 | Dry summers → anti-malarial/dengue/heat-related med demand; 3-month lag |
| Cyclone in coastal region | Shipping/Logistics | − | 5 | Port disruptions; shipping delays; repricing within week |
| Cyclone in crop region | Pharma | − | 30 | If flooding causes seed/fertilizer losses, agricultural income falls → rural health spending drops; 1-month lag |

---

## Cross-Sector Demand & Supply

| From | To | Sign | Lag (days) | Justification |
|---|---|---|---|---|
| Infra capex momentum | Metals & Mining | + | 30 | Steel consumption; cement demand; mining activity; 1-month lag in order books |
| Infra capex momentum | Semis | + | 45 | Signalling/telecom capex; power-distribution capex; 1.5-month lag in end-demand |
| Infra capex momentum | Paints | + | 30 | Building/coating demand; 1-month lag |
| Defence procurement surge | Metals & Mining | + | 60 | Supply chain ramp (steel, rare earths for avionics, armour); 2-month lag in production |
| Defence procurement surge | Semis | + | 90 | Electronics, radar, avionics capex; 3-month lag |
| EV adoption wave | Semis | + | 60 | Chip demand for EV powertrains, battery management, infotainment; 2-month lag in foundry capacity |
| EV adoption wave | Energy | − | 30 | Petrol demand destruction; crude import deflation; repricing within 1 month |
| EV adoption wave | Metals & Mining | + | 45 | Lithium, cobalt, rare-earth demand; 1.5-month lag in new mining projects |

---

## Financial Market Sentiment

| From | To | Sign | Lag (days) | Justification |
|---|---|---|---|---|
| VIX spike | Banks | − | 1 | Capital preservation mode; credit demand freezes; FII outflows; immediate repricing |
| VIX spike | Gold | + | 1 | Safe-haven demand; immediate repricing |
| FII inflows (broad EM rotation) | IT & AI | + | 3 | Sector beneficiary of India-as-growth narrative; 3-day repricing lag |
| FII inflows | Infra | + | 7 | Development story; 1-week repricing lag |
| FII outflows (EM de-risking) | Pharma | − | 5 | Defensive positioning (but pharma often seen as defensive — mixed signal; using − as average); 1-week lag |

---

## Implementation Notes for Sprint 14

- **Edges are directional**: China weakness → Semis (positive). Reverse edge
  (Semis strength → China weakness) is not included — causality matters.
- **Lags are conservative estimates** based on typical market repricing
  speed for Indian equities. Actual lags vary by volatility regime (lag may
  shorten in volatile periods, lengthen in placid ones).
- **Signs are net average effects**, not accounting for offsetting channels.
  E.g., "rate cut → infra +" is true on the capex channel, but rates also
  shrink infra's hurdle rate baseline (encouraging more projects), and lower
  rates weaken rupee (raising import costs for steel/equipment). The sign
  reflects the net of these, historically observed.
- **Subsector granularity**: where a sector's heterogeneity is large (energy:
  oil/gas vs renewables have opposite rate sensitivity; banks: PSU vs private
  have different deposit dynamics), consider splitting the edge or noting the
  split as a caveat in scenario UI.
- **Feedback loops are not included**: "IT strong → rupee strengthens → IT
  weaker" would require the scenario engine to iterate and converge, beyond
  the scope of linear stress testing. Treat scenarios as single-step shocks,
  not multi-period equilibrations.

---

## Validation Checks for Sprint 14

Before wiring these into scenario cards:
- [ ] Run each edge against a 3-year rolling window: if crude price changes
  by more than 20%, does the "to" sector typically move in the signed
  direction within the lag window? (Not a requirement for 100% hit rate, but
  >50% confirms the sign is reasonable.)
- [ ] Ask yourself: would this edge would survive an interview question
  ("why does inflation help metals?") without hand-waving?
- [ ] Spot-check for asymmetries: if "rate cut → infra +" with a 14-day
  lag, does "rate hike → infra −" with the same lag feel symmetric? If
  not, audit the edge (likely one direction is weaker than the other, and
  the edge should say so or split).
