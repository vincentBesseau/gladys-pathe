// -----------------------------------------------------------------------------
// Entry point of the Gladys external integration.
//
// This is a "movies" type integration (Gladys contract B.19): it answers
// `movies.getUpcoming` with the films currently playing at ONE configured
// Pathé cinema, and exposes a "Find my cinema" action to look up its ID.
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

gladys.onMoviesGetUpcoming(async () => {
  validateConfig(config);

  logger.info(`onMoviesGetUpcoming <- cinema ${config.cinema_id}`);

  return fetchNowPlaying(config.cinema_id);
});

gladys.onConfigUpdated(async (newConfig) => {
  logger.info('onConfigUpdated -> new configuration received');

  config = normalizeConfig(newConfig);

  try {
    validateConfig(config);

    await gladys.setConnectionStatus(true);
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
  } catch (error) {
    await gladys.setConnectionStatus(false, {
      en: error.message,
      fr: error.message,
    });
  }
});

logger.info('Starting the Pathé integration...');

gladys.connect().catch((error) => {
  logger.error('Initial connection to Gladys failed', error);

  process.exit(1);
});
