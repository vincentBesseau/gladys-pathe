// -----------------------------------------------------------------------------
// Persistence of the "ever seen" film ids for the new_film scene trigger.
//
// The diffing that used to live in Gladys core (a cumulative in-memory
// baseline, reset on every core restart) now lives in the integration
// itself: the baseline must survive the container's own restarts, so it is
// persisted in /data, the one writable path of the sandbox.
// -----------------------------------------------------------------------------

import { readFile, writeFile } from 'node:fs/promises';
import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'pathe-seen-films' });

const DEFAULT_SEEN_FILMS_PATH = '/data/seen-films.json';

/**
 * @param {string} [path] - Overridable for tests; defaults to the real /data path.
 * @returns {Promise<{ids: Set<string>, existed: boolean}>} `existed` is false on
 * a missing or corrupt file — the two cases a fresh baseline must be built
 * from, told apart from "the file was read and the cinema legitimately had
 * zero films on the previous check" (`ids` empty, `existed` true).
 */
async function loadSeenFilmIds(path = DEFAULT_SEEN_FILMS_PATH) {
  try {
    const raw = await readFile(path, 'utf8');
    const ids = JSON.parse(raw);

    if (!Array.isArray(ids)) {
      throw new Error('seen-films file does not contain a JSON array');
    }

    return { ids: new Set(ids.map(String)), existed: true };
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.debug('Unable to read the seen-films file, starting from an empty baseline', error);
    }

    return { ids: new Set(), existed: false };
  }
}

/**
 * @param {Set<string>} seenFilmIds - The full set to persist.
 * @param {string} [path] - Overridable for tests; defaults to the real /data path.
 */
async function saveSeenFilmIds(seenFilmIds, path = DEFAULT_SEEN_FILMS_PATH) {
  await writeFile(path, JSON.stringify([...seenFilmIds]));
}

export { loadSeenFilmIds, saveSeenFilmIds };
