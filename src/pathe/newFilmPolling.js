// -----------------------------------------------------------------------------
// Polling loop for the new_film scene trigger (Gladys capability
// scene-triggers-and-actions.md): "this happened, with these details" — the
// integration owns the diffing, Gladys only matches and runs scenes.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { loadSeenFilmIds, saveSeenFilmIds } from './seenFilms.js';
import { joinShowtimes } from './widget.js';

const logger = createLogger({ name: 'pathe-new-film-polling' });

// Twice a day, like the check-movies-new-releases job this replaces: a
// cinema program changes far less often than weather.
const POLL_INTERVAL_MS = 12 * 60 * 60 * 1000;

let pollTimer = null;

/**
 * @param {import('@gladysassistant/integration-sdk').GladysIntegration} gladys
 * @param {() => Promise<Array<object>>} fetchMovies - Returns the current "now playing" list.
 * @param {{ seenFilmIds: Set<string>|null, isFirstCheck?: boolean, seenFilmsPath?: string }} state -
 * Mutable cache of the ever-seen ids, loaded from disk on its first use (which also sets
 * `isFirstCheck`); `seenFilmsPath` is overridable for tests, defaults to the real /data path.
 */
async function checkForNewFilms(gladys, fetchMovies, state) {
  let movies;

  try {
    movies = await fetchMovies();
  } catch (error) {
    logger.debug('Unable to fetch the now-playing list, keeping the previous baseline', error);

    return;
  }

  if (state.seenFilmIds === null) {
    const loaded = await loadSeenFilmIds(state.seenFilmsPath);

    state.seenFilmIds = loaded.ids;
    // Told apart from "the set is currently empty" (a legitimately
    // film-less program on a previous, already-persisted check): only a
    // missing/corrupt file means "never checked before".
    state.isFirstCheck = !loaded.existed;
  }

  const { seenFilmIds, isFirstCheck } = state;
  const newFilms = movies.filter((movie) => !seenFilmIds.has(String(movie.id)));

  movies.forEach((movie) => seenFilmIds.add(String(movie.id)));
  await saveSeenFilmIds(seenFilmIds, state.seenFilmsPath);
  state.isFirstCheck = false;

  // The very first check of a fresh container is a baseline: firing for
  // every film already on the bill would flood every configured scene the
  // moment the integration starts.
  if (isFirstCheck) {
    logger.info(`new_film: baseline of ${movies.length} film(s), no event fired`);

    return;
  }

  await Promise.all(
    newFilms.map(async (movie) => {
      logger.info(`new_film: "${movie.title}" was not seen before, firing the trigger`);

      try {
        await gladys.publishSceneEvent('new_film', {
          title: movie.title,
          release_date: movie.releaseDate,
          showtimes: joinShowtimes(movie.showtimes) || null,
          source_url: movie.sourceUrl,
        });
      } catch (error) {
        logger.error(`new_film: unable to publish the scene event for "${movie.title}"`, error);
      }
    }),
  );
}

/**
 * @param {import('@gladysassistant/integration-sdk').GladysIntegration} gladys
 * @param {() => Promise<Array<object>>} fetchMovies
 */
function startNewFilmPolling(gladys, fetchMovies) {
  if (pollTimer) {
    return;
  }

  const state = { seenFilmIds: null };

  checkForNewFilms(gladys, fetchMovies, state).catch((error) =>
    logger.error('new_film: initial check failed', error),
  );
  pollTimer = setInterval(() => {
    checkForNewFilms(gladys, fetchMovies, state).catch((error) =>
      logger.error('new_film: check failed', error),
    );
  }, POLL_INTERVAL_MS);
}

function stopNewFilmPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export { startNewFilmPolling, stopNewFilmPolling, checkForNewFilms };
