import 'package:desktop/mascot/mascot_state.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('maps all 10 wire strings to the matching enum value', () {
    expect(mascotStateFromWire('thinking'), MascotStateName.thinking);
    expect(mascotStateFromWire('coding'), MascotStateName.coding);
    expect(mascotStateFromWire('analyzing'), MascotStateName.analyzing);
    expect(mascotStateFromWire('planning'), MascotStateName.planning);
    expect(mascotStateFromWire('building'), MascotStateName.building);
    expect(mascotStateFromWire('terminal'), MascotStateName.terminal);
    expect(mascotStateFromWire('tool'), MascotStateName.tool);
    expect(mascotStateFromWire('waiting'), MascotStateName.waiting);
    expect(mascotStateFromWire('done'), MascotStateName.done);
    expect(mascotStateFromWire('presenting'), MascotStateName.presenting);
  });

  test('unknown string falls back to idle', () {
    expect(mascotStateFromWire('bogus'), MascotStateName.idle);
    expect(mascotStateFromWire(''), MascotStateName.idle);
    expect(mascotStateFromWire('Thinking'), MascotStateName.idle);
  });
}
