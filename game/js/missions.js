// The story: eight jobs for Rosa, Solmar Bay's fixer. Each mission is a list
// of steps — drive somewhere, pick something up, survive a shootout, race a
// route, shake the cops — with dialogue, a timer where the job is timed, and
// a cash + respect payout. Rivals are the armed crews the jobs put Leo against.

import { dist } from './random.js';
import { addCash, addRespect, damagePlayer } from './player.js';
import { clearWanted } from './police.js';
import { makeCar } from './vehicles.js';

export const MISSIONS = [
  {
    name: 'First Wheels',
    brief: ["ROSA: New in town, Leo? Every legend here starts with a set of wheels.",
      "ROSA: There is a sports car parked by the marina. Borrow it. Then bring it to my garage."],
    reward: 300, respect: 60,
    steps: [
      { type: 'goto', x: 700, y: 420, label: 'Get to the sports car by the marina' },
      { type: 'goto', x: 980, y: 1750, label: 'Drive it to Rosa\'s Garage', needCar: true },
    ],
  },
  {
    name: 'The Drop',
    brief: ["ROSA: A package is waiting at the Portside crates. The buyer pays on delivery —",
      "ROSA: — but only if you are on time. One hundred seconds, Leo. Move."],
    reward: 450, respect: 90,
    steps: [
      { type: 'pickup', x: 3100, y: 500, label: 'Pick up the package at Portside' },
      { type: 'deliver', x: 700, y: 2100, time: 100, label: 'Deliver the package to Old Town' },
    ],
  },
  {
    name: 'Heat on the Pier',
    brief: ["ROSA: The Dockside crew is shaking down my pier vendors. Four of them.",
      "ROSA: Go make them reconsider. The SMG in my stash is yours after this."],
    reward: 600, respect: 140,
    steps: [
      { type: 'kill', label: 'Clear the Dockside crew off the pier', spawn: [
        { x: 420, y: 700 }, { x: 520, y: 820 }, { x: 380, y: 900 }, { x: 620, y: 760 },
      ] },
    ],
  },
  {
    name: 'Solmar Grand Prix',
    brief: ["ROSA: The street racers run a five-gate route tonight. Win it and the whole",
      "ROSA: bay knows your name. Lose it and you are just another tourist."],
    reward: 800, respect: 180,
    steps: [
      { type: 'race', time: 150, label: 'Hit all five race gates in order', checkpoints: [
        { x: 1220, y: 700 }, { x: 2020, y: 700 }, { x: 2420, y: 1500 },
        { x: 1620, y: 2300 }, { x: 820, y: 1900 },
      ] },
    ],
  },
  {
    name: 'The Getaway',
    brief: ["ROSA: The SBPD is all over the bay tonight. I need you to pull them off a",
      "ROSA: shipment — get hot, then get gone. Lose the heat and meet me back here."],
    reward: 700, respect: 160,
    steps: [
      { type: 'escape', label: 'Lose the 3-star wanted level', startWanted: 3 },
      { type: 'goto', x: 980, y: 1750, label: 'Return to Rosa\'s Garage' },
    ],
  },
  {
    name: 'Clean Sweep',
    brief: ["ROSA: The East Docks warehouse is crawling with the crew that hit my convoy.",
      "ROSA: Clear them out, grab the goods, and bring them home. The shotgun is yours."],
    reward: 1000, respect: 240,
    steps: [
      { type: 'kill', label: 'Clear the East Docks warehouse', spawn: [
        { x: 3000, y: 1800 }, { x: 3150, y: 1950 }, { x: 2950, y: 2100 },
        { x: 3250, y: 2200 }, { x: 3050, y: 2350 }, { x: 3300, y: 1900 },
      ] },
      { type: 'deliver', x: 980, y: 1750, time: 120, label: 'Bring the goods to Rosa\'s Garage' },
    ],
  },
  {
    name: 'Night Run',
    brief: ["ROSA: Three VIPs need rides across the bay tonight, and they pay for speed.",
      "ROSA: Pick each one up and drop them off. Do not keep a VIP waiting."],
    reward: 900, respect: 200,
    steps: [
      { type: 'taxi', time: 180, label: 'Ferry three VIPs across the bay', stops: [
        { x: 2020, y: 300 }, { x: 820, y: 1100 }, { x: 2820, y: 1900 },
      ] },
    ],
  },
  {
    name: 'The Big Score',
    brief: ["ROSA: Downtown vault. One night, one crew — you. Get in, take the cash,",
      "ROSA: and vanish with half the SBPD behind you. This is the one they will sing about."],
    reward: 2500, respect: 500,
    steps: [
      { type: 'kill', label: 'Take out the vault guards', spawn: [
        { x: 1620, y: 1100 }, { x: 1750, y: 1250 }, { x: 1500, y: 1300 }, { x: 1850, y: 1150 },
      ] },
      { type: 'pickup', x: 1620, y: 1200, label: 'Grab the vault cash' },
      { type: 'escape', label: 'Shake the 4-star heat', startWanted: 4 },
      { type: 'goto', x: 980, y: 1750, label: 'Bring the score to Rosa\'s Garage' },
    ],
  },
];

/** Start a mission: reset its steps, spawn its first-step content. */
export function startMission(state, index) {
  const def = MISSIONS[index];
  state.mission = {
    index, def, step: 0, timer: 0, checkpoint: 0,
    objective: def.steps[0].label, failed: false, passed: false,
  };
  state.rivals = [];
  enterStep(state);
  return state.mission;
}

/** Set up the current step (spawn rivals, set timers, raise heat). */
function enterStep(state) {
  const m = state.mission;
  const step = m.def.steps[m.step];
  m.objective = step.label;
  m.timer = step.time || 0;
  m.checkpoint = 0;
  if (step.type === 'kill') {
    state.rivals = step.spawn.map((s) => ({
      x: s.x, y: s.y, angle: 0, health: 60, alive: true,
      shootTimer: state.rng.range(0.4, 1.2),
    }));
  }
  if (step.type === 'escape' && step.startWanted) {
    state.police.heat = 1 + (step.startWanted - 1) * 1.2 + 0.5;
  }
  if (m.index === 0 && m.step === 0) {
    // Mission 1's sports car waits by the marina.
    const car = makeCar(700, 420, 0, 'sports', '#c0392b', 'none');
    state.cars.push(car);
  }
}

function advanceStep(state) {
  const m = state.mission;
  m.step += 1;
  if (m.step >= m.def.steps.length) {
    m.passed = true;
    return 'passed';
  }
  enterStep(state);
  return null;
}

/** Fail the mission (timer out, player down). */
export function failMission(state, reason) {
  if (!state.mission) return;
  state.mission.failed = true;
  state.mission.failReason = reason;
}

/** Complete the mission: pay out and clear the heat. */
export function completeMission(state) {
  const m = state.mission;
  addCash(state, m.def.reward);
  addRespect(state, m.def.respect);
  state.stats.missionsDone += 1;
  clearWanted(state);
  state.mission = null;
  state.rivals = [];
}

/** Rivals shoot at the player when he is in range and in sight. */
export function updateRivals(state, dt) {
  const p = state.player;
  for (const r of state.rivals) {
    if (!r.alive) continue;
    const d = dist(r.x, r.y, p.x, p.y);
    const want = Math.atan2(p.y - r.y, p.x - r.x);
    r.angle = want;
    // Close in slowly until in range, then hold and shoot.
    if (d > 320) {
      r.x += Math.cos(want) * 120 * dt;
      r.y += Math.sin(want) * 120 * dt;
    }
    r.shootTimer -= dt;
    if (d < 480 && r.shootTimer <= 0 && p.alive) {
      r.shootTimer = 0.8 + state.rng.range(0, 0.8);
      const spread = state.rng.range(-0.14, 0.14);
      state.bullets.push({
        x: r.x, y: r.y,
        vx: Math.cos(want + spread) * 820, vy: Math.sin(want + spread) * 820,
        life: 0.7, damage: 8, from: 'rival',
      });
    }
  }
}

/** Advance the active mission one tick. Returns 'passed', 'failed' or null. */
export function updateMission(state, dt) {
  const m = state.mission;
  if (!m || m.passed || m.failed) return m ? (m.passed ? 'passed' : 'failed') : null;
  const step = m.def.steps[m.step];
  const p = state.player;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(state, 'Out of time');
      return 'failed';
    }
  }
  const at = (x, y, r) => dist(p.x, p.y, x, y) < r;
  switch (step.type) {
    case 'goto':
      if (at(step.x, step.y, 70)) {
        if (step.needCar && p.onFoot) { m.objective = step.label + ' (in a car!)'; break; }
        return advanceStep(state);
      }
      break;
    case 'pickup':
      if (at(step.x, step.y, 60)) return advanceStep(state);
      break;
    case 'deliver':
      if (at(step.x, step.y, 70)) return advanceStep(state);
      break;
    case 'kill':
      m.objective = `${step.label} (${state.rivals.filter((r) => r.alive).length} left)`;
      if (state.rivals.every((r) => !r.alive)) return advanceStep(state);
      break;
    case 'race': {
      const cp = step.checkpoints[m.checkpoint];
      m.objective = `${step.label} — gate ${m.checkpoint + 1}/${step.checkpoints.length}`;
      if (cp && at(cp.x, cp.y, 80)) {
        m.checkpoint += 1;
        addRespect(state, 10);
        if (m.checkpoint >= step.checkpoints.length) return advanceStep(state);
      }
      break;
    }
    case 'escape':
      m.objective = `${step.label} (wanted: ${state.police.wanted}★)`;
      if (state.police.wanted === 0) return advanceStep(state);
      break;
    case 'taxi': {
      const stop = step.stops[m.checkpoint];
      m.objective = `${step.label} — VIP ${m.checkpoint + 1}/${step.stops.length}`;
      if (stop && at(stop.x, stop.y, 70)) {
        m.checkpoint += 1;
        addCash(state, 120);
        if (m.checkpoint >= step.stops.length) return advanceStep(state);
      }
      break;
    }
    default:
      break;
  }
  return null;
}

/** Where should the minimap point for the current mission step? */
export function missionTarget(state) {
  const m = state.mission;
  if (!m) return null;
  const step = m.def.steps[m.step];
  if (step.type === 'race') return step.checkpoints[m.checkpoint] || null;
  if (step.type === 'taxi') return step.stops[m.checkpoint] || null;
  if (step.type === 'kill') {
    const alive = state.rivals.find((r) => r.alive);
    return alive ? { x: alive.x, y: alive.y } : null;
  }
  if (step.x !== undefined) return { x: step.x, y: step.y };
  return null;
}
