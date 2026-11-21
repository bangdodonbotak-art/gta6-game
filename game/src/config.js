// SOLMAR — central tuning. One place for every number that shapes the city,
// the cars, the wanted system and the missions, so balancing never means
// hunting through gameplay code.
export const CONFIG = {
  seed: 1,
  // City layout: a grid of square blocks separated by roads.
  blockSize: 44,
  roadWidth: 14,
  blocksX: 5,
  blocksZ: 5,
  buildingMinH: 12,
  buildingMaxH: 55,
  // Player on foot.
  walkSpeed: 6,
  runSpeed: 11,
  playerRadius: 0.7,
  playerHealth: 100,
  // Arcade car handling.
  carAccel: 26,
  carBrake: 42,
  carReverseMax: 12,
  carTopSpeed: 42,
  carSteer: 1.9,
  carGrip: 4.5,
  carRadius: 1.9,
  // Traffic + pedestrians.
  trafficCount: 14,
  pedCount: 22,
  trafficSpeed: 9,
  pedSpeed: 1.6,
  // Wanted system.
  wantedMax: 5,
  wantedDecayDelay: 12,
  wantedDecayRate: 0.12,
  policeMax: 6,
  bustedRadius: 2.6,
  // Economy.
  stealFine: 150,
  missionReward: [400, 700, 1500],
  cashDropValue: 120,
  // Missions.
  mission1Time: 150,
  mission2Time: 180,
  mission3Time: 240,
  // Camera.
  camDistance: 11,
  camHeight: 5.5,
  camDriveDistance: 13,
  camDriveHeight: 6,
};

export const COLORS = {
  sky: 0xff9e5e,
  fog: 0xf2a06b,
  sun: 0xffd9a0,
  road: 0x3a3f46,
  roadLine: 0xe8d44d,
  sidewalk: 0x9a938a,
  sand: 0xe8c98f,
  ocean: 0x1e6f8e,
  grass: 0x5d8a4a,
  buildingPalette: [0xd8c1a3, 0xc9b8a8, 0xb8c4c9, 0xe0a878, 0xa8b8c4, 0xd9a0a0, 0xc4b89a],
  carPalette: [0xc23b2e, 0x2e6fc2, 0xe8c832, 0x3aa655, 0xe8e8e8, 0x222226, 0x7a4a9e, 0xe07830],
  policeCar: 0x1a1a22,
  playerShirt: 0x2fa36b,
  pedPalette: [0xd94f4f, 0x4f7ad9, 0x7ad94f, 0xd9b84f, 0x9a4fd9, 0x4fd9c9, 0xe8e8e8, 0x333333],
};
