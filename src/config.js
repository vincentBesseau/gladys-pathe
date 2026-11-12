// Up to five cinemas can be configured; each "now playing" widget then picks
// one of them through its `cinema` setting (a 1..5 slot). Slot 1 keeps the
// historical `cinema_id` / `cinema_name` keys so existing installs keep working
// unchanged; slots 2..5 use `cinema_id_N` / `cinema_name_N`.
export const MAX_CINEMAS = 5;

function normalizeId(value) {
  return String(value ?? '').trim();
}

/**
 * Parse the raw config into the list of configured cinemas (in slot order,
 * empty slots skipped) and the default cinema id (the first configured one,
 * used for the connection status and the scene trigger).
 */
export function normalizeConfig(input = {}) {
  const cinemas = [];

  for (let slot = 1; slot <= MAX_CINEMAS; slot += 1) {
    const idKey = slot === 1 ? 'cinema_id' : `cinema_id_${slot}`;
    const nameKey = slot === 1 ? 'cinema_name' : `cinema_name_${slot}`;
    const id = normalizeId(input[idKey]);

    if (id) {
      cinemas.push({ id, name: String(input[nameKey] ?? '').trim() });
    }
  }

  return {
    cinema_id: cinemas[0]?.id ?? '',
    cinemas,
  };
}

/**
 * Validate that at least one cinema is set. Pathé cinema ids have no fixed shape
 * to check, so only presence is enforced. Also used with a single-cinema object
 * ({ cinema_id }) to re-check one widget's resolved cinema.
 */
export function validateConfig(config) {
  if (!config.cinema_id) {
    throw new Error('Run the "Find my cinema" action and set a cinema ID.');
  }
}

/**
 * The cinema a given "now playing" widget instance should show: the configured
 * cinema at the slot its `cinema` setting selects (1..5), falling back to the
 * first configured cinema when the setting is absent or out of range. This lets
 * one dashboard hold several cinemas (one widget per cinema) chosen from the
 * cinemas set up once in the integration config.
 */
export function resolveWidgetCinema(config, settings = {}) {
  const cinemas = config.cinemas?.length ? config.cinemas : [{ id: config.cinema_id, name: '' }];
  const slot = Number.parseInt(settings?.cinema, 10);

  if (Number.isInteger(slot) && slot >= 1 && slot <= cinemas.length) {
    return cinemas[slot - 1];
  }

  return cinemas[0];
}
