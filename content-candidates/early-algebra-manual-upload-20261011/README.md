# Early Algebra sidecar upload

This folder contains eight new authored Early Algebra sidecars. Chart and audio objects stay unchanged. The currently published revisions remain active until the new objects and matching revision metadata are verified.

## Upload from the Supabase Dashboard

1. Open the Supabase Dashboard project **hshovrqtmzvpjggqcpya**.
2. Open **Storage → SidecarJsons**.
3. From File Explorer, open:

   `C:\Users\tboya\Documents\GitHub\ultrarapidplatform\content-candidates\early-algebra-manual-upload-20261011\dev`

4. Try dragging the `dev` folder onto the bucket file area. It contains only the eight new sidecars and keeps their full object paths. Each path uses a fresh revision UUID, so it will not replace an existing object.
5. If the Dashboard rejects folder drops, use **Upload File** and upload the eight `.json` files into the matching folders shown in `manifest.csv`. Do not upload the README or manifest.
6. Reply here after the upload. I can verify the object paths and checksums, then insert the matching immutable revision rows through the connected SQL access.

Do not delete existing objects, run SQL, or change the active revision rows; I will handle the metadata after verifying all eight uploads.

## Content note

The Jazz draft had a stale Year 7 cue-only equation with seven hits and no drag. This upload copy removes that equation and its seven orphaned cues; the remaining eight one-step equations each have a drag encounter. The other seven sidecars retain their authored encounters and receive fresh revision UUIDs.

## Checks performed

All eight pass Platform's static authored-lesson publication validation. The bundle also checks JSON identity, unique equation/encounter IDs, equation references, one-step integer equations in the 0–10 range, ordered nonnegative ticks, and at least one drag per equation. Chart-clock overlap/playability validation and hosted launch, timed play, results, and return acceptance still need to happen before these are marked ready.

