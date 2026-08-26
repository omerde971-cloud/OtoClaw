import 'package:flutter/widgets.dart';

import 'mascot_state.dart';

/// Renders the mascot for a given [MascotStateName]. Implementations must
/// produce continuous, real animation (never a static frame) per
/// ARCHITECTURE.md §13's "video-like, not slideshow" requirement.
abstract class MascotRenderer {
  Widget build(BuildContext context, MascotStateName state);
}
