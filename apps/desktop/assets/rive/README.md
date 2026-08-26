# Rive mascot asset (placeholder)

The real `otoclaw.riv` asset (cube-headed robot, 10-state Rive state machine per
ARCHITECTURE.md §13 / OTOCLAW_PLAN.md §3) is not produced in this phase — it is
illustration/design work tracked separately.

Until `otoclaw.riv` is added here, `RiveMascotRenderer` fails to load the asset and
`MascotWidget` falls back to `FallbackMascotRenderer`, which renders each of the 10
states with Flutter-native animated primitives.

When the real asset lands, drop it in as `assets/rive/otoclaw.riv` — no code changes
should be required beyond wiring up the actual state machine input names.
