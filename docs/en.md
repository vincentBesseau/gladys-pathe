# Pathé

Movies currently playing at your Pathé cinema, shown in Gladys's "Upcoming
Releases" widget.

## Important: unofficial integration

This integration reads the public JSON data that **pathe.fr already uses to
render its own pages** — the same content you would see by opening your
cinema's page in a browser, nothing more. It is not developed, endorsed, or
affiliated with Pathé. Pathé can change its site at any time and break this
integration without notice.

No paid API, no credential extracted from an app is used. One thing worth
being explicit about: pathe.fr's rendered pages are behind bot-detection
(Akamai), and this integration never loads those; the JSON API underneath
them, however, rejects an honest identification (it answers 403 to a
User-Agent that identifies this integration) but works normally when no
User-Agent is sent at all. That choice is deliberate and documented — see
the repository's README for the full reasoning.

## Configuration

1. Open the integration's **Configuration** tab.
2. Run the **Find my cinema** action: leave the field empty to list every
   Pathé cinema, or type a city to filter. The result is shown under the
   button as `Cinema name — City (ID: cinema-pathe-rennes)`.
3. Copy the ID of your cinema into the **Cinema ID** field, then save.

The films playing today at that cinema then appear in the dashboard's
"Upcoming Releases" widget. Clicking a poster opens the film's detail card,
which shows a table of today's showtimes at that cinema (time and version,
VF/VOST). Unlike the UGC and CGR integrations, there is no trailer here:
pathe.fr's own video CDN (`media.pathe.fr`) refuses to play anything
requested outside of a pathe.fr page itself, so the link would never work
for you anyway.

## Known limitations (v1)

- One cinema at a time per installation of the integration.
- Only today's films and showtimes (no view of tomorrow or later days).
- The cinema list is a hand-maintained static list (see the repository's
  README): a brand-new Pathé cinema may not appear in it yet.

## Troubleshooting

The integration logs everything it does: check the integration logs from the
Gladys interface (or `docker logs` on the host) with `LOG_LEVEL=debug` for
full detail.
