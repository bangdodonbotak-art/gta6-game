// SOLMAR — the city itself. A seeded procedural coastal city: a grid of blocks
// with roads, box buildings wearing canvas-painted window textures, palm trees,
// streetlights, a sandy beach and an ocean plane on the south edge, all under a
// low sunset sun with warm fog. Deterministic: the same seed builds the same
// city. Also exports the road loops traffic follows and the landmark spots the
// missions use (garage, pier, hideout, package point, cash drops, health).
import * as THREE from 'three';
import { CONFIG, COLORS } from './config.js';

const PITCH = CONFIG.blockSize + CONFIG.roadWidth; // 58: block + road
const HALF = (CONFIG.blocksX * PITCH) / 2; // 145: city half-extent

// Paint a building facade on a canvas: base colour with a grid of lit and
// dark windows. One texture per building keeps the city varied and cheap.
function buildingTexture(rng, baseColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = baseColor;
  g.fillRect(0, 0, 128, 256);
  // Slight vertical shading so the sun side reads warmer.
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,220,170,0.25)');
  grad.addColorStop(1, 'rgba(60,30,10,0.35)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 14; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const lit = rng.chance(0.45);
      g.fillStyle = lit ? '#ffd98a' : '#3a4552';
      g.fillRect(8 + col * 15, 10 + row * 17, 9, 11);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePalm(rng) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 6.5, 6), trunkMat);
  trunk.position.y = 3.25;
  trunk.rotation.z = rng.range(-0.08, 0.08);
  group.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f3a });
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 3.4), leafMat);
    const angle = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(angle) * 1.2, 6.6, Math.sin(angle) * 1.2);
    leaf.rotation.y = -angle;
    leaf.rotation.x = 0.5;
    group.add(leaf);
  }
  const nut = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x6a4a2a }),
  );
  nut.position.y = 6.4;
  group.add(nut);
  return group;
}

function makeStreetlight() {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7, 6), mat);
  pole.position.y = 3.5;
  group.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), mat);
  arm.position.set(0.7, 6.9, 0);
  group.add(arm);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffc860, emissiveIntensity: 0.9 }),
  );
  lamp.position.set(1.4, 6.8, 0);
  group.add(lamp);
  return group;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const loops = [];

  // --- Sky, fog and sun -------------------------------------------------
  scene.background = new THREE.Color(COLORS.sky);
  scene.fog = new THREE.Fog(COLORS.fog, 130, 460);
  const hemi = new THREE.HemisphereLight(0xffc9a0, 0x5a4632, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(COLORS.sun, 1.9);
  sun.position.set(-140, 85, -60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -180;
  sun.shadow.camera.right = 180;
  sun.shadow.camera.top = 180;
  sun.shadow.camera.bottom = -180;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  // Low sun disc on the western horizon.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(22, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }),
  );
  sunDisc.position.set(-320, 42, -40);
  sunDisc.lookAt(0, 42, 0);
  scene.add(sunDisc);

  // --- Ground: city slab, beach sand, ocean ------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshLambertMaterial({ color: 0x8f8578 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 70),
    new THREE.MeshLambertMaterial({ color: COLORS.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, HALF + 35);
  sand.receiveShadow = true;
  scene.add(sand);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 260),
    new THREE.MeshLambertMaterial({ color: COLORS.ocean }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.4, HALF + 200);
  scene.add(ocean);
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 4),
    new THREE.MeshLambertMaterial({ color: 0xf2ead8 }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.05, HALF + 68);
  scene.add(foam);

  // --- Roads --------------------------------------------------------------
  // Road centre lines sit between blocks: -145, -87, -29, 29, 87, 145.
  const roadCenters = [];
  for (let i = 0; i <= CONFIG.blocksX; i += 1) {
    roadCenters.push(-HALF + i * PITCH);
  }
  const roadMat = new THREE.MeshLambertMaterial({ color: COLORS.road });
  const lineMat = new THREE.MeshLambertMaterial({ color: COLORS.roadLine });
  const roadLen = HALF * 2 + CONFIG.roadWidth;
  for (const c of roadCenters) {
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.roadWidth, roadLen), roadMat);
    vRoad.rotation.x = -Math.PI / 2;
    vRoad.position.set(c, 0.03, 0);
    vRoad.receiveShadow = true;
    scene.add(vRoad);
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, CONFIG.roadWidth), roadMat);
    hRoad.rotation.x = -Math.PI / 2;
    hRoad.position.set(0, 0.03, c);
    hRoad.receiveShadow = true;
    scene.add(hRoad);
    // Dashed centre lines.
    for (let d = -HALF; d < HALF; d += 8) {
      const dashV = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3.2), lineMat);
      dashV.rotation.x = -Math.PI / 2;
      dashV.position.set(c, 0.05, d);
      scene.add(dashV);
      const dashH = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.5), lineMat);
      dashH.rotation.x = -Math.PI / 2;
      dashH.position.set(d, 0.05, c);
      scene.add(dashH);
    }
  }

  // --- Buildings ------------------------------------------------------------
  const blockCenters = [];
  for (let i = 0; i < CONFIG.blocksX; i += 1) {
    blockCenters.push(-HALF + PITCH / 2 + i * PITCH);
  }
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4038 });
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      // The south row of blocks fronts the beach: keep it low (hotels, cafes).
      const nearBeach = bz > HALF - PITCH;
      const count = rng.chance(0.45) ? 2 : 1;
      for (let k = 0; k < count; k += 1) {
        const w = rng.range(16, 30);
        const d = rng.range(16, 30);
        const h = nearBeach
          ? rng.range(8, 18)
          : rng.range(CONFIG.buildingMinH, CONFIG.buildingMaxH);
        const ox = count === 2 ? (k === 0 ? -9 : 9) : 0;
        const oz = count === 2 ? (k === 0 ? -9 : 9) : 0;
        const x = bx + ox;
        const z = bz + oz;
        const base = '#' + new THREE.Color(rng.pick(COLORS.buildingPalette)).getHexString();
        const tex = buildingTexture(rng, base);
        const mat = new THREE.MeshLambertMaterial({ map: tex });
        const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        building.position.set(x, h / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6), roofMat);
        roof.position.set(x, h + 0.4, z);
        scene.add(roof);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
      // Traffic loop around this block, on the surrounding roads.
      const r = CONFIG.blockSize / 2 + CONFIG.roadWidth / 2;
      loops.push([
        { x: bx - r, z: bz - r },
        { x: bx + r, z: bz - r },
        { x: bx + r, z: bz + r },
        { x: bx - r, z: bz + r },
      ]);
    }
  }

  // --- Palms: beachfront row + a few sidewalk palms -------------------------
  for (let x = -HALF + 10; x <= HALF - 10; x += 24) {
    const palm = makePalm(rng);
    palm.position.set(x + rng.range(-4, 4), 0, HALF + 12 + rng.range(-3, 5));
    scene.add(palm);
  }
  for (let i = 0; i < 14; i += 1) {
    const palm = makePalm(rng);
    const bx = rng.pick(blockCenters);
    const bz = rng.pick(blockCenters);
    palm.position.set(bx + rng.range(-20, 20), 0, bz + rng.range(-20, 20));
    scene.add(palm);
  }

  // --- Streetlights along the roads -----------------------------------------
  for (const c of roadCenters) {
    for (let d = -HALF + 14; d < HALF; d += 58) {
      const light = makeStreetlight();
      light.position.set(c + CONFIG.roadWidth / 2 + 1.2, 0, d);
      light.rotation.y = Math.PI;
      scene.add(light);
      const light2 = makeStreetlight();
      light2.position.set(d, 0, c + CONFIG.roadWidth / 2 + 1.2);
      light2.rotation.y = Math.PI / 2;
      scene.add(light2);
    }
  }

  // --- Landmarks -------------------------------------------------------------
  // Garage (mission 1 target): a low workshop on the west side.
  const garagePos = { x: -HALF + 4, z: -29 };
  const garage = new THREE.Group();
  const garageBody = new THREE.Mesh(
    new THREE.BoxGeometry(20, 8, 14),
    new THREE.MeshLambertMaterial({ color: 0xb8552e }),
  );
  garageBody.position.y = 4;
  garageBody.castShadow = true;
  garage.add(garageBody);
  const garageDoor = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 6),
    new THREE.MeshLambertMaterial({ color: 0x2c2f36 }),
  );
  garageDoor.position.set(0, 3, 7.05);
  garage.add(garageDoor);
  const garageSign = new THREE.Mesh(
    new THREE.BoxGeometry(16, 2, 0.6),
    new THREE.MeshLambertMaterial({ color: 0xf2c94c, emissive: 0x8a6d1a, emissiveIntensity: 0.5 }),
  );
  garageSign.position.set(0, 8.6, 0);
  garage.add(garageSign);
  garage.position.set(garagePos.x, 0, garagePos.z);
  scene.add(garage);
  colliders.push({ minX: garagePos.x - 10, maxX: garagePos.x + 10, minZ: garagePos.z - 7, maxZ: garagePos.z + 7 });

  // Pier (mission 2 delivery): wooden walkway out over the ocean, south centre.
  const pierPos = { x: 0, z: HALF + 62 };
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x9a7a52 });
  for (let i = 0; i < 14; i += 1) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 4.4), pierMat);
    plank.position.set(0, 0.6, HALF + 72 + i * 4.6);
    plank.castShadow = true;
    scene.add(plank);
  }
  for (const side of [-4.2, 4.2]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1, 62), pierMat);
    rail.position.set(side, 1.4, HALF + 100);
    scene.add(rail);
  }

  // Hideout (mission 3 finish + respawn): a small house on the east edge.
  const hideoutPos = { x: HALF - 8, z: 87 };
  const hideout = new THREE.Group();
  const house = new THREE.Mesh(
    new THREE.BoxGeometry(12, 6, 10),
    new THREE.MeshLambertMaterial({ color: 0x7a9e6a }),
  );
  house.position.y = 3;
  house.castShadow = true;
  hideout.add(house);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(9, 4, 4),
    new THREE.MeshLambertMaterial({ color: 0xa8542e }),
  );
  roof.position.y = 8;
  roof.rotation.y = Math.PI / 4;
  hideout.add(roof);
  hideout.position.set(hideoutPos.x, 0, hideoutPos.z);
  scene.add(hideout);
  colliders.push({ minX: hideoutPos.x - 6, maxX: hideoutPos.x + 6, minZ: hideoutPos.z - 5, maxZ: hideoutPos.z + 5 });

  // Package pickup point (mission 2 start): a corner kiosk near the centre.
  const packagePos = { x: 29, z: -87 };
  const kiosk = new THREE.Mesh(
    new THREE.BoxGeometry(5, 3.4, 5),
    new THREE.MeshLambertMaterial({ color: 0x2e6f8e }),
  );
  kiosk.position.set(packagePos.x, 1.7, packagePos.z);
  kiosk.castShadow = true;
  scene.add(kiosk);
  colliders.push({ minX: packagePos.x - 2.5, maxX: packagePos.x + 2.5, minZ: packagePos.z - 2.5, maxZ: packagePos.z + 2.5 });

  // Cash drop spots (mission 3): spread across the city.
  const cashSpots = [
    { x: -87, z: -87 },
    { x: 87, z: -29 },
    { x: -29, z: 29 },
    { x: 29, z: 87 },
    { x: -87, z: 116 },
  ];

  // Health pickup spots: near the beach and the hideout.
  const healthSpots = [
    { x: -58, z: HALF + 8 },
    { x: 58, z: HALF + 8 },
    { x: HALF - 22, z: 58 },
  ];

  return {
    colliders,
    loops,
    garagePos,
    pierPos,
    hideoutPos,
    packagePos,
    cashSpots,
    healthSpots,
    half: HALF,
    roadCenters,
  };
}

// Circle (player, car, ped) vs building AABB: push the circle out and report
// whether a hit happened. Used by every moving thing in the city.
export function resolveCircleVsColliders(pos, radius, colliders) {
  let hit = false;
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        pos.x = c.maxX + radius;
      }
    }
  }
  return hit;
}
