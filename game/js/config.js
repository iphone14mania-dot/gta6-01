// Solmar Bay — every tuning number and colour in one place.
// The world is a fixed 3600x2700 logical city; the renderer scales it to the
// window, so no rule below depends on the screen size.

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** The city: 3600 wide, 2700 tall, sea along the west edge. */
export const WORLD = { width: 3600, height: 2700, seaWidth: 180, sandWidth: 130 };

/** Road centrelines: avenues run north-south, streets east-west. */
export const AVENUES = [420, 820, 1220, 1620, 2020, 2420, 2820, 3220];
export const STREETS = [300, 700, 1100, 1500, 1900, 2300];
export const ROAD_WIDTH = 96;
export const LANE_OFFSET = 24;

export const PLAYER = {
  walkSpeed: 210,
  runSpeed: 320,
  radius: 13,
  maxHealth: 100,
  maxArmor: 100,
};

export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 34, rate: 0.28, spread: 0.03, range: 620, bulletSpeed: 900, mag: 12, unlock: 0 },
  smg: { name: 'SMG', damage: 18, rate: 0.09, spread: 0.09, range: 520, bulletSpeed: 1000, mag: 30, unlock: 2 },
  shotgun: { name: 'Shotgun', damage: 22, rate: 0.7, spread: 0.22, range: 380, bulletSpeed: 800, mag: 6, pellets: 6, unlock: 4 },
};

export const CAR = {
  accel: 420,
  brake: 700,
  maxSpeed: 620,
  reverseMax: 180,
  turnRate: 2.6,
  grip: 6.5,
  driftGrip: 2.2,
};

export const TRAFFIC_COUNT = 41;
export const PED_COUNT = 46;
export const PACKAGE_COUNT = 12;

export const WANTED = {
  max: 5,
  decayDelay: 6,
  decayRate: 0.25,
  killPed: 0.6,
  killCop: 1.4,
  killRival: 0.15,
  carjack: 0.35,
  shootNearCop: 0.2,
};

export const MISSION_COUNT = 8;

export const RESPECT_RANKS = ['Nobody', 'Hustler', 'Wheelman', 'Enforcer', 'Shot Caller', 'Bay Legend'];
export const RESPECT_THRESHOLDS = [0, 150, 400, 800, 1500, 2600];

export const CREW = [
  { id: 'driver', name: 'Milo the Wheelman', perk: 'Getaway Driver', desc: 'Police lose you 30% faster.', price: 400 },
  { id: 'muscle', name: 'Dana the Muscle', perk: 'Heavy Backup', desc: 'You take 25% less damage.', price: 600 },
  { id: 'mechanic', name: 'Otto the Mechanic', perk: 'Tuned Rides', desc: 'Every car you drive is 12% faster.', price: 500 },
];

export const GARAGE = {
  engine: [0, 300, 700, 1400],
  armor: [0, 250, 600, 1200],
  respray: 150,
};

export const PALETTE = {
  sea: '#1e7fa8',
  seaDeep: '#146a8f',
  sand: '#e8d5a3',
  grass: '#7fae5a',
  parkGrass: '#6fa055',
  sidewalk: '#c9c2b2',
  road: '#3d3a38',
  roadLine: '#e8d44d',
  buildingRoof: '#b08968',
  buildingRoof2: '#8d6e63',
  buildingRoof3: '#a1887f',
  buildingRoof4: '#7d8c99',
  buildingWall: '#d7ccc8',
  shadow: 'rgba(60, 30, 10, 0.35)',
  palm: '#2e7d32',
  palmTrunk: '#8d6e63',
  player: '#ff5252',
  cop: '#2979ff',
  copCar: '#1565c0',
  heli: '#37474f',
  rival: '#ab47bc',
  taxi: '#ffd54f',
  text: '#f5f0e6',
  muted: '#b8b0a0',
  panel: 'rgba(20, 16, 12, 0.78)',
  gold: '#ffb300',
};

/** Golden-hour sun direction: shadows stretch down-right. */
export const SUN = { x: 0.55, y: 0.85, length: 34 };

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export const SAVE_KEY = 'solmar-bay.save.v1';
export const BEST_KEY = 'solmar-bay.best';
