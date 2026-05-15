import { test } from '@playwright/test';

const ROADS = [
  { x: 0, y: 0, w: 48, h: 3, n: 'h-y0' },
  { x: 0, y: -8, w: 48, h: 3, n: 'h-y8' },
  { x: 0, y: 8, w: 48, h: 3, n: 'h-y8p' },
  { x: 0, y: -16, w: 48, h: 3, n: 'h-y16' },
  { x: 0, y: -8, w: 3, h: 28, n: 'v-x0' },
  { x: -12, y: -8, w: 3, h: 28, n: 'v-x12' },
  { x: 12, y: -8, w: 3, h: 28, n: 'v-x12p' },
  { x: 20, y: -8, w: 3, h: 28, n: 'v-x20' },
];

// Bazaar shops: w = 1.45 * scale, h = 1.06 * scale
const SHOPS = [
  { x: -15.5, y: -3.5, w: 1.45 * 2.5, h: 1.06 * 2.5, n: 'Masala' },
  { x: -3.5, y: -3.5, w: 1.45 * 2.5, h: 1.06 * 2.5, n: 'Code' },
  { x: 8.5, y: -3.5, w: 1.45 * 2.5, h: 1.06 * 2.5, n: 'Snack' },
];

// Pet shop: 0.85 scale on base 8.1x5.1
const PET = { x: 7, y: -11.8, w: 8.1 * 0.85, h: 5.1 * 0.85, n: 'PetWorkshop' };

function overlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x - a.w / 2 < b.x + b.w / 2 && a.x + a.w / 2 > b.x - b.w / 2 &&
         a.y - a.h / 2 < b.y + b.h / 2 && a.y + a.h / 2 > b.y - b.h / 2;
}

function contains(inner: { x: number; y: number; w: number; h: number }, outer: { x: number; y: number; w: number; h: number }) {
  return inner.x - inner.w / 2 >= outer.x - outer.w / 2 &&
         inner.x + inner.w / 2 <= outer.x + outer.w / 2 &&
         inner.y - inner.h / 2 >= outer.y - outer.h / 2 &&
         inner.y + inner.h / 2 <= outer.y + outer.h / 2;
}

test('no overlaps', () => {
  const errors: string[] = [];

  for (const s of SHOPS) {
    for (const r of ROADS) {
      if (overlap(s, r)) {
        errors.push(`${s.n} shop at (${s.x},${s.y} ${s.w.toFixed(1)}x${s.h.toFixed(1)}) overlaps road ${r.n} (${r.x},${r.y} ${r.w}x${r.h})`);
      }
    }
  }

  for (const r of ROADS) {
    if (overlap(PET, r)) {
      errors.push(`Pet workshop at (${PET.x},${PET.y} ${PET.w.toFixed(1)}x${PET.h.toFixed(1)}) overlaps road ${r.n} (${r.x},${r.y} ${r.w}x${r.h})`);
    }
  }

  for (const s of SHOPS) {
    if (overlap(PET, s)) {
      errors.push(`Pet workshop overlaps ${s.n} shop`);
    }
  }

  for (let i = 0; i < SHOPS.length; i++) {
    for (let j = i + 1; j < SHOPS.length; j++) {
      if (overlap(SHOPS[i], SHOPS[j])) {
        errors.push(`${SHOPS[i].n} shop overlaps ${SHOPS[j].n} shop`);
      }
    }
  }

  // Verify everything is on the island (radius 40)
  const all = [...SHOPS, PET];
  for (const item of all) {
    for (const [cx, cy] of [[item.x, item.y], [item.x - item.w / 2, item.y], [item.x + item.w / 2, item.y], [item.x, item.y - item.h / 2], [item.x, item.y + item.h / 2]]) {
      if (Math.hypot(cx, cy) > 38) {
        errors.push(`${item.n} extends near island edge (${cx.toFixed(1)},${cy.toFixed(1)})`);
      }
    }
  }

  if (errors.length > 0) {
    console.log('FAILED:');
    errors.forEach(e => console.log(`  ✗ ${e}`));
  } else {
    console.log('✓ All layout checks passed');
  }

  test.expect(errors.length).toBe(0);
});
