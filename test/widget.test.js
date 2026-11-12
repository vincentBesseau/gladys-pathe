import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNowPlayingContent,
  resolvePosterUrl,
  imageKeyOf,
  joinShowtimes,
} from '../src/pathe/widget.js';

test('buildNowPlayingContent returns an empty component list for an empty program', () => {
  const content = buildNowPlayingContent([]);

  assert.deepEqual(content, { version: 1, ttl_seconds: 900, components: [] });
});

test('buildNowPlayingContent adds a heading with the cinema name when a title is given', () => {
  const movie = {
    id: '1',
    title: 'A',
    releaseDate: '2026-01-01',
    sourceUrl: 'https://example.test/1',
  };

  const withFilms = buildNowPlayingContent([movie], { title: 'My cinema' });
  assert.deepEqual(withFilms.components[0], {
    type: 'text',
    variant: 'heading',
    text: 'My cinema',
  });
  assert.equal(withFilms.components[1].type, 'card-list');

  // The heading is kept even on an empty program, so the card still names its cinema.
  const empty = buildNowPlayingContent([], { title: 'My cinema' });
  assert.deepEqual(empty.components, [{ type: 'text', variant: 'heading', text: 'My cinema' }]);
});

test('buildNowPlayingContent renders a card-list item with showtimes and a book link, but no trailer link (Pathé never sets trailerUrl)', () => {
  const movie = {
    id: 'harry-potter-et-les-reliques-de-la-mort-partie-1',
    title: 'Harry Potter et les reliques de la mort - partie 1',
    releaseDate: '2010-11-24',
    overview: 'La chasse aux Horcruxes commence.',
    posterUrl: 'https://media.pathe.fr/poster-lg.jpg',
    sourceUrl: 'https://www.pathe.fr/films/harry-potter-et-les-reliques-de-la-mort-partie-1',
    showtimes: [
      { time: '20:00', version: 'VF' },
      { time: '20:15', version: 'VOST' },
    ],
  };

  const content = buildNowPlayingContent([movie]);

  assert.equal(content.version, 1);
  assert.equal(content.components.length, 1);

  const [cardList] = content.components;
  assert.equal(cardList.type, 'card-list');
  assert.equal(cardList.display, 'grid');
  assert.equal(cardList.items.length, 1);

  const [item] = cardList.items;
  assert.equal(item.title, 'Harry Potter et les reliques de la mort - partie 1');
  assert.equal(item.subtitle, '20:00 VF, 20:15 VOST');
  assert.equal(item.description, 'La chasse aux Horcruxes commence.');
  assert.equal(item.image, 'poster-harry-potter-et-les-reliques-de-la-mort-partie-1');
  assert.deepEqual(item.links, [{ url: movie.sourceUrl, label: { en: 'Book', fr: 'Réserver' } }]);
});

test('buildNowPlayingContent omits description and image when the movie has neither', () => {
  const movie = {
    id: 'a',
    title: 'A',
    releaseDate: '2026-01-01',
    sourceUrl: 'https://www.pathe.fr/films/a',
  };

  const [{ items }] = buildNowPlayingContent([movie]).components;

  assert.equal(items[0].description, undefined);
  assert.equal(items[0].image, undefined);
});

test('buildNowPlayingContent caps items at 12, the grid content-budget bound', () => {
  const movies = Array.from({ length: 15 }).map((value, index) => ({
    id: `movie-${index}`,
    title: `Movie ${index}`,
    releaseDate: '2026-01-01',
    sourceUrl: `https://www.pathe.fr/films/movie-${index}`,
  }));

  const [{ items }] = buildNowPlayingContent(movies).components;

  assert.equal(items.length, 12);
});

test('buildNowPlayingContent lists the films past the grid cap in a body line', () => {
  const movies = Array.from({ length: 15 }).map((value, index) => ({
    id: String(index),
    title: `Movie ${index}`,
    releaseDate: '2026-01-01',
    sourceUrl: `https://example.test/${index}`,
  }));

  const { components } = buildNowPlayingContent(movies);

  assert.equal(components.length, 2);
  assert.equal(components[0].type, 'card-list');

  const note = components[1];
  assert.equal(note.type, 'text');
  assert.equal(note.variant, 'body');
  assert.equal(note.text.fr, '+3 films non affichés : Movie 12, Movie 13, Movie 14');
  assert.equal(note.text.en, '+3 more films not shown: Movie 12, Movie 13, Movie 14');
});

test('buildNowPlayingContent uses the singular when exactly one film is hidden', () => {
  const movies = Array.from({ length: 13 }).map((value, index) => ({
    id: String(index),
    title: `Movie ${index}`,
    releaseDate: '2026-01-01',
    sourceUrl: `https://example.test/${index}`,
  }));

  const note = buildNowPlayingContent(movies).components[1];

  assert.equal(note.text.fr, '+1 film non affiché : Movie 12');
  assert.equal(note.text.en, '+1 more film not shown: Movie 12');
});

test('buildNowPlayingContent adds no overflow line at or below the 12-film cap', () => {
  const movies = Array.from({ length: 12 }).map((value, index) => ({
    id: String(index),
    title: `Movie ${index}`,
    releaseDate: '2026-01-01',
    sourceUrl: `https://example.test/${index}`,
  }));

  const { components } = buildNowPlayingContent(movies);

  assert.equal(components.length, 1);
  assert.equal(components[0].type, 'card-list');
});

test('resolvePosterUrl returns the poster URL published for a previously-built item, and undefined for an unknown key', () => {
  const movie = {
    id: 'with-poster',
    title: 'A',
    releaseDate: '2026-01-01',
    posterUrl: 'https://media.pathe.fr/poster-999.jpg',
    sourceUrl: 'https://www.pathe.fr/films/with-poster',
  };

  buildNowPlayingContent([movie]);

  assert.equal(
    resolvePosterUrl(imageKeyOf('with-poster')),
    'https://media.pathe.fr/poster-999.jpg',
  );
  assert.equal(resolvePosterUrl('poster-unknown'), undefined);
});

test('imageKeyOf builds a stable, id-derived key', () => {
  assert.equal(imageKeyOf('with-poster'), 'poster-with-poster');
});

test('joinShowtimes flattens showtimes, keeping a bare time when there is no version', () => {
  assert.equal(joinShowtimes(undefined), undefined);
  assert.equal(joinShowtimes([]), undefined);
  assert.equal(joinShowtimes([{ time: '20:15' }]), '20:15');
  assert.equal(
    joinShowtimes([{ time: '14:00', version: 'VF' }, { time: '20:15' }]),
    '14:00 VF, 20:15',
  );
});
