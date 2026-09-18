import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkForNewFilms } from '../src/pathe/newFilmPolling.js';

let dir;
let seenFilmsPath;

function buildState() {
  return { seenFilmIds: null, seenFilmsPath };
}

function fakeGladys() {
  const calls = [];
  return {
    calls,
    publishSceneEvent: async (key, data) => {
      calls.push({ key, data });
    },
  };
}

const movieA = {
  id: 'a',
  title: 'A',
  releaseDate: '2026-01-01',
  sourceUrl: 'https://www.pathe.fr/films/a',
};
const movieB = {
  id: 'b',
  title: 'B',
  releaseDate: '2026-02-01',
  sourceUrl: 'https://www.pathe.fr/films/b',
  showtimes: [{ time: '20:00', version: 'VF' }],
};

afterEach(async () => {
  if (dir) {
    await rm(dir, { recursive: true, force: true });
  }
});

async function setup() {
  dir = await mkdtemp(join(tmpdir(), 'pathe-new-film-'));
  seenFilmsPath = join(dir, 'seen-films.json');
}

test('the first check is a baseline: no event fired, every film marked as seen', async () => {
  await setup();
  const gladys = fakeGladys();
  const state = buildState();

  await checkForNewFilms(gladys, async () => [movieA, movieB], state);

  assert.deepEqual(gladys.calls, []);
  assert.deepEqual(state.seenFilmIds, new Set(['a', 'b']));
});

test('a film present since the baseline does not re-fire on a later check', async () => {
  await setup();
  const gladys = fakeGladys();
  const state = buildState();

  await checkForNewFilms(gladys, async () => [movieA], state);
  await checkForNewFilms(gladys, async () => [movieA], state);

  assert.deepEqual(gladys.calls, []);
});

test('a film that appears after the baseline fires the new_film trigger with its details', async () => {
  await setup();
  const gladys = fakeGladys();
  const state = buildState();

  await checkForNewFilms(gladys, async () => [movieA], state);
  await checkForNewFilms(gladys, async () => [movieA, movieB], state);

  assert.deepEqual(gladys.calls, [
    {
      key: 'new_film',
      data: {
        title: 'B',
        release_date: '2026-02-01',
        showtimes: '20:00 VF',
        source_url: movieB.sourceUrl,
      },
    },
  ]);
});

test('a film with no showtimes fires with showtimes: null rather than an empty string', async () => {
  await setup();
  const gladys = fakeGladys();
  const state = buildState();

  await checkForNewFilms(gladys, async () => [], state);
  await checkForNewFilms(gladys, async () => [movieA], state);

  assert.equal(gladys.calls[0].data.showtimes, null);
});

test('the baseline survives across process restarts (state reloaded from disk)', async () => {
  await setup();
  const gladys = fakeGladys();

  await checkForNewFilms(gladys, async () => [movieA], buildState());
  // A fresh state, as a new process would build it, reloads from the same path.
  await checkForNewFilms(gladys, async () => [movieA, movieB], buildState());

  assert.deepEqual(gladys.calls, [
    {
      key: 'new_film',
      data: {
        title: 'B',
        release_date: '2026-02-01',
        showtimes: '20:00 VF',
        source_url: movieB.sourceUrl,
      },
    },
  ]);
});

test('a fetch failure keeps the previous baseline instead of throwing', async () => {
  await setup();
  const gladys = fakeGladys();
  const state = buildState();

  await checkForNewFilms(gladys, async () => [movieA], state);
  await checkForNewFilms(
    gladys,
    async () => {
      throw new Error('pathe.fr unreachable');
    },
    state,
  );

  assert.deepEqual(gladys.calls, []);
  assert.deepEqual(state.seenFilmIds, new Set(['a']));
});

test('a publishSceneEvent failure for one film does not stop the others from firing', async () => {
  await setup();
  const gladys = fakeGladys();
  gladys.publishSceneEvent = async (key, data) => {
    gladys.calls.push({ key, data });
    if (data.title === 'B') {
      throw new Error('rate limited');
    }
  };
  const movieC = {
    id: 'c',
    title: 'C',
    releaseDate: '2026-03-01',
    sourceUrl: 'https://www.pathe.fr/films/c',
  };
  const state = buildState();

  await checkForNewFilms(gladys, async () => [], state);
  await checkForNewFilms(gladys, async () => [movieB, movieC], state);

  assert.deepEqual(
    gladys.calls.map((call) => call.data.title),
    ['B', 'C'],
  );
});
