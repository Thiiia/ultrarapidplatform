# Perimeter completion V4 contract examples

These fixtures exercise the proposed strict V4 result shape and its validation against a server-owned lesson admission. The SHA-256 identifies the checked-in canonical pilot lesson bytes after the Unity-compatible trailing newline normalization. These are still **contract test inputs only**: no exporter/receipt adapter makes them a launchable lesson or a production result.

The first fixture records the existing pilot's 3×5 guided practice, an answer-revealed 3×4 check, and a fresh independent 4×5 check. Check start, guidance, explicit unit selections, and answer attempts share one monotonic evidence sequence. Each submitted unit must reference the latest matching learner selection for that problem; an answer reveal clears the prior selection. It deliberately reports no timing and no score policy. The duplicate-edge fixture must be rejected before admission projection.

The contract remains outside the live V2/V3 completion bridge and persistence routes until T06 exports immutable lesson identity and the admitted host attempt binds that identity server-side. No assignment credit or Syntheia reward is enabled by these examples.
