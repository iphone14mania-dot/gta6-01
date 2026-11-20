// Screenshot staging: each named shot builds a fresh world, plays real game
// rules forward with a road-following autopilot for a fixed number of steps,
// then freezes the frame for capture. No scripted pictures — every shot is
// the live game, caught mid-action.

import { STEP, AVENUES, STREETS } from './config.js';
import { createWorld, stepWorld, snapCamera } from './world.js';
import { startMission } from './missions.js';
import { makeCar, stealCar } from './vehicles.js';
import { isOnRoad } from './city.js';
import { dist } from './random.js';

/** The nearest road coordinate to a value (avenue or street). */
function nearestRoad(roads, value) {
  let best = roads[0];
  for (const r of roads) if (Math.abs(r - value) < Math.abs(best - value)) best = r;
  return best;
}

/**
 * A Manhattan route across the road grid: along the nearest street to the
 * target's avenue, down that avenue, then the short hop to the target.
 * Duplicate waypoints (already on the target road) are dropped.
 */
export function manhattanRoute(fromX, fromY, toX, toY) {
  const street = nearestRoad(STREETS, fromY);
  const avenue = nearestRoad(AVENUES, toX);
  const raw = [
    { x: avenue, y: street },
    { x: avenue, y: toY },
    { x: toX, y: toY },
  ];
  const points = [];
  let px = fromX;
  let py = fromY;
  for (const pt of raw) {
    if (dist(pt.x, pt.y, px, py) > 90) {
      points.push(pt);
      px = pt.x;
      py = pt.y;
    }
  }
  return { points, i: 0 };
}

/** Autopilot: steer the player's car through the route's waypoints. */
function autopilotInput(state, route) {
  const input = { up: false, down: false, left: false, right: false, run: false, handbrake: false, firing: false, mouseX: 0, mouseY: 0 };
  const car = state.cars.find((c) => c.id === state.player.inCar);
  if (!car) return input;
  const target = route.points[route.i];
  if (!target) {
    input.up = true; // Out of waypoints: keep rolling straight.
    return input;
  }
  if (dist(car.x, car.y, target.x, target.y) < 70) {
    route.i += 1;
    return input; // Coast one step through the waypoint.
  }
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  // Brake into sharp corners so the car stays on the road, and cruise below
  // top speed — a 600-speed drift swings wide off the avenue.
  if (Math.abs(diff) > 0.9 && Math.abs(car.speed) > 300) {
    input.down = true;
  } else if (Math.abs(car.speed) < 470) {
    input.up = true;
  }
  // Screen coords: angle grows clockwise, so a positive diff (target
  // clockwise of the heading) means steering right.
  if (diff > 0.15) input.right = true;
  else if (diff < -0.15) input.left = true;
  if (Math.abs(diff) > 1.4 && Math.abs(car.speed) > 200) input.handbrake = true;
  return input;
}

function runSteps(state, steps, route) {
  for (let i = 0; i < steps; i += 1) {
    const input = route ? autopilotInput(state, route) : { up: false, down: false, left: false, right: false, run: false, handbrake: false, firing: false, mouseX: 0, mouseY: 0 };
    stepWorld(state, STEP, input);
  }
  snapCamera(state);
}

/** Drop traffic cars that a collision pushed off the road — they read as bugs in a still. */
function cleanupStrays(state) {
  state.cars = state.cars.filter((c) => c.driver !== 'traffic' || isOnRoad(c.x, c.y));
}

function putPlayerInCar(state, x, y, angle) {
  const car = state.cars.find((c) => c.driver === 'traffic' && !c.wrecked);
  state.player.x = x;
  state.player.y = y;
  state.player.onFoot = true;
  state.player.inCar = null;
  if (car) {
    car.x = x + 30;
    car.y = y;
    car.angle = angle;
    car.speed = 0;
    car.driver = 'none';
    stealCar(state);
  }
  state.player.angle = angle;
}

/** Stage the "chase" cover shot: 3-star chase, mission live, high speed. */
export function stageChase(seed) {
  const state = createWorld(seed);
  putPlayerInCar(state, 1220, 1500, 0);
  // The getaway car is orange — unmistakable against the blue patrol cars.
  const playerCar = state.cars.find((c) => c.id === state.player.inCar);
  if (playerCar) playerCar.color = '#e67e22';
  // Clear the chase route so the player stays at speed.
  state.cars = state.cars.filter((c) => !(c.driver === 'traffic' && Math.abs(c.y - 1500) < 120 && c.x > 900 && c.x < 3000));
  startMission(state, 1); // The Drop — a timed delivery gives the objective.
  state.mission.step = 1;
  state.mission.timer = 74;
  state.mission.objective = state.mission.def.steps[1].label;
  state.police.heat = 3.4; // 3 stars
  // Two patrol cars in pursuit, behind the player but not on top of him.
  const p1 = makeCar(920, 1500, 0, 'sedan', '#1565c0', 'police');
  p1.siren = true;
  p1.speed = 420;
  const p2 = makeCar(770, 1500, 0, 'sedan', '#1565c0', 'police');
  p2.siren = true;
  p2.speed = 400;
  state.cars.push(p1, p2);
  // A roadblock waits ahead on the same street.
  state.police.roadblocks.push({ x: 2820, y: 1500, angle: Math.PI / 2, life: 30 });
  const car = state.cars.find((c) => c.id === state.player.inCar);
  if (car) car.speed = 520;
  runSteps(state, 150, manhattanRoute(1220, 1500, 2020, 1500));
  cleanupStrays(state);
  // A cross-traffic car can end up on top of the player mid-chase; drop any
  // traffic that close and restore the paint so the frame reads as a chase,
  // not a pile-up.
  if (car) {
    state.cars = state.cars.filter((c) => c.driver !== 'traffic' || dist(c.x, c.y, car.x, car.y) > 150);
    state.particles = state.particles.filter((pt) => dist(pt.x, pt.y, car.x, car.y) > 100);
    car.health = 100;
  }
  // Freeze mid-chase at full speed.
  if (car) car.speed = 560;
  snapCamera(state);
  return state;
}

/** Stage the "on foot downtown" shot. */
export function stageOnFoot(seed) {
  const state = createWorld(seed);
  state.player.x = 1220;
  state.player.y = 1150;
  state.player.onFoot = true;
  state.player.inCar = null;
  state.player.angle = 0.6;
  runSteps(state, 90, null);
  return state;
}

/** Stage the "timed delivery" shot: mid-route with the countdown running. */
export function stageDelivery(seed) {
  const state = createWorld(seed);
  // Already on the avenue, heading south toward the drop — a straight run,
  // so the frame catches the car at speed on the open road.
  putPlayerInCar(state, 820, 1100, Math.PI / 2);
  // Clear the avenue ahead so the run stays clean.
  state.cars = state.cars.filter((c) => !(c.driver === 'traffic'
    && Math.abs(c.x - 820) < 120 && c.y > 1000 && c.y < 2300));
  startMission(state, 1);
  state.mission.step = 1;
  state.mission.timer = 61;
  state.mission.objective = state.mission.def.steps[1].label;
  const car = state.cars.find((c) => c.id === state.player.inCar);
  if (car) car.speed = 430;
  runSteps(state, 120, manhattanRoute(820, 1100, 700, 2100));
  cleanupStrays(state);
  // A couple of cars sharing the avenue, so the frame has life.
  if (car) {
    const ahead = makeCar(car.x, car.y + 260, Math.PI / 2, 'sedan', '#f39c12', 'traffic');
    ahead.speed = 240;
    const behind = makeCar(car.x, car.y - 300, Math.PI / 2, 'hatch', '#8e44ad', 'traffic');
    behind.speed = 220;
    state.cars.push(ahead, behind);
  }
  // Freeze mid-route at speed, heading down the avenue.
  if (car) car.speed = 480;
  snapCamera(state);
  return state;
}

/** Stage the title screen over a slow drift of the city. */
export function stageTitle(seed) {
  const state = createWorld(seed);
  state.camera.x = 1220;
  state.camera.y = 1150;
  runSteps(state, 120, null);
  state.camera.x = 1220;
  state.camera.y = 1150;
  // Freeze on a blink phase where the "press enter" prompt is visible.
  state.time = 0.3;
  return state;
}

export const SHOTS = {
  chase: { stage: stageChase, screen: 'play', caption: '3-star police chase with a live mission objective' },
  onfoot: { stage: stageOnFoot, screen: 'play', caption: 'On foot in Downtown Solmar Bay' },
  delivery: { stage: stageDelivery, screen: 'play', caption: 'Timed delivery with the countdown running' },
  title: { stage: stageTitle, screen: 'title', caption: 'Title screen over the city' },
};
