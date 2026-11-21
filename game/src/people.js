// SOLMAR — pedestrians. Simple low-poly walkers (capsule body, head, legs
// that swing while walking) who stroll the sidewalks on fixed routes, pause
// at corners, and scatter when a car comes at them. They are also the
// witnesses: hitting one raises the wanted level.
import * as THREE from 'three';
import { CONFIG } from './config.js';

function makePedMesh(color) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a986 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c3242 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.95, 8), shirt);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.78;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.18), pants);
  legL.position.set(-0.14, 0.3, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.14;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.14), shirt);
  armL.position.set(-0.45, 1.1, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.45;
  group.add(armR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  group.userData.armL = armL;
  group.userData.armR = armR;
  return group;
}

export class Pedestrians {
  constructor(scene, rng, city) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.peds = [];
    this.walkPhase = 0;
    for (let i = 0; i < CONFIG.pedCount; i += 1) {
      this.spawnPed();
    }
  }

  // A sidewalk stroll: pick a block corner route along the kerb.
  spawnPed() {
    const road = this.rng.pick(this.city.roadCenters);
    const vertical = this.rng.chance(0.5);
    const side = this.rng.chance(0.5) ? 1 : -1;
    const along = this.rng.range(-130, 130);
    const x = vertical ? road + side * 8.4 : along;
    const z = vertical ? along : road + side * 8.4;
    const mesh = makePedMesh(this.rng.pick([0xd94f4f, 0x4f7ad9, 0x7ad94f, 0xd9b84f, 0x9a4fd9, 0x4fd9c9, 0xe8e8e8]));
    const ped = {
      mesh,
      x,
      z,
      heading: vertical ? (side > 0 ? Math.PI : 0) : (side > 0 ? -Math.PI / 2 : Math.PI / 2),
      speed: CONFIG.pedSpeed * this.rng.range(0.7, 1.3),
      vertical,
      side,
      road,
      dir: this.rng.chance(0.5) ? 1 : -1,
      flee: 0,
      down: false,
      downTimer: 0,
      phase: this.rng.range(0, Math.PI * 2),
    };
    mesh.position.set(x, 0, z);
    mesh.rotation.y = ped.heading;
    this.scene.add(mesh);
    this.peds.push(ped);
    return ped;
  }

  // A car is bearing down: run away from it for a couple of seconds.
  scare(x, z, radius) {
    for (const ped of this.peds) {
      if (ped.down) continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < radius) {
        ped.flee = 2;
        ped.heading = Math.atan2(ped.x - x, ped.z - z);
      }
    }
  }

  // Knock a pedestrian down (they get up after a while). Returns the ped.
  knockDown(x, z, radius) {
    for (const ped of this.peds) {
      if (ped.down) continue;
      if (Math.hypot(ped.x - x, ped.z - z) < radius) {
        ped.down = true;
        ped.downTimer = 6;
        ped.mesh.rotation.x = Math.PI / 2;
        ped.mesh.position.y = 0.3;
        return ped;
      }
    }
    return null;
  }

  update(dt, playerX, playerZ, playerSpeed) {
    this.walkPhase += dt * 8;
    for (const ped of this.peds) {
      if (ped.down) {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          ped.down = false;
          ped.mesh.rotation.x = 0;
          ped.mesh.position.y = 0;
        }
        continue;
      }
      // Fleeing overrides the stroll.
      if (ped.flee > 0) {
        ped.flee -= dt;
        ped.x += Math.sin(ped.heading) * 4.5 * dt;
        ped.z += Math.cos(ped.heading) * 4.5 * dt;
      } else {
        // Stroll along the kerb; turn around at the city edge.
        const step = ped.speed * ped.dir * dt;
        if (ped.vertical) ped.z += step;
        else ped.x += step;
        const limit = 140;
        if (ped.vertical && Math.abs(ped.z) > limit) ped.dir *= -1;
        if (!ped.vertical && Math.abs(ped.x) > limit) ped.dir *= -1;
        ped.heading = ped.vertical
          ? (ped.dir > 0 ? 0 : Math.PI)
          : (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      }
      // Keep peds out of buildings.
      const clamped = { x: ped.x, z: ped.z };
      const hit = this.city.colliders.some((c) => {
        return clamped.x > c.minX - 0.6 && clamped.x < c.maxX + 0.6 && clamped.z > c.minZ - 0.6 && clamped.z < c.maxZ + 0.6;
      });
      if (hit) {
        ped.dir *= -1;
        ped.flee = 0;
      }
      ped.mesh.position.set(ped.x, ped.down ? 0.3 : 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
      // Walk swing.
      const swing = Math.sin(this.walkPhase + ped.phase) * 0.5;
      ped.mesh.userData.legL.rotation.x = swing;
      ped.mesh.userData.legR.rotation.x = -swing;
      ped.mesh.userData.armL.rotation.x = -swing * 0.7;
      ped.mesh.userData.armR.rotation.x = swing * 0.7;
      // Scare peds when the player speeds past in a car.
      if (playerSpeed > 12) {
        const d = Math.hypot(ped.x - playerX, ped.z - playerZ);
        if (d < 8) this.scare(playerX, playerZ, 9);
      }
    }
  }
}
