import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fetchNowPlaying } from '../src/pathe/nowPlaying.js';

const realFetch = globalThis.fetch;

const showsSample = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/shows-sample.json', import.meta.url)), 'utf-8'),
);

const showtimesBySlug = {
  'harry-potter-et-les-reliques-de-la-mort-partie-1': [
    { time: '2026-08-31 20:00:00', version: 'vf' },
    { time: '2026-08-31 20:15:00', version: 'vost' },
  ],
  'spider-man-brand-new-day-47729': [],
  'no-details-available': [{ time: '2026-08-31 21:00:00', version: 'vf' }],
};

const detailsBySlug = {
  'harry-potter-et-les-reliques-de-la-mort-partie-1': {
    slug: 'harry-potter-et-les-reliques-de-la-mort-partie-1',
    title: 'Harry Potter et les reliques de la mort - partie 1',
    releaseAt: { FR_FR: '2010-11-24' },
    synopsis: 'La chasse aux Horcruxes commence.',
    posterPath: {
      lg: 'https://media.pathe.fr/poster-lg.jpg',
      md: 'https://media.pathe.fr/poster-md.jpg',
    },
    trailers: [
      { externalId: 'https://media.pathe.fr/trailer-en.mp4', isMain: false, language: 'en' },
      { externalId: 'https://media.pathe.fr/trailer-fr.mp4', isMain: true, language: 'fr' },
    ],
  },
};

const realNow = new Date('2026-08-31T12:00:00');

afterEach(() => {
  globalThis.fetch = realFetch;
});

function fetchRouter() {
  return async (url) => {
    const href = url.toString();

    if (href.includes('/api/shows?')) {
      return { ok: true, json: async () => showsSample };
    }

    const showtimesMatch = href.match(/\/api\/show\/([^/]+)\/showtimes\//);
    if (showtimesMatch) {
      const slug = showtimesMatch[1];
      return { ok: true, json: async () => showtimesBySlug[slug] || [] };
    }

    const detailsMatch = href.match(/\/api\/show\/([^/?]+)\?/);
    if (detailsMatch) {
      const slug = detailsMatch[1];
      const details = detailsBySlug[slug];
      if (!details) {
        return { ok: false, status: 404 };
      }
      return { ok: true, json: async () => details };
    }

    throw new Error(`Unexpected fetch: ${href}`);
  };
}

test('parses films actually playing at the given cinema, with showtimes and trailer', async () => {
  globalThis.fetch = fetchRouter();

  const movies = await fetchNowPlaying('cinema-pathe-rennes', { now: realNow });

  assert.equal(
    movies.length,
    1,
    'films with no session at this cinema, or with no fetchable details, are excluded',
  );

  assert.deepEqual(movies[0], {
    id: 'harry-potter-et-les-reliques-de-la-mort-partie-1',
    title: 'Harry Potter et les reliques de la mort - partie 1',
    releaseDate: '2010-11-24',
    overview: 'La chasse aux Horcruxes commence.',
    posterUrl: 'https://media.pathe.fr/poster-lg.jpg',
    trailerUrl: 'https://media.pathe.fr/trailer-fr.mp4',
    sourceUrl: 'https://www.pathe.fr/films/harry-potter-et-les-reliques-de-la-mort-partie-1',
    showtimes: [
      { time: '20:00', version: 'VF' },
      { time: '20:15', version: 'VOST' },
    ],
  });
});

test('excludes a national-catalog film with zero sessions at this specific cinema', async () => {
  globalThis.fetch = fetchRouter();

  const movies = await fetchNowPlaying('cinema-pathe-rennes', { now: realNow });

  assert.ok(!movies.some((movie) => movie.id === 'spider-man-brand-new-day-47729'));
});

test('excludes a film with sessions but no fetchable details, without failing the batch', async () => {
  globalThis.fetch = fetchRouter();

  const movies = await fetchNowPlaying('cinema-pathe-rennes', { now: realNow });

  assert.ok(!movies.some((movie) => movie.id === 'no-details-available'));
});

test('never fetches details for a film with zero showtimes candidates', async () => {
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ shows: [] }) });

  const movies = await fetchNowPlaying('cinema-pathe-rennes', { now: realNow });

  assert.deepEqual(movies, []);
});

test('picks the main French trailer over other languages/non-main ones', async () => {
  globalThis.fetch = fetchRouter();

  const movies = await fetchNowPlaying('cinema-pathe-rennes', { now: realNow });

  assert.equal(movies[0].trailerUrl, 'https://media.pathe.fr/trailer-fr.mp4');
});

test('turns the literal <br/> separators in synopsis into paragraph breaks, not raw HTML', async () => {
  const oneFilmShows = { shows: [{ slug: 'with-html-synopsis', next24ShowtimesCount: 1 }] };
  const oneFilmShowtimes = [{ time: '2026-08-31 20:00:00', version: 'vf' }];
  const oneFilmDetails = {
    slug: 'with-html-synopsis',
    title: 'With HTML Synopsis',
    releaseAt: { FR_FR: '2026-08-01' },
    synopsis: 'Premier paragraphe.<br/><br/>Second paragraphe avec un <b>tag</b> inattendu.',
  };

  globalThis.fetch = async (url) => {
    const href = url.toString();
    if (href.includes('/api/shows?')) {
      return { ok: true, json: async () => oneFilmShows };
    }
    if (href.includes('/showtimes/')) {
      return { ok: true, json: async () => oneFilmShowtimes };
    }
    return { ok: true, json: async () => oneFilmDetails };
  };

  const movies = await fetchNowPlaying('cinema-pathe-rennes', { now: realNow });

  assert.equal(
    movies[0].overview,
    'Premier paragraphe.\n\nSecond paragraphe avec un tag inattendu.',
  );
});
