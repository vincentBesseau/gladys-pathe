import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchCinemas, nearestCinemas } from '../src/pathe/cinemas.js';

test('returns every cinema when the query is empty', () => {
  const results = searchCinemas('');
  assert.ok(results.length > 60);
  assert.ok(results.every((c) => c.id && c.name && c.city));
});

test('filters by city or name, case and accent insensitively', () => {
  const results = searchCinemas('rennes');
  assert.ok(results.length > 0);
  assert.ok(results.every((c) => `${c.name} ${c.city}`.toLowerCase().includes('rennes')));
});

test('returns an empty array when nothing matches', () => {
  assert.deepEqual(searchCinemas('this-city-does-not-exist'), []);
});

test('every cinema has a valid latitude/longitude', () => {
  const results = searchCinemas('');

  assert.ok(
    results.every(
      (c) =>
        typeof c.latitude === 'number' &&
        typeof c.longitude === 'number' &&
        Math.abs(c.latitude) <= 90 &&
        Math.abs(c.longitude) <= 180,
    ),
  );
});

test('nearestCinemas sorts by distance, nearest first, and attaches distanceKm', () => {
  // A point right next to Pathé Rennes.
  const nearRennes = { latitude: 48.1, longitude: -1.68 };

  const results = nearestCinemas(nearRennes, 5);

  assert.equal(results.length, 5);
  assert.ok(results.every((c) => typeof c.distanceKm === 'number'));

  for (let i = 1; i < results.length; i += 1) {
    assert.ok(results[i].distanceKm >= results[i - 1].distanceKm);
  }

  assert.equal(results[0].id, 'cinema-pathe-rennes', 'Pathé Rennes should be the closest match');
});

test('nearestCinemas respects the limit', () => {
  const nearRennes = { latitude: 48.1, longitude: -1.68 };

  assert.equal(nearestCinemas(nearRennes, 3).length, 3);
  assert.equal(nearestCinemas(nearRennes, 1).length, 1);
});
