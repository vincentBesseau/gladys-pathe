// -----------------------------------------------------------------------------
// Content of the "now_playing" dashboard widget (Gladys capability
// dashboard-widgets.md): a card-list of today's films at the configured Pathé
// cinema, with their showtimes and a booking link.
//
// Posters never travel as a raw URL in the content: onWidgetGetImage serves
// the bytes on demand (section 6 of the spec), so this module also keeps the
// image-key -> real poster URL mapping the image handler resolves against.
//
// Pathé movies never carry a trailerUrl (media.pathe.fr's Referer-based
// hotlink protection, see nowPlaying.js), so the trailer link is simply
// never added below — no Pathé-specific branching needed.
// -----------------------------------------------------------------------------

const posterUrlByImageKey = new Map();

function imageKeyOf(filmId) {
  return `poster-${filmId}`;
}

function joinShowtimes(showtimes) {
  if (!Array.isArray(showtimes) || showtimes.length === 0) {
    return undefined;
  }

  return showtimes
    .map((showtime) => (showtime.version ? `${showtime.time} ${showtime.version}` : showtime.time))
    .join(', ');
}

/**
 * @param {Array<object>} movies - The films currently playing, from fetchNowPlaying().
 * @returns {object} A widget content tree (dashboard-widgets.md, section 4).
 */
function buildNowPlayingContent(movies) {
  if (movies.length === 0) {
    return { version: 1, ttl_seconds: 900, components: [] };
  }

  const items = movies.slice(0, 12).map((movie) => {
    const links = [{ url: movie.sourceUrl, label: { en: 'Book', fr: 'Réserver' } }];

    if (movie.trailerUrl) {
      links.push({ url: movie.trailerUrl, label: { en: 'Trailer', fr: 'Bande-annonce' } });
    }

    const item = {
      title: movie.title,
      subtitle: joinShowtimes(movie.showtimes),
      links,
    };

    if (movie.overview) {
      item.description = movie.overview;
    }

    if (movie.posterUrl) {
      const key = imageKeyOf(movie.id);

      posterUrlByImageKey.set(key, movie.posterUrl);
      item.image = key;
    }

    return item;
  });

  return {
    version: 1,
    // Today's program changes on its own schedule (new showtimes, films
    // leaving the bill) — 15 min keeps the card fresh without hammering
    // pathe.fr on every dashboard render.
    ttl_seconds: 900,
    components: [{ type: 'card-list', display: 'grid', items }],
  };
}

/**
 * @param {string} imageKey - As sent in a previous widget content (imageKeyOf()).
 * @returns {string|undefined} The real poster URL, or undefined for an unknown/expired key.
 */
function resolvePosterUrl(imageKey) {
  return posterUrlByImageKey.get(imageKey);
}

export { buildNowPlayingContent, resolvePosterUrl, imageKeyOf, joinShowtimes };
