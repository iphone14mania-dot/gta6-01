// Combat: hitscan shooting with a crosshair, enemy gang members with simple AI,
// and the particle effects (muzzle flash, sparks, smoke, explosions).

import * as THREE from '../vendor/three.min.js';
import { WEAPONS } from './config.js';
import { pick } from './random.js';

const ENEMY_SHIRTS = [0x8a2a2a, 0x5a2a6a, 0x2a5a2a];

function buildEnemyMesh(rand) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: pick(rand, [0xf2c9a0, 0xc98a5a, 0x8a5a3a]) });
  const shirt = new THREE.MeshLambertMaterial({ color: pick(rand, ENEMY_SHIRTS) });
  const pants = new THREE.MeshLambertMaterial({ color: 0x1e2a3a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.32), shirt);
  torso.position.y = 1.18;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.76;
  g.add(head);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.7),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.3, 1.35, 0.4);
  g.add(gun);
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.24), pants);
    leg.geometry.translate(0, -0.42, 0);
    leg.position.set(s * 0.16, 0.82, 0);
    g.add(leg);
    legs.push(leg);
  }
  g.userData.legs = legs;
  // health bar above the head
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.12),
    new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide }));
  barBg.position.y = 2.25;
  g.add(barBg);
  const barFg = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xff4444, side: THREE.DoubleSide }));
  barFg.position.set(0, 2.25, 0.01);
  g.add(barFg);
  g.userData.barFg = barFg;
  return g;
}

export function createParticles(scene) {
  const items = [];
  const geo = new THREE.SphereGeometry(0.12, 6, 5);
  function spawn(x, y, z, color, count, speed, life, gravity = -4) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      scene.add(m);
      items.push({
        mesh: m,
        vx: (Math.random() - 0.5) * speed,
        vy: Math.random() * speed * 0.7,
        vz: (Math.random() - 0.5) * speed,
        life: life * (0.6 + Math.random() * 0.7),
        maxLife: life,
        gravity,
      });
    }
  }
  return {
    sparks(x, y, z) { spawn(x, y, z, 0xffcc44, 8, 6, 0.4); },
    blood(x, y, z) { spawn(x, y, z, 0xaa2222, 10, 4, 0.5); },
    smoke(x, y, z) { spawn(x, y, z, 0x555555, 6, 2, 1.4, 2); },
    explosion(x, y, z) {
      spawn(x, y, z, 0xff8822, 26, 10, 0.7);
      spawn(x, y, z, 0xffcc44, 18, 7, 0.5);
      spawn(x, y, z, 0x333333, 14, 4, 1.8, 2);
    },
    update(dt) {
      for (let i = items.length - 1; i >= 0; i--) {
        const p = items[i];
        p.life -= dt;
        if (p.life <= 0) {
          scene.remove(p.mesh);
          p.mesh.material.dispose();
          items.splice(i, 1);
          continue;
        }
        p.vy += p.gravity * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.mesh.material.opacity = p.life / p.maxLife;
      }
    },
  };
}

export function createCombat(scene, rand, audio, particles) {
  const raycaster = new THREE.Raycaster();
  const enemies = [];
  let cooldown = 0;
  let reloadTimer = 0;
  const flashLight = new THREE.PointLight(0xffcc66, 0, 18);
  scene.add(flashLight);
  let flashTimer = 0;

  function spawnEnemy(x, z, health = 60) {
    const mesh = buildEnemyMesh(rand);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const enemy = {
      mesh, x, z, health, maxHealth: health,
      heading: 0, shootTimer: 1 + Math.random(),
      walkPhase: Math.random() * 6,
      dead: false,
    };
    mesh.userData.enemyRef = enemy;
    enemies.push(enemy);
    return enemy;
  }

  function shoot(shooterPos, aimDir, weaponId, targets, world) {
    const w = WEAPONS[weaponId];
    const pellets = w.pellets || 1;
    let hitAny = null;
    for (let p = 0; p < pellets; p++) {
      const dir = aimDir.clone();
      dir.x += (Math.random() - 0.5) * w.spread * 2;
      dir.y += (Math.random() - 0.5) * w.spread * 2;
      dir.z += (Math.random() - 0.5) * w.spread * 2;
      dir.normalize();
      raycaster.set(shooterPos, dir);
      raycaster.far = w.range;
      const hits = raycaster.intersectObjects(targets, true);
      if (hits.length > 0) {
        const hit = hits[0];
        let obj = hit.object;
        while (obj && !obj.userData.enemyRef) obj = obj.parent;
        if (obj && obj.userData.enemyRef) {
          const enemy = obj.userData.enemyRef;
          if (!enemy.dead) {
            enemy.health -= w.damage;
            particles.blood(hit.point.x, hit.point.y, hit.point.z);
            if (enemy.health <= 0) {
              enemy.dead = true;
              enemy.mesh.rotation.x = Math.PI / 2;
              enemy.mesh.position.y = 0.3;
            }
            hitAny = enemy;
          }
        } else {
          particles.sparks(hit.point.x, hit.point.y, hit.point.z);
          hitAny = hitAny || { point: hit.point };
        }
      }
    }
    flashLight.position.copy(shooterPos).add(aimDir.clone().multiplyScalar(1.2));
    flashLight.intensity = 60;
    flashTimer = 0.06;
    audio.shoot(weaponId);
    return hitAny;
  }

  function update(dt, player, world, onPlayerHit) {
    cooldown = Math.max(0, cooldown - dt);
    if (reloadTimer > 0) {
      reloadTimer -= dt;
      if (reloadTimer <= 0) {
        const w = player.weapons[player.weapon];
        const spec = WEAPONS[player.weapon];
        const need = spec.mag - w.ammo;
        const take = Math.min(need, w.reserve);
        w.ammo += take;
        w.reserve -= take;
      }
    }
    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0) flashLight.intensity = 0;
    }
    // enemy AI: approach the player and shoot with poor aim
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = player.x - e.x;
      const dz = player.z - e.z;
      const dist = Math.hypot(dx, dz);
      e.heading = Math.atan2(dx, dz);
      if (dist > 14) {
        const nx = e.x + Math.sin(e.heading) * 5 * dt;
        const nz = e.z + Math.cos(e.heading) * 5 * dt;
        const fixed = world.collideCircle(nx, nz, 0.8);
        e.x = fixed.x;
        e.z = fixed.z;
        e.walkPhase += dt * 8;
        const s = Math.sin(e.walkPhase) * 0.5;
        e.mesh.userData.legs[0].rotation.x = s;
        e.mesh.userData.legs[1].rotation.x = -s;
      }
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist < 55) {
        e.shootTimer = 0.9 + Math.random() * 0.9;
        // inaccurate: hits the player about 1 in 3 shots
        if (Math.random() < 0.34) onPlayerHit(8 + Math.floor(Math.random() * 8));
        flashLight.position.set(e.x, 1.4, e.z);
        flashLight.intensity = 40;
        flashTimer = 0.05;
        audio.shoot('pistol');
      }
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = e.heading;
      e.mesh.userData.barFg.scale.x = Math.max(0.01, e.health / e.maxHealth);
      e.mesh.userData.barFg.position.x = -0.52 * (1 - e.health / e.maxHealth);
    }
  }

  return {
    enemies,
    get reloading() { return reloadTimer > 0; },
    get cooldownLeft() { return cooldown; },
    spawnEnemy,
    shoot,
    update,
    clearEnemies() {
      for (const e of enemies) scene.remove(e.mesh);
      enemies.length = 0;
    },
    aliveCount() {
      return enemies.filter((e) => !e.dead).length;
    },
    tryFire(player, aimDir, targets, world) {
      const spec = WEAPONS[player.weapon];
      const w = player.weapons[player.weapon];
      if (cooldown > 0 || reloadTimer > 0) return false;
      if (w.ammo <= 0) {
        if (w.reserve > 0) reloadTimer = spec.reload;
        return false;
      }
      w.ammo -= 1;
      cooldown = spec.rate;
      player.stats.shotsFired += 1;
      const origin = new THREE.Vector3(player.x, 1.5, player.z);
      return shoot(origin, aimDir, player.weapon, targets, world);
    },
    reload(player) {
      const spec = WEAPONS[player.weapon];
      const w = player.weapons[player.weapon];
      if (reloadTimer <= 0 && w.ammo < spec.mag && w.reserve > 0) reloadTimer = spec.reload;
    },
  };
}
