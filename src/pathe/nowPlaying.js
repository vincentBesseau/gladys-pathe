// -----------------------------------------------------------------------------
// "Now playing" for one Pathé cinema.
//
// pathe.fr's own site calls these exact JSON endpoints (see client.js for
// the User-Agent caveat) to render its pages: `shows` for the national
// catalog, `show/<slug>/showtimes/<cinema>/<date>` for a specific cinema's
// sessions, and `show/<slug>` for the film's own details (synopsis,
// release date, trailer).
//
// Unlike UGC or CGR, pathe.fr has no single "now playing at cinema X"
// endpoint: the catalog call isn't actually scoped by cinema (verified
// live), so this cross-references it against the cinema-specific showtimes
// endpoint, one call per candidate film, to find out which ones actually
// play there today.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { patheGetJson } from './client.js';

const logger = createLogger({ name: 'pathe-now-playing' });

// Two rounds of per-film calls (showtimes, then details for the films that
// survive): bounded so a full national catalog check still resolves
// comfortably within the 15s ack budget Gladys allows for movies.getUpcoming.
const FETCH_CONCURRENCY = 15;

function todayDateKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Run `mapper` over `items` with at most `concurrency` calls in flight.
 * @param {Array} items
 * @param {number} concurrency
 * @param {(item: any) => Promise<void>} mapper
 */
async function forEachWithConcurrency(items, concurrency, mapper) {
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = items[nextIndex];
      nextIndex += 1;
      await mapper(current);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
}

function versionLabel(version) {
  if (typeof version !== 'string' || version.length === 0) {
    return undefined;
  }

  return version.toUpperCase();
}

/**
 * Find every film with at least one session at `cinemaId` on `dateKey`.
 * @param {string} cinemaId
 * @param {string} dateKey
 * @returns {Promise<Map<string, Array<{time: string, version?: string}>>>}
 */
async function findPlayingFilms(cinemaId, dateKey) {
  const { shows } = await patheGetJson('shows', { date: dateKey, language: 'fr' });
  const candidates = (Array.isArray(shows) ? shows : []).filter(
    (show) => show.next24ShowtimesCount > 0,
  );

  const showtimesBySlug = new Map();

  await forEachWithConcurrency(candidates, FETCH_CONCURRENCY, async (show) => {
    let sessions;

    try {
      sessions = await patheGetJson(`show/${show.slug}/showtimes/${cinemaId}/${dateKey}`, {
        language: 'fr',
      });
    } catch (error) {
      logger.debug(
        `Pathé film ${show.slug}: unable to fetch showtimes for cinema ${cinemaId}`,
        error,
      );

      return;
    }

    if (!Array.isArray(sessions) || sessions.length === 0) {
      return;
    }

    const showtimes = sessions
      .filter((session) => typeof session.time === 'string')
      .map((session) => {
        const time = session.time.slice(11, 16);
        const version = versionLabel(session.version);

        return version ? { time, version } : { time };
      });

    if (showtimes.length > 0) {
      showtimesBySlug.set(show.slug, showtimes);
    }
  });

  return showtimesBySlug;
}

// pathe.fr's synopsis field is plain text with the occasional literal
// `<br/>` between paragraphs — not real markup requiring a parser, just
// this one pattern to turn into a paragraph break, plus a defensive strip
// of anything else tag-shaped so it never reaches the widget as raw HTML.
function cleanSynopsis(synopsis) {
  if (typeof synopsis !== 'string' || synopsis.length === 0) {
    return undefined;
  }

  const cleaned = synopsis
    .replace(/(<br\s*\/?>\s*)+/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .trim();

  return cleaned.length > 0 ? cleaned : undefined;
}

function toMovie(details, showtimes) {
  const releaseDate = details.releaseAt?.FR_FR;

  if (!details.slug || !details.title || !releaseDate) {
    logger.debug(
      `Pathé film ${details.slug} (${details.title}) is missing a required field, skipping it`,
    );

    return null;
  }

  return {
    id: details.slug,
    title: details.title,
    releaseDate,
    overview: cleanSynopsis(details.synopsis),
    posterUrl: details.posterPath?.lg || details.posterPath?.md || undefined,
    // No trailerUrl: media.pathe.fr's video CDN enforces Referer-based
    // hotlink protection (verified live — a direct request with no Referer
    // gets a 403 "Access Denied" from Akamai). A visitor's browser opening
    // this integration's trailer link directly never sends a pathe.fr
    // Referer, so the link would 403 for every single user, every time.
    // Better to not offer the button at all than to offer one that always
    // fails.
    sourceUrl: `https://www.pathe.fr/films/${details.slug}`,
    showtimes,
  };
}

/**
 * Fetch and parse the films currently playing at a Pathé cinema, including
 * their showtimes and trailer.
 * @param {string} cinemaId
 * @param {object} [options]
 * @param {Date} [options.now] - Overridable for tests; defaults to the real current time.
 * @returns {Promise<Array<{id: string, title: string, releaseDate: string, overview?: string, posterUrl?: string, trailerUrl?: string, sourceUrl: string, showtimes?: Array<{time: string, version?: string}>}>>}
 */
export async function fetchNowPlaying(cinemaId, { now = new Date() } = {}) {
  const dateKey = todayDateKey(now);
  const showtimesBySlug = await findPlayingFilms(cinemaId, dateKey);

  const slugs = [...showtimesBySlug.keys()];

  if (slugs.length === 0) {
    logger.info(`Pathé cinema ${cinemaId}: 0 film(s) currently playing`);

    return [];
  }

  const detailsBySlug = new Map();

  await forEachWithConcurrency(slugs, FETCH_CONCURRENCY, async (slug) => {
    try {
      const details = await patheGetJson(`show/${slug}`, { language: 'fr' });
      detailsBySlug.set(slug, details);
    } catch (error) {
      logger.debug(`Pathé film ${slug}: unable to fetch details`, error);
    }
  });

  const movies = slugs
    .map((slug) => {
      const details = detailsBySlug.get(slug);

      return details ? toMovie(details, showtimesBySlug.get(slug)) : null;
    })
    .filter(Boolean);

  logger.info(`Pathé cinema ${cinemaId}: ${movies.length} film(s) currently playing`);

  return movies;
}
