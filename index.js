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
import { searchCinemas } from './src/pathe/cinemas.js';
import { fetchNowPlaying } from './src/pathe/nowPlaying.js';

const gladys = new GladysIntegration();

let config = normalizeConfig();

function formatCinemaLine(cinema) {
  return `${cinema.name} — ${cinema.city} (ID: ${cinema.id})`;
}

gladys.onAction('search_cinemas', async (fields) => {
  const results = searchCinemas(fields.query || '');

  logger.info(
    `Action search_cinemas <- query="${fields.query || ''}", ${results.length} result(s)`,
  );

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
