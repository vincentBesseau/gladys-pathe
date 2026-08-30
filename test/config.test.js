import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, validateConfig } from '../src/config.js';

test('normalizeConfig trims and defaults cinema_id', () => {
  assert.deepEqual(normalizeConfig(), { cinema_id: '' });
  assert.deepEqual(normalizeConfig({ cinema_id: ' cinema-pathe-rennes ' }), {
    cinema_id: 'cinema-pathe-rennes',
  });
});

test('validateConfig throws when cinema_id is empty', () => {
  assert.throws(() => validateConfig({ cinema_id: '' }), /Find my cinema/);
});

test('validateConfig accepts a non-empty cinema_id', () => {
  assert.doesNotThrow(() => validateConfig({ cinema_id: 'cinema-pathe-rennes' }));
});
