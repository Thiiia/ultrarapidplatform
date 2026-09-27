# Early Algebra hit pad upgrade — 27 September 2026

The eight published catalogue songs already use the authored equation progressions and rhythm-hit encounter layout. A read-only launch check found 313 encounters, including 257 Hits, and 77 authored equations. Every published Hit currently uses one pad.

The prepared upgrade keeps every equation, encounter ID, start time, and end time. It gives featured Hits and selected later rhythm Hits two required pads, up to the player's limit of two. Foundation songs begin with single-pad Hits before the two-pad progression.

| Song | Encounters | Hits | Proposed two-pad Hits | Equations |
| --- | ---: | ---: | ---: | ---: |
| garden | 40 | 33 | 14 | 10 |
| geminiqueen | 41 | 33 | 13 | 12 |
| grudge | 36 | 31 | 12 | 7 |
| jazzmaybach | 12 | 10 | 5 | 2 |
| justbecause | 37 | 30 | 12 | 10 |
| oneone | 35 | 30 | 11 | 8 |
| seven | 37 | 28 | 11 | 10 |
| waves | 75 | 62 | 25 | 18 |
| **Total** | **313** | **257** | **103** | **77** |

The reviewed snapshot is in `/tmp/early-algebra-hitpad-20260927`; validated output is in `/tmp/early-algebra-hitpad-ready-20260927`. The dry-run and `--verify-live` checks both passed against all eight currently published revisions. The script validates each proposed sidecar for publication and compares the live chart, sidecar, and revision with the snapshot before any write.

To repeat the read-only check:

```bash
npx tsx scripts/migrate-early-algebra-catalogue.ts --verify-live --hitpad-upgrade --snapshot-dir=/tmp/early-algebra-hitpad-20260927 --output-dir=/tmp/early-algebra-hitpad-ready-20260927
```

After publication approval, the production write is:

```bash
npx tsx scripts/migrate-early-algebra-catalogue.ts --apply --hitpad-upgrade --snapshot-dir=/tmp/early-algebra-hitpad-20260927 --output-dir=/tmp/early-algebra-hitpad-ready-20260927
```

The write creates eight new published lesson revisions. Its preflight prevents a stale snapshot from being applied, but a save failure after the first song can leave some songs updated. Check the script's per-song result and the live launch packages after publishing.
