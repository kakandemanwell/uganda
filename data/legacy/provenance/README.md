# Provenance: legacy county table

`counties_raw.wikitext` is the raw wikitext of the "Counties of Uganda"
Wikipedia article as fetched 2026-07-09 (`action=raw`, not rendered HTML),
kept verbatim so the derivation of `data/legacy/counties_2015_statoids.csv`
is auditable rather than opaque.

`parse_counties.mjs` mechanically parses that wikitext's table (handling
`rowspan` cells) into `../counties_2015_statoids.csv`. It was deliberately
written as a plain parser rather than summarized by a model, so no row could
be silently dropped or merged. Re-run with:

```
node parse_counties.mjs
```
