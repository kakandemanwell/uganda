# Contributing

This project is only as good as its sourcing. The single rule that matters
more than any other:

**Never upgrade a record's `confidence` to `verified` without citing a
specific, checkable source in `data/sources.json` and referencing it via
`source_ids`.** A plausible-sounding name is not a verified one — that's the
exact problem this project exists to fix.

## Most useful contributions right now

1. **Reconcile a legacy county or subcounty gap.** Run `node scripts/build.mjs`,
   open `dist/data-quality-report.json`, pick a district under
   `districts_missing_counties` or `districts_missing_subcounties`, find its
   correct data (district local government website, UBOS abstract, a
   parliamentary/gazette notice), and add a row to the relevant CSV in
   `data/` with an honest `confidence` value and a new entry in
   `data/sources.json`.
2. **Parse one district's EC polling-station PDF** into parish/village/zone
   rows. This is the highest-value, highest-effort contribution — see
   `docs/ROADMAP.md` Phase 3. Submit even a single district; this is
   explicitly designed to be done incrementally, not all at once.
3. **Verify a `pending`/`proposed` unit** (e.g. the reported 2025/2026 new
   town councils) against a primary source and add it with `status`
   reflecting reality (`pending` if approved-but-not-yet-operational,
   `operational` with an `effective_date` once confirmed).

## Workflow

```bash
npm run build      # data/*.csv -> dist/
npm run validate    # structural + referential-integrity checks
```

Both must pass before submitting a change. If you add a new source, add it
to `data/sources.json` with `title`, `publisher`, `url`, `accessed` date, and
a `note` on what it was used (or rejected) for — future contributors need to
know why a source was or wasn't trusted, not just that it exists.
