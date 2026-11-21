// SOLMAR — vehicles. Builds a low-poly car from boxes (body, cabin, wheels,
// lights), runs the traffic cars along the city's road loops, and keeps the
// parked cars the player can steal. No model files: every car is assembled
// from primitives with a seeded colour.
import * as THREE from 'three';
import { CONFIG, COLORS } from './config.js';
import { resolveCircleVsColliders } from './city.js';

// A car mesh: body + cabin + 4 wheels + headlights + taillights. Faces +Z
// when heading is 0, so heading = atan2(dx, dz) lines it up with travel.
export function makeCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.2), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.55, 2.1),
    new THREE.MeshLambertMaterial({ color: 0x1c2733 }),
  );
  cabin.position.set(0, 1.1, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.36, z);
    group.add(wheel);
    wheels.push(wheel);
  }
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffe98a, emissiveIntensity: 0.7 });
  for (const x of [-0.65, 0.65]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.1), headMat);
    head.position.set(x, 0.62, 2.12);
    group.add(head);
  }
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xd92b2b, emissive: 0x8a1010, emissiveIntensity: 0.7 });
  for (const x of [-0.65, 0.65]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.1), tailMat);
    tail.position.set(x, 0.62, -2.12);
    group.add(tail);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.18, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x222222 }),
    );
    bar.position.set(0, 1.5, -0.25);
    group.add(bar);
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.16, 0.42),
      new THREE.MeshLambertMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1 }),
    );
    red.position.set(-0.3, 1.62, -0.25);
    group.add(red);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.16, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 1 }),
    );
    blue.position.set(0.3, 1.62, -0.25);
    group.add(blue);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.2, 4.22),
      new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
    );
    stripe.position.y = 0.72;
    group.add(stripe);
  }
  group.userData.wheels = wheels;
  return group;
}

export class Car {
  constructor(mesh, x, z, heading) {
    this.mesh = mesh;
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.stolen = false;
    this.parked = false;
  }

  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * 0.016;
    for (const w of this.mesh.userData.wheels || []) w.rotation.x += spin;
  }
}

// Traffic: cars that loop the blocks on the road network, plus parked cars
// waiting on the kerb to be stolen.
export class Traffic {
  constructor(scene, rng, city) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.cars = [];
    this.parked = [];
    this.spawned = 0;
    for (let i = 0; i < CONFIG.trafficCount; i += 1) {
      this.spawnTrafficCar(true);
    }
    for (let i = 0; i < 8; i += 1) {
      this.spawnParkedCar();
    }
  }

  spawnTrafficCar(randomLoop) {
    const loop = this.city.loops[this.spawned % this.city.loops.length];
    this.spawned += 1;
    const wp = randomLoop ? loop[Math.floor(this.rng.next() * loop.length)] : loop[0];
    const mesh = makeCarMesh(this.rng.pick(COLORS.carPalette), false);
    const car = new Car(mesh, wp.x, wp.z, 0);
    car.loop = loop;
    car.wpIndex = 0;
    car.speed = CONFIG.trafficSpeed * this.rng.range(0.8, 1.15);
    car.isTraffic = true;
    // Face the first waypoint.
    const next = loop[(car.wpIndex + 1) % loop.length];
    car.heading = Math.atan2(next.x - car.x, next.z - car.z);
    this.scene.add(mesh);
    this.cars.push(car);
    return car;
  }

  spawnParkedCar() {
    // Parked along a road edge, just off the driving lane.
    const road = this.rng.pick(this.city.roadCenters);
    const along = this.rng.range(-120, 120);
    const side = this.rng.chance(0.5) ? 1 : -1;
    const vertical = this.rng.chance(0.5);
    const x = vertical ? road + side * 5.2 : along;
    const z = vertical ? along : road + side * 5.2;
    const mesh = makeCarMesh(this.rng.pick(COLORS.carPalette), false);
    const car = new Car(mesh, x, z, vertical ? 0 : Math.PI / 2);
    car.parked = true;
    car.speed = 0;
    car.syncMesh();
    this.scene.add(mesh);
    this.parked.push(car);
    return car;
  }

  // A parked car the player is standing next to, if any.
  nearestParked(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.parked) {
      if (car.stolen) continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  update(dt) {
    for (const car of this.cars) {
      const target = car.loop[(car.wpIndex + 1) % car.loop.length];
      const dx = target.x - car.x;
      const dz = target.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 3) {
        car.wpIndex = (car.wpIndex + 1) % car.loop.length;
        continue;
      }
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      resolveCircleVsColliders(car, CONFIG.carRadius * 0.8, this.city.colliders);
      car.syncMesh();
    }
  }

  // Simple circle push between two cars; returns true on contact.
  static collide(a, b, radius) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const d = Math.hypot(dx, dz);
    if (d < radius * 2 && d > 0.001) {
      const push = (radius * 2 - d) / 2;
      const nx = dx / d;
      const nz = dz / d;
      a.x -= nx * push;
      a.z -= nz * push;
      b.x += nx * push;
      b.z += nz * push;
      return true;
    }
    return false;
  }
}
