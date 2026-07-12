# uganda-locale

An open, versioned dataset (and eventually a small serving library) of Uganda's
administrative units — **region → district/city → county/municipality →
subcounty/town council/division → parish/ward → village/cell → zone** — built
because no single free, current, machine-readable source of this hierarchy
existed for software integration (form dropdowns, address validation,
reporting, etc.), and Uganda's units change often enough that hand-maintained
copies go stale fast.

## Why this exists

Uganda's Electoral Commission is the most tactically complete government body
for this data — it maps down to the village level for every election. Most
free sources (Wikipedia, HDX/OCHA, Statoids) turned out to be either scoped to
district level only or several years stale below that — see
[`docs/DATA_QUALITY.md`](docs/DATA_QUALITY.md) for the full source-by-source
breakdown, including what was checked and rejected.

The EC does in fact publish the real thing: a full village-level gazetteer
(`ec.or.ug/admin-units`), just not advertised as a "dataset" — it's a
3,019-page PDF. It's now been parsed, and validated twice over (see below).

## What's actually in here right now

Run `npm run build` to compile `data/` into `dist/`:

| Level | Count | Confidence |
|---|---|---|
| Region | 4 | verified |
| District (incl. Kampala/KCCA) | 136 | verified — cross-checked against 3 independent current sources |
| City | 10 | verified |
| County / Municipality | 322 | **verified** — reconstructed from the EC gazetteer's constituency data, July 2022, 135/136 rural districts (Kampala has no county tier, like cities) |
| Subcounty / Town Council / Division | 2,191 | **verified** — EC gazetteer, July 2022, all 146 district-equivalent units |
| Parish / Ward | 10,717 | **verified** — EC gazetteer, July 2022, all 146 district-equivalent units |
| Village / Cell | 71,230 | **verified** — EC gazetteer, July 2022, all 146 district-equivalent units |
| Zone | 0 | not yet ingested — EC polling-station data is a separate source from the admin-unit gazetteer, see [Roadmap](docs/ROADMAP.md) |

Every record has a `confidence` (`verified` / `legacy` / `unverified`) and a
`status` (`operational` / `pending` / ...) field. Consuming code should
filter on `confidence` explicitly rather than assume completeness — the one
remaining structural gap is one subcounty (Katikamu, Luwero) that spans two
constituencies like a city division and wasn't force-assigned a county name.

The subcounty → village layer is sourced from the EC's own "Verified
Administrative Units, July 2022" gazetteer and cross-validated twice: every
one of the ~2,198 "TOTAL VILLAGES IN X" checksums printed in the source
document itself matches, and fully re-aggregated per-district totals match
the EC's independently-published summary statistics exactly, for all 146
districts/cities with zero discrepancies. The county layer is reconstructed
from that same gazetteer's constituency data (outside city/Kampala
divisions, a constituency name in this document *is* the county name) and
was independently spot-checked against separate research across 13
districts, 11 exact matches and 2 refinements, 0 contradictions. Full story
in [`data/legacy/provenance/ec/README.md`](data/legacy/provenance/ec/README.md)
and [`docs/DATA_QUALITY.md`](docs/DATA_QUALITY.md). All of it is dated July
2022, so it doesn't reflect any changes since (see `docs/DATA_QUALITY.md`
for what's unverified from 2023-2026, e.g. reported new town councils).

Run `node scripts/build.mjs` and check `dist/data-quality-report.json` for a
live coverage report — regenerated every build, not hand-maintained.

## Repo layout

```
data/
  regions.csv           # 4 regions
  districts.csv         # 136 districts + Kampala/KCCA, verified
  cities.csv            # 10 second-generation cities, verified
  sources.json          # every source cited, with access date + what it was used/rejected for
  ec/
    administrative_units_ec2022.json   # EC-verified county->subcounty->parish->village, all 146 units
  legacy/
    counties_2015_statoids.csv       # superseded by data/ec/; kept for provenance only, ~2015 vintage
    subcounties_legacy_source.csv    # the project's original location.csv, kept for reference (superseded by data/ec/)
    provenance/
      ec/               # the EC PDF parser, validation logs, and regeneration instructions
schema/
  administrative-unit.schema.json    # the record shape everything compiles to
scripts/
  build.mjs                    # data/*.csv + data/ec/*.json -> dist/
  ingest-ec-admin-units.mjs    # parsed EC village data -> schema-shaped units
  validate.mjs                 # structural + referential-integrity check of the build output
dist/                    # generated, gitignored — run `npm run build`
docs/
  ROADMAP.md
  DATA_QUALITY.md
  CONTRIBUTING.md
```

## Using the data

```bash
npm run build
```

produces in `dist/`:
- `uganda-locations.json` — the full unified record set (~84,500 records)
- `regions.json`, `districts.json`, `citys.json`, `countys.json`, `subcountys.json`, `town_councils.json`, `divisions.json`, `parishs.json`, `wards.json`, `villages.json`, `cells.json` — per-level exports
- `uganda-locations.csv` — flattened, loosely backward-compatible with the original `location.csv` shape, for drop-in use in existing forms
- `data-quality-report.json` — coverage/gaps, regenerated every build

## License

- Code (`scripts/`, `schema/`): [MIT](LICENSE-CODE.md)
- Data (`data/`, `dist/`): [CC-BY 4.0](LICENSE-DATA.md) — attribute UBOS, the
  Electoral Commission of Uganda, OCHA/HDX, and Wikipedia/Statoids as
  applicable per [`data/sources.json`](data/sources.json).

## Status

Early stage, local-only (not yet pushed to GitHub). Region through village
is now verified for all (or nearly all) district-equivalent units. See
[`docs/ROADMAP.md`](docs/ROADMAP.md) for what's next — the zone/
polling-station layer, and a packaged serving mechanism (npm/API), neither
of which exist yet.
