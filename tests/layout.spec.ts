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

// Bazaar shops at scale 1.5: w=1.45*1.5, h=1.06*1.5
const SHOPS = [
  { x: -3, y: -5.5, w: 2.175, h: 1.59, n: 'Masala' },
  { x: 3, y: -5.5, w: 2.175, h: 1.59, n: 'Code' },
  { x: 8, y: -5.5, w: 2.175, h: 1.59, n: 'Snack' },
];

// Pet shop at scale 0.5: w=8.1*0.5, h=5.1*0.5
const PET = { x: -8, y: -5.2, w: 4.05, h: 2.55, n: 'PetWorkshop' };

function overlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x - a.w / 2 < b.x + b.w / 2 && a.x + a.w / 2 > b.x - b.w / 2 &&
         a.y - a.h / 2 < b.y + b.h / 2 && a.y + a.h / 2 > b.y - b.h / 2;
}

test('no overlaps', () => {
  const errors: string[] = [];
  const all = [...SHOPS, PET];

  for (const s of all) {
    for (const r of ROADS) {
      if (overlap(s, r)) {
        errors.push(`${s.n} at (${s.x},${s.y} ${s.w.toFixed(2)}x${s.h.toFixed(2)}) overlaps road ${r.n}`);
      }
    }
  }

  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      if (overlap(all[i], all[j])) {
        errors.push(`${all[i].n} overlaps ${all[j].n}`);
      }
    }
  }

  // Island boundary check
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
