// -----------------------------------------------------------------------------
// Thin HTTP client for pathe.fr's own public JSON API.
//
// pathe.fr's own site calls these exact endpoints (under /api/) to render its
// pages for every visitor: no API key, no session cookie, no authentication
// of any kind. Only the rendered HTML pages (`/cinemas/<slug>`) are behind
// Akamai Bot Manager — this integration never requests those, only the JSON
// API underneath.
//
// That API has its own, much shallower filter though (verified live): it
// rejects a self-identifying User-Agent ("gladys-pathe integration (...)")
// AND curl's own default UA with a 403, but answers normally when NO
// User-Agent header is sent at all. This is not spoofing a browser — no
// fake identity is ever asserted — but it is a deliberate choice to omit
// the header specifically because sending an honest one gets blocked. See
// the README for the full reasoning; this was a conscious, documented
// decision, not an oversight.
//
// It is unofficial (Pathé does not publish or support it) and can change or
// disappear without notice — see the manifest's disclaimer.
//
// Node 20+ provides `fetch` natively: no HTTP client dependency needed.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'pathe-client' });

const BASE_URL = 'https://www.pathe.fr/api';
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * GET one of pathe.fr's own JSON API actions.
 * @param {string} action - e.g. "cinemas"
 * @param {Record<string, string>} params
 * @param {object} [options]
 * @param {number} [options.timeoutMs] - Overrides the default request timeout.
 * @returns {Promise<any>} The parsed JSON body.
 */
export async function patheGetJson(action, params = {}, { timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const url = new URL(`${BASE_URL}/${action}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  logger.debug('pathe.fr request ->', url.toString());

  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    // No headers at all: see the file-level comment above for why no
    // User-Agent is sent, deliberately.
  });

  if (!response.ok) {
    throw new Error(`pathe.fr HTTP ${response.status} on ${action}`);
  }

  return response.json();
}
