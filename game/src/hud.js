// SOLMAR — the HUD. DOM overlays (wanted stars, health bar, money, speed,
// objective + timer, controls help, mute/pause) plus a live 2D minimap drawn
// on a canvas: roads, the player arrow, traffic, police and the mission
// marker, all top-down. Also owns the screens: start, pause, wasted, busted
// and story-complete.
export class HUD {
  constructor() {
    this.el = {
      stars: document.getElementById('stars'),
      healthFill: document.getElementById('health-fill'),
      healthText: document.getElementById('health-text'),
      money: document.getElementById('money'),
      speed: document.getElementById('speed'),
      objective: document.getElementById('objective'),
      timer: document.getElementById('timer'),
      help: document.getElementById('help'),
      toast: document.getElementById('toast'),
      startScreen: document.getElementById('start-screen'),
      pauseScreen: document.getElementById('pause-screen'),
      wastedScreen: document.getElementById('wasted-screen'),
      bustedScreen: document.getElementById('busted-screen'),
      completeScreen: document.getElementById('complete-screen'),
      bestMoney: document.getElementById('best-money'),
      finalMoney: document.getElementById('final-money'),
      completeMoney: document.getElementById('complete-money'),
      minimap: document.getElementById('minimap'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this.toastTimer = 0;
  }

  showToast(text, seconds) {
    this.el.toast.textContent = text;
    this.el.toast.style.opacity = '1';
    this.toastTimer = seconds || 3;
  }

  updateToast(dt) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el.toast.style.opacity = '0';
    }
  }

  hideAllScreens() {
    for (const key of ['startScreen', 'pauseScreen', 'wastedScreen', 'bustedScreen', 'completeScreen']) {
      if (this.el[key]) this.el[key].style.display = 'none';
    }
  }

  showScreen(name) {
    this.hideAllScreens();
    const map = {
      start: 'startScreen',
      pause: 'pauseScreen',
      wasted: 'wastedScreen',
      busted: 'bustedScreen',
      complete: 'completeScreen',
    };
    const el = this.el[map[name]];
    if (el) el.style.display = 'flex';
  }

  setBestMoney(value) {
    if (this.el.bestMoney) this.el.bestMoney.textContent = 'Best take: $' + value.toLocaleString();
  }

  setFinalMoney(value) {
    if (this.el.finalMoney) this.el.finalMoney.textContent = 'Take: $' + value.toLocaleString();
    if (this.el.completeMoney) this.el.completeMoney.textContent = 'Final take: $' + value.toLocaleString();
  }

  update(state) {
    // Wanted stars: filled ★ up to the level, empty ☆ above it.
    const wanted = Math.floor(state.wanted);
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < wanted ? '★' : '☆';
    this.el.stars.textContent = stars;
    this.el.stars.style.color = wanted > 0 ? '#ffd94d' : '#ffffff55';
    this.el.healthFill.style.width = Math.max(0, state.health) + '%';
    this.el.healthFill.style.background = state.health > 50 ? '#3aa655' : state.health > 25 ? '#e8a832' : '#d92b2b';
    this.el.healthText.textContent = Math.ceil(state.health) + ' HP';
    this.el.money.textContent = '$' + state.money.toLocaleString();
    if (state.driving) {
      this.el.speed.style.display = 'block';
      this.el.speed.textContent = Math.round(state.speedKmh) + ' km/h';
    } else {
      this.el.speed.style.display = 'none';
    }
    this.el.objective.textContent = state.objective;
    this.el.timer.textContent = state.timer > 0 ? '⏱ ' + state.timer + 's' : '';
    this.el.help.textContent = state.driving
      ? 'W/S drive · A/D steer · Space handbrake · E exit · Esc pause · M mute'
      : 'WASD move · Shift run · Drag mouse: camera · E steal car · F punch · Esc pause · M mute';
    this.updateToast(1 / 60);
  }

  // Top-down minimap: roads as grey lines, beach as sand, ocean as blue,
  // then the mission marker (yellow), traffic (white), police (blue/red)
  // and the player arrow (green).
  drawMinimap(state) {
    const ctx = this.mapCtx;
    const size = 180;
    const half = state.cityHalf;
    const toMap = (x, z) => [size / 2 + (x / (half + 90)) * (size / 2), size / 2 + (z / (half + 90)) * (size / 2)];
    ctx.fillStyle = '#20242c';
    ctx.fillRect(0, 0, size, size);
    // Ocean strip at the bottom (south).
    const [, oceanY] = toMap(0, half + 20);
    ctx.fillStyle = '#1e6f8e';
    ctx.fillRect(0, oceanY, size, size - oceanY);
    ctx.fillStyle = '#e8c98f';
    const [, sandY] = toMap(0, half);
    ctx.fillRect(0, sandY, size, oceanY - sandY);
    // Roads.
    ctx.strokeStyle = '#6a7078';
    ctx.lineWidth = 3;
    for (const c of state.roadCenters) {
      const [x1] = toMap(c, 0);
      ctx.beginPath();
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1, size);
      ctx.stroke();
      const [, y1] = toMap(0, c);
      ctx.beginPath();
      ctx.moveTo(0, y1);
      ctx.lineTo(size, y1);
      ctx.stroke();
    }
    // Mission marker.
    if (state.marker) {
      const [mx, my] = toMap(state.marker.x, state.marker.z);
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.arc(mx, my, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f2c94c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Traffic (white) and police (flashing blue/red).
    for (const car of state.traffic) {
      const [x, y] = toMap(car.x, car.z);
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    for (const car of state.police) {
      const [x, y] = toMap(car.x, car.z);
      ctx.fillStyle = Math.floor(performance.now() / 300) % 2 === 0 ? '#2040ff' : '#ff2020';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const [px, py] = toMap(state.playerX, state.playerZ);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(state.playerHeading);
    ctx.fillStyle = '#3aa655';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
