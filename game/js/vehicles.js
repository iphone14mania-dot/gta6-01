// Cars: arcade driving physics, lane-following traffic that brakes for the
// car ahead, and stealing. A car is one object whether the player, traffic or
// the police drive it; only the driver changes.

import { AVENUES, STREETS, ROAD_WIDTH, LANE_OFFSET, CAR, TRAFFIC_COUNT } from './config.js';
import { angleDiff, clamp, dist } from './random.js';
import { buildingHit, clampToWorld, isOnRoad } from './city.js';

const CAR_COLORS = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#ecf0f1', '#2c3e50', '#e67e22', '#16a085', '#d35400'];
const CAR_KINDS = ['sedan', 'sedan', 'sedan', 'hatch', 'sports', 'truck', 'van'];

let nextCarId = 1;

export function makeCar(x, y, angle, kind, color, driver) {
  const id = nextCarId;
  nextCarId += 1;
  // Default paint from the car's position, not the global id counter — so a
  // world's traffic looks the same no matter how many worlds were built
  // before it in the same page (the screenshot staging builds two).
  const paint = color || CAR_COLORS[Math.abs(Math.floor(x * 0.37 + y * 0.91)) % CAR_COLORS.length];
  return {
    id,
    x, y, angle, kind,
    color: paint,
    driver: driver || 'traffic',
    speed: 0,
    steer: 0,
    length: kind === 'truck' || kind === 'van' ? 52 : 44,
    width: kind === 'truck' || kind === 'van' ? 26 : 22,
    health: 100,
    hitCooldown: 0,
    route: null,
    brakeLight: false,
    siren: false,
    honk: 0,
  };
}

/** Spawn the ambient traffic on the roads, all on the right-hand lane. */
export function spawnTraffic(city, rng) {
  const cars = [];
  let guard = 0;
  while (cars.length < TRAFFIC_COUNT && guard < 800) {
    guard += 1;
    const vertical = rng.chance(0.5);
    const x = vertical ? rng.pick(AVENUES) + LANE_OFFSET * (rng.chance(0.5) ? 1 : -1) : rng.range(400, 3500);
    const y = vertical ? rng.range(150, 2550) : rng.pick(STREETS) + LANE_OFFSET * (rng.chance(0.5) ? 1 : -1);
    if (!isOnRoad(x, y)) continue;
    if (cars.some((c) => dist(c.x, c.y, x, y) < 140)) continue;
    const angle = vertical ? (x % 2 === 0 ? Math.PI / 2 : -Math.PI / 2) : (y % 2 === 0 ? 0 : Math.PI);
    const car = makeCar(x, y, angle, rng.pick(CAR_KINDS), null, 'traffic');
    car.speed = rng.range(140, 260);
    car.route = { vertical, dir: rng.chance(0.5) ? 1 : -1 };
    cars.push(car);
  }
  return cars;
}

/** Nearest road centreline in the given axis, for lane snapping. */
function nearestLine(list, v) {
  let best = list[0];
  for (const l of list) if (Math.abs(l - v) < Math.abs(best - v)) best = l;
  return best;
}

/** Drive one traffic car along its road; brake for cars ahead, turn at random. */
function driveTrafficCar(state, car, dt) {
  const city = state.city;
  const route = car.route || { vertical: true, dir: 1 };
  car.route = route;
  // Steer toward the lane centre of the road we are on.
  const laneX = route.vertical ? nearestLine(AVENUES, car.x) + LANE_OFFSET * route.dir : car.x;
  const laneY = !route.vertical ? nearestLine(STREETS, car.y) + LANE_OFFSET * route.dir : car.y;
  const targetAngle = route.vertical ? (route.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (route.dir > 0 ? 0 : Math.PI);
  const wantX = route.vertical ? laneX : car.x + Math.cos(targetAngle) * 80;
  const wantY = route.vertical ? car.y + Math.sin(targetAngle) * 80 : laneY;
  const want = Math.atan2(wantY - car.y, wantX - car.x);
  car.angle += clamp(angleDiff(car.angle, want), -1.8 * dt, 1.8 * dt);

  // Brake when another car is close ahead.
  let blocked = false;
  for (const other of state.cars) {
    if (other === car) continue;
    const d = dist(car.x, car.y, other.x, other.y);
    if (d < 70) {
      const ahead = Math.cos(other.angle - car.angle);
      const facing = Math.cos(Math.atan2(other.y - car.y, other.x - car.x) - car.angle);
      if (facing > 0.6 && ahead > -0.5) { blocked = true; break; }
    }
  }
  const cruise = 200 + ((car.id * 37) % 80);
  car.speed += (blocked ? -600 : (car.speed < cruise ? 260 : -120)) * dt;
  car.speed = clamp(car.speed, 0, 320);
  car.brakeLight = blocked;

  // At an intersection, sometimes turn onto the crossing road.
  const onAvenue = AVENUES.some((a) => Math.abs(car.x - a) < 6);
  const onStreet = STREETS.some((s) => Math.abs(car.y - s) < 6);
  if (onAvenue && onStreet && state.rng.chance(dt * 0.25)) {
    route.vertical = !route.vertical;
    route.dir = state.rng.chance(0.5) ? 1 : -1;
  }
  moveCar(state, car, dt);
}

/** Move a car forward along its heading, with building and world collision. */
export function moveCar(state, car, dt) {
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = buildingHit(state.city, nx, ny, car.width / 2 + 4);
  if (hit) {
    car.speed *= -0.25;
    // One impact's worth of damage and smoke — a sustained scrape must not
    // drain the whole health bar in a second.
    if ((car.hitCooldown || 0) <= 0) {
      car.hitCooldown = 0.6;
      car.health -= 4;
      state.effects.shake = Math.max(state.effects.shake, 3);
      spawnSmoke(state, car.x, car.y, 4);
    }
    return;
  }
  const p = clampToWorld(nx, ny);
  car.x = p.x;
  car.y = p.y;
  // Soft car-car collision: push apart.
  for (const other of state.cars) {
    if (other === car) continue;
    const d = dist(car.x, car.y, other.x, other.y);
    if (d > 0.01 && d < (car.length + other.length) / 2 - 6) {
      const push = ((car.length + other.length) / 2 - 6 - d) / 2;
      const a = Math.atan2(car.y - other.y, car.x - other.x);
      car.x += Math.cos(a) * push;
      car.y += Math.sin(a) * push;
      other.x -= Math.cos(a) * push;
      other.y -= Math.sin(a) * push;
      if ((Math.abs(car.speed) > 200 || Math.abs(other.speed) > 200)
        && (car.hitCooldown || 0) <= 0 && (other.hitCooldown || 0) <= 0) {
        car.hitCooldown = 0.5;
        other.hitCooldown = 0.5;
        car.health -= 6;
        other.health -= 6;
        spawnSmoke(state, (car.x + other.x) / 2, (car.y + other.y) / 2, 3);
        // The impact impulse is one-off too — cutting speed every step while
        // overlapped welded cars together at intersections.
        car.speed *= 0.7;
        other.speed *= 0.7;
      }
    }
  }
}

/** Player driving: arcade handling with drift when the handbrake is held. */
export function drivePlayerCar(state, car, input, dt) {
  const engineLevel = state.upgrades.engine || 0;
  const maxSpeed = CAR.maxSpeed * (1 + engineLevel * 0.12) * (state.crew.mechanic ? 1.12 : 1);
  if (input.up) car.speed += CAR.accel * dt * (car.speed < 0 ? 2.2 : 1);
  if (input.down) car.speed -= (car.speed > 10 ? CAR.brake : CAR.accel * 0.6) * dt;
  if (!input.up && !input.down) car.speed -= Math.sign(car.speed) * 120 * dt;
  car.speed = clamp(car.speed, -CAR.reverseMax, maxSpeed);
  const steerInput = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const grip = input.handbrake ? CAR.driftGrip : CAR.grip;
  const turn = steerInput * CAR.turnRate * clamp(Math.abs(car.speed) / 220, 0, 1) * Math.sign(car.speed || 1);
  car.angle += turn * dt;
  // Skid marks while drifting or hard cornering — spaced out so they read as
  // dashed rubber, not one solid black snake.
  if ((input.handbrake && Math.abs(car.speed) > 160) || (Math.abs(steerInput) > 0 && Math.abs(car.speed) > 420)) {
    const lastSkid = state.skids[state.skids.length - 1];
    if (!lastSkid || dist(lastSkid.x, lastSkid.y, car.x, car.y) > 18) {
      state.skids.push({ x: car.x - Math.cos(car.angle) * 16, y: car.y - Math.sin(car.angle) * 16, angle: car.angle, life: 5 });
      if (state.skids.length > 220) state.skids.shift();
    }
    if (state.rng.chance(dt * 8)) spawnSmoke(state, car.x, car.y, 1);
  }
  car.speed *= 1 - (1 - grip / 8) * dt * 0.4;
  moveCar(state, car, dt);
}

/** Find the nearest car to (x, y) within range. */
export function nearestCar(state, x, y, range) {
  let best = null;
  let bestD = range;
  for (const car of state.cars) {
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

/** The player steals the nearest car (or enters their own). Returns the car or null. */
export function stealCar(state) {
  const car = nearestCar(state, state.player.x, state.player.y, 70);
  if (!car) return null;
  if (car.driver === 'traffic' || car.driver === 'none') {
    car.driver = 'player';
    state.player.inCar = car.id;
    state.player.onFoot = false;
    state.stats.carsStolen += 1;
    state.police.heat += 0.35;
    return car;
  }
  return null;
}

/** The player steps out of the car beside it. */
export function exitCar(state) {
  const car = state.cars.find((c) => c.id === state.player.inCar);
  if (!car) return;
  car.driver = 'none';
  car.speed = 0;
  state.player.inCar = null;
  state.player.onFoot = true;
  state.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
  state.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
  state.player.angle = car.angle;
}

export function spawnSmoke(state, x, y, n) {
  for (let i = 0; i < n; i += 1) {
    state.particles.push({
      x: x + state.rng.range(-8, 8), y: y + state.rng.range(-8, 8),
      vx: state.rng.range(-30, 30), vy: state.rng.range(-50, -10),
      life: state.rng.range(0.5, 1.4), maxLife: 1.4, type: 'smoke', size: state.rng.range(6, 14),
    });
  }
}

export function spawnExplosion(state, x, y) {
  state.effects.shake = Math.max(state.effects.shake, 14);
  state.effects.flash = 0.25;
  for (let i = 0; i < 26; i += 1) {
    const a = state.rng.range(0, Math.PI * 2);
    const s = state.rng.range(60, 320);
    state.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: state.rng.range(0.3, 0.9), maxLife: 0.9,
      type: state.rng.chance(0.5) ? 'fire' : 'smoke', size: state.rng.range(5, 16),
    });
  }
}

/** Update every car: traffic drives, wrecks smoke, dead cars burn out. */
export function updateCars(state, dt) {
  for (const car of state.cars) {
    if (car.driver === 'traffic') driveTrafficCar(state, car, dt);
    if (car.hitCooldown > 0) car.hitCooldown -= dt;
    if (car.health <= 0 && !car.wrecked) {
      car.wrecked = true;
      spawnExplosion(state, car.x, car.y);
    }
    if (car.wrecked) {
      car.speed *= 1 - 2 * dt;
      if (state.rng.chance(dt * 6)) spawnSmoke(state, car.x, car.y, 1);
    }
  }
}
