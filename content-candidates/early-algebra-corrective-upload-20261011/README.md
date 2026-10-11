# Early Algebra corrective upload

This folder contains complete chart and authored-sidecar pairs for eight Early Algebra songs. The deployed launch contract requires the chart path, sidecar path, and receipt to identify the same immutable revision folder.

The earlier October 11 sidecar-only publication referenced charts in different revision folders. Although both objects existed, selecting Garden returned HTTP 503 `PACKAGE_UNAVAILABLE`; Vercel logged `Authored chart and sidecar revisions do not match`. Those historical immutable rows remain intact.

## Published and verified — 11 October 2026

All 16 files from this bundle were uploaded without overwriting objects and downloaded to verify their sizes and SHA-256 hashes. `publish.sql` created eight new revisions through publishing → ready and updated the existing SongChart pointers. The temporary, JWT-protected publisher accepted only these bundled artifacts plus an expiring publication proof; it was replaced with a 410 response immediately after upload.

`validate.ts` verifies identity, hashes, counts, introductory one-step integer equations, and chart-timed publish readiness. All eight pass. The live `scripts/audit-authored-roundtrip.ts` sweep also passed for all eight: HTTP 200 launch/audio, correct revision, no readiness blockers, and unchanged equation/encounter semantics after serialization and rehydration. This is package/editor proof; completed hosted gameplay and results persistence remain separate acceptance checks.

## Manual upload reference

1. In Supabase, open project `hshovrqtmzvpjggqcpya`.
2. Open **Storage → Charts**. From File Explorer, open:
   `C:\Users\tboya\Documents\GitHub\ultrarapidplatform\content-candidates\early-algebra-corrective-upload-20261011\charts\dev`
   Drag the `dev` folder into the bucket.
3. Open **Storage → SidecarJsons**. Open:
   `C:\Users\tboya\Documents\GitHub\ultrarapidplatform\content-candidates\early-algebra-corrective-upload-20261011\sidecars\dev`
   Drag the `dev` folder into that bucket.
4. Do not upload this README or the manifest, and do not delete prior objects. This bundle is already published; another manual upload is unnecessary.

The manifest records all eight published revision IDs and file hashes. Keep `publish.sql` as the publication record; do not modify prior ready revisions.

**Melika note:** its chart copy differs from the chart hash currently recorded for the older Platform revision. This staged chart is the local chart used to validate the revised encounters, so the new revision records its SHA-256 separately.
