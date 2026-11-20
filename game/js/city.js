// Solmar Bay's city: seven districts on a road grid, seeded buildings with
// golden-hour shadows, a beach with animated sea, palm trees, and the fixed
// landmarks (Rosa's garage, the gun store, taxi stands, hidden packages).
// Pure construction from a seeded RNG: the same seed builds the same city.

import { AVENUES, STREETS, ROAD_WIDTH, WORLD, PACKAGE_COUNT } from './config.js';
import { clamp } from './random.js';

export const DISTRICTS = [
  { name: 'Marina Beach', x: 180, y: 0, w: 560, h: 950, tint: '#e8d5a3' },
  { name: 'Palm Heights', x: 1220, y: 0, w: 1600, h: 650, tint: '#cfe8b0' },
  { name: 'Portside', x: 2820, y: 0, w: 780, h: 1100, tint: '#b8c8d8' },
  { name: 'Downtown', x: 1020, y: 650, w: 1400, h: 850, tint: '#d8c8b0' },
  { name: 'Central Park', x: 1820, y: 1100, w: 1000, h: 800, tint: '#8fbf6f' },
  { name: 'Old Town', x: 420, y: 1500, w: 1400, h: 800, tint: '#d8b8a0' },
  { name: 'East Docks', x: 2820, y: 1500, w: 780, h: 1200, tint: '#a8b0b8' },
];

const ROOFS = ['#b08968', '#8d6e63', '#a1887f', '#7d8c99', '#9c7b54', '#6d7f8e'];
const PARKING_LOTS = [
  { x: 900, y: 780 }, { x: 2100, y: 1600 }, { x: 2900, y: 600 }, { x: 1300, y: 2100 },
];

/** Is (x, y) on a road (including intersections)? */
export function isOnRoad(x, y) {
  const half = ROAD_WIDTH / 2;
  for (const ax of AVENUES) if (Math.abs(x - ax) <= half) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) <= half) return true;
  return false;
}

/** Which district contains (x, y)? Falls back to the nearest one. */
export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[3];
}

/** Does the circle at (x, y, r) hit any building? Returns the building or null. */
export function buildingHit(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

/** Does the segment from (x1, y1) to (x2, y2) cross a building (bullet walls)? */
export function segmentBlocked(city, x1, y1, x2, y2) {
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 12);
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (buildingHit(city, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 1)) return true;
  }
  return false;
}

/** Snap a point out of buildings by pushing it to the nearest free edge. */
export function pushOutOfBuildings(city, x, y, r) {
  const b = buildingHit(city, x, y, r);
  if (!b) return { x, y };
  const left = b.x - r - x;
  const right = b.x + b.w + r - x;
  const top = b.y - r - y;
  const bottom = b.y + b.h + r - y;
  const m = Math.min(Math.abs(left), Math.abs(right), Math.abs(top), Math.abs(bottom));
  if (m === Math.abs(left)) return { x: x + left, y };
  if (m === Math.abs(right)) return { x: x + right, y };
  if (m === Math.abs(top)) return { x, y: y + top };
  return { x, y: y + bottom };
}

/** Build the whole city from the seeded RNG. */
export function buildCity(rng) {
  const buildings = [];
  const palms = [];
  const trees = [];
  const half = ROAD_WIDTH / 2 + 14;

  // One or two buildings per block between the roads.
  const xs = [WORLD.seaWidth + WORLD.sandWidth + half, ...AVENUES.map((a) => a + half)];
  const ys = [half, ...STREETS.map((s) => s + half)];
  const xe = [...AVENUES.map((a) => a - half), WORLD.width - half];
  const ye = [...STREETS.map((s) => s - half), WORLD.height - half];
  for (let bi = 0; bi < xs.length; bi += 1) {
    for (let bj = 0; bj < ys.length; bj += 1) {
      const bx = xs[bi];
      const by = ys[bj];
      const bw = xe[bi] - bx;
      const bh = ye[bj] - by;
      if (bw < 90 || bh < 90) continue;
      const cx = bx + bw / 2;
      const cy = by + bh / 2;
      const d = districtAt(cx, cy);
      if (d.name === 'Central Park') {
        // Park: trees and paths, no buildings.
        const n = rng.int(4, 8);
        for (let i = 0; i < n; i += 1) {
          trees.push({ x: rng.range(bx + 20, bx + bw - 20), y: rng.range(by + 20, by + bh - 20), r: rng.range(14, 24) });
        }
        continue;
      }
      if (d.name === 'Marina Beach' && bx < 700) {
        // Beachfront: palms along the sand, low villas behind.
        for (let i = 0; i < 3; i += 1) {
          palms.push({ x: rng.range(bx + 10, bx + 60), y: rng.range(by + 10, by + bh - 10), s: rng.range(0.8, 1.3) });
        }
      }
      const count = rng.chance(0.55) ? 1 : 2;
      for (let k = 0; k < count; k += 1) {
        const w = count === 1 ? rng.range(bw * 0.5, bw * 0.85) : rng.range(bw * 0.3, bw * 0.45);
        const h = count === 1 ? rng.range(bh * 0.5, bh * 0.85) : rng.range(bh * 0.35, bh * 0.6);
        const x = count === 1 ? bx + (bw - w) / 2 + rng.range(-8, 8) : bx + 12 + k * (bw / 2) + rng.range(0, 10);
        const y = count === 1 ? by + (bh - h) / 2 + rng.range(-8, 8) : by + 12 + rng.range(0, bh - h - 24);
        const tall = d.name === 'Downtown' && rng.chance(0.5);
        buildings.push({
          x, y, w, h,
          roof: rng.pick(ROOFS),
          height: tall ? rng.int(3, 5) : rng.int(1, 2),
          windows: rng.int(2, 5),
        });
      }
      if (rng.chance(0.4)) {
        palms.push({ x: rng.range(bx + 10, bx + bw - 10), y: rng.range(by + 10, by + bh - 10), s: rng.range(0.7, 1.2) });
      }
    }
  }

  // Palm-lined beach promenade.
  for (let y = 120; y < WORLD.height - 100; y += 130) {
    palms.push({ x: 300 + rng.range(-8, 8), y: y + rng.range(-20, 20), s: rng.range(0.9, 1.4) });
  }

  // Twelve hidden packages in quiet corners.
  const packages = [];
  let guard = 0;
  while (packages.length < PACKAGE_COUNT && guard < 400) {
    guard += 1;
    const x = rng.range(380, WORLD.width - 120);
    const y = rng.range(120, WORLD.height - 120);
    if (isOnRoad(x, y)) continue;
    if (buildingHit({ buildings }, x, y, 20)) continue;
    if (packages.some((p) => Math.hypot(p.x - x, p.y - y) < 320)) continue;
    packages.push({ x, y, taken: false });
  }

  return {
    buildings,
    palms,
    trees,
    packages,
    parkingLots: PARKING_LOTS,
    garage: { x: 980, y: 1750, w: 150, h: 110, name: "Rosa's Garage" },
    gunStore: { x: 1500, y: 900, w: 130, h: 90, name: 'Harbor Arms' },
    taxiStands: [
      { x: 1220, y: 300 }, { x: 2020, y: 1500 }, { x: 820, y: 2300 },
    ],
    start: { x: 1220, y: 1150 },
  };
}

/** Clamp a position inside the world (sea is a wall on the west). */
export function clampToWorld(x, y) {
  return {
    x: clamp(x, WORLD.seaWidth + 8, WORLD.width - 8),
    y: clamp(y, 8, WORLD.height - 8),
  };
}
