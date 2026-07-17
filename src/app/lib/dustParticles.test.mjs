import assert from 'node:assert/strict';
import { advanceDustParticle, createDustParticle } from './dustParticles.js';

const randomValues = [0.5, 0.25, 0.75, 0.4, 0.6, 0.3];
let index = 0;
const particle = createDustParticle(() => randomValues[index++], 200, 100);
assert.deepEqual(particle, { x: 100, y: 25, vx: 0.05, vy: -0.02, size: 1.2, alpha: 0.18 });

const moved = advanceDustParticle(
  { x: 50, y: 50, vx: 0, vy: 0, size: 1, alpha: 0.15 },
  { width: 100, height: 100 },
  { x: 55, y: 50, radius: 40 },
);
assert.ok(moved.x < 50, 'nearby pointer repels the particle');

const wrapped = advanceDustParticle(
  { x: 101, y: 20, vx: 0.2, vy: 0, size: 1, alpha: 0.15 },
  { width: 100, height: 100 },
  null,
);
assert.ok(wrapped.x <= 1, 'particle wraps at the horizontal edge');
