import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceKm } from '../src/pathe/geo.js';

test('distanceKm is zero for the same point', () => {
  assert.equal(
    distanceKm({ latitude: 48.8566, longitude: 2.3522 }, { latitude: 48.8566, longitude: 2.3522 }),
    0,
  );
});

test('distanceKm matches the well-known Paris-Lyon distance (~392km as the crow flies)', () => {
  const paris = { latitude: 48.8566, longitude: 2.3522 };
  const lyon = { latitude: 45.764, longitude: 4.8357 };

  const distance = distanceKm(paris, lyon);

  assert.ok(distance > 385 && distance < 400, `expected ~392km, got ${distance}`);
});

test('distanceKm is symmetric', () => {
  const a = { latitude: 48.8566, longitude: 2.3522 };
  const b = { latitude: 45.764, longitude: 4.8357 };

  assert.equal(distanceKm(a, b), distanceKm(b, a));
});
