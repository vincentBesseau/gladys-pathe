// -----------------------------------------------------------------------------
// Static list of Pathé cinemas (id, name, city), refreshed by hand from
// pathe.fr's own public /api/cinemas endpoint (see README "Refreshing the
// cinema list"). There is no dynamic "select" field type in Gladys for
// anything other than devices, so the "Find my cinema" action searches this
// list and the user pastes the chosen ID into the `cinema_id` config field.
// -----------------------------------------------------------------------------

import cinemas from './cinemas.json' with { type: 'json' };
import { distanceKm } from './geo.js';

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // strip combining diacritics left by NFD normalization
}

/**
 * @param {string} [query] - city or name fragment (case/accent-insensitive).
 * @returns {Array<{id: string, name: string, city: string, latitude: number, longitude: number}>}
 */
export function searchCinemas(query = '') {
  const needle = normalize(query.trim());

  if (!needle) {
    return cinemas;
  }

  return cinemas.filter((cinema) => normalize(`${cinema.name} ${cinema.city}`).includes(needle));
}

/**
 * The `limit` cinemas closest to `origin`, nearest first, each with a
 * `distanceKm` field attached. Browsing the full ~80-cinema list unfiltered
 * isn't useful when only one or two are ever relevant to a given house, so
 * this is what "Find my cinema" falls back to when its query is left empty
 * and the Gladys house is located (see index.js).
 * @param {{latitude: number, longitude: number}} origin
 * @param {number} [limit]
 * @returns {Array<{id: string, name: string, city: string, latitude: number, longitude: number, distanceKm: number}>}
 */
export function nearestCinemas(origin, limit = 5) {
  return cinemas
    .map((cinema) => ({ ...cinema, distanceKm: Math.round(distanceKm(origin, cinema) * 10) / 10 }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}
