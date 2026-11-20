// Third-person camera: follows behind the player on foot, swings behind the
// car while driving, and eases into every move so it never snaps.

import * as THREE from '../vendor/three.min.js';

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 3000);
  const pos = new THREE.Vector3(0, 6, -12);
  const look = new THREE.Vector3();
  let yaw = Math.PI;
  let pitch = 0.32;
  let distance = 9;
  let fovKick = 0;

  return {
    camera,
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    setYaw(v) { yaw = v; },
    setPitch(v) { pitch = v; },
    addLook(dx, dy) {
      yaw -= dx * 0.0026;
      pitch = Math.max(-0.15, Math.min(1.1, pitch + dy * 0.0026));
    },
    snapTo(x, y, z, targetYaw) {
      yaw = targetYaw;
      pos.set(x - Math.sin(yaw) * distance, y + 4, z - Math.cos(yaw) * distance);
      look.set(x, y + 1.5, z);
    },
    update(dt, target, driving, speedNorm) {
      const wantDist = driving ? 11 : 8.5;
      distance += (wantDist - distance) * Math.min(1, dt * 3);
      if (driving) {
        // ease the yaw toward the car's heading
        let dh = target.heading - yaw;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        yaw += dh * Math.min(1, dt * 3);
        pitch += (0.3 - pitch) * Math.min(1, dt * 2);
      }
      const tx = target.x;
      const ty = target.y ?? 1.2;
      const tz = target.z;
      const cx = tx - Math.sin(yaw) * Math.cos(pitch) * distance;
      const cy = ty + Math.sin(pitch) * distance + 1.2;
      const cz = tz - Math.cos(yaw) * Math.cos(pitch) * distance;
      const k = 1 - Math.exp(-dt * 7);
      pos.x += (cx - pos.x) * k;
      pos.y += (cy - pos.y) * k;
      pos.z += (cz - pos.z) * k;
      if (pos.y < 1.2) pos.y = 1.2;
      look.x += (tx - look.x) * k;
      look.y += (ty + 1.4 - look.y) * k;
      look.z += (tz - look.z) * k;
      camera.position.copy(pos);
      camera.lookAt(look);
      const wantFov = 62 + (driving ? speedNorm * 7 : 0);
      fovKick += (wantFov - (62 + fovKick)) * Math.min(1, dt * 3);
      camera.fov = 62 + fovKick;
      camera.updateProjectionMatrix();
    },
    aimDirection() {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      return dir;
    },
  };
}
