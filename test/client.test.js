import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { patheGetJson } from '../src/pathe/client.js';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

test('builds the request URL from the action and params', async () => {
  let calledUrl;
  globalThis.fetch = async (url) => {
    calledUrl = url;
    return { ok: true, json: async () => ({}) };
  };

  await patheGetJson('cinemas', { language: 'fr' });

  assert.equal(calledUrl.toString(), 'https://www.pathe.fr/api/cinemas?language=fr');
});

test('sends no headers at all (deliberately no User-Agent, see client.js)', async () => {
  let calledOptions;
  globalThis.fetch = async (url, options) => {
    calledOptions = options;
    return { ok: true, json: async () => ({}) };
  };

  await patheGetJson('cinemas');

  assert.equal(calledOptions.headers, undefined);
});

test('throws on a non-2xx response', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 403 });

  await assert.rejects(() => patheGetJson('cinemas'), /pathe\.fr HTTP 403/);
});

test('returns the parsed JSON body', async () => {
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ hello: 'world' }) });

  assert.deepEqual(await patheGetJson('cinemas'), { hello: 'world' });
});
