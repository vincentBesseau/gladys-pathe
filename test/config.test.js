import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, validateConfig, resolveWidgetCinema } from '../src/config.js';

test('normalizeConfig reads the default cinema (slot 1 keeps the historical keys)', () => {
  assert.deepEqual(normalizeConfig(), { cinema_id: '', cinemas: [] });
  assert.deepEqual(
    normalizeConfig({ cinema_id: ' cinema-pathe-rennes ', cinema_name: ' Pathé Rennes ' }),
    {
      cinema_id: 'cinema-pathe-rennes',
      cinemas: [{ id: 'cinema-pathe-rennes', name: 'Pathé Rennes' }],
    },
  );
});

test('normalizeConfig collects up to five cinemas in slot order, skipping empty slots', () => {
  const config = normalizeConfig({
    cinema_id: 'cinema-pathe-rennes',
    cinema_name: 'One',
    cinema_id_2: '',
    cinema_id_3: 'cinema-pathe-lyon',
    cinema_name_3: 'Three',
  });

  assert.equal(config.cinema_id, 'cinema-pathe-rennes');
  assert.deepEqual(config.cinemas, [
    { id: 'cinema-pathe-rennes', name: 'One' },
    { id: 'cinema-pathe-lyon', name: 'Three' },
  ]);
});

test('validateConfig throws when no cinema is set', () => {
  assert.throws(() => validateConfig({ cinema_id: '', cinemas: [] }), /Find my cinema/);
});

test('validateConfig accepts any non-empty cinema id (Pathé ids have no fixed shape)', () => {
  assert.doesNotThrow(() => validateConfig({ cinema_id: 'cinema-pathe-rennes' }));
  assert.doesNotThrow(() =>
    validateConfig({
      cinema_id: 'cinema-pathe-rennes',
      cinemas: [
        { id: 'cinema-pathe-rennes', name: '' },
        { id: 'cinema-pathe-lyon', name: '' },
      ],
    }),
  );
});

test('resolveWidgetCinema picks the cinema at the selected slot', () => {
  const config = normalizeConfig({
    cinema_id: 'cinema-pathe-rennes',
    cinema_name: 'One',
    cinema_id_2: 'cinema-pathe-lyon',
    cinema_name_2: 'Two',
  });

  assert.deepEqual(resolveWidgetCinema(config, { cinema: '2' }), {
    id: 'cinema-pathe-lyon',
    name: 'Two',
  });
});

test('resolveWidgetCinema falls back to the first cinema when the slot is missing or out of range', () => {
  const config = normalizeConfig({
    cinema_id: 'cinema-pathe-rennes',
    cinema_name: 'One',
    cinema_id_2: 'cinema-pathe-lyon',
  });

  assert.deepEqual(resolveWidgetCinema(config, {}), { id: 'cinema-pathe-rennes', name: 'One' });
  assert.deepEqual(resolveWidgetCinema(config, { cinema: '5' }), {
    id: 'cinema-pathe-rennes',
    name: 'One',
  });
  assert.deepEqual(resolveWidgetCinema(config), { id: 'cinema-pathe-rennes', name: 'One' });
});
