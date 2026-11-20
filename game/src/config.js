// Coral Harbor — every tuning number, colour and city constant in one place.
// The city is a fixed grid of streets; nothing below depends on the screen size.

export const STEP = 1 / 60; // fixed simulation step, 60 updates a second

export const CITY = {
  // Streets run every 108 units (90-unit blocks + 18-unit roads), 10 each way.
  streetSpacing: 108,
  streetCount: 10,
  roadWidth: 18,
  blockSize: 90,
  bounds: 560, // playable area is [-560, 560] on both axes
  beachX: 560, // east of this: sand, then the ocean
  oceanX: 640,
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 11,
  jumpSpeed: 8,
  radius: 0.8,
  height: 1.8,
  health: 100,
};

export const CAR = {
  maxSpeed: 46, // m/s, sports car; others scale by their topSpeed factor
  accel: 22,
  brake: 34,
  reverseMax: 12,
  steerMax: 0.55,
  grip: 8,
  radius: 2.2,
};

export const WANTED = {
  maxStars: 5,
  // seconds out of every cop's sight before a star drops, per star level
  hideTime: [0, 8, 12, 18, 25, 35],
  copCars: [0, 1, 2, 3, 4, 5],
  roadblockAt: 3,
  heliAt: 4,
};

export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 25, rate: 0.28, auto: false, mag: 12, reload: 0.9, range: 90, spread: 0.008, kick: 0.4 },
  smg: { name: 'SMG', damage: 12, rate: 0.09, auto: true, mag: 30, reload: 1.4, range: 70, spread: 0.03, kick: 0.25 },
  shotgun: { name: 'Shotgun', damage: 9, pellets: 6, rate: 0.8, auto: false, mag: 6, reload: 2.0, range: 40, spread: 0.09, kick: 1.2 },
  rifle: { name: 'Rifle', damage: 40, rate: 0.14, auto: true, mag: 24, reload: 1.8, range: 140, spread: 0.012, kick: 0.6 },
};
export const WEAPON_ORDER = ['pistol', 'smg', 'shotgun', 'rifle'];

export const PALETTE = {
  skyTop: 0x2e1a4d,
  skyHorizon: 0xff9a5c,
  sun: 0xffd9a0,
  fog: 0x3a2350,
  road: 0x2b2f38,
  roadLine: 0xd8d3a8,
  sidewalk: 0x8a8d96,
  sand: 0xe8d29a,
  ocean: 0x1e6f8e,
  grass: 0x4a7c43,
  building: [0x9a8f8a, 0x7d8aa0, 0xa08a7d, 0x8a9a8f, 0xb0a090, 0x6f7d95, 0xc0b49a],
  glass: 0x2a3548,
  windowLit: 0xffd27a,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const SAVE_KEY = 'coral-harbor.save.v1';

// Mission start points, garage and safehouse, in world coordinates.
export const PLACES = {
  garage: { x: -54, z: -270, name: 'Harbor Garage' },
  safehouse: { x: -270, z: 378, name: 'Safehouse' },
  docks: { x: 378, z: 486, name: 'Coral Docks' },
  beach: { x: 486, z: -54, name: 'Sunset Beach' },
  downtown: { x: 54, z: 54, name: 'Downtown' },
  airport: { x: -486, z: -486, name: 'Coral Airfield' },
  stadium: { x: -162, z: 162, name: 'Harbor Stadium' },
  hills: { x: -486, z: 486, name: 'Palm Hills' },
};
