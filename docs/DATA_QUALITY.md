# Data quality: what's verified, what isn't, and why

This project exists because the user of this repo found no accurate,
current, machine-readable dataset of Uganda's administrative units below
district level. Producing one honestly means being explicit about the
ceiling of what free sources currently allow, rather than filling gaps with
plausible-sounding guesses. This document was written 2026-07-09 and
substantially revised the same day once the EC's own village-level gazetteer
was located and validated — see the second entry under "Confirmed" below.
Revised again 2026-10-17 for the boundary layers, twice in one day: first
around OCHA's COD-AB (which exposed the old geoBoundaries district layer as
wrong and the old "parish" layer as subcounty-tier), then — superseding
that — around UBOS's own current polygons, built bottom-up from parishes
under the territorial rule below. Every level from parish to region now
has polygons; COD-AB is kept for its P-codes only. See "Boundary polygons"
below. Later the same day: UBOS's parish polygons turned out not to be one
clean topology, so each district's parishes are now cleaned into an exact
tessellation before anything is built from them; refugee-settlement land
is split between its host subcounties instead of being left as gaps; a
sub-region layer, 2024 population below district, and a cross-dataset
boundary-agreement check were added. Update this document whenever the
ceiling moves again.

## Territorial rule

The boundary layers rest on one standing rule, set by this project's owner.
Every decision in the boundary build follows from it, so it's stated here
first:

1. **No new land is ever created.** The country's outline and the outer
   boundaries of the regions and districts are fixed. Every level tiles its
   parent completely — no overlaps, no holes.
2. **A new unit is always carved out of existing ones.** A new district,
   county, subcounty or town council is made from units that already
   exist: a new subcounty is a regrouping of the parishes of the old
   subcounty (or subcounties), a new parish a regrouping of villages.
   Creating a unit is renaming plus regrouping — never new territory.
3. **An unmapped area inside a mapped parent *is* the missing unit(s).** Its
   boundary already exists, as the gap between its documented neighbours.
   Fill it by inference or by finding data; never treat it as "no land".

Why this matters in practice: Uganda creates units constantly, and every
boundary source is a snapshot of a slightly different moment. Without the
rule, each mismatch between a source and the EC's July 2022 tree looks like
a missing polygon, and the honest-sounding response — leave it blank — is
actually wrong, because the land is certainly *somebody's*. With the rule,
each mismatch becomes a question with a bounded answer: a UBOS subcounty
the EC doesn't list was carved from the EC subcounties its parishes came
from; leftover land inside a subcounty with exactly one unmapped parish
*is* that parish; and where the evidence allows more than one answer, the
land is kept as an explicit gap listing the candidates, not dropped and not
guessed. One case sits between those two: land that certainly belongs to
*several* neighbours that already have land of their own — a refugee
settlement inside its host subcounties, or a sliver the sources left
between parishes — with nothing recording where the line runs. There the
build splits it along equidistant lines (each point to whichever neighbour
is nearest), the least-assumption division, and says so (`inferred`, and
the settlement outlines are kept). A gap whose candidates have *no* land
yet — 2+ unmapped parishes — has nothing to measure distance from, so it
stays a gap. How each of these is applied, and how often, is under
"Boundary polygons" below.

### Assumptions at a glance

Every judgement call the boundary build (0.10.0) and the map make, in one
list. Each is explained, with counts, in the section it links to; change
one and that section's figures change with it.

**Sources**

- **Unit identity comes from the EC 2022 gazetteer; geometry from UBOS.**
  Parish polygons are UBOS BEC 2025, subcounty/district checks UBOS NPHC
  2024. Every other level (subcounty, county, city, district, sub-region,
  region) is the union of its parishes, so the levels nest exactly by
  construction. → "Boundary polygons".
- **OCHA COD-AB is used for P-codes only**, never geometry: it is the
  2018–2020 system. Its "admin4" is the subcounty level, not the parish.
  Two P-codes on the Masindi–Kiryandongo line (Bujenje, Pakanyi) are
  withheld because the two sources put them in different districts. →
  "OCHA COD-AB".
- **geoBoundaries supplies the coastline/land mask only.** Its district
  polygons are wrong (Kampala 351 km² against the official ~179 km²).
- **MWE WEIS GeoServer is not a source.** Its terms forbid automated
  access. → "Sources evaluated and rejected".

**Fixing the geometry**

- **Water:** parish polygons are clipped to land = geoBoundaries land
  minus Natural Earth 10m lakes buffered 3 km. A parish the mask would
  erase completely is kept whole and flagged `includes_water` (an island,
  or a lakeshore parish the coarse mask misreads), never dropped.
- **Overlaps and slivers between sources:** under 100 m² is float noise
  and ignored; up to 2 ha goes whole to the nearest neighbour; 2 ha–5 km²
  is split between the touching neighbours along equidistant lines;
  **over 5 km² is never assigned automatically** — it stays a published
  gap (`gaps.geojson`, kind `unassigned_chunk`) listing its candidates.
- **Inference:** where exactly one unit inside a mapped parent has no
  polygon, the parent's leftover land *is* that unit (`inferred: true`,
  drawn dashed on the map). Two or more unmapped units → a gap, not a
  guess.
- **Refugee settlements** are split equidistantly among their host
  subcounties in the same district; the settlement outlines are kept
  separately (`settlements.geojson`) and are informational, not units.
- **Simplification** is topological (shared edges simplified once, so
  neighbours can't drift apart), coordinates rounded to 5 decimal places
  (~1 m).

**Population and agreement**

- **Subcounty population** is UBOS NPHC 2024 by UBOS code. Settlement and
  camp rows are left out, so they aren't counted twice, and `#N/A` values
  are skipped rather than read as zero. County population is the sum of
  its subcounties, flagged `partial` if any are missing.
- **Boundary agreement** is IoU against UBOS NPHC 2024, measured only over
  the unit's own district's land. Under 0.8 → `flag: review` (7
  subcounties, all settlement hosts). The COD-AB IoU is shown but never
  flags anything, because a low value there mostly means the unit has been
  redrawn since 2020.

**Known holes, left visible rather than papered over**

- `subcounty:kampala-makerere-university` has no polygon. It is a
  separate unit in the EC gazetteer, but UBOS has its land inside Kawempe
  Division, so there is nothing to draw it from.
- Lubya parish (Buvuma, UBOS `12010603`) lost all its area while the
  overlaps were cleaned and has no polygon.
- 83 parishes have no polygon; 23 gaps of land couldn't be given to a
  single unit.

**The owner's worked examples, as built**

- **Nakasongola:** all 15 subcounties/town councils have polygons,
  including the ones the earlier layers missed: Nabiswera, Mayirikiti TC,
  Katuugo TC and Kazwama TC. They come from UBOS's own parishes, not from
  inference; 2 of the district's 68 parishes are inferred.
- **Terego** (split from Arua): all 7 subcounties have polygons; 1 of 42
  parishes is inferred.
- **Soroti:** all 12 subcounties and 54 parishes have polygons, none
  inferred — the "empty middle" in the old layer is filled.

**Map display** (web app only; nothing here changes the data)

- Satellite imagery is Esri World Imagery through a server-side proxy
  (the `ESRI_API_KEY` licence key stays on the server). Imagery is display
  only: no Esri pixels go into `dist/` or the CC BY dataset.
- Colour fill defaults to 20% and **fades out as you zoom in** (parish
  level: gone by z15), so imagery and streets are what you see up close.
  Boundary lines stay at every zoom, and the fill can be switched off
  (`fill=0`).
- In hierarchy mode, each level's lines have their own colour from a
  colour-blind-checked palette: region, sub-region, district, county,
  subcounty, parish. Villages have no polygons, so they are listed for a
  clicked point instead of drawn.

## Confirmed (`confidence: verified`)

**136 districts, including Kampala and Terego** — cross-checked against
three independent sources that all agree at the 135 level: [Statoids](https://www.statoids.org/en/ug/admin-levels/l2/list/uganda/districts)
(states "last updated April 2026"), [Wikipedia: Districts of Uganda](https://en.wikipedia.org/wiki/Districts_of_Uganda),
and an official-style enumerated list hosted at
[ugandatrades.go.ug](https://ugandatrades.go.ug/media/List%20of%20Local%20Governments%20in%20Uganda.pdf).
**All three of these sources turned out to share the same gap: Terego
District (split from Arua, effective 2020-07-01) is missing from all of
them.** This was only caught by cross-referencing the EC's own June 2022
"Summary of Administrative Units After Verification" statistics (see below),
which lists 146 district-equivalent units (136 districts + 10 cities) and
whose internal totals sum exactly to its own stated national totals. 136 is
now the trusted district count; 135-from-three-agreeing-sources turned out
to be three sources agreeing on the same stale number, not independent
confirmation — a useful reminder that source *count* isn't the same as
source *independence* when they may share a common root.

**10 second-generation cities** (Arua, Fort Portal, Gulu, Hoima, Jinja, Lira,
Masaka, Mbale, Mbarara, Soroti), each a distinct local-government unit
carved out of a municipality in 2020, coexisting with (not replacing) their
parent district.

**17 cultural/traditional sub-regions** (`data/subregions.csv`, `subregion_id`
on every district/city and everything beneath them) — Uganda's 4
administrative regions (Central/Eastern/Northern/Western) group districts by
government convenience, not by shared history or culture; several distinct
peoples sit inside the same administrative region (e.g. Busoga, Bukedi,
Bugisu, Sebei, and Teso are all "Eastern"). `subregion_id` is a second,
parallel classification for that — the taxonomy UBOS itself uses for census
reporting: Acholi, Ankole, Buganda, Bugisu, Bukedi, Bunyoro, Busoga, Kampala,
Karamoja, Kigezi, Lango, Madi, Rwenzori, Sebei, Teso, Tooro, West Nile. All
136 districts (plus Kampala and all 10 cities) were placed by finding each
one named explicitly in a Wikipedia sub-region article or citypopulation.de's
independent administrative breakdown, cross-checked against each other — see
`data/sources.json` → `src-ubos-subregions-2024` and
`src-subregion-district-mapping-2026`. Three of the 17 (Madi, Rwenzori,
Sebei) are UBOS-specific 2024-census splits from broader groupings
(West Nile, Tooro, Bugisu respectively) that older sources still lump
together — don't be surprised if you see e.g. "Bugisu" used elsewhere to
include Sebei districts. **Caveat, in keeping with this document's honesty
policy:** every direct fetch attempt against ubos.org/statistics.ubos.org hit
a TLS certificate error, so the UBOS attribution rests on search-engine-
mediated corroboration of UBOS's report titles/PDFs, not a primary-document
fetch — strong enough to mark `confidence: verified` on the same 2+-
independent-secondary-source basis this project already uses for
`region_id`, but weaker than the EC gazetteer's doubly-validated primary
source. Also note this classification is inherently coarser than
administrative boundaries: sub-region membership reflects a historical/
cultural majority for the district as a whole, not a claim that every
resident identifies with it.

**Subcounty/town council/division → parish/ward → village/cell for all 146
district-equivalent units** — sourced from the EC's "Verified Administrative
Units, July 2022," a 3,019-page gazetteer linked from
[ec.or.ug/admin-units](https://ec.or.ug/admin-units) (direct fetches
returned HTTP 403 for the harness's WebFetch tool; a plain browser-UA
request succeeded). Extracting this required a coordinate-aware parser
(plain text extraction destroys the nested table structure — see
`data/legacy/provenance/ec/README.md` for the full story of how that was
discovered and debugged) and was validated two independent ways: every one
of the ~2,198 "TOTAL VILLAGES IN X" checksums the source document prints
matches the parser's count, and fully re-aggregated per-district totals
match the EC's own companion summary-statistics PDF exactly, for all 146
districts/cities × 4 fields (584 checks, zero discrepancies). National
totals: 353 constituencies, 2,191 subcounties/towns/divisions, 10,717
parishes/wards, 71,230 villages. **This is dated July 2022** — it does not
reflect any 2023-2026 changes.

A widely-repeated "146 districts" figure appears in several 2026 news
searches, referring to *districts* specifically (not district-equivalents).
That specific claim could not be traced to a primary source and looks like
it conflates districts with cities, or anticipates units that are approved
but not yet operational — **136 remains the trusted district-only count**;
146 is correct only as "districts + cities."

**County, for 135 of 136 rural districts (322 counties nationally)** —
reconstructed from the EC gazetteer above rather than the stale 2015 legacy
list. The gazetteer's own tier between district and subcounty is labeled
"constituency" (353 nationally, vs. 312 traditional counties), not "county."
Outside city/Kampala divisions, a constituency's name in this document *is*
the county name, not a separate electoral-only label (e.g. "Bugahya County,"
"Buyanja County") — confirmed two ways: (1) of 2,165 non-city subcounties,
2,164 carry exactly one constituency, meaning there's essentially no
ambiguity to resolve for the rural case; (2) spot-checked against
independent research across 13 districts (UBOS NPHC drilldowns, Wikipedia
district pages — see `data/sources.json` →
`src-county-constituency-crosscheck-2026`) and matched exactly in 11 cases,
with the other 2 (Nakapiripirit, Kikuube) showing this data has one
additional constituency split the independent sources didn't mention
(Chekwii → Chekwii + Chekwii East; Buhaguzi → Buhaguzi + Buhaguzi East) — a
refinement, not a contradiction. One prior flag in this document was wrong
and has been retracted: "Ik County" under Kaabong, earlier called a likely
Wikipedia error, is confirmed real by this independent EC data.

Two structural exceptions, both handled explicitly rather than forced into
the general rule:
- **City/Kampala divisions have no county tier at all** — a Division sits
  directly under its City/KCCA per the Local Governments Act, and some
  divisions are listed under two constituencies purely for parliamentary
  seat allocation (e.g. "Kawempe Division" under both "Kawempe Division
  North" and "South") without being two administrative divisions. Forcing
  constituency into the tree here would require one division to have two
  parents, so it doesn't happen — the constituency name(s) are kept as
  `external_refs.ec_constituencies` metadata on the division instead.
- **Katikamu subcounty (Luwero)** is the one non-city exception to the
  clean 1-subcounty-to-1-constituency rule — it's split across "Katikamu
  County North"/"South" the same way a city division would be. Rather than
  fabricate a merged "Katikamu County" name the source doesn't actually use,
  it's left parented directly to Luwero District with a note
  (`dist/data-quality-report.json` → `subcounties_without_a_matched_county`).
  This is also why Kampala shows up in `districts_missing_counties` even
  though that's expected/by-design, not a gap — the report doesn't currently
  distinguish "structurally has no county tier" from "actually missing
  data," which is worth tightening if it causes confusion.

**Country-level metadata** (`data/country/uganda.json`) — ISO 3166 codes,
currency (UGX), calling code (+256), capital, region/subregion, official
languages, TLD, timezone, driving side, demonym, motto, independence date,
area, and bordering countries. Sourced from
[mledoze/countries](https://github.com/mledoze/countries) (a widely-used,
MIT-licensed, community-maintained dataset — downloaded and parsed with a
script rather than trusted via a truncated summarizer pass, since the raw
file is ~1.4MB) and cross-checked for timezone/driving-side specifically
against several independent current sources. These are long-stable,
low-ambiguity facts (ISO codes and calling codes essentially never change
retroactively), so the verification bar here is lower-effort than the
administrative-unit data but the same discipline applies: nothing pulled
from memory without a citable source.

**Flag and coat of arms** (`data/country/assets/`) — downloaded from
Wikimedia Commons and **visually verified** (not just trusted by filename)
before use: the flag's black/yellow/red bands and grey crowned crane, and
the coat of arms' kob antelope and crested crane supporters with the "FOR
GOD AND MY COUNTRY" motto banner, both checked against the rendered image.
Licensing differs between the two files — see `LICENSE-DATA.md` before
reusing either: the flag is public domain (with an independent
insignia-use caveat), the coat of arms is CC BY-SA 3.0 (attribution +
share-alike required), which is stricter than this project's default
CC-BY 4.0 data license.

**Boundary polygons — every level, built bottom-up from UBOS**
(`data/geo/parishs.geojson`, `subcountys.geojson`, `countys.geojson`,
`citys.geojson`, `districts.geojson`, `regions.geojson`,
`subregions.geojson`, `gaps.geojson` and `settlements.geojson`) — for map
visualization. Final state as of 2026-10-17:

| Layer | Polygons | Notes |
|---|---|---|
| Region | 4 / 4 | dissolved from the district layer by `region_id` |
| Sub-region | 17 / 17 | dissolved from the district layer by `subregion_id` (`subregions.geojson`, `subregionBoundaries()`) |
| District | 136 / 136 | each includes any city carved out of it; 215,579 km² of land in total |
| City | 10 / 10 | new layer (`citys.geojson`, `cityBoundaries()`) |
| County / municipality | 322 / 322 | every one complete — all of its subcounties mapped |
| Subcounty / town council / division | 2,190 / 2,191 | 3 inferred; only Makerere University has no polygon |
| Parish / ward | 10,634 / 10,717 (99.2%) | 73 inferred; 14 island parishes include water |
| Unassigned land (`gaps.geojson`) | 23 features, ~722 km² | all parish-level; no subcounty-level gaps |
| Refugee settlements (`settlements.geojson`) | 15 outlines, ~870 km² | informational — their land is split between the host subcounties (inferred) |

The one subcounty-tier unit without a polygon, `subcounty:kampala-makerere-university`,
is a separate unit in the EC gazetteer but not in UBOS's data — its land is
inside UBOS's Kawempe Division — so there is nothing to draw it from.
Exact counts are regenerated every build in `dist/data-quality-report.json`
→ `boundary_coverage`, `boundary_agreement` and `ubos_2024`.

*Sources.* Two UBOS dissemination APIs, both public, both current:
- **UBOS NPHC 2024** (`statistics.ubos.org/nphc/api/get_geospatial_data.php`)
  — district polygons (147 features: the 136 districts plus the 10 cities
  as separate districts, with Kampala split into 2 features) and, one
  district per request, subcounty polygons (2,206 features under 2,205
  codes), each carrying 2024 population. `src-ubos-nphc-2024-geo`.
- **UBOS Baseline Education Census (BEC) 2025**
  (`statistics.ubos.org/bec/api/get_geo.php?level=parish…`) — parish
  polygons, 10,831 features, with school/learner counts. The only current,
  official parish polygons found anywhere. `src-ubos-bec-2025-geo`.

UBOS codes nest by prefix — district 3 digits, county 4 (district + 1),
subcounty 6 (county + 2), parish 8 (subcounty + 2) — so every parish
code's first 6 digits *is* its UBOS subcounty code. That is what makes a
bottom-up build possible: a parish knows its subcounty from its code, with
no geometry test. The snapshots were fetched 2026-10-17 by the
research/observatory session (`scripts/observatory/fetch-public-sources.mjs`
on branch `research/observatory`: 303 files, no failures, one request per
second, URL/size/sha256 per file in its manifest) and copied into this
branch's gitignored `data/legacy/provenance/ubos/`. UBOS data may be
reproduced with citation to UBOS and a link, and processed data must be
labelled as processed — which every layer here is (see `LICENSE-DATA.md`).
The Ministry of Water and Environment's WEIS GeoServer, which has village
polygons, was deliberately *not* used: its terms forbid automated access
without written permission (`src-mwe-weis-geoserver-not-used`).

*How the layer got here* — each step is worth keeping, because each one
looked finished at the time:
- **geoBoundaries (0.7.0–0.9.1).** The original district layer was
  [geoBoundaries](https://www.geoboundaries.org)' Uganda ADM3 release (CC0,
  2020 vintage), chosen because it already included Terego and had the
  simpler license. It matched `data/districts.csv` 136/136 *by name*, and
  that was the only thing checked — nobody had compared the shapes against
  an independent outline. Once UBOS-sourced polygons (OCHA's COD-AB) were
  in hand they were compared district by district, and geoBoundaries
  turned out to be materially wrong for many districts: **only 12 of 135
  districts had an intersection-over-union of 0.9 or better with their
  UBOS counterpart.** Its Kampala was 351 km² against an official
  ~189 km², because it swallowed Kira and Kasangati, both of which are in
  Wakiso; Pader town fell inside Agago; Wakiso came out at 1,747 km². Same
  lesson as the 135-vs-136 district count above: a 136/136 name match says
  nothing about whether the geometry is right. geoBoundaries is now used
  only for its coastline (the land mask, below).
- **OCHA COD-AB (earlier on 2026-10-17, superseded the same day).** COD-AB
  is UBOS's own boundary set as of 2020 (`valid_on: 2020-08-24`), and its
  districts were far better than geoBoundaries'. But below district level
  it is the 2018–2020 system: county polygons could be matched for only
  118 of 322 counties and subcounty polygons for 1,351 of 2,191 — a
  pre-split polygon can't honestly be stretched over its successors (COD-AB
  has "Kashari"; today there are Kashari North and South) — and it has no
  parish level at all. Rather than keep matching 2020 polygons onto a 2022
  tree, the build moved to UBOS's own 2024/2025 polygons, which are newer
  than the EC gazetteer, not older. That build's scripts
  (`ingest-district-boundaries.mjs`, `ingest-subcounty-boundaries.mjs`)
  are deleted; COD-AB is kept for its P-codes (see "OCHA P-code crosswalk"
  below).

*How the current layers are built* (`scripts/ingest-ubos-boundaries.mjs`,
then `scripts/build-region-boundaries.mjs`) — the territorial rule applied
literally, from the bottom up:

1. **Parishes are matched first.** Each UBOS parish polygon is matched to
   an EC (July 2022) parish: same district, same name, with tier words
   ("ward", "town council", "TC", "TOWNCOUNCIL") normalised away. A name
   repeated inside a district is disambiguated by subcounty. A unique
   near-miss spelling (edit distance ≤ 1 for names of 6+ characters, ≤ 2 for
   10+) is accepted only inside the expected subcounty. Result: **10,466
   exact + 98 fuzzy matches; 267 UBOS parishes unmatched.** (The
   crosswalk, `data/crosswalk/ubos-2024.csv`, lists the parish pieces that
   survive to the output: 10,465 exact, 98 fuzzy, 144 unmatched. The 123
   unmatched parishes of the refugee-settlement census units aren't rows
   any more — their land was split between host subcounties, step 7 — and
   one exact match, Lubya parish in Buvuma (UBOS `12010603`), lost all its
   land to its neighbours in the overlap removal of step 3, so
   `parish:buvuma-lubya-town-council-lubya` now has neither a polygon nor a
   `ubos_code`.)
2. **UBOS subcounties are matched to EC subcounty-tier units** by name and
   tier within the district: **2,105 exact, 7 fuzzy, 75 `carved_from`, 18
   unmatched.** `carved_from` are UBOS subcounties created after the EC's
   2022 gazetteer; under rule 2 their land belongs to the EC subcounty most
   of their parishes came from. 15 of the 18 unmatched are refugee-settlement
   census units (below); the other 3 are Iceme, Nyakabungo and Kiryandongo
   Town Councils — where step 6 independently lands its 3 inferred
   subcounties.
3. **Each district's parishes are cleaned into one tessellation**
   (`scripts/lib/tessellate.mjs`, step "4b" of the ingest). UBOS's BEC 2025
   parish polygons were not drawn as one topology. Measured per district,
   they overlap their neighbours by ~0.3–0.4 km² in total (65–99
   overlapping pairs) and leave ~4 km² of gaps against the district outline
   in 1,000–1,800 slivers — Alebtong: 4.25 km² in ~1,854 parts, ~1,258 of
   them under 100 m², but ~420 between 0.01 and 10 ha, the wedges of
   "nobody's land" that show between parishes on a zoomed-in map. (UBOS's
   own NPHC 2024 subcounty layer has similar gaps, ~3.5 km² per district,
   so this isn't one bad API.) Under rule 1 that land is somebody's, so per
   district — the frame being the UBOS district polygon, clipped to land:
   1. every parish is clipped to the frame;
   2. overlaps are removed — contested land goes to the parish earlier in
      UBOS-code order (a fixed, reproducible rule);
   3. gaps are filled: under 100 m² is ignored as float noise; up to 2 ha
      goes whole to the nearest neighbour; 2 ha–5 km² is split between the
      parishes it touches by nearest-neighbour ("equidistant") allocation —
      the chunk is triangulated (earcut, via `turf.tesselate`) and each
      triangle goes to the neighbour whose border vertex is nearest its
      centroid; over 5 km² is **not** auto-assigned but published as a gap
      (`kind: "unassigned_chunk"`) listing the touching units, since a
      chunk that size is more likely an unmapped lake than a sliver.

   A Voronoi-cell version of the split was tried first and abandoned:
   clipping the cells produced near-coincident float edges that sent
   polyclip (turf's clipping engine) into a runaway allocation — 6 GB on
   one Mityana sliver. Coordinates are truncated to 6 decimal places
   (~0.1 m) before clipping, and every clipping operation retries once on
   truncated input and otherwise falls back rather than crashing the
   build — one uncleaned spot beats a crashed run (0 fallbacks in the
   final run). National totals:
   **53.2 km² of overlaps removed, 409.5 km² of gaps filled** (43,157
   slivers to their nearest neighbour, 5,307 equidistant splits), 1 piece
   fully overlapped (Lubya, step 1), 0 chunks over 5 km². Measured on the
   published layers for Alebtong, gaps went from 4.25 km² to 0.067 km²
   (16 parts over 100 m²) and overlaps from 0.36 km² to 0.015 km². The
   small residual comes from the topology simplification in step 10
   (clipping output sometimes has an extra vertex on one side of a shared
   border); a coarser topology grid (quantization 1e5 instead of 1e6) was
   tried and was worse — overlaps doubled — so 1e6 stays (overridable via
   `TOPO_QUANTIZATION`).
4. **Every piece of UBOS land gets an owner** — the EC subcounty-tier unit
   it belongs to — in order of evidence: its matched EC parish's subcounty
   (10,564 pieces); else its UBOS subcounty's name match (84); else the
   carved-from majority (52); else none (131 pieces — 123 of them the
   refugee-settlement units' parishes, split between host subcounties in
   step 7; the rest kept as gaps — never dropped, never guessed).
5. **Every level is the union of the one below.** Subcounty = its owned
   land; county = union of its subcounties; city = all the land in it;
   district = all the land in it, plus any city carved from it; region =
   union of its districts, and sub-region likewise by `subregion_id`. So
   the layers nest exactly, by construction.
6. **Inference (rule 3).** Where a subcounty has exactly one unmatched EC
   parish and owned land left over, that land *is* the parish — 73
   parishes, marked `inferred: true` with an `inference` note. Where a
   district has exactly one subcounty with no land and unowned land
   remains, that land *is* the subcounty — 3 subcounties:
   `kanungu-nyakabungo-town`, `kiryandongo-kiryandongo-town`,
   `oyam-icheme-town-council`.
7. **Refugee settlements are split between their host subcounties.**
   UBOS counts 15 refugee settlements as subcounty-level census units of
   their own — Nakivale (3 units), Kyangwali, Rwamwanja, Kyaka II,
   Palabek, Rhino Camp (in Madi-Okollo and in Terego), Imvepi, Palorinya,
   Lobule, Kiryandongo, and Adjumani's settlements (2 units). The EC and
   local government don't have these as units: the land is administered
   by the host subcounties around it, so under rule 1 it belongs to them.
   No source here records where the lines run inside a settlement, so each
   settlement's land is split between the touching host subcounties of
   the same district by the same equidistant (nearest-neighbour) method as
   step 3 — an inference, not a survey. Each settlement's outline is
   published as an informational layer, `data/geo/settlements.geojson`
   (`id` `settlement:<ubos code>`, `name`, `ubos_code`, `district_id`,
   `host_subcounty_ids`, `note`), so the inference stays visible and the
   settlement can still be drawn. Until this step the settlements were
   shipped as 11 subcounty-level gaps (~869 km²); the outlines total
   ~870 km². Settlement land belongs to its host subcounty but to none of
   that subcounty's parishes: it's excluded from the "leftover land is the
   sole unmapped parish" inference in step 6, and from the "sole unmapped
   subcounty" inference — otherwise a settlement would be painted as
   whichever host subcounty or parish happened to be the only unmapped one.
   This is also why seven host subcounties disagree with UBOS's own
   subcounty polygons (see "Cross-dataset boundary agreement" below).
8. **Land nobody owns goes to `data/geo/gaps.geojson`** — 23 features,
   ~722 km², all parish-level: a subcounty's leftover land where it has 2
   or more unmatched EC parishes, so the land can't be split between them
   (the candidates have no land of their own to measure a split from); the
   parishes are listed as candidates. There are no subcounty-level gaps
   any more. The build would still emit one for a cleaning chunk over
   5 km² (`kind: "unassigned_chunk"`, step 3) or a settlement with no host
   to split it between — neither occurs in the current data.
9. **Water.** UBOS's polygons follow legal boundaries out into the lakes,
   which inflates every per-km² figure. Water = UBOS's country outline minus
   the union of geoBoundaries' ADM3 land (a fine coastline), *intersected
   with* Natural Earth's 10m lakes (public domain, buffered 3 km; the
   Uganda subset is committed at
   `data/legacy/provenance/geo/ne-10m-lakes-uganda.geojson`, from
   nvkelso/natural-earth-vector v5.1.2). The lake intersection is what
   keeps geoBoundaries' errors out: without it, geoBoundaries' wrong
   western border made Bundibugyo's Semliki strip and parts of Kasese
   "water", and 41 parishes vanished. A parish that clipping would erase
   entirely keeps its full legal outline and is flagged
   `includes_water: true` (14 island parishes) — no unit is ever dropped by
   clipping.
10. **One topology, simplified before any union.** All the cleaned pieces
    (from the 10,831 UBOS parish polygons) are simplified together as a
    single TopoJSON topology (`scripts/lib/topo.mjs`: quantization 1e6 — a
    ~0.6 m grid — then Visvalingam, minimum weight 2.5e-6 deg², coordinates
    rounded to 5 decimal places), so each shared border is one arc,
    simplified once and used by both neighbours, and every layer nests
    exactly inside the one above. (The original per-feature `turf.simplify`
    simplified each side of a border independently: hairline gaps between
    neighbours, and ~1,513 slit holes once districts were dissolved into
    regions.) Parts that simplification collapses to zero area are dropped;
    a parish that collapses entirely is left out — 2 islet parishes.
11. **Winding.** Every output feature is rewound for d3-geo's spherical
    convention (exterior rings clockwise in lon/lat) — see the correctness
    note below.
12. **Outputs:** `data/geo/{parishs,subcountys,countys,citys,districts,gaps,settlements}.geojson`,
    `data/crosswalk/ubos-2024.csv` (`level`, `ubos_code`, `ubos_name`,
    `unit_id`, `match`, `note`) and
    `data/population/ubos-nphc-2024-subcounty.csv` (see "Population below
    district" below). The full ingest takes ~10 minutes, mostly the
    cleaning in step 3, and needs `node --max-old-space-size=6000`;
    `UBOS_REUSE_CLEAN=1` reuses the last run's cleaned pieces (a gitignored
    cache, `data/legacy/provenance/ubos/cleaned-pieces.json`) when iterating
    on the later steps — never in a normal run.

Every boundary feature carries `properties.id`, `area_km2` (land area),
`hdx_pcode` (where COD-AB has an exact equivalent) and `ubos_code` (where
UBOS has the same unit under a matching name); district and city features
also carry `population`, and so do subcounty and county features (see
"Population below district" below); subcounty features carry `agreement`
(see "Cross-dataset boundary agreement" below). **12,820 units** carry
`external_refs.ubos_code` — districts and cities, subcounty-tier units,
and parishes — the key for
joining UBOS's own tables (census subcounty and parish profiles, and so
on). Inferred units say so (`inferred`, `inference`), and so do island
parishes (`includes_water`), so a consumer can tell a drawn boundary from a
deduced one.

Region geometry is **not** an independent source: it's dissolved from the
district layer, grouped by `region_id` (`scripts/build-region-boundaries.mjs`;
`@turf/turf` and the `topojson-*` packages are dev-only dependencies, never
shipped in the published package). This guarantees the region shapes can
never drift out of sync with `region_id` as assigned in
`data/districts.csv`, and sidesteps geoBoundaries' own region layer, which
is ODbL-licensed. Measured on the current build: regions total 215,511 km²
against 215,579 km² for the districts, within 0.03%. Kampala comes out at
179 km² of land (geoBoundaries had 351). The 17 **sub-regions** are
dissolved from the same district layer the same way, grouped by
`subregion_id` (`data/geo/subregions.geojson`, 215,530 km² in total), so
they can't drift from `subregion_id` either; `scripts/validate.mjs`
expects exactly 17. **License consequence:** the
boundary layers are processed UBOS data — cite UBOS (see `LICENSE-DATA.md`);
geoBoundaries' CC0 geometry contributes only the coastline and Natural
Earth's public-domain lakes only the lake extents. See `data/sources.json` →
`src-ubos-nphc-2024-geo`, `src-ubos-bec-2025-geo`,
`src-geoboundaries-uga-adm3`, `src-natural-earth-10m-lakes` and
`src-region-boundary-dissolve`, and `data/legacy/provenance/geo/README.md`.

**Cross-dataset boundary agreement** (`scripts/compare-boundaries.mjs` →
`data/qa/boundary-agreement.csv`). A layer built bottom-up from parishes
could drift from what UBOS itself draws for a subcounty without any
structural check noticing, so each published subcounty is compared with
two independent drawings of the same unit: UBOS NPHC 2024's subcounty
polygon for the same UBOS code (`ubos_nphc_iou`) and OCHA COD-AB 2020's
for the same P-code (`hdx_iou`). Both are intersection-over-union,
restricted to the unit's own district land — both sources run into the
lakes and spill a little across district lines, which isn't disagreement
about the unit. A clipping failure leaves the value blank ("couldn't
compare"), never 0, which would read as total disagreement. Results:

| Compared against | Subcounties compared | Median IoU |
|---|---|---|
| UBOS NPHC 2024 (same UBOS code) | 2,110 | 0.991 |
| OCHA COD-AB 2020 (same P-code) | 1,352 | 0.753 |

COD-AB's lower figure is context, not a defect: it's the 2018–2020 system,
and many units have been split or redrawn since. So the review flag
(`flag: review`) uses UBOS NPHC only, at IoU < 0.8 — **7 subcounties**, and
all 7 are refugee-settlement hosts that absorbed settlement land in step 7,
which UBOS's own polygon leaves to the settlement unit: Palorinya (Obongi,
0.546), Nkanja (Kyegegwa, 0.694), Itula (Obongi, 0.696), Bweyale Town
Council (Kiryandongo, 0.730), Kabuye (Kamwenge, 0.741), Kashumba
(Isingiro, 0.773) and Uriama (Terego, 0.794). Expected, then, and the
disagreement is exactly the inferred split. `scripts/build.mjs` copies the
two values onto each subcounty feature as `agreement: { ubos_nphc_iou,
hdx_iou }` and adds a `boundary_agreement` section to
`dist/data-quality-report.json`; the web map colours it as the "Boundary
agreement" metric.

**Post-hoc correctness note (2026-07-22, updated 2026-10-17):** all four
boundary files of the time (district/region/subcounty/parish) were found to
have polygon rings wound in the direction opposite to what d3-geo's
spherical convention expects — structurally valid GeoJSON, and invisible to
every schema and coverage check then in place, but it made every single
feature render as an extra ring tracing the whole map's clip rectangle the
moment anything actually tried to draw these polygons with d3-geo (caught
while building the web UI's interactive map — see the root
`CHANGELOG.md`). Root cause confirmed empirically (not just inferred from
the RFC), fixed at the source via `turf.rewind(feature, { reverse: true })`.
It bit a second time during the 2026-10-17 rebuild: `turf.union` returns
planar-wound rings, d3-geo then reads a polygon as "the globe minus this
polygon", and the web map framed South America. Worth flagging as a general
lesson: passing a schema/coverage check is not the same as being
render-correct — geometry validity and geometry *orientation* are different
properties. This document used to add that the structural validator "does
not and cannot catch the latter"; that is no longer true:
**`scripts/validate.mjs` now fails any boundary feature whose exterior ring
is counter-clockwise**, and every output of the UBOS build and the region
dissolve is rewound before it's written.

**Do not assume completeness** even now — 83 parishes and one subcounty
have no polygon, 23 areas are explicitly unassigned, and the 15 refugee
settlements' land is divided between host subcounties by inference, not
by any source. Check `properties.id` against your own unit list, and draw
`gaps.geojson` (and `settlements.geojson`, if it matters where the
settlements are) when a map needs to show the whole country honestly.

**The retracted COD-AB "parish" layer (history, 2026-10-17).** Releases
0.9.0–0.9.1 shipped `data/geo/parishs.geojson` with 423 "parish" polygons
(reported as 3.95% coverage), built from HDX COD-AB's admin4 layer. **That
was wrong: COD-AB's "admin4" is subcounty-tier, not parish-level.** This
document previously said it had been "confirmed directly from its own
attributes (`adm2_name`=district, `adm4_name`=parish) that this one really
is parish-level" — that confirmation was mistaken. Nothing in the
attributes says "parish": the fields are just `adm1_name`…`adm4_name`, and
reading level 4 as parish (and `adm3_name` as subcounty) was off by one
tier — `adm3_name` is the *county* (the first raw record is
`adm3_name: "Moroto"`, Alebtong's Moroto County; `adm4_name: "Abako"`, a
subcounty in it). What the units actually were was never checked. The
evidence it isn't parish-level:
- it contains **Kampala's five divisions** (Central, Kawempe, Makindye,
  Nakawa, Rubaga Division, codes `UG10080101`–`05`) — divisions are
  subcounty-tier;
- its P-codes are 8-digit, subcounty-shaped codes nested under 6-digit
  county codes;
- COD-AB Uganda only has ADM0–ADM4: country, 4 regions, 135 districts, 203
  counties, 1,520 subcounties. There is no parish or village level in it
  at all. The "1,520 features" that looked like a coincidence with
  geoBoundaries' 1,521-feature subcounty layer was not a coincidence — they
  are the same tier.

So the 423 "matches" were subcounty polygons attached to parishes that
happen to share their subcounty's name (e.g. `parish:alebtong-abia-abia`
got the outline of the whole of Abia subcounty). They were withdrawn,
`scripts/ingest-parish-boundaries.mjs` was deleted, and for part of
2026-10-17 `parishs.geojson` was an empty FeatureCollection. It now holds
**real parish polygons from UBOS's BEC 2025** (above), and nothing from the
retracted layer. The source entry `src-hdx-cod-ab-uga-admin4-parish` is
kept (so old references resolve) but marked retracted.

**OCHA P-code crosswalk** (`data/crosswalk/hdx-cod-ab-uga.csv`, shipped as
`dist/crosswalk/hdx-cod-ab-uga.csv`) — the reason COD-AB is still here.
Humanitarian and development datasets for Uganda are keyed by COD-AB
P-codes, so `scripts/ingest-hdx-cod-ab.mjs` writes one row per COD-AB unit
(`hdx_level`, `hdx_pcode`, `hdx_name`, `hdx_parent_pcode`, `unit_id`,
`match`, `note`). **COD-AB is used for its P-codes only** — none of its
geometry is published. Matching is by name, never geometry, and always
scoped to a district *family* — the district itself, any city carved out
of it, and any district split from it since — because COD-AB is the
2018–2020 system and a 2018 subcounty may now sit under a newer district
or a city. Both the base name **and** the tier (subcounty vs. town council
vs. division) must match. There is deliberately no tier-insensitive
fallback: a first pass that allowed one mapped the "Ibanda" county onto
Ibanda Municipality and the 2018 "Bitooma" subcounty onto today's Bitooma
Town Council — different units that happen to share a name; those land in
the crosswalk as `tier_mismatch`.

COD-AB's 2020 polygons are then used for two things, neither of which
publishes them: the `hdx_iou` column of the boundary-agreement check
(above), and — first — a **sanity test** of
each name match against the UBOS-derived district layer
(`scripts/lib/fit-to-district.mjs`, called with `{ clip: false }` — a test
only, nothing is clipped or kept). A matched unit's own district must be
the district its COD-AB polygon overlaps *most* (not a single interior
point — COD-AB polygons include open water, so a point test routinely
lands in a lake). This is what catches a name match that's right on paper
but wrong on the ground; a failure is recorded as `rejected_geometry` and
that unit gets no P-code. With UBOS's districts as the reference it
rejects only 2 matches, both on the Masindi–Kiryandongo line: county
**Bujenje** (`UG412501`) and subcounty **Pakanyi** (`UG41250103`). COD-AB
places both mostly inside Kiryandongo, while UBOS and the EC have them in
Masindi, so those two P-codes are withheld rather than attached to units
COD-AB draws somewhere else. (Run against the old geoBoundaries district
layer, the same test rejected 68 subcounties — most of them that layer's
errors, not the matches'. In the intermediate COD-AB build it still
rejected Bundingoma and Busunga Town Council in Bundibugyo, on the DRC
border — the stretch where geoBoundaries' western border, which that
build's land mask came from, is wrong; against UBOS's districts both now
pass.) Results:

| COD-AB level | exact | other |
|---|---|---|
| adm1 (region) | 4 / 4 | — |
| adm2 (district) | 135 | 1 `split_from` (Terego → Arua's `UG3072`) |
| adm3 (county) | 117 | 10 `predecessor`, 66 unmatched, 5 `tier_mismatch`, 4 `no_equivalent`, 1 `rejected_geometry` |
| adm4 (subcounty) | 1,352 | 146 unmatched, 21 `tier_mismatch`, 1 `rejected_geometry` |

- The 10 adm3 `predecessor` rows are the pre-2020 municipalities that
  became the 10 cities. They're recorded as predecessors only, never as an
  exact equivalence, because each city is larger than the municipality it
  grew from.
- The 4 `no_equivalent` rows are COD-AB's "KCCA" counties: Kampala's (which
  has no county tier in this project — see above), plus three counties in
  Buikwe, Mityana and Mukono that COD-AB itself mislabels "KCCA".
- The 2 `rejected_geometry` rows are Bujenje and Pakanyi (above).
- One exact match is by P-code rather than name: COD-AB's "Central
  Division" (`UG10080101`) is the EC gazetteer's "Kampala Central". Such
  hand-confirmed renames live in `PCODE_OVERRIDES` in
  `scripts/ingest-hdx-cod-ab.mjs`, still go through the district-fit test,
  and are kept to cases that are certain.

Every record from region down to subcounty tier now carries
`external_refs.hdx_pcode` (its exact COD-AB equivalent, where one exists —
1,608 units) and `external_refs.hdx_within_pcode` (the most specific
COD-AB unit containing it — all 2,663 eligible units; cities, Terego and
post-2020 units take it from their nearest ancestor, or via `split_from`).
P-codes are `UG` + 1 digit region + 3 district + 2 county + 2 subcounty,
nested. `dist/uganda-locations-full.csv` gained a final `hdx_pcode`
column (the village's subcounty's `hdx_within_pcode`), appended after
`parish_id` so existing column positions don't shift. Every boundary
feature in `dist/geo/` carries `hdx_pcode` where an exact one exists,
alongside `ubos_code` and `area_km2` (see "Boundary polygons" above).
P-codes and UBOS codes answer different questions: a P-code joins
humanitarian data keyed to the 2020 COD-AB system; a UBOS code
(`external_refs.ubos_code`, `dist/crosswalk/ubos-2024.csv`) joins UBOS's
own 2024 census and 2025 education census tables, and reaches down to
parishes.

`scripts/validate.mjs` checks that P-codes are well-formed, unique per
unit, and nest within their parent's **district-level** code. County-level
nesting is deliberately *not* enforced, because it genuinely doesn't hold:
Kachomo subcounty has moved between Budaka's counties since 2020, and
COD-AB itself files Buikwe's and Mityana's Central Divisions under its
mislabelled "KCCA" counties. `dist/data-quality-report.json` reports the
live numbers under `boundary_coverage`, `hdx_cod_ab` and `ubos_2024`.

**Road network** (`data/geo/roads.geojson`) — OpenStreetMap-derived (HDX's
HOTOSM export, ODC-ODbL, Geofabrik snapshot 2026-06-22 — see
`data/sources.json` → `src-hotosm-uga-roads`), a fundamentally different
kind of data from the boundary layers above: a road crosses many
districts/subcounties, so these features carry **no district_id/region_id
at all** — there's no admin-unit linkage without a spatial join against the
boundary layers, which hasn't been attempted (now that those layers are
essentially complete, it's feasible). The raw export is
681,317 features and **98.8% have no name tag at all** — this project ships
only the major road network (motorway through tertiary + `_link` variants,
10,721 features, ~29% named, ~3.6MB simplified), dropping residential/
unclassified streets and informal paths/tracks (which make up the other
~96% of the raw data and are overwhelmingly unnamed) as too heavy and too
noisy for a locale package. The fuller 278,185-feature "classified roads"
cut (still ~89% unnamed) and the complete 681,317-feature raw export are
**not shipped** but remain directly reproducible from the cited source —
see `data/legacy/provenance/roads/README.md` and
`scripts/ingest-roads.mjs`. No street addressing (`addr:housenumber`/
`addr:street`) exists in Uganda's OSM coverage at all, not just filtered
out here.

**What's still NOT included, and why**:
- **The last parishes and one subcounty**: 83 of 10,717 parishes and
  `subcounty:kampala-makerere-university` have no polygon, and ~722 km²
  is held in `gaps.geojson` rather than assigned (see "Boundary polygons"
  above). Each gap lists its candidates; closing one needs a source that
  records how the land is split between the candidate parishes, not looser
  inference. Likewise the refugee-settlement splits are inferred — a host
  subcounty's own map of a settlement would replace them. Older or rejected boundary
  sources that would not help: geoBoundaries' "county" layer (2006
  vintage, 151 counties vs. this project's 322;
  `src-geoboundaries-uga-adm2-county-rejected`) and the 2010 UBOS parish
  shapefile (`src-ubos-parish-2010-stanford-rejected`, superseded by BEC
  2025).
- **Village**: no usable source. One candidate was found and scrutinized at
  the byte level, not trusted from its filename — genuine Polygon geometry
  (shape type 5), 44,034 records with a real
  VILLAGE/PARISH/SUBCOUNTY/COUNTY/DISTRICT field structure, but only ~62%
  of this project's verified 71,230-village count, **no license anywhere**
  (anonymous single-commit GitHub upload, no README), and an unverifiable
  "2011" vintage claim. Rejected — real-looking data with no license and
  material staleness isn't something this project's no-guessing culture
  should ship. (`src-github-village-shapefile-unlicensed-rejected`) The
  research/observatory session later found exactly 44,034 village polygons
  on the Ministry of Water and Environment's WEIS GeoServer, which suggests
  (not confirmed) that the upload is a copy of that layer; WEIS's terms
  forbid automated access without written permission, so it isn't used
  either (`src-mwe-weis-geoserver-not-used`).
- **GADM** was rejected as a source family entirely, independent of
  geometry quality: its license flatly disallows redistribution/commercial
  use without permission, incompatible with this project's CC BY 4.0 / CC0
  posture. Its ADM3/ADM4 counts exactly match HDX's, suggesting it
  repackages the same COD-AB data rather than adding independent value.
  (`src-gadm-uga-rejected`)
- **OpenStreetMap** self-reports all 146 district-equivalents "Complete" at
  `admin_level=4` (per the WikiProject Uganda wiki page, 2026-03-05), a
  genuine actively-maintained alternative — not used: every boundary level
  now comes from UBOS's own 2024/2025 polygons, OSM is ODbL (share-alike), and this
  pass didn't independently spot-check OSM's polygons one by one. The same
  page confirms subcounty/county boundaries are explicitly "future work" in
  OSM and lower tiers are mapped mostly as point nodes, not polygons.
  (`src-osm-wikiproject-uganda-not-used`)

**District/city population** (`data/population/uganda-nphc-2024-population.csv`,
`population` field on district/city records and on
`data/geo/districts.geojson` features) — sourced from UBOS's **National
Population and Housing Census 2024 Final Report, Volume 1**, the actual
final census count, not a projection. This supersedes the original plan to
use HDX's `cod-ps-uga` (2023 projection) once it turned out ubos.org was
directly reachable after all: every earlier `WebFetch`-tool request to
ubos.org had failed with a TLS certificate error, but a plain `curl` request
with a browser User-Agent and `-k` succeeded — a tool-side TLS issue, not a
real access block (see `data/legacy/provenance/population/README.md` for
the full story). Extracted with `pdftotext -table` mode (plain `-layout`
mode badly misaligned this specific table's columns — every number shifted
down one row relative to its district name — `-table` mode extracted every
row correctly with no manual correction needed). Validated three
independent ways, all with zero discrepancies: (1) male + female = total
for all 146 rows; (2) cross-checked against the report's own prose ("Wakiso
district was the most populated with 3,411,177 people while Kalangala was
the least populated district with 74,411 people") — exact match; (3) summed
all 146 rows' male/female/total columns independently and reproduced the
report's separately-stated national total (22,314,289 / 23,591,128 /
45,905,417) exactly, to the person, across all three columns — the same
kind of independent-checksum validation this project already relies on for
the EC gazetteer. All 146 names (136 districts + 10 cities, each counted
separately from its parent district, e.g. "Masaka" and "Masaka City" are
two distinct rows) resolved to this project's own ids with zero unresolved
and zero missing. No explicit copyright/license statement was found
anywhere in the 36MB report; treated as public government statistical data
per this project's CC BY 4.0 default, but flagged rather than assumed — see
`LICENSE-DATA.md`. See `data/sources.json` →
`src-ubos-nphc2024-final-report`.

**Population below district** (`data/population/ubos-nphc-2024-subcounty.csv`,
`population` on subcounty and county features in `dist/geo/`). The
obstacle used to be that there was no matching boundary layer to report
against; once the subcounty layer existed, the figures were already to
hand: UBOS's NPHC 2024 subcounty polygons (`src-ubos-nphc-2024-geo`) carry
2024 population per UBOS subcounty. `scripts/ingest-ubos-boundaries.mjs`
gives each UBOS subcounty's count to the EC subcounty that owns its land —
by name match, or the EC unit it was carved from — and writes the CSV
(`id`, `male`, `female`, `total`, `ubos_codes`, `method`). Refugee-
settlement units are left out (their land is split between host
subcounties by inference, not by any count, so their people can't be
honestly assigned), and values UBOS serves as `#N/A` are skipped — no
figure rather than a 0. Result: **2,180 subcounties, 44,986,031 people**,
against the 45,905,417 national total; the ~919k difference is the
settlement units, counted separately. `method` is `name_match` (2,105) or
`includes_carved_units` (75) — the latter, and any subcounty whose UBOS
parishes were reorganised across EC units, are approximate.
`scripts/build.mjs` attaches the figure to subcounty features and sums it
to counties, with `partial: true` where a county has a subcounty without a
figure (5 counties). The web map's population and people/km² metrics now
work at county and subcounty level. Parish and village population, and
WorldPop's gridded raster alternative, remain un-ingested — see
`data/sources.json` → `src-worldpop-uga-not-used`.

## Explicitly not verified / not included

**New town councils and district splits reported ahead of the 2026
elections** (e.g. "9 new town councils effective 2025-07-01", and reports of
new districts/a city being split from Tororo) — real news signals, but every
attempt to fetch the primary source (Daily Monitor article, the EC's own
electoral-map page) returned HTTP 403 during this research pass. Rather than
transcribing an unverifiable secondhand summary as fact, these are omitted
until a primary source is reachable. See `data/sources.json` →
`src-monitor-town-councils-2025`.

**County: now verified for 135/136 rural districts** (Kampala structurally
has no county tier, same as cities — see below), reconstructed from the EC
gazetteer rather than the old 2015 legacy list. Superseded gap, moved out of
this section — see "Confirmed" above for the full explanation and
`data/legacy/counties_2015_statoids.csv`'s own entry in `data/sources.json`
for why the old 2015 list (112/136 matched, and stale even where matched)
is no longer ingested into the build.

**Subcounty/town council/division → parish/ward → village/cell: verified
for all 146 district-equivalent units.** Source:
`data/legacy/provenance/ec/admin-units-2022.pdf`, the EC's "Verified
Administrative Units, July 2022" — see the "Confirmed" section above and
`data/legacy/provenance/ec/README.md` for the parsing/validation story. The
project's original `location.csv` (110/135 districts, with a `county` column
that mostly just repeated the subcounty name — exactly the gap that
motivated this project) has been retired from the build; it's kept at
`data/legacy/subcounties_legacy_source.csv` for reference only.

**Zone** — still not ingested. The EC's polling-station-level data
(50,739 stations reported for the 2025/26 elections) is a *separate* EC
publication from the administrative-unit gazetteer used here, and wasn't
located/parsed in this pass. See [`ROADMAP.md`](ROADMAP.md).

## Sources evaluated and rejected

**HDX / OCHA COD-AB** (`data.humdata.org/dataset/cod-ab-uga`), the standard
humanitarian/GIS administrative-boundaries source — **rejected as a source
of unit *names/lists* and, in the end, of geometry; used for P-codes
only.** As a list it's the 2020 system (`valid_on: 2020-08-24`): 135
districts (no Terego), 203 counties, 1,520 subcounties, and no parish or
village level — stale against the EC's 2022 gazetteer (322 counties, 2,191
subcounty-tier units, 10,717 parishes), so no unit in this dataset is
created or named from it. (An earlier version of this paragraph read its
~208 "admin3" and ~1,520 "admin4" features as a too-thin county/parish
count; in fact they're the county and subcounty tiers — see the parish
retraction above.) As *geometry* it's UBOS's own boundary set as of 2020,
and it was far more accurate than geoBoundaries for districts; for part of
2026-10-17 it was the district, county and subcounty geometry. It was
superseded the same day by UBOS's own 2024/2025 polygons, which are
current, reach parishes, and need no 2020-to-2022 name matching (see
"Boundary polygons" above). Its polygons are now read only as a sanity
test of the P-code matches and as the second comparison in the
boundary-agreement check. See `data/sources.json` → `src-hdx-cod-ab-uga`.

**MWE WEIS GeoServer** (Ministry of Water and Environment) — reachable, and
the only source seen with village polygons, but **deliberately not used**:
its terms forbid automated access without written permission (and forbid
commercial reuse). Nothing was fetched from it. See `data/sources.json` →
`src-mwe-weis-geoserver-not-used`.

## How to interpret `confidence` in practice

- `verified`: cross-checked against 2+ independent *current* sources. Safe
  to treat as ground truth.
- `legacy`: real data, but from a dated source and not yet reconciled to the
  current administrative structure. Usable as a starting point, not as a
  guarantee.
- `unverified`: present in the dataset but not yet source-checked at all.

Consuming applications should default to `verified`-only data unless they
explicitly want to opt into `legacy` rows (e.g. a form that would rather show
a probably-right subcounty list than none at all).
