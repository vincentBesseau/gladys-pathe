# gladys-pathe

[![Latest version](https://img.shields.io/github/v/tag/vincentBesseau/gladys-pathe?label=version)](https://github.com/vincentBesseau/gladys-pathe/tags)
[![CI](https://github.com/vincentBesseau/gladys-pathe/actions/workflows/ci.yml/badge.svg)](https://github.com/vincentBesseau/gladys-pathe/actions/workflows/ci.yml)
[![Docker pulls](https://ghcr-badge.elias.eu.org/shield/vincentBesseau/gladys-pathe/gladys-pathe)](https://github.com/vincentBesseau/gladys-pathe/pkgs/container/gladys-pathe)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue)](https://www.apache.org/licenses/LICENSE-2.0)
[![Gladys](https://img.shields.io/badge/gladys-%3E%3D4.90.0-6f42c1)](https://gladysassistant.com)

Pathé cinema integration for [Gladys Assistant](https://gladysassistant.com):
movies currently playing at your Pathé cinema, shown in the "Upcoming
Releases" widget (Gladys core contract B.19, `movies` external-integration
type).

## Why this one is different (and the User-Agent decision)

Pathé's rendered pages (`https://www.pathe.fr/cinemas/<slug>`) are behind
Akamai Bot Manager — verified live, a plain HTTP client gets a 403 there.
This integration **never requests those pages**. It only calls the JSON API
under `pathe.fr/api/` that those pages themselves call to get their data —
`shows`, `show/<slug>`, `show/<slug>/showtimes/<cinema>/<date>`,
`cinemas` — none of which sit behind that same Akamai protection.

That API has its own, much shallower filter, though. Verified live:

- A self-identifying User-Agent (`"gladys-pathe integration (...)"`) → **403**
- curl's own default User-Agent (`curl/x.y.z`) → **403**
- **No User-Agent header at all** → **200**, identical response

This integration sends no User-Agent, deliberately. Some context for that
decision, since it's a judgment call rather than a clean-cut case like
`gladys-ugc`/`gladys-cgr`:

- It is **not spoofing a browser** — no fake identity (`Mozilla/5.0 ...
Chrome/...`) is ever asserted. Omitting an optional HTTP header is
  different from lying about what sent the request.
- The filter itself looks shallow — a User-Agent string check, not the
  TLS-fingerprinting/JS-challenge system protecting the rendered pages. It
  rejects known non-browser signatures but doesn't require a browser to get
  through.
- The data behind it is the same public, free, no-login showtimes info the
  site shows any visitor — not something gated for a business reason.
- It's still a conscious choice made specifically because sending an honest
  identifier gets blocked, not an accident. If Pathé's filter changes to
  something that actually requires impersonating a browser or defeating a
  real challenge, this integration should stop rather than escalate to
  that.

## What it does

- Configure one Pathé cinema (its slug, e.g. `cinema-pathe-rennes`).
- `movies.getUpcoming` returns the films playing there today, each with its
  showtimes (`movie.showtimes`, Gladys core B.19). Unlike `gladys-ugc`/
  `gladys-cgr`, pathe.fr has no single "now playing at cinema X" endpoint —
  the national catalog call (`/api/shows`) isn't actually scoped by cinema
  (verified live: identical results with or without a `cinemaSlug`-like
  parameter), so this integration cross-references it against the
  cinema-specific showtimes endpoint, one call per candidate film with at
  least one showtime somewhere nationally, to find out which ones actually
  play at the configured cinema. All calls run with bounded concurrency;
  verified live in well under 2s end to end for a full cinema.
- **No `trailerUrl`, deliberately**: `pathe.fr/api/show/<slug>` does return
  trailer URLs, but `media.pathe.fr` (the video CDN they point to) enforces
  Referer-based hotlink protection — verified live, a request with no
  Referer (which is exactly what a visitor's browser sends when opening
  this integration's link directly) gets a 403 "Access Denied" from Akamai,
  every time, for every visitor. Unlike UGC/CGR's `fr.vid.web.acsta.net`
  (verified to have no such restriction), there is no way to make this link
  work from outside pathe.fr's own pages, so it is omitted rather than
  offered broken.
- A **Find my cinema** action searches a hand-maintained static list of
  Pathé (and Pathé-network, e.g. some Gaumont) cinemas, from `pathe.fr`'s
  own public `/api/cinemas` endpoint. Left empty, it returns the 5 cinemas
  nearest the Gladys house (`location: true` in the manifest,
  `gladys.getHouses()`) instead of dumping the full ~80-cinema list — falls
  back to the full list when no house has a location set.

## Development

```bash
npm install
npm test
npm run lint
npm run format:check
```

Conventions: ESM, native `fetch` (no HTTP client dependency), `node --test`
(no test framework dependency) — matching the sibling `gladys-ugc` and
`gladys-cgr` integrations. No HTML-parsing dependency needed: Pathé's API is
JSON end to end.

### SDK dependency (temporary)

`onMoviesGetUpcoming` and `getHouses()` were added to the official SDK in
[GladysAssistant/integration-sdk-js#32](https://github.com/GladysAssistant/integration-sdk-js/pull/32),
not yet merged/published. `package.json` points
`@gladysassistant/integration-sdk` at that branch directly:

```json
"@gladysassistant/integration-sdk": "github:vincentBesseau/integration-sdk-js#feature/movies-type"
```

Switch this back to a published `^x.y.z` version once that PR is merged and
released.

### Refreshing the cinema list

`src/pathe/cinemas.json` is a hand-maintained snapshot of
`GET https://www.pathe.fr/api/cinemas?language=fr` (no User-Agent header,
see above) — re-fetch it and rebuild the list from each entry's `slug`,
`name`, and `theaters[0]` (`addressLine1` → `address`, `addressZip` →
`postalCode`, `addressCity` → `city`, `gpsPosition.x`/`.y` → `latitude`/
`longitude`, used by `nearestCinemas()` in `src/pathe/cinemas.js`) —
first-party and precise, no third-party geocoding needed here (unlike
`gladys-ugc`, whose cinema list has no such data built in).

## Related integrations

Same chain-by-chain approach, one repo per cinema chain:

- [`gladys-ugc`](https://github.com/vincentBesseau/gladys-ugc) — UGC
- [`gladys-cgr`](https://github.com/vincentBesseau/gladys-cgr) — CGR

## Publishing checklist

- [ ] `gladys_version` in `gladys-assistant-integration.json` is a
      placeholder (`>=4.90.0`) — set it to the actual Gladys release that
      ships the `movies` integration type (Gladys core PR
      [GladysAssistant/Gladys#3061](https://github.com/GladysAssistant/Gladys/pull/3061))
      once it is released.
- [ ] Swap the SDK dependency to a published version (see above).
- [x] Add a `cover.png` (referenced by `cover_image` in the manifest) — 800x534, under 150 KB.
- [ ] Run **Release** (GitHub Actions) once ready to cut `v0.1.0` and publish
      the image to `ghcr.io/vincentbesseau/gladys-pathe`.

## License

Apache-2.0
