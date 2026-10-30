import assert from 'node:assert/strict';
// Reference vectors for the existing toolchain Mulberry32 and Box–Muller order.
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function sample(random, mean, std, min, max, rate) {
  let u = 0, v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  const value = Math.max(0, Math.min(max, Math.max(min, mean + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * std)));
  return Math.floor(value * rate + 0.5);
}
const generate = () => { const r = rng(0); return [sample(r, .2, .05, 0, 1, 24000), sample(r, .2, .05, 0, 1, 24000)]; };
console.log('seed 0 samples:', generate());
assert.deepEqual(generate(), [6752, 6061]);
assert.deepEqual(generate(), generate());
assert.equal(sample(rng(0), 1, 0, 0, .25, 24000), 6000);
assert.equal(sample(rng(0), -1, 0, -2, 1, 24000), 0);
assert.equal(Math.floor(.01 * 30), 0);
assert.equal(Math.ceil(.04 * 30), 2);
assert.equal(Math.floor(.5 + .5), 1);
