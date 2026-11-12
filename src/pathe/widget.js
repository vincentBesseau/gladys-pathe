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
function buildNowPlayingContent(movies, { title } = {}) {
  // A heading naming the cinema goes in the header slot (canonical order), kept
  // even on an empty program so the card still says which cinema it is.
  const heading = title ? [{ type: 'text', variant: 'heading', text: title }] : [];

  if (movies.length === 0) {
    return { version: 1, ttl_seconds: 900, components: heading };
  }

  // The grid caps at 12 cards (dashboard-widgets.md: card-list "1-12 in grid"),
  // and a widget can carry only one focal component, so a second card-list
  // would be dropped by the core. A cinema can run more than 12 films, so the
  // films past the cap would silently vanish. Rather than leave the user
  // guessing what is missing, name them in a short body line under the grid
  // (the core renders a `text`/`body` in the slot below the focal component).
  const MAX_GRID_ITEMS = 12;

  const items = movies.slice(0, MAX_GRID_ITEMS).map((movie) => {
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

  const components = [...heading, { type: 'card-list', display: 'grid', items }];

  const hidden = movies.slice(MAX_GRID_ITEMS);

  if (hidden.length > 0) {
    const titles = hidden.map((movie) => movie.title).join(', ');
    const plural = hidden.length > 1 ? 's' : '';

    // The core trims this to the `body` bound (300 chars) with an ellipsis, so
    // on a very long overflow the last titles are dropped cleanly rather than
    // overflowing the card.
    components.push({
      type: 'text',
      variant: 'body',
      text: {
        en: `+${hidden.length} more film${plural} not shown: ${titles}`,
        fr: `+${hidden.length} film${plural} non affiché${plural} : ${titles}`,
      },
    });
  }

  return {
    version: 1,
    // Today's program changes on its own schedule (new showtimes, films
    // leaving the bill) — 15 min keeps the card fresh without hammering
    // pathe.fr on every dashboard render.
    ttl_seconds: 900,
    components,
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
