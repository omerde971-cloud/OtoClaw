/// The 10 mascot states from ARCHITECTURE.md §13 / OTOCLAW_PLAN.md §3, plus
/// an `idle` fallback for the pre-run / unknown-state case.
enum MascotStateName {
  idle,
  thinking,
  coding,
  analyzing,
  planning,
  building,
  terminal,
  tool,
  waiting,
  done,
  presenting,
}

/// Maps the wire `state` string (from `MascotStatePayload.state`) to a
/// [MascotStateName]. Unknown strings fall back to [MascotStateName.idle].
MascotStateName mascotStateFromWire(String state) {
  switch (state) {
    case 'thinking':
      return MascotStateName.thinking;
    case 'coding':
      return MascotStateName.coding;
    case 'analyzing':
      return MascotStateName.analyzing;
    case 'planning':
      return MascotStateName.planning;
    case 'building':
      return MascotStateName.building;
    case 'terminal':
      return MascotStateName.terminal;
    case 'tool':
      return MascotStateName.tool;
    case 'waiting':
      return MascotStateName.waiting;
    case 'done':
      return MascotStateName.done;
    case 'presenting':
      return MascotStateName.presenting;
    default:
      return MascotStateName.idle;
  }
}
