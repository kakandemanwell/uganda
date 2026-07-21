# Data quality: what's verified, what isn't, and why

This project exists because the user of this repo found no accurate,
current, machine-readable dataset of Uganda's administrative units below
district level. Producing one honestly means being explicit about the
ceiling of what free sources currently allow, rather than filling gaps with
plausible-sounding guesses. This document was written 2026-07-09 and
substantially revised the same day once the EC's own village-level gazetteer
was located and validated — see the second entry under "Confirmed" below.
Update it whenever the ceiling moves again.

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
humanitarian/GIS administrative-boundaries source: still shows the pre-2016
135-district baseline (coincidentally still numerically correct, though not
by name-for-name overlap with today's set) but only ~208 "admin3" and ~1,520
"admin4" features nationally — far short of Uganda's real count of roughly
1,400+ subcounties and 7,000+ parishes. Concluded stale/unreliable below
district level and not used for those levels.

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
