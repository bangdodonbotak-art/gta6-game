// SOLMAR — boot and the one loop. Builds the world (city, traffic, peds,
// player, police, missions, HUD, audio), runs it in fixed 1/60 s steps, and
// moves between screens: start, play, pause, wasted, busted, story-complete.
//
// ?seed=N fixes the city. ?shot=start|play|chase|mission (with &seed=N)
// stages that scene instead of the menu, paints it, and sets
// window.__shotReady for a screenshot. The game is static files only:
// three.js is vendored under game/vendor, everything else is written here.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeRng } from './random.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { buildCity } from './city.js';
import { Traffic } from './vehicles.js';
import { Pedestrians } from './people.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const BEST_KEY = 'solmar.best';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

// Capture page errors where the screenshot harness can read them.
window.__gameErrors = [];
window.addEventListener('error', (e) => {
  window.__gameErrors.push(String(e.message || e.error || 'error'));
});

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best take then lasts one visit.
  }
}

class Game {
  constructor(seedValue) {
    this.seed = seedValue;
    this.rng = makeRng(seedValue);
    this.screen = 'start';
    this.best = readBest();
    this.ramCooldown = 0;
    this.orbitAngle = 0.6;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(60, 55, 160);

    this.city = buildCity(this.scene, this.rng);
    this.traffic = new Traffic(this.scene, this.rng, this.city);
    this.peds = new Pedestrians(this.scene, this.rng, this.city);
    this.player = new Player(this.scene, this.city.hideoutPos.x - 10, this.city.hideoutPos.z);
    this.police = new Police(this.scene, this.rng, this.city);
    this.missions = new Missions(this.scene, this.city);
    this.hud = new HUD();
    this.audio = new AudioEngine();
    this.input = new Input(this.renderer.domElement);
    this.missions.updateMarkerTarget();
    this.hud.setBestMoney(this.best);

    // The one context object every system gets: world handles plus the
    // callbacks that cross between systems (crime, damage, mission events).
    this.ctx = {
      city: this.city,
      traffic: this.traffic,
      peds: this.peds,
      audio: this.audio,
      police: this.police,
      player: this.player,
      onStealCar: () => {
        this.police.addWanted(1);
        this.hud.showToast('Car stolen — the cops noticed! Wanted +1 ★', 3);
      },
      onPunchPed: () => {
        this.police.addWanted(1);
        this.hud.showToast('Assault! Wanted +1 ★', 3);
      },
      onHitPed: () => {
        this.police.addWanted(1);
        this.hud.showToast('You hit a pedestrian! Wanted +1 ★', 3);
      },
      onHitTrafficCar: () => {
        this.police.addWanted(1);
        this.hud.showToast('Hit and run! Wanted +1 ★', 3);
      },
      onCrash: () => {},
      onPoliceRam: () => {
        if (this.ramCooldown <= 0) {
          this.ramCooldown = 0.9;
          this.player.damage(5, this.ctx);
          if (this.audio) this.audio.crash(6);
        }
      },
      onBusted: () => this.busted(),
      onWasted: () => this.wasted(),
      onMissionComplete: (index, reward) => {
        const names = ['Hot Wheels', 'Package Run', 'The Big Score'];
        this.hud.showToast('Mission complete: ' + names[index] + ' — +$' + reward, 4);
        this.saveBestIfBeaten();
      },
      onMissionFailed: () => {
        this.hud.showToast('Mission failed — out of time. Walk to the yellow marker to retry.', 4);
      },
      onStoryComplete: () => {
        this.saveBestIfBeaten();
        this.setScreen('complete');
      },
    };

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  saveBestIfBeaten() {
    if (this.player.money > this.best) {
      this.best = this.player.money;
      saveBest(this.best);
      this.hud.setBestMoney(this.best);
    }
  }

  setScreen(name) {
    this.screen = name;
    this.hud.showScreen(name);
    const hudEl = document.getElementById('hud');
    if (hudEl) hudEl.style.display = name === 'play' || name === 'pause' ? 'block' : 'none';
    if (name === 'wasted' || name === 'busted' || name === 'complete') {
      this.hud.setFinalMoney(this.player.money);
      this.saveBestIfBeaten();
    }
  }

  reset() {
    // Fresh world for a screenshot scene: rebuild the dynamic systems on the
    // same static city. Simplest correct reset is a page-level rebuild of
    // the mutable managers; the city geometry stays.
    for (const car of this.traffic.cars) this.scene.remove(car.mesh);
    for (const car of this.traffic.parked) this.scene.remove(car.mesh);
    for (const ped of this.peds.peds) this.scene.remove(ped.mesh);
    for (const car of this.police.cars) this.scene.remove(car.mesh);
    this.traffic = new Traffic(this.scene, makeRng(this.seed), this.city);
    this.peds = new Pedestrians(this.scene, makeRng(this.seed + 7), this.city);
    this.police = new Police(this.scene, makeRng(this.seed + 13), this.city);
    this.player.health = CONFIG.playerHealth;
    this.player.money = 0;
    if (this.player.inCar) this.player.exitCar();
    this.player.x = this.city.hideoutPos.x - 10;
    this.player.z = this.city.hideoutPos.z;
    this.player.heading = 0;
    this.player.mesh.visible = true;
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.ctx.traffic = this.traffic;
    this.ctx.peds = this.peds;
    this.ctx.police = this.police;
    // Missions keep their meshes (marker, drops, pickups) but reset state.
    this.missions.index = 0;
    this.missions.stage = 0;
    this.missions.active = false;
    this.missions.storyComplete = false;
    this.missions.completedCount = 0;
    this.missions.cashCollected = 0;
    this.missions.hasPackage = false;
    this.missions.packageMesh.visible = false;
    for (const drop of this.missions.cashDrops) drop.mesh.visible = false;
    this.missions.updateMarkerTarget();
  }

  busted() {
    const fine = Math.min(this.player.money, 150);
    this.player.money -= fine;
    this.police.clearWanted();
    if (this.player.inCar) this.player.exitCar();
    this.player.x = this.city.hideoutPos.x - 10;
    this.player.z = this.city.hideoutPos.z;
    this.player.health = CONFIG.playerHealth;
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.audio.busted();
    this.hud.showToast('BUSTED — fined $' + fine + '. You wake up at the hideout.', 4);
    this.setScreen('busted');
  }

  wasted() {
    this.audio.busted();
    this.setScreen('wasted');
  }

  startPlaying() {
    this.audio.ensure();
    this.setScreen('play');
  }

  restart() {
    this.player.health = CONFIG.playerHealth;
    this.player.money = 0;
    this.police.clearWanted();
    if (this.player.inCar) this.player.exitCar();
    this.player.x = this.city.hideoutPos.x - 10;
    this.player.z = this.city.hideoutPos.z;
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.missions.index = 0;
    this.missions.stage = 0;
    this.missions.active = false;
    this.missions.storyComplete = false;
    this.missions.completedCount = 0;
    this.missions.updateMarkerTarget();
    this.startPlaying();
  }

  // One fixed simulation step: every system advances, the HUD refreshes.
  stepWorld(dt, input) {
    this.ramCooldown = Math.max(0, this.ramCooldown - dt);
    this.player.update(dt, input, this.ctx);
    this.traffic.update(dt);
    this.peds.update(dt, this.player.x, this.player.z, this.player.driving ? Math.abs(this.player.carSpeed) : this.player.speed);
    this.police.update(dt, this.player, this.ctx);
    this.missions.update(dt, this.player, this.ctx);
    this.audio.update(this.player.driving ? Math.abs(this.player.carSpeed) / CONFIG.carTopSpeed : 0, this.police.wanted);
    this.player.updateCamera(this.camera, dt);
    this.hud.update({
      wanted: this.police.wanted,
      health: this.player.health,
      money: this.player.money,
      driving: this.player.driving,
      speedKmh: this.player.speedKmh,
      objective: this.missions.objective,
      timer: this.missions.active ? this.missions.timeLeft : 0,
    });
    this.hud.drawMinimap({
      cityHalf: this.city.half,
      roadCenters: this.city.roadCenters,
      marker: this.missions.markerTarget,
      traffic: [...this.traffic.cars, ...this.traffic.parked],
      police: this.police.cars,
      playerX: this.player.x,
      playerZ: this.player.z,
      playerHeading: this.player.heading,
    });
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

const game = new Game(seed);

function runShot(name) {
  const staged = stageShot(name, game);
  game.setScreen(staged.screen);
  // Start screen keeps its slow orbit; play scenes render as staged.
  let painted = 0;
  function paint() {
    if (staged.screen === 'start') {
      game.orbitAngle += 0.01;
      game.camera.position.set(
        Math.sin(game.orbitAngle) * 130,
        62,
        Math.cos(game.orbitAngle) * 130,
      );
      game.camera.lookAt(0, 12, 20);
    }
    game.render();
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  game.setScreen('start');
  let last = performance.now();
  let accumulator = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    // Global keys, whatever the screen.
    if (game.input.justPressed('KeyM')) {
      game.audio.setMuted(!game.audio.muted);
      game.hud.showToast(game.audio.muted ? 'Sound muted' : 'Sound on', 2);
    }

    if (game.screen === 'start') {
      game.audio.ensure();
      // Slow orbit over the city behind the title.
      game.orbitAngle += dt * 0.03;
      game.camera.position.set(Math.sin(game.orbitAngle) * 130, 62, Math.cos(game.orbitAngle) * 130);
      game.camera.lookAt(0, 12, 20);
      game.stepWorld(dt, game.input);
      if (game.input.justPressed('Enter') || game.input.justPressed('Space')) {
        game.startPlaying();
      }
      game.render();
    } else if (game.screen === 'play') {
      if (game.input.justPressed('Escape') || game.input.justPressed('KeyP')) {
        game.setScreen('pause');
      } else {
        accumulator += dt;
        while (accumulator >= STEP) {
          game.stepWorld(STEP, game.input);
          accumulator -= STEP;
        }
        game.render();
      }
    } else if (game.screen === 'pause') {
      if (game.input.justPressed('Escape') || game.input.justPressed('KeyP') || game.input.justPressed('Enter')) {
        game.setScreen('play');
      }
      game.render();
    } else {
      // wasted / busted / complete: world idles behind the screen.
      if (game.input.justPressed('Enter') || game.input.justPressed('Space') || game.input.justPressed('KeyR')) {
        if (game.screen === 'complete') game.setScreen('play');
        else game.restart();
      }
      game.render();
    }
    game.input.endFrame();
  }

  // Clicking the start button (or anywhere on the title) starts the game.
  document.getElementById('start-button').addEventListener('click', () => game.startPlaying());
  document.getElementById('restart-button').addEventListener('click', () => game.restart());
  document.getElementById('busted-button').addEventListener('click', () => game.setScreen('play'));
  document.getElementById('complete-button').addEventListener('click', () => game.setScreen('play'));
  document.getElementById('resume-button').addEventListener('click', () => game.setScreen('play'));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === 'play') game.setScreen('pause');
  });

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
