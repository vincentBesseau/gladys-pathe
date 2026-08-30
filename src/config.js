const DEFAULTS = Object.freeze({
  cinema_id: '',
});

export function normalizeConfig(input = {}) {
  return {
    cinema_id: String(input.cinema_id ?? DEFAULTS.cinema_id).trim(),
  };
}

export function validateConfig(config) {
  if (!config.cinema_id) {
    throw new Error('Run the "Find my cinema" action and set a cinema ID.');
  }
}
