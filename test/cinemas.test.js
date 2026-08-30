import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchCinemas } from '../src/pathe/cinemas.js';

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
