// SOLMAR — the story: three sequential missions with a HUD objective, a
// countdown, a world marker and a minimap blip. Finishing all three shows
// STORY COMPLETE; free roam continues after. Also owns the world pickups:
// health crosses and the mission-3 cash drops.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const MISSION_DEFS = [
  {
    name: 'Hot Wheels',
    intro: 'Rico needs a ride. Steal any car, then bring it to his garage.',
    stages: ['Steal a car — press E near a parked car', 'Drive to Rico\'s Garage'],
    reward: 400,
    time: CONFIG.mission1Time,
  },
  {
    name: 'Package Run',
    intro: 'A package is waiting at the kiosk. The cops are already watching — 1 star.',
    stages: ['Pick up the package at the kiosk', 'Deliver it to the Pier'],
    reward: 700,
    time: CONFIG.mission2Time,
  },
  {
    name: 'The Big Score',
    intro: 'Five cash drops are stashed around Solmar. Grab them all, then vanish to the hideout.',
    stages: ['Collect the cash drops (0/5)', 'Get to the Hideout'],
    reward: 1500,
    time: CONFIG.mission3Time,
  },
];

function makeMarker(scene) {
  const group = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3, 0.25, 24),
    new THREE.MeshLambertMaterial({ color: 0xf2c94c, emissive: 0x8a6d1a, emissiveIntensity: 0.8, transparent: true, opacity: 0.85 }),
  );
  disc.position.y = 0.15;
  group.add(disc);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 42, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 21;
  group.add(beam);
  group.visible = false;
  scene.add(group);
  return group;
}

function makeCashDrop(scene, x, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.7, 1.0),
    new THREE.MeshLambertMaterial({ color: 0x2fa36b, emissive: 0x1a5a3a, emissiveIntensity: 0.6 }),
  );
  mesh.position.set(x, 1.0, z);
  mesh.castShadow = true;
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 0.2, 1.05),
    new THREE.MeshLambertMaterial({ color: 0xf2c94c, emissive: 0x8a6d1a, emissiveIntensity: 0.8 }),
  );
  band.position.y = 0;
  mesh.add(band);
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, x, z, taken: false, phase: Math.random() * 6 };
}

function makeHealthPickup(scene, x, z) {
  const group = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 1.1, 1.1),
    new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
  );
  group.add(box);
  const crossMat = new THREE.MeshLambertMaterial({ color: 0xd92b2b, emissive: 0x8a1010, emissiveIntensity: 0.6 });
  const v = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.1), crossMat);
  v.position.z = 0.56;
  group.add(v);
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.1), crossMat);
  h.position.z = 0.56;
  group.add(h);
  group.position.set(x, 0.9, z);
  scene.add(group);
  return { group, x, z, active: true, respawn: 0 };
}

function makePackage(scene, x, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.7, 1.0),
    new THREE.MeshLambertMaterial({ color: 0x9a7a52 }),
  );
  mesh.position.set(x, 1.2, z);
  mesh.visible = false;
  scene.add(mesh);
  return mesh;
}

export class Missions {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.index = 0; // 0..2, or 3 when the story is done
    this.stage = 0;
    this.timer = 0;
    this.active = false;
    this.storyComplete = false;
    this.completedCount = 0;
    this.cashCollected = 0;
    this.hasPackage = false;
    this.marker = makeMarker(scene);
    this.markerTarget = null;
    this.cashDrops = city.cashSpots.map((s) => makeCashDrop(scene, s.x, s.z));
    this.healthPickups = city.healthSpots.map((s) => makeHealthPickup(scene, s.x, s.z));
    this.packageMesh = makePackage(scene, city.packagePos.x + 4, city.packagePos.z);
    this.pulse = 0;
  }

  get def() {
    return MISSION_DEFS[this.index];
  }

  get objective() {
    if (this.storyComplete) return 'Story complete — free roam. Enjoy Solmar.';
    if (!this.active) return 'Free roam — walk to the yellow marker to start: ' + MISSION_DEFS[this.index].name;
    const def = this.def;
    let text = def.stages[this.stage];
    if (this.index === 2 && this.stage === 0) {
      text = 'Collect the cash drops (' + this.cashCollected + '/5)';
    }
    return def.name + ' — ' + text;
  }

  get timeLeft() {
    return Math.max(0, Math.ceil(this.timer));
  }

  startMission(index) {
    this.index = index;
    this.stage = 0;
    this.timer = MISSION_DEFS[index].time;
    this.active = true;
    this.cashCollected = 0;
    this.hasPackage = false;
    if (index === 1) {
      this.packageMesh.visible = true;
    }
    if (index === 2) {
      for (const drop of this.cashDrops) {
        drop.taken = false;
        drop.mesh.visible = true;
      }
    }
    this.updateMarkerTarget();
  }

  updateMarkerTarget() {
    if (this.storyComplete || !this.active) {
      // Between missions, point at the next mission's start.
      if (this.index === 0) this.markerTarget = { x: -100, z: -29, label: 'Garage' };
      else if (this.index === 1) this.markerTarget = { x: this.city.packagePos.x, z: this.city.packagePos.z };
      else if (this.index === 2) this.markerTarget = { x: this.city.cashSpots[0].x, z: this.city.cashSpots[0].z };
      else this.markerTarget = null;
      return;
    }
    if (this.index === 0) {
      this.markerTarget = this.stage === 0 ? null : { x: this.city.garagePos.x + 12, z: this.city.garagePos.z };
    } else if (this.index === 1) {
      this.markerTarget = this.stage === 0
        ? { x: this.city.packagePos.x + 4, z: this.city.packagePos.z }
        : { x: this.city.pierPos.x, z: this.city.pierPos.z - 8 };
    } else {
      if (this.stage === 0) {
        const next = this.cashDrops.find((d) => !d.taken);
        this.markerTarget = next ? { x: next.x, z: next.z } : { x: this.city.hideoutPos.x, z: this.city.hideoutPos.z };
      } else {
        this.markerTarget = { x: this.city.hideoutPos.x, z: this.city.hideoutPos.z };
      }
    }
  }

  // Called when the player walks onto the between-missions start marker.
  tryStart(player, ctx) {
    if (this.active || this.storyComplete) return false;
    const start = this.index === 0
      ? { x: -100, z: -29 }
      : this.index === 1
        ? { x: this.city.packagePos.x, z: this.city.packagePos.z }
        : { x: this.city.cashSpots[0].x, z: this.city.cashSpots[0].z };
    if (Math.hypot(player.x - start.x, player.z - start.z) < 5) {
      this.startMission(this.index);
      if (ctx.audio) ctx.audio.jingle();
      if (this.index === 1 && ctx.police) ctx.police.addWanted(1);
      return true;
    }
    return false;
  }

  completeMission(ctx) {
    const reward = this.def.reward;
    this.completedCount += 1;
    if (ctx.player) ctx.player.money += reward;
    if (ctx.audio) ctx.audio.jingle();
    if (ctx.onMissionComplete) ctx.onMissionComplete(this.index, reward);
    this.active = false;
    this.index += 1;
    if (this.index >= MISSION_DEFS.length) {
      this.storyComplete = true;
      this.markerTarget = null;
      if (ctx.onStoryComplete) ctx.onStoryComplete();
    } else {
      this.updateMarkerTarget();
    }
  }

  failMission(ctx) {
    this.active = false;
    this.stage = 0;
    this.timer = 0;
    this.hasPackage = false;
    this.packageMesh.visible = false;
    for (const drop of this.cashDrops) drop.mesh.visible = false;
    if (ctx.onMissionFailed) ctx.onMissionFailed(this.index);
    this.updateMarkerTarget();
  }

  update(dt, player, ctx) {
    this.pulse += dt;
    // Marker follows the current target and pulses.
    if (this.markerTarget) {
      this.marker.visible = true;
      this.marker.position.set(this.markerTarget.x, 0, this.markerTarget.z);
      const s = 1 + Math.sin(this.pulse * 3) * 0.12;
      this.marker.scale.set(s, 1, s);
    } else {
      this.marker.visible = false;
    }
    // Cash drops bob and spin.
    for (const drop of this.cashDrops) {
      if (drop.taken || !drop.mesh.visible) continue;
      drop.mesh.rotation.y += dt * 1.5;
      drop.mesh.position.y = 1.0 + Math.sin(this.pulse * 2 + drop.phase) * 0.25;
    }
    // Health pickups: respawn on a timer, heal on touch.
    for (const hp of this.healthPickups) {
      if (!hp.active) {
        hp.respawn -= dt;
        if (hp.respawn <= 0) {
          hp.active = true;
          hp.group.visible = true;
        }
        continue;
      }
      hp.group.rotation.y += dt * 0.8;
      if (Math.hypot(player.x - hp.x, player.z - hp.z) < 2.6) {
        hp.active = false;
        hp.group.visible = false;
        hp.respawn = 20;
        player.heal(30);
        if (ctx.audio) ctx.audio.pickup();
      }
    }
    // Starting a mission by walking onto its start marker.
    this.tryStart(player, ctx);
    if (!this.active) return;

    this.timer -= dt;
    if (this.timer <= 0) {
      this.failMission(ctx);
      return;
    }

    if (this.index === 0) {
      if (this.stage === 0 && player.driving) {
        this.stage = 1;
        this.updateMarkerTarget();
        if (ctx.audio) ctx.audio.pickup();
      } else if (this.stage === 1) {
        const g = this.city.garagePos;
        if (Math.hypot(player.x - (g.x + 12), player.z - g.z) < 6) {
          this.completeMission(ctx);
        }
      }
    } else if (this.index === 1) {
      if (this.stage === 0) {
        const p = this.city.packagePos;
        if (Math.hypot(player.x - (p.x + 4), player.z - p.z) < 3.5) {
          this.stage = 1;
          this.hasPackage = true;
          this.packageMesh.visible = false;
          this.updateMarkerTarget();
          if (ctx.audio) ctx.audio.pickup();
        }
      } else if (this.stage === 1) {
        const pier = this.city.pierPos;
        if (Math.hypot(player.x - pier.x, player.z - (pier.z - 8)) < 6) {
          this.completeMission(ctx);
        }
      }
    } else if (this.index === 2) {
      if (this.stage === 0) {
        for (const drop of this.cashDrops) {
          if (!drop.taken && Math.hypot(player.x - drop.x, player.z - drop.z) < 3) {
            drop.taken = true;
            drop.mesh.visible = false;
            this.cashCollected += 1;
            player.money += CONFIG.cashDropValue;
            if (ctx.audio) ctx.audio.pickup();
            this.updateMarkerTarget();
          }
        }
        if (this.cashCollected >= 5) {
          this.stage = 1;
          this.updateMarkerTarget();
        }
      } else if (this.stage === 1) {
        const h = this.city.hideoutPos;
        if (Math.hypot(player.x - h.x, player.z - h.z) < 7) {
          this.completeMission(ctx);
        }
      }
    }
  }
}
