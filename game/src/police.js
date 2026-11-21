// SOLMAR — the wanted system and the police. Stealing a car, hitting a
// pedestrian or a car, or punching someone raises the wanted level (0–5
// stars). Police cars spawn at the city edge and chase the player, ramming
// the player's car or, on foot, closing in for the bust. Lie low and the
// heat decays; get caught on foot and you lose cash and wake at the hideout.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeCarMesh, Car } from './vehicles.js';
import { resolveCircleVsColliders } from './city.js';

export class Police {
  constructor(scene, rng, city) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.wanted = 0;
    this.heatTimer = 0;
    this.cars = [];
    this.bustTimer = 0;
  }

  addWanted(amount) {
    this.wanted = Math.min(CONFIG.wantedMax, this.wanted + amount);
    this.heatTimer = 0;
  }

  clearWanted() {
    this.wanted = 0;
    this.heatTimer = 0;
    this.bustTimer = 0;
    for (const car of this.cars) this.scene.remove(car.mesh);
    this.cars = [];
  }

  spawnPoliceCar(playerX, playerZ) {
    // Spawn on a road some distance from the player.
    const angle = this.rng.range(0, Math.PI * 2);
    const dist = this.rng.range(55, 85);
    let x = playerX + Math.cos(angle) * dist;
    let z = playerZ + Math.sin(angle) * dist;
    x = Math.max(-140, Math.min(140, x));
    z = Math.max(-140, Math.min(140, z));
    const mesh = makeCarMesh(0x1a1a22, true);
    const car = new Car(mesh, x, z, 0);
    car.isPolice = true;
    car.speed = 0;
    this.scene.add(mesh);
    this.cars.push(car);
    return car;
  }

  nearestPoliceDist(playerX, playerZ) {
    let best = Infinity;
    for (const car of this.cars) {
      best = Math.min(best, Math.hypot(car.x - playerX, car.z - playerZ));
    }
    return best;
  }

  update(dt, player, ctx) {
    this.heatTimer += dt;
    // Wanted decays only when the player has been quiet and no cop is close.
    if (this.wanted > 0 && this.heatTimer > CONFIG.wantedDecayDelay) {
      const near = this.nearestPoliceDist(player.x, player.z);
      if (near > 45) {
        this.wanted = Math.max(0, this.wanted - CONFIG.wantedDecayRate * dt);
      }
    }
    // Keep the right number of police cars on the street.
    const wantCount = Math.min(CONFIG.policeMax, Math.floor(this.wanted));
    while (this.cars.length < wantCount) this.spawnPoliceCar(player.x, player.z);
    while (this.cars.length > wantCount) {
      const car = this.cars.pop();
      this.scene.remove(car.mesh);
    }

    const topSpeed = 26 + this.wanted * 2.5;
    for (const car of this.cars) {
      const dx = player.x - car.x;
      const dz = player.z - car.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
      car.speed = Math.min(topSpeed, car.speed + 14 * dt);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      resolveCircleVsColliders(car, CONFIG.carRadius * 0.8, this.city.colliders);
      // Ram the player's car: damage + shove.
      if (player.driving) {
        const d = Math.hypot(player.inCar.x - car.x, player.inCar.z - car.z);
        if (d < CONFIG.carRadius * 2 && d > 0.001) {
          const nx = (player.inCar.x - car.x) / d;
          const nz = (player.inCar.z - car.z) / d;
          player.inCar.x += nx * 0.6;
          player.inCar.z += nz * 0.6;
          if (ctx.onPoliceRam) ctx.onPoliceRam();
        }
      }
      car.syncMesh();
    }

    // On foot, a cop closing in means BUSTED.
    if (!player.driving && this.wanted > 0) {
      const near = this.nearestPoliceDist(player.x, player.z);
      if (near < CONFIG.bustedRadius) {
        this.bustTimer += dt;
        if (this.bustTimer > 0.6 && ctx.onBusted) ctx.onBusted();
      } else {
        this.bustTimer = 0;
      }
    } else {
      this.bustTimer = 0;
    }
  }
}
