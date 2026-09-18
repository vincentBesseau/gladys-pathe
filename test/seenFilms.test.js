import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSeenFilmIds, saveSeenFilmIds } from '../src/pathe/seenFilms.js';

let dir;

afterEach(async () => {
  if (dir) {
    await rm(dir, { recursive: true, force: true });
    dir = undefined;
  }
});

test('loadSeenFilmIds returns existed:false and an empty set when the file does not exist yet', async () => {
  dir = await mkdtemp(join(tmpdir(), 'pathe-seen-films-'));

  const loaded = await loadSeenFilmIds(join(dir, 'seen-films.json'));

  assert.deepEqual(loaded, { ids: new Set(), existed: false });
});

test('loadSeenFilmIds returns existed:false when the file is corrupt, rather than throwing', async () => {
  dir = await mkdtemp(join(tmpdir(), 'pathe-seen-films-'));
  const path = join(dir, 'seen-films.json');
  await writeFile(path, 'not json');

  const loaded = await loadSeenFilmIds(path);

  assert.deepEqual(loaded, { ids: new Set(), existed: false });
});

test('loadSeenFilmIds returns existed:false when the file holds something other than a JSON array', async () => {
  dir = await mkdtemp(join(tmpdir(), 'pathe-seen-films-'));
  const path = join(dir, 'seen-films.json');
  await writeFile(path, JSON.stringify({ not: 'an array' }));

  const loaded = await loadSeenFilmIds(path);

  assert.deepEqual(loaded, { ids: new Set(), existed: false });
});

test('saveSeenFilmIds then loadSeenFilmIds round-trips the set with existed:true, ids coerced to strings', async () => {
  dir = await mkdtemp(join(tmpdir(), 'pathe-seen-films-'));
  const path = join(dir, 'seen-films.json');

  await saveSeenFilmIds(new Set(['a', 'b', 'c']), path);
  const loaded = await loadSeenFilmIds(path);

  assert.deepEqual(loaded, { ids: new Set(['a', 'b', 'c']), existed: true });
});

test('a persisted empty array is existed:true (a real baseline of zero films, not "never checked")', async () => {
  dir = await mkdtemp(join(tmpdir(), 'pathe-seen-films-'));
  const path = join(dir, 'seen-films.json');

  await saveSeenFilmIds(new Set(), path);
  const loaded = await loadSeenFilmIds(path);

  assert.deepEqual(loaded, { ids: new Set(), existed: true });
});
