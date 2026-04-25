import assert from 'node:assert/strict';
import {
  isAccessPasswordAuthenticated,
  markAccessPasswordAuthenticated,
} from './accessSession.js';

function createSessionStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

globalThis.sessionStorage = createSessionStorage();

assert.equal(isAccessPasswordAuthenticated('123456'), false);

markAccessPasswordAuthenticated('123456');

assert.equal(isAccessPasswordAuthenticated('123456'), true);
assert.equal(isAccessPasswordAuthenticated('changed'), false);

delete globalThis.sessionStorage;

assert.equal(isAccessPasswordAuthenticated('123456'), false);
