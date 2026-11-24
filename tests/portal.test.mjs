import test from 'node:test';
import assert from 'node:assert/strict';
import { crossedPortal } from '../src/portal.js';

// a ring at the origin facing along +z
const portal = { x: 0, z: 0, yaw: 0, y: 0 };
const at = (x, z, y = 0) => ({ x, y, z });

test('walking through the ring counts, in both directions', () => {
  assert.equal(crossedPortal(portal, at(0, -0.1), at(0, 0.1)), true);
  assert.equal(crossedPortal(portal, at(0.5, 0.1), at(0.5, -0.1)), true);
});

test('staying on one side does not count', () => {
  assert.equal(crossedPortal(portal, at(0, -0.3), at(0, -0.1)), false);
});

test('walking past beside the ring does not count', () => {
  assert.equal(crossedPortal(portal, at(2, -0.1), at(2, 0.1)), false);
});

test('jumping over the top does not count', () => {
  assert.equal(crossedPortal(portal, at(0, -0.1, 4), at(0, 0.1, 4)), false);
});

test('a jump in position (back to the start) does not count', () => {
  assert.equal(crossedPortal(portal, at(0, -30), at(0, 0.1)), false);
});

test('a turned ring is crossed along its own facing', () => {
  const turned = { x: 5, z: 5, yaw: Math.PI / 2, y: 0 }; // faces along +x
  assert.equal(crossedPortal(turned, at(4.9, 5), at(5.1, 5)), true);
  assert.equal(crossedPortal(turned, at(5.3, 4.9), at(5.3, 5.1)), false);
});
