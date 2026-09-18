// -----------------------------------------------------------------------------
// Entry point of the Gladys external integration.
//
// This is a "provider" type integration (Gladys capabilities/provider-type.md):
// it has no device surface, and declares two capabilities instead — a
// dashboard widget (capabilities/dashboard-widgets.md, "now_playing") and a
// scene trigger (capabilities/scene-triggers-and-actions.md, "new_film") —
// for the films currently playing at ONE configured Pathé cinema. It also
// exposes a "Find my cinema" action to look up the cinema's ID.
//
// Environment variables provided by the Gladys supervisor to the container:
//   - GLADYS_HOST_API_URL         (host API URL)
//   - GLADYS_INTEGRATION_TOKEN    (integration-scoped JWT)
//   - GLADYS_INTEGRATION_SELECTOR (integration identifier)
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { normalizeConfig, validateConfig } from './src/config.js';
import { searchCinemas, nearestCinemas } from './src/pathe/cinemas.js';
import { fetchNowPlaying } from './src/pathe/nowPlaying.js';
import { buildNowPlayingContent, resolvePosterUrl } from './src/pathe/widget.js';
import { startNewFilmPolling, stopNewFilmPolling } from './src/pathe/newFilmPolling.js';

const gladys = new GladysIntegration();

let config = normalizeConfig();

// How many cinemas to show when the "Find my cinema" query is left empty
// and the house is located: browsing the full ~80-cinema list unfiltered
// isn't useful when only one or two are ever relevant to a given house.
const NEARBY_CINEMAS_LIMIT = 5;

function formatCinemaLine(cinema) {
  const distance = cinema.distanceKm === undefined ? '' : ` (${cinema.distanceKm} km)`;

  return `${cinema.name} — ${cinema.city}${distance} (ID: ${cinema.id})`;
}

/**
 * The cinemas nearest the first located Gladys house, or `null` when there
 * is no house, no house has been located (`latitude`/`longitude` null), or
 * `getHouses()` fails (e.g. `location` not yet granted for this install) —
 * callers fall back to the full unfiltered list in that case.
 */
async function findNearbyCinemas() {
  let houses;

  try {
    houses = await gladys.getHouses();
  } catch (error) {
    logger.debug('Unable to fetch houses for geolocation, falling back to the full list', error);

    return null;
  }

  const house = houses?.[0];

  if (!house || house.latitude === null || house.longitude === null) {
    return null;
  }

  return nearestCinemas(house, NEARBY_CINEMAS_LIMIT);
}

gladys.onAction('search_cinemas', async (fields) => {
  const query = (fields.query || '').trim();

  let results;

  if (query) {
    results = searchCinemas(query);

    logger.info(`Action search_cinemas <- query="${query}", ${results.length} result(s)`);
  } else {
    results = await findNearbyCinemas();

    if (results) {
      logger.info(`Action search_cinemas <- no query, ${results.length} cinema(s) near the house`);
    } else {
      results = searchCinemas('');

      logger.info(
        `Action search_cinemas <- no query and no located house, listing all ${results.length} cinema(s)`,
      );
    }
  }

  if (results.length === 0) {
    return {
      en: 'No Pathé cinema matches this search.',
      fr: 'Aucun cinéma Pathé ne correspond à cette recherche.',
    };
  }

  return results.map(formatCinemaLine).join('\n');
});

gladys.onWidgetGet('now_playing', async () => {
  validateConfig(config);

  logger.info(`onWidgetGet(now_playing) <- cinema ${config.cinema_id}`);

  const movies = await fetchNowPlaying(config.cinema_id);

  return buildNowPlayingContent(movies);
});

gladys.onWidgetGetImage(async (imageKey) => {
  const posterUrl = resolvePosterUrl(imageKey);

  if (!posterUrl) {
    throw new Error(`onWidgetGetImage: unknown image key "${imageKey}"`);
  }

  const response = await fetch(posterUrl);

  if (!response.ok) {
    throw new Error(`onWidgetGetImage: pathe.fr HTTP ${response.status} on ${posterUrl}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());

  return bytes.toString('base64');
});

gladys.onConfigUpdated(async (newConfig) => {
  logger.info('onConfigUpdated -> new configuration received');

  config = normalizeConfig(newConfig);

  try {
    validateConfig(config);

    await gladys.setConnectionStatus(true);
    startNewFilmPolling(gladys, () => fetchNowPlaying(config.cinema_id));
  } catch (error) {
    await gladys.setConnectionStatus(false, {
      en: error.message,
      fr: error.message,
    });
  }
});

gladys.on('connected', async () => {
  config = normalizeConfig(await gladys.getConfig());

  try {
    validateConfig(config);

    await gladys.setConnectionStatus(true);
    startNewFilmPolling(gladys, () => fetchNowPlaying(config.cinema_id));
  } catch (error) {
    await gladys.setConnectionStatus(false, {
      en: error.message,
      fr: error.message,
    });
  }
});

gladys.handleShutdown(async () => stopNewFilmPolling());

logger.info('Starting the Pathé integration...');

gladys.connect().catch((error) => {
  logger.error('Initial connection to Gladys failed', error);

  process.exit(1);
});
