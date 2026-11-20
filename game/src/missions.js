// The story: eight jobs for the Harbor Crew. Each mission is a list of steps
// (drive here, kill them, lose the cops, survive) with a briefing, a marker
// in the world and a cash + respect reward. Original characters and places.

import * as THREE from '../vendor/three.min.js';
import { PLACES } from './config.js';
import { createCar } from './vehicles.js';

const RANKS = ['Street', 'Runner', 'Wheelman', 'Shot Caller', 'Kingpin'];

export const MISSIONS = [
  {
    id: 1, title: 'First Gear',
    briefing: 'Milo, fresh off the bus. Sammy at the Harbor Garage needs a driver. Get over there and say hello.',
    reward: 300, respect: 60,
    steps: [{ type: 'goto', x: PLACES.garage.x, z: PLACES.garage.z, label: 'Drive to the Harbor Garage', radius: 14 }],
  },
  {
    id: 2, title: 'Harbor Run',
    briefing: 'A package is waiting at the docks. Pick it up and get it to the safehouse — 150 seconds, no excuses.',
    reward: 500, respect: 90, unlock: 'smg',
    steps: [
      { type: 'goto', x: PLACES.docks.x, z: PLACES.docks.z, label: 'Pick up the package at the docks', radius: 12 },
      { type: 'timed', x: PLACES.safehouse.x, z: PLACES.safehouse.z, label: 'Deliver the package to the safehouse', radius: 12, seconds: 150 },
    ],
  },
  {
    id: 3, title: 'Hot Wheels',
    briefing: 'A Comet GT is parked at the stadium, keys in it. Take it. The cops will notice — lose them.',
    reward: 800, respect: 120, car: { type: 'sports', color: 0xd43a2a, x: -162, z: 120 },
    steps: [
      { type: 'steal', label: 'Steal the Comet GT at the stadium', radius: 10 },
      { type: 'escape', label: 'Lose the cops (2 stars)', stars: 2 },
      { type: 'goto', x: PLACES.garage.x, z: PLACES.garage.z, label: 'Bring the Comet to the garage', radius: 14 },
    ],
  },
  {
    id: 4, title: 'Dockside Deal',
    briefing: 'The Vultures crashed our deal at the docks. Sammy is pinned down. Clear them out — all six.',
    reward: 1000, respect: 150, unlock: 'shotgun',
    steps: [
      { type: 'goto', x: PLACES.docks.x, z: PLACES.docks.z, label: 'Get to the docks', radius: 16 },
      { type: 'kill', label: 'Take out the Vultures', count: 6, at: { x: PLACES.docks.x, z: PLACES.docks.z } },
    ],
  },
  {
    id: 5, title: 'The Getaway',
    briefing: 'The job went loud. Three stars and the whole CHPD on your tail. Lose them and get to the safehouse.',
    reward: 1200, respect: 180,
    steps: [
      { type: 'escape', label: 'Lose the cops (3 stars)', stars: 3 },
      { type: 'goto', x: PLACES.safehouse.x, z: PLACES.safehouse.z, label: 'Reach the safehouse', radius: 12 },
    ],
  },
  {
    id: 6, title: 'Street King',
    briefing: 'A street race across Coral Harbor — six checkpoints, three minutes. Beat the clock and take the crown.',
    reward: 1500, respect: 220, unlock: 'rifle',
    steps: [{
      type: 'race', label: 'Hit every checkpoint', seconds: 180,
      checkpoints: [
        { x: 54, z: 54 }, { x: 378, z: -162 }, { x: 486, z: -486 },
        { x: -54, z: -486 }, { x: -486, z: 54 }, { x: -54, z: -54 },
      ],
    }],
  },
  {
    id: 7, title: 'Air Support',
    briefing: 'Four stars. CONDOR-1 is overhead and every cruiser in the city is coming. Survive 90 seconds.',
    reward: 2000, respect: 280,
    steps: [{ type: 'survive', label: 'Survive the manhunt', seconds: 90, stars: 4 }],
  },
  {
    id: 8, title: 'Coral Crown',
    briefing: 'The Vultures\' hideout at the airfield. Dante Kross ends tonight. Take the loot and bring it home.',
    reward: 5000, respect: 400,
    steps: [
      { type: 'goto', x: PLACES.airport.x, z: PLACES.airport.z, label: 'Storm the airfield hideout', radius: 18 },
      { type: 'kill', label: 'Clear the hideout', count: 10, at: { x: PLACES.airport.x, z: PLACES.airport.z } },
      { type: 'goto', x: PLACES.garage.x, z: PLACES.garage.z, label: 'Bring the loot to the garage', radius: 14 },
    ],
  },
];

function buildMarker() {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd94c, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  g.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.2, 4.2, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd94c, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  g.add(ring);
  return g;
}

export function createMissions(scene, rand) {
  const marker = buildMarker();
  marker.visible = false;
  scene.add(marker);
  const startMarker = buildMarker();
  startMarker.visible = false;
  scene.add(startMarker);

  let active = null; // {def, stepIndex, timer, kills, targetCar}
  let completedCount = 0;
  let startPos = { x: PLACES.garage.x, z: PLACES.garage.z };

  function currentDef() {
    return MISSIONS[completedCount] || null;
  }

  function startMission(ctx) {
    const def = currentDef();
    if (!def) return false;
    active = { def, stepIndex: 0, timer: 0, kills: 0, targetCar: null };
    if (def.car) {
      active.targetCar = createCar(scene, def.car.type, def.car.color, def.car.x, def.car.z, 0);
      active.targetCar.driver = null;
    }
    startMarker.visible = false;
    marker.visible = true;
    positionMarker();
    ctx.onMessage(`Mission: ${def.title}`, def.briefing);
    ctx.audio.missionComplete();
    return true;
  }

  function positionMarker() {
    if (!active) return;
    const step = active.def.steps[active.stepIndex];
    let x = 0;
    let z = 0;
    if (step.type === 'race') {
      const cp = step.checkpoints[active.checkpoint || 0];
      x = cp.x;
      z = cp.z;
    } else if (step.type === 'steal' && active.targetCar) {
      x = active.targetCar.x;
      z = active.targetCar.z;
    } else if (step.x !== undefined) {
      x = step.x;
      z = step.z;
    } else {
      marker.visible = false;
      return;
    }
    marker.visible = true;
    marker.position.set(x, 0, z);
  }

  function advance(ctx) {
    const def = active.def;
    active.stepIndex += 1;
    active.timer = 0;
    if (active.stepIndex >= def.steps.length) {
      complete(ctx);
      return;
    }
    const step = def.steps[active.stepIndex];
    if (step.type === 'kill') {
      for (let i = 0; i < step.count; i++) {
        const a = (i / step.count) * Math.PI * 2;
        const r = 18 + (i % 3) * 8;
        ctx.combat.spawnEnemy(step.at.x + Math.sin(a) * r, step.at.z + Math.cos(a) * r);
      }
    }
    if (step.type === 'escape' || step.type === 'survive') {
      ctx.police.setStars(step.stars);
    }
    if (step.type === 'timed' || step.type === 'race' || step.type === 'survive') {
      active.timer = step.seconds;
    }
    positionMarker();
    ctx.onMessage('Objective', step.label);
  }

  function complete(ctx) {
    const def = active.def;
    ctx.player.money += def.reward;
    ctx.player.addRespect(def.respect);
    if (def.unlock) {
      ctx.player.giveWeapon(def.unlock);
      ctx.onMessage('New weapon', `You unlocked the ${def.unlock.toUpperCase()}.`);
    }
    completedCount += 1;
    ctx.player.stats.missionsDone = completedCount;
    ctx.audio.missionComplete();
    ctx.onMissionComplete(def);
    if (active.targetCar && def.id === 3) {
      ctx.onKeepCar(active.targetCar);
      active.targetCar = null;
    } else if (active.targetCar) {
      active.targetCar.dispose();
      active.targetCar = null;
    }
    active = null;
    marker.visible = false;
    updateStartMarker();
  }

  function fail(ctx, reason) {
    ctx.audio.missionFail();
    ctx.onMissionFail(active ? active.def : null, reason);
    if (active && active.targetCar) {
      active.targetCar.dispose();
      active.targetCar = null;
    }
    ctx.combat.clearEnemies();
    ctx.police.clearAll();
    active = null;
    marker.visible = false;
    updateStartMarker();
  }

  function updateStartMarker() {
    const def = currentDef();
    if (def && !active) {
      startMarker.visible = true;
      startMarker.position.set(startPos.x, 0, startPos.z);
    } else {
      startMarker.visible = false;
    }
  }

  function update(dt, ctx) {
    marker.rotation.y += dt * 0.8;
    startMarker.rotation.y += dt * 0.8;
    const player = ctx.player;
    if (!active) {
      updateStartMarker();
      const def = currentDef();
      if (def && Math.hypot(player.x - startPos.x, player.z - startPos.z) < 10) {
        startMission(ctx);
      }
      return;
    }
    const step = active.def.steps[active.stepIndex];
    if (step.type === 'goto' || step.type === 'timed') {
      if (Math.hypot(player.x - step.x, player.z - step.z) < step.radius) {
        advance(ctx);
        return;
      }
    } else if (step.type === 'steal') {
      if (player.car === active.targetCar) {
        ctx.player.stats.carsStolen += 1;
        advance(ctx);
        return;
      }
      if (active.targetCar) positionMarker();
    } else if (step.type === 'kill') {
      if (ctx.combat.aliveCount() === 0 && ctx.combat.enemies.length > 0) {
        advance(ctx);
        return;
      }
    } else if (step.type === 'escape') {
      if (ctx.police.stars === 0) {
        advance(ctx);
        return;
      }
    } else if (step.type === 'survive') {
      // timer counts down below
    } else if (step.type === 'race') {
      const cp = step.checkpoints[active.checkpoint || 0];
      if (cp && Math.hypot(player.x - cp.x, player.z - cp.z) < 14) {
        active.checkpoint = (active.checkpoint || 0) + 1;
        ctx.audio.pickup();
        if (active.checkpoint >= step.checkpoints.length) {
          advance(ctx);
          return;
        }
        positionMarker();
      }
    }
    if (step.type === 'timed' || step.type === 'race' || step.type === 'survive') {
      active.timer -= dt;
      if (active.timer <= 0) {
        if (step.type === 'survive') {
          ctx.police.clearAll();
          advance(ctx);
        } else {
          fail(ctx, 'Out of time.');
        }
        return;
      }
    }
    // mission car destroyed = fail
    if (active.targetCar && active.targetCar.damage > 1) {
      fail(ctx, 'The mission car was destroyed.');
    }
  }

  updateStartMarker();

  return {
    get active() { return active; },
    get completedCount() { return completedCount; },
    get currentDef() { return currentDef(); },
    get startPos() { return startPos; },
    setCompleted(n) {
      completedCount = n;
      updateStartMarker();
    },
    currentStep() {
      return active ? active.def.steps[active.stepIndex] : null;
    },
    currentLabel() {
      if (active) return active.def.steps[active.stepIndex].label;
      const def = currentDef();
      return def ? `Next job: ${def.title} — go to the marker` : 'All jobs complete. Coral Harbor is yours.';
    },
    timerLeft() {
      return active ? Math.max(0, active.timer) : 0;
    },
    markerPos() {
      return marker.visible ? { x: marker.position.x, z: marker.position.z } : null;
    },
    startMarkerPos() {
      return startMarker.visible ? { x: startMarker.position.x, z: startMarker.position.z } : null;
    },
    update,
    fail,
    startMission,
    ranks: RANKS,
  };
}
