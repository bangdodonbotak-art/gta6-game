// SOLMAR — the screenshot scenes behind ?shot=start|play|chase|mission.
// Each scene plays the real simulation forward from a fresh world for a
// fixed number of fixed steps, steered by a tiny scripted driver (hold W,
// steer toward the road ahead), so every frame is what a short session
// really looks like — and the same seed always gives the same frame.
// The staged scene renders immediately on load, with no user input.
import { CONFIG } from './config.js';

const STEP = 1 / 60;

// A stand-in for the real keyboard: the autopilot holds W and steers, and
// never presses an action key. `throttle` false means coasting (used by the
// chase scene so the police can catch the player).
function scriptedInput(steerLeft, steerRight, throttle) {
  const held = new Set();
  if (throttle !== false) held.add('KeyW');
  if (steerLeft) held.add('KeyA');
  if (steerRight) held.add('KeyD');
  return {
    down: (code) => held.has(code),
    justPressed: () => false,
    consumeDrag: () => ({ dx: 0, dy: 0 }),
    endFrame: () => {},
  };
}

function idleInput() {
  return {
    down: () => false,
    justPressed: () => false,
    consumeDrag: () => ({ dx: 0, dy: 0 }),
    endFrame: () => {},
  };
}

// Drive the player's car forward along its current road for `seconds`,
// steering gently back toward the road centre line. With `maxSpeed` the
// autopilot lifts off the throttle above that speed (a cruise, not a race).
function driveForward(game, seconds, maxSpeed) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const car = game.player.inCar;
    let steerLeft = false;
    let steerRight = false;
    let throttle = true;
    if (car) {
      if (maxSpeed !== undefined && car.speed >= maxSpeed) throttle = false;
      // Roads run along X or Z; nudge the car back onto its lane.
      const onVerticalRoad = Math.abs(Math.sin(car.heading)) < 0.5;
      const lane = onVerticalRoad ? car.x : car.z;
      const nearestRoad = game.city.roadCenters.reduce((best, c) => {
        return Math.abs(c - lane) < Math.abs(best - lane) ? c : best;
      }, game.city.roadCenters[0]);
      const off = lane - nearestRoad;
      const headingErr = onVerticalRoad ? Math.sin(car.heading) : Math.cos(car.heading);
      if (off > 1.5 || headingErr > 0.08) steerRight = true;
      if (off < -1.5 || headingErr < -0.08) steerLeft = true;
    }
    game.stepWorld(STEP, scriptedInput(steerLeft, steerRight, throttle));
  }
}

// Put the player in a parked car on a road, ready to drive.
function putPlayerInCar(game) {
  const car = game.traffic.parked.find((c) => Math.abs(c.x + 29) < 8) || game.traffic.parked[0];
  car.x = -29;
  car.z = -100;
  car.heading = 0;
  car.parked = false;
  game.player.enterCar(car);
  game.player.carSpeed = 12;
  car.syncMesh();
}

/**
 * Stage the named scene on a fresh game and return the screen to show over
 * it ('start' shows the title screen, the rest show the play HUD).
 */
export function stageShot(name, game) {
  game.reset();
  if (name === 'play') {
    putPlayerInCar(game);
    driveForward(game, 4.5);
    return { screen: 'play' };
  }
  if (name === 'chase') {
    putPlayerInCar(game);
    game.police.addWanted(3);
    // Place the pursuit where the chase camera can see it: two cruisers
    // coming head-on down the player's road (heading PI, toward the player)
    // and one more closing from behind. A short drive keeps them in frame.
    const escorts = [
      { x: -29, z: -20, heading: Math.PI, speed: 30 },
      { x: -21, z: -45, heading: Math.PI, speed: 30 },
      { x: -29, z: -128, heading: 0, speed: 32 },
    ];
    for (const spot of escorts) {
      const cruiser = game.police.spawnPoliceCar(game.player.x, game.player.z);
      cruiser.x = spot.x;
      cruiser.z = spot.z;
      cruiser.heading = spot.heading;
      cruiser.speed = spot.speed;
      cruiser.syncMesh();
    }
    driveForward(game, 1.0);
    return { screen: 'play' };
  }
  if (name === 'mission') {
    // On foot at the package kiosk, mission 2 running, marker and HUD live.
    // The player stands just outside the pickup radius so the marker stays
    // at the kiosk, in frame, with the objective on the HUD.
    game.missions.startMission(1);
    game.police.addWanted(1);
    game.player.x = game.city.packagePos.x + 8;
    game.player.z = game.city.packagePos.z + 6;
    game.player.heading = -2.55;
    game.player.camYaw = 0.59;
    game.player.mesh.position.set(game.player.x, 0, game.player.z);
    game.player.mesh.rotation.y = game.player.heading;
    for (let i = 0; i < Math.round(2 / STEP); i += 1) {
      game.stepWorld(STEP, idleInput());
    }
    return { screen: 'play' };
  }
  // start (and any unknown name): title screen over a high city vista.
  game.player.x = -40;
  game.player.z = 120;
  game.player.mesh.position.set(-40, 0, 120);
  for (let i = 0; i < Math.round(1 / STEP); i += 1) {
    game.stepWorld(STEP, idleInput());
  }
  return { screen: 'start' };
}
