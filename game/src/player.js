// SOLMAR — the player. One body, two modes: on foot (WASD, Shift to run,
// mouse-drag orbit camera, F to punch, E to steal a car) and driving (W/S
// accelerate and brake/reverse, A/D steer, Space handbrake, E to get out,
// chase camera). Arcade handling on purpose: forgiving, grippy, fun.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { resolveCircleVsColliders } from './city.js';

function makePlayerMesh() {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2fa36b });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x24344d });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.0, 8), shirt);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), skin);
  head.position.y = 1.8;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.29, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xe8c832 }));
  cap.position.y = 1.84;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.62, 0.19), pants);
  legL.position.set(-0.15, 0.31, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.15;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.58, 0.15), shirt);
  armL.position.set(-0.47, 1.1, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.47;
  group.add(armR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  group.userData.armL = armL;
  group.userData.armR = armR;
  return group;
}

export class Player {
  constructor(scene, x, z) {
    this.mesh = makePlayerMesh();
    scene.add(this.mesh);
    this.x = x;
    this.z = z;
    this.heading = 0;
    this.speed = 0;
    this.health = CONFIG.playerHealth;
    this.money = 0;
    this.inCar = null;
    this.carSpeed = 0;
    this.steerAngle = 0;
    this.camYaw = 0;
    this.camPitch = 0.32;
    this.punchCooldown = 0;
    this.punchTimer = 0;
    this.walkPhase = 0;
    this.crashCooldown = 0;
    this.footstep = 0;
  }

  get speedKmh() {
    return Math.abs(this.inCar ? this.carSpeed : this.speed) * 3.6;
  }

  get driving() {
    return this.inCar !== null;
  }

  enterCar(car) {
    this.inCar = car;
    car.stolen = true;
    car.parked = false;
    car.speed = 0;
    this.carSpeed = 0;
    this.mesh.visible = false;
  }

  exitCar() {
    if (!this.inCar) return;
    const car = this.inCar;
    this.inCar = null;
    car.parked = true;
    car.speed = 0;
    // Step out on the driver's side.
    this.x = car.x + Math.cos(car.heading) * 2.2;
    this.z = car.z - Math.sin(car.heading) * 2.2;
    this.heading = car.heading;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  damage(amount, ctx) {
    if (this.health <= 0) return;
    this.health = Math.max(0, this.health - amount);
    if (ctx && ctx.audio) ctx.audio.blip(140, 0.2, 'sawtooth', 0.15);
    if (this.health <= 0 && ctx && ctx.onWasted) ctx.onWasted();
  }

  heal(amount) {
    this.health = Math.min(CONFIG.playerHealth, this.health + amount);
  }

  update(dt, input, ctx) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.punchTimer = Math.max(0, this.punchTimer - dt);
    this.crashCooldown = Math.max(0, this.crashCooldown - dt);

    const drag = input.consumeDrag();
    this.camYaw -= drag.dx * 0.005;
    this.camPitch = Math.max(0.05, Math.min(1.1, this.camPitch + drag.dy * 0.003));

    if (this.inCar) this.updateDriving(dt, input, ctx);
    else this.updateOnFoot(dt, input, ctx);

    if (this.punchTimer > 0 && this.mesh.userData.armR) {
      this.mesh.userData.armR.rotation.x = -1.6 * (this.punchTimer / 0.25);
    }
  }

  updateOnFoot(dt, input, ctx) {
    const run = input.down('ShiftLeft') || input.down('ShiftRight');
    const top = run ? CONFIG.runSpeed : CONFIG.walkSpeed;
    let mx = 0;
    let mz = 0;
    if (input.down('KeyW') || input.down('ArrowUp')) mz -= 1;
    if (input.down('KeyS') || input.down('ArrowDown')) mz += 1;
    if (input.down('KeyA') || input.down('ArrowLeft')) mx -= 1;
    if (input.down('KeyD') || input.down('ArrowRight')) mx += 1;
    const moving = mx !== 0 || mz !== 0;
    if (moving) {
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      // Movement is relative to the camera yaw.
      const sin = Math.sin(this.camYaw);
      const cos = Math.cos(this.camYaw);
      const wx = mx * cos - mz * sin;
      const wz = mx * sin + mz * cos;
      this.speed = top;
      this.x += wx * top * dt;
      this.z += wz * top * dt;
      this.heading = Math.atan2(wx, wz);
      this.walkPhase += dt * (run ? 13 : 9);
      const swing = Math.sin(this.walkPhase) * 0.55;
      this.mesh.userData.legL.rotation.x = swing;
      this.mesh.userData.legR.rotation.x = -swing;
      this.mesh.userData.armL.rotation.x = -swing * 0.7;
      this.mesh.userData.armR.rotation.x = this.punchTimer > 0 ? this.mesh.userData.armR.rotation.x : swing * 0.7;
    } else {
      this.speed = 0;
      this.mesh.userData.legL.rotation.x = 0;
      this.mesh.userData.legR.rotation.x = 0;
      this.mesh.userData.armL.rotation.x = 0;
      if (this.punchTimer <= 0) this.mesh.userData.armR.rotation.x = 0;
    }
    // Buildings are solid.
    resolveCircleVsColliders(this, CONFIG.playerRadius, ctx.city.colliders);
    // Stay inside the playable area (city + beach).
    this.x = Math.max(-160, Math.min(160, this.x));
    this.z = Math.max(-160, Math.min(230, this.z));
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;

    // E: steal the nearest parked car.
    if (input.justPressed('KeyE')) {
      const car = ctx.traffic.nearestParked(this.x, this.z, 4);
      if (car) {
        this.enterCar(car);
        if (ctx.onStealCar) ctx.onStealCar(car);
      }
    }
    // F: punch. Short range, in front of the player.
    if (input.justPressed('KeyF') && this.punchCooldown <= 0) {
      this.punchCooldown = 0.45;
      this.punchTimer = 0.25;
      if (ctx.audio) ctx.audio.punch();
      const fx = this.x + Math.sin(this.heading) * 1.6;
      const fz = this.z + Math.cos(this.heading) * 1.6;
      const hit = ctx.peds.knockDown(fx, fz, 2.1);
      if (hit && ctx.onPunchPed) ctx.onPunchPed(hit);
    }
  }

  updateDriving(dt, input, ctx) {
    const car = this.inCar;
    const forward = input.down('KeyW') || input.down('ArrowUp');
    const back = input.down('KeyS') || input.down('ArrowDown');
    const left = input.down('KeyA') || input.down('ArrowLeft');
    const right = input.down('KeyD') || input.down('ArrowRight');
    const handbrake = input.down('Space');

    if (forward) this.carSpeed += CONFIG.carAccel * dt;
    if (back) {
      if (this.carSpeed > 0.5) this.carSpeed -= CONFIG.carBrake * dt;
      else this.carSpeed -= CONFIG.carAccel * 0.55 * dt;
    }
    if (!forward && !back) {
      // Rolling drag.
      this.carSpeed -= Math.sign(this.carSpeed) * Math.min(Math.abs(this.carSpeed), 8 * dt);
    }
    if (handbrake) {
      this.carSpeed -= Math.sign(this.carSpeed) * Math.min(Math.abs(this.carSpeed), 30 * dt);
    }
    this.carSpeed = Math.max(-CONFIG.carReverseMax, Math.min(CONFIG.carTopSpeed, this.carSpeed));

    // Steering: stronger at low speed, looser and drifty with the handbrake.
    const steerTarget = (left ? 1 : 0) - (right ? 1 : 0);
    this.steerAngle += (steerTarget * CONFIG.carSteer - this.steerAngle) * Math.min(1, dt * 8);
    const speedFactor = Math.max(-1, Math.min(1, this.carSpeed / 12));
    car.heading += this.steerAngle * speedFactor * dt * (handbrake ? 1.7 : 1);

    const prevX = car.x;
    const prevZ = car.z;
    car.x += Math.sin(car.heading) * this.carSpeed * dt;
    car.z += Math.cos(car.heading) * this.carSpeed * dt;

    // Buildings: bounce off with damage on hard hits.
    const before = Math.abs(this.carSpeed);
    const hitWall = resolveCircleVsColliders(car, CONFIG.carRadius, ctx.city.colliders);
    if (hitWall && this.crashCooldown <= 0 && before > 6) {
      this.crashCooldown = 0.5;
      this.carSpeed *= -0.25;
      this.damage(Math.min(18, (before - 6) * 0.8), ctx);
      if (ctx.audio) ctx.audio.crash(before);
      if (ctx.onCrash) ctx.onCrash(before);
    }
    // Traffic cars: shove each other, small damage on hard hits.
    for (const other of ctx.traffic.cars) {
      if (other === car) continue;
      const d = Math.hypot(other.x - car.x, other.z - car.z);
      if (d < CONFIG.carRadius * 2 && d > 0.001) {
        const push = (CONFIG.carRadius * 2 - d) / 2;
        const nx = (other.x - car.x) / d;
        const nz = (other.z - car.z) / d;
        car.x -= nx * push;
        car.z -= nz * push;
        other.x += nx * push;
        other.z += nz * push;
        if (this.crashCooldown <= 0 && Math.abs(this.carSpeed) > 8) {
          this.crashCooldown = 0.6;
          this.damage(6, ctx);
          if (ctx.audio) ctx.audio.crash(8);
          if (ctx.onCrash) ctx.onCrash(8);
        }
      }
    }
    // Pedestrians in the way get knocked down (and the law notices).
    const hitPed = ctx.peds.knockDown(car.x, car.z, CONFIG.carRadius + 0.4);
    if (hitPed && this.crashCooldown <= 0) {
      this.crashCooldown = 0.4;
      if (ctx.onHitPed) ctx.onHitPed(hitPed);
    }
    // Scare nearby peds.
    ctx.peds.scare(car.x, car.z, 9);

    car.speed = this.carSpeed;
    car.syncMesh();
    this.x = car.x;
    this.z = car.z;
    this.heading = car.heading;
    this.camYaw = car.heading + Math.PI; // chase camera sits behind the car

    if (input.justPressed('KeyE')) {
      this.exitCar();
    }
  }

  // Third-person camera: orbit on foot, chase behind the car. Smoothly follows.
  updateCamera(camera, dt) {
    const dist = this.inCar ? CONFIG.camDriveDistance : CONFIG.camDistance;
    const height = this.inCar ? CONFIG.camDriveHeight : CONFIG.camHeight;
    let tx;
    let tz;
    let ty;
    if (this.inCar) {
      const car = this.inCar;
      tx = car.x - Math.sin(car.heading) * dist;
      tz = car.z - Math.cos(car.heading) * dist;
      ty = height;
    } else {
      tx = this.x + Math.sin(this.camYaw) * dist;
      tz = this.z + Math.cos(this.camYaw) * dist;
      ty = height + (this.camPitch - 0.32) * 6;
    }
    const k = Math.min(1, dt * 6);
    camera.position.x += (tx - camera.position.x) * k;
    camera.position.y += (ty - camera.position.y) * k;
    camera.position.z += (tz - camera.position.z) * k;
    const lookY = this.inCar ? 1.6 : 1.4;
    camera.lookAt(this.x, lookY, this.z);
  }
}
