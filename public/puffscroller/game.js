const BASE_WIDTH = 480;
const BASE_HEIGHT = 854;
const GROUND_Y = 715;
const FINISH_DISTANCE = 3200;
const STORAGE_KEY = 'puffscroller.bestRun.v1';

const ROUTES = {
  shogun: {
    label: 'Shogun Route',
    playerName: 'Shogun Sheba',
    asset: 'shogun',
    crop: { x: 36, y: 170, w: 430, h: 650 },
    portraitCrop: { x: 36, y: 170, w: 430, h: 650 },
    accent: '#f4c542',
    secondary: '#d13c27',
    jump: 690,
    dash: 0.2,
    dashBoost: 450,
    attackRange: 86,
    death: 'Honorable explosion. Sheba will return stronger.',
    victoryTitle: 'Empress Puff Rescued',
    victoryCopy:
      'Clean Puff Protocol ripples across Queefdom. Sir Gas has filed a complaint with customer support.',
    attackLine: 'For the Breath!',
    dashLine: 'Golden paw priority lane.'
  },
  ninja: {
    label: 'Ninja Route',
    playerName: 'Ninja Flatulus',
    asset: 'flatulus',
    crop: { x: 36, y: 942, w: 334, h: 340 },
    portraitCrop: { x: 55, y: 154, w: 314, h: 392 },
    accent: '#00cc66',
    secondary: '#1a1a1a',
    jump: 735,
    dash: 0.32,
    dashBoost: 610,
    attackRange: 74,
    death: 'Poof of green smoke. Worth it.',
    victoryTitle: 'Final Emission Key Stolen',
    victoryCopy:
      'Empress Puff remains locked, the fee chart looks suspicious, and Flatulus is absolutely whistling.',
    attackLine: 'Silent. But financially devastating.',
    dashLine: 'Shadow dash. Audit later.'
  }
};

const ASSETS = {
  shogun: 'puffscroller/assets/shogun-sheba-ref.jpg',
  flatulus: 'puffscroller/assets/flatulus-ref.jpg',
  general: 'puffscroller/assets/general-puff-ref.jpg',
  empress: 'puffscroller/assets/empress-puff-ref.png'
};

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');

const hud = {
  routeName: document.querySelector('#routeName'),
  coinCount: document.querySelector('#coinCount'),
  biomeName: document.querySelector('#biomeName'),
  distanceCount: document.querySelector('#distanceCount'),
  treeCount: document.querySelector('#treeCount'),
  heartCount: document.querySelector('#heartCount'),
  powerName: document.querySelector('#powerName')
};

const menu = document.querySelector('#menu');
const result = document.querySelector('#result');
const quipBox = document.querySelector('#quip');
const pauseBadge = document.querySelector('#pauseBadge');
const pauseButton = document.querySelector('#pauseButton');

const resultEls = {
  eyebrow: document.querySelector('#resultEyebrow'),
  title: document.querySelector('#resultTitle'),
  copy: document.querySelector('#resultCopy'),
  coins: document.querySelector('#receiptCoins'),
  trees: document.querySelector('#receiptTrees'),
  carbon: document.querySelector('#receiptCarbon'),
  hash: document.querySelector('#receiptHash')
};

const images = {};
let imagesReady = false;
let screen = 'menu';
let routeKey = 'shogun';
let run = createRun(routeKey);
let lastFrame = performance.now();
let quipTimer = 0;
let bestRun = readBestRun();

const keys = new Set();

function loadAssets() {
  const jobs = Object.entries(ASSETS).map(([key, src]) => {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        images[key] = image;
        resolve();
      };
      image.onerror = () => resolve();
      image.src = src;
    });
  });

  Promise.all(jobs).then(() => {
    imagesReady = true;
    draw();
  });
}

function createRun(route) {
  return {
    route,
    elapsed: 0,
    distance: 0,
    coins: 0,
    combo: 0,
    hearts: 3,
    spawnTimer: 0.35,
    powerTimer: 8,
    nextPowerDistance: 450,
    paused: false,
    finished: false,
    gameOver: false,
    cameraShake: 0,
    timeScale: 1,
    lastTrailSample: 0,
    trail: [],
    entities: [],
    particles: [],
    player: {
      x: 92,
      y: GROUND_Y - 84,
      w: 56,
      h: 78,
      vy: 0,
      grounded: true,
      jumps: 0,
      invuln: 0,
      dashTime: 0,
      dashCooldown: 0,
      attackTime: 0,
      attackCooldown: 0,
      shield: 0,
      morale: 0,
      slide: 0,
      flash: 0
    }
  };
}

function startRun(route) {
  routeKey = route;
  run = createRun(route);
  screen = 'running';
  menu.classList.remove('screen-active');
  result.classList.remove('screen-active');
  pauseBadge.hidden = true;
  quip(`${ROUTES[route].playerName}: ${route === 'shogun' ? 'For the Breath!' : 'The Princess stays locked.'}`);
}

function showMenu() {
  screen = 'menu';
  run.paused = false;
  menu.classList.add('screen-active');
  result.classList.remove('screen-active');
  pauseBadge.hidden = true;
}

function showResult(kind) {
  const route = ROUTES[run.route];
  const trees = run.coins;
  const carbon = (run.coins * 0.021).toFixed(2);
  const hash = makeReceiptHash(run);

  screen = 'result';
  run.finished = kind === 'victory';
  result.classList.add('screen-active');
  menu.classList.remove('screen-active');

  if (kind === 'victory') {
    resultEls.eyebrow.textContent = route.label;
    resultEls.title.textContent = route.victoryTitle;
    resultEls.copy.textContent = route.victoryCopy;
  } else {
    resultEls.eyebrow.textContent = 'Run Detonated';
    resultEls.title.textContent = route.death;
    resultEls.copy.textContent =
      'Oof. That is what 0.00042 ETH feels like on a bad Tuesday. The mempool has receipts.';
  }

  resultEls.coins.textContent = String(run.coins);
  resultEls.trees.textContent = String(trees);
  resultEls.carbon.textContent = `${carbon} kg`;
  resultEls.hash.textContent = hash;

  saveBestRun(kind);
}

function saveBestRun(kind) {
  const candidate = {
    route: run.route,
    coins: run.coins,
    distance: Math.floor(run.distance),
    victory: kind === 'victory',
    trail: run.trail.slice(-520)
  };

  if (!bestRun || candidate.coins > bestRun.coins || candidate.distance > bestRun.distance) {
    bestRun = candidate;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(candidate));
    } catch {
      // localStorage can be unavailable in some embedded previews.
    }
  }
}

function readBestRun() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function makeReceiptHash(currentRun) {
  const seed = `${currentRun.route}:${currentRun.coins}:${Math.floor(currentRun.distance)}:${currentRun.trail.length}`;
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `0xPUFF${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}

function jump() {
  if (screen !== 'running' || run.paused) return;
  const player = run.player;
  if (player.grounded || player.jumps < 2) {
    player.vy = -ROUTES[run.route].jump;
    player.grounded = false;
    player.jumps += 1;
    puff(player.x + player.w * 0.5, player.y + player.h, '#f4c542', 9);
  }
}

function dash() {
  if (screen !== 'running' || run.paused) return;
  const player = run.player;
  if (player.dashCooldown <= 0) {
    player.dashTime = ROUTES[run.route].dash;
    player.dashCooldown = run.route === 'ninja' ? 0.75 : 0.95;
    player.invuln = Math.max(player.invuln, run.route === 'ninja' ? 0.34 : 0.18);
    quip(ROUTES[run.route].dashLine);
    puff(player.x, player.y + player.h * 0.5, ROUTES[run.route].accent, 16);
  }
}

function attack() {
  if (screen !== 'running' || run.paused) return;
  const player = run.player;
  if (player.attackCooldown > 0) return;

  player.attackTime = 0.22;
  player.attackCooldown = run.route === 'shogun' ? 0.46 : 0.38;
  quip(ROUTES[run.route].attackLine);

  const range = ROUTES[run.route].attackRange + (player.morale > 0 ? 30 : 0);
  let hits = 0;
  run.entities.forEach((entity) => {
    if (!entity.dead && entity.damage && Math.abs(entity.x - (player.x + player.w)) < range) {
      entity.dead = true;
      hits += 1;
      run.coins += entity.type === 'rig' ? 3 : 1;
      puff(entity.x + entity.w * 0.5, entity.y + entity.h * 0.5, '#6df2cf', 15);
    }
  });

  if (hits > 1 && run.route === 'shogun') {
    run.player.shield = Math.max(run.player.shield, 1.4);
    quip('Staff slam batched the whole transaction.');
  }
}

function togglePause() {
  if (screen !== 'running') return;
  run.paused = !run.paused;
  pauseBadge.hidden = !run.paused;
}

function update(dt) {
  if (screen !== 'running' || run.paused) return;

  dt = Math.min(dt, 0.032) * run.timeScale;
  const route = ROUTES[run.route];
  const player = run.player;
  const progress = Math.min(1, run.distance / FINISH_DISTANCE);
  const baseScroll = 238 + progress * 92;
  const dashScroll = player.dashTime > 0 ? route.dashBoost : 0;
  const moraleScroll = player.morale > 0 ? 55 : 0;
  const scroll = baseScroll + dashScroll + moraleScroll;

  run.elapsed += dt;
  run.distance += dt * (30 + progress * 11 + (player.dashTime > 0 ? 11 : 0));
  run.spawnTimer -= dt;
  run.cameraShake = Math.max(0, run.cameraShake - dt * 18);

  player.dashTime = Math.max(0, player.dashTime - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.attackTime = Math.max(0, player.attackTime - dt);
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.invuln = Math.max(0, player.invuln - dt);
  player.shield = Math.max(0, player.shield - dt);
  player.morale = Math.max(0, player.morale - dt);
  player.flash = Math.max(0, player.flash - dt);

  if (keys.has('ArrowLeft') || keys.has('KeyA')) {
    player.x -= 150 * dt;
  }
  if (keys.has('ArrowRight') || keys.has('KeyD')) {
    player.x += 150 * dt + (player.dashTime > 0 ? 260 * dt : 0);
  }

  player.x = clamp(player.x, 38, 178);
  player.vy += 1820 * dt;
  player.y += player.vy * dt;

  if (player.y + player.h >= GROUND_Y) {
    player.y = GROUND_Y - player.h;
    player.vy = 0;
    player.grounded = true;
    player.jumps = 0;
  } else {
    player.grounded = false;
  }

  if (run.spawnTimer <= 0 && run.distance < FINISH_DISTANCE - 260) {
    spawnWave(progress);
  }

  if (run.distance >= run.nextPowerDistance && run.distance < FINISH_DISTANCE - 420) {
    spawnPower();
    run.nextPowerDistance += 680 + Math.random() * 320;
  }

  updateEntities(dt, scroll);
  updateParticles(dt, scroll);
  collectTrail();
  updateHud();

  if (run.distance >= FINISH_DISTANCE) {
    run.distance = FINISH_DISTANCE;
    showResult('victory');
  }
}

function spawnWave(progress) {
  const difficulty = 1 + progress * 1.8;
  const roll = Math.random();
  const safeGap = Math.max(0.52, 1.05 - progress * 0.38);
  run.spawnTimer = safeGap + Math.random() * 0.45;

  if (roll < 0.42) {
    const lane = pick([GROUND_Y - 54, GROUND_Y - 156, GROUND_Y - 260]);
    const count = 5 + Math.floor(Math.random() * 4);
    for (let index = 0; index < count; index += 1) {
      run.entities.push({
        type: 'coin',
        x: BASE_WIDTH + index * 38,
        y: lane + Math.sin(index * 0.85) * 18,
        w: 26,
        h: 26,
        spin: Math.random() * 6
      });
    }
  } else if (roll < 0.65) {
    run.entities.push({
      type: 'mine',
      damage: true,
      x: BASE_WIDTH + 30,
      y: GROUND_Y - 34,
      w: 38,
      h: 30,
      seed: Math.random() * 10
    });
    if (progress > 0.35 && Math.random() < 0.55) {
      spawnCoins(BASE_WIDTH + 82, GROUND_Y - 150, 4);
    }
  } else if (roll < 0.82) {
    run.entities.push({
      type: 'cloud',
      damage: true,
      x: BASE_WIDTH + 30,
      y: pick([GROUND_Y - 175, GROUND_Y - 260]),
      w: 72,
      h: 52,
      seed: Math.random() * 10
    });
    if (Math.random() < 0.48) {
      spawnCoins(BASE_WIDTH + 120, GROUND_Y - 68, 3);
    }
  } else {
    run.entities.push({
      type: 'rig',
      damage: true,
      x: BASE_WIDTH + 30,
      y: GROUND_Y - 108,
      w: 48,
      h: 108,
      hp: Math.ceil(difficulty),
      seed: Math.random() * 10
    });
    spawnCoins(BASE_WIDTH + 100, GROUND_Y - 214, 5);
  }
}

function spawnCoins(x, y, count) {
  for (let index = 0; index < count; index += 1) {
    run.entities.push({
      type: 'coin',
      x: x + index * 34,
      y: y + Math.sin(index * 0.8) * 12,
      w: 25,
      h: 25,
      spin: Math.random() * 6
    });
  }
}

function spawnPower() {
  run.entities.push({
    type: 'general',
    powerup: true,
    x: BASE_WIDTH + 40,
    y: pick([GROUND_Y - 150, GROUND_Y - 245]),
    w: 52,
    h: 58,
    seed: Math.random() * 10
  });
}

function updateEntities(dt, scroll) {
  const player = run.player;
  const playerBox = {
    x: player.x + 9,
    y: player.y + 8,
    w: player.w - 16,
    h: player.h - 10
  };

  run.entities.forEach((entity) => {
    entity.x -= scroll * dt;
    entity.spin = (entity.spin || 0) + dt * 7;

    if (entity.dead) return;

    if (entity.type === 'coin' && intersects(playerBox, entity)) {
      entity.dead = true;
      run.coins += 1;
      run.combo += 1;
      if (run.combo % 12 === 0) {
        quip('Batching transactions IRL saves gas. You are welcome.');
      }
      puff(entity.x + entity.w / 2, entity.y + entity.h / 2, '#f4c542', 8);
      return;
    }

    if (entity.powerup && intersects(playerBox, entity)) {
      entity.dead = true;
      player.morale = 6;
      player.shield = Math.max(player.shield, 3);
      run.coins += 5;
      quip('General Puff called in a morale rocket.');
      puff(entity.x + entity.w / 2, entity.y + entity.h / 2, '#6df2cf', 24);
      return;
    }

    if (entity.damage && intersects(playerBox, entity)) {
      const phasing = run.route === 'ninja' && player.dashTime > 0;
      if (player.invuln <= 0 && player.shield <= 0 && !phasing) {
        takeDamage(entity);
      } else if (player.shield > 0 || phasing) {
        entity.dead = true;
        run.coins += 1;
        puff(entity.x + entity.w / 2, entity.y + entity.h / 2, '#6df2cf', 12);
      }
    }
  });

  run.entities = run.entities.filter((entity) => entity.x > -140 && !entity.dead);
}

function takeDamage(entity) {
  const player = run.player;
  entity.dead = true;
  run.hearts -= 1;
  run.combo = 0;
  run.cameraShake = 10;
  player.invuln = 1.2;
  player.flash = 0.35;
  puff(player.x + player.w / 2, player.y + player.h / 2, '#ec4d32', 24);

  if (run.hearts <= 0) {
    showResult('death');
  } else {
    quip(entity.type === 'cloud' ? 'Mempool fog got personal.' : 'Gas fee impact detected.');
  }
}

function collectTrail() {
  if (run.elapsed - run.lastTrailSample < 0.22) return;
  run.lastTrailSample = run.elapsed;
  run.trail.push({
    d: Math.floor(run.distance),
    y: Math.round(run.player.y),
    x: Math.round(run.player.x)
  });
  if (run.trail.length > 560) {
    run.trail.shift();
  }
}

function updateParticles(dt, scroll) {
  run.particles.forEach((particle) => {
    particle.x += particle.vx * dt - scroll * 0.22 * dt;
    particle.y += particle.vy * dt;
    particle.vy += 420 * dt;
    particle.life -= dt;
  });
  run.particles = run.particles.filter((particle) => particle.life > 0);
}

function puff(x, y, color, count) {
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 240;
    run.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 90,
      radius: 3 + Math.random() * 8,
      color,
      life: 0.28 + Math.random() * 0.45
    });
  }
}

function draw() {
  const shake = run.cameraShake;
  ctx.save();
  ctx.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }
  const progress = Math.min(1, run.distance / FINISH_DISTANCE);
  drawBackground(progress);
  drawEntities();
  drawGhost();
  drawFinishSetPiece(progress);
  drawPlayer();
  drawParticles();
  drawForeground(progress);
  ctx.restore();
}

function drawBackground(progress) {
  const sky = ctx.createLinearGradient(0, 0, 0, BASE_HEIGHT);
  sky.addColorStop(0, blend('#9fe7ff', '#587257', progress));
  sky.addColorStop(0.48, blend('#f7d78b', '#708343', progress * 0.75));
  sky.addColorStop(1, blend('#5f9f68', '#272b24', progress));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

  ctx.globalAlpha = 0.58 + progress * 0.18;
  ctx.fillStyle = '#f7ce4a';
  ctx.beginPath();
  ctx.arc(392 - progress * 80, 104 + progress * 32, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  drawCloudLayer(0.24, '#ffffff', 0.48);
  drawCloudLayer(0.58, '#d7f6d1', 0.32 + progress * 0.18);

  drawHills(0.28, '#3f7f4f', 590, progress);
  drawHills(0.55, '#265f41', 650, progress);

  const skylineShift = -(run.distance * 0.7) % 180;
  for (let x = skylineShift - 80; x < BASE_WIDTH + 90; x += 90) {
    const height = 90 + ((x + 300) % 4) * 22;
    ctx.fillStyle = progress > 0.45 ? 'rgba(48, 52, 41, 0.68)' : 'rgba(95, 83, 56, 0.46)';
    ctx.fillRect(x, GROUND_Y - 180 - height * 0.32, 56, height);
    ctx.fillStyle = 'rgba(244, 197, 66, 0.35)';
    ctx.fillRect(x + 12, GROUND_Y - 160, 9, 10);
    ctx.fillRect(x + 34, GROUND_Y - 128, 9, 10);
  }

  if (progress > 0.36) {
    ctx.globalAlpha = (progress - 0.36) * 0.65;
    for (let i = 0; i < 6; i += 1) {
      const x = (i * 94 - run.distance * 2.2) % (BASE_WIDTH + 100);
      drawGasBlob(x < -50 ? x + BASE_WIDTH + 120 : x, 205 + i * 58, 68 + i * 6, '#00cc66');
    }
    ctx.globalAlpha = 1;
  }
}

function drawCloudLayer(speed, color, alpha) {
  const offset = -(run.distance * speed) % 260;
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  for (let x = offset - 120; x < BASE_WIDTH + 130; x += 260) {
    drawSoftCloud(x, 150 + ((x + 800) % 3) * 34, 1);
  }
  ctx.globalAlpha = 1;
}

function drawSoftCloud(x, y, scale) {
  ctx.beginPath();
  ctx.arc(x, y, 22 * scale, 0, Math.PI * 2);
  ctx.arc(x + 28 * scale, y - 10 * scale, 30 * scale, 0, Math.PI * 2);
  ctx.arc(x + 62 * scale, y + 2 * scale, 24 * scale, 0, Math.PI * 2);
  ctx.arc(x + 34 * scale, y + 12 * scale, 30 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawHills(speed, color, yBase, progress) {
  const offset = -(run.distance * speed) % 240;
  ctx.fillStyle = blend(color, '#203226', progress * 0.6);
  ctx.beginPath();
  ctx.moveTo(0, BASE_HEIGHT);
  for (let x = offset - 260; x < BASE_WIDTH + 260; x += 80) {
    ctx.quadraticCurveTo(x + 50, yBase - 90, x + 120, yBase);
  }
  ctx.lineTo(BASE_WIDTH, BASE_HEIGHT);
  ctx.closePath();
  ctx.fill();
}

function drawForeground(progress) {
  const ground = ctx.createLinearGradient(0, GROUND_Y - 16, 0, BASE_HEIGHT);
  ground.addColorStop(0, blend('#805331', '#556127', progress));
  ground.addColorStop(0.28, blend('#4c3425', '#24291d', progress));
  ground.addColorStop(1, '#11110d');
  ctx.fillStyle = ground;
  ctx.fillRect(0, GROUND_Y, BASE_WIDTH, BASE_HEIGHT - GROUND_Y);

  ctx.fillStyle = progress > 0.55 ? '#83df57' : '#ffe07a';
  for (let x = -(run.distance * 7) % 56; x < BASE_WIDTH + 60; x += 56) {
    ctx.fillRect(x, GROUND_Y + 12, 28, 4);
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(0, GROUND_Y, BASE_WIDTH, 2);
}

function drawEntities() {
  run.entities.forEach((entity) => {
    if (entity.type === 'coin') {
      drawCoin(entity);
    } else if (entity.type === 'mine') {
      drawMine(entity);
    } else if (entity.type === 'cloud') {
      drawGasCloud(entity);
    } else if (entity.type === 'rig') {
      drawRig(entity);
    } else if (entity.type === 'general') {
      drawGeneralPower(entity);
    }
  });
}

function drawCoin(entity) {
  const pulse = Math.sin((entity.spin || 0) * 2) * 0.15 + 1;
  ctx.save();
  ctx.translate(entity.x + entity.w / 2, entity.y + entity.h / 2);
  ctx.scale(pulse, 1);
  ctx.shadowBlur = 18;
  ctx.shadowColor = '#f4c542';
  ctx.fillStyle = '#f4c542';
  ctx.beginPath();
  ctx.arc(0, 0, entity.w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#fff2a8';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#694914';
  ctx.font = '900 16px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Q', 0, 1);
  ctx.restore();
}

function drawMine(entity) {
  ctx.save();
  ctx.translate(entity.x + entity.w / 2, entity.y + entity.h / 2);
  ctx.rotate(Math.sin(run.elapsed * 5 + entity.seed) * 0.08);
  ctx.fillStyle = '#1a1a1a';
  roundRect(-20, -14, 40, 28, 8);
  ctx.fill();
  ctx.fillStyle = '#00cc66';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f4c542';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#ec4d32';
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    ctx.fillRect(Math.cos(a) * 23 - 3, Math.sin(a) * 16 - 3, 6, 6);
  }
  ctx.restore();
}

function drawGasCloud(entity) {
  const bob = Math.sin(run.elapsed * 3 + entity.seed) * 7;
  drawGasBlob(entity.x + entity.w / 2, entity.y + entity.h / 2 + bob, entity.w, '#00cc66');
  ctx.fillStyle = 'rgba(8, 10, 9, 0.78)';
  ctx.font = '900 16px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('GAS', entity.x + entity.w / 2, entity.y + entity.h / 2 + bob + 5);
}

function drawGasBlob(x, y, size, color) {
  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x - size * 0.24, y + size * 0.04, size * 0.28, 0, Math.PI * 2);
  ctx.arc(x + size * 0.03, y - size * 0.15, size * 0.34, 0, Math.PI * 2);
  ctx.arc(x + size * 0.28, y + size * 0.08, size * 0.25, 0, Math.PI * 2);
  ctx.arc(x + size * 0.02, y + size * 0.16, size * 0.31, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawRig(entity) {
  const x = entity.x;
  const y = entity.y;
  ctx.fillStyle = '#302f2c';
  roundRect(x + 8, y + 28, entity.w - 16, entity.h - 28, 6);
  ctx.fill();
  ctx.fillStyle = '#54463a';
  ctx.fillRect(x + 2, y + 16, entity.w - 4, 18);
  ctx.strokeStyle = '#ec4d32';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 17);
  ctx.lineTo(x + entity.w - 8, y + 2);
  ctx.lineTo(x + entity.w - 3, y + 17);
  ctx.stroke();
  ctx.fillStyle = '#00cc66';
  ctx.globalAlpha = 0.72;
  drawGasBlob(x + entity.w / 2, y + 12, 28, '#00cc66');
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#f4c542';
  ctx.fillRect(x + 18, y + 62, 12, 18);
}

function drawGeneralPower(entity) {
  const bob = Math.sin(run.elapsed * 5 + entity.seed) * 7;
  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = '#6df2cf';
  ctx.fillStyle = 'rgba(109, 242, 207, 0.22)';
  ctx.beginPath();
  ctx.arc(entity.x + entity.w / 2, entity.y + entity.h / 2 + bob, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  drawImageCrop('general', { x: 38, y: 150, w: 350, h: 430 }, entity.x - 7, entity.y - 15 + bob, 70, 86);
  ctx.restore();
}

function drawGhost() {
  if (!bestRun || !bestRun.trail || bestRun.trail.length < 4 || screen !== 'running') return;
  const current = nearestTrailPoint(bestRun.trail, run.distance);
  if (!current) return;

  ctx.save();
  ctx.globalAlpha = 0.33;
  const route = ROUTES[bestRun.route] || ROUTES.shogun;
  const y = clamp(current.y, 120, GROUND_Y - 70);
  drawImageCrop(route.asset, route.crop, 195, y - 5, 72, 92);
  ctx.fillStyle = route.accent;
  ctx.font = '800 11px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('BEST GHOST', 230, y - 8);
  ctx.restore();
}

function nearestTrailPoint(trail, distance) {
  let best = trail[0];
  let bestGap = Number.POSITIVE_INFINITY;
  for (let index = 0; index < trail.length; index += 1) {
    const gap = Math.abs(trail[index].d - distance);
    if (gap < bestGap) {
      best = trail[index];
      bestGap = gap;
    }
  }
  return bestGap < 180 ? best : null;
}

function drawFinishSetPiece(progress) {
  if (progress < 0.9) return;
  const reveal = (progress - 0.9) / 0.1;
  const x = BASE_WIDTH - reveal * 360;
  ctx.fillStyle = '#1a1719';
  roundRect(x + 170, GROUND_Y - 270, 135, 270, 8);
  ctx.fill();
  ctx.fillStyle = '#4c1823';
  ctx.fillRect(x + 182, GROUND_Y - 250, 110, 34);
  ctx.fillStyle = '#00cc66';
  ctx.globalAlpha = 0.58;
  drawGasBlob(x + 236, GROUND_Y - 250, 72, '#00cc66');
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#f4c542';
  ctx.lineWidth = 5;
  ctx.strokeRect(x + 200, GROUND_Y - 160, 74, 96);
  drawImageCrop('empress', { x: 50, y: 170, w: 315, h: 340 }, x + 203, GROUND_Y - 168, 68, 88);
}

function drawPlayer() {
  if (screen === 'menu') {
    drawAttractCharacters();
    return;
  }

  const player = run.player;
  const route = ROUTES[run.route];
  const pulse = player.flash > 0 ? Math.sin(run.elapsed * 50) > 0 : false;
  if (pulse) return;

  ctx.save();
  ctx.globalAlpha = player.invuln > 0 && Math.sin(run.elapsed * 28) > 0 ? 0.62 : 1;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(player.x + player.w * 0.5, GROUND_Y + 8, 40, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  if (player.shield > 0) {
    ctx.strokeStyle = '#6df2cf';
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    ctx.arc(player.x + player.w / 2, player.y + player.h / 2, 58, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (player.dashTime > 0) {
    ctx.globalAlpha = 0.32;
    for (let i = 0; i < 3; i += 1) {
      drawImageCrop(route.asset, route.crop, player.x - 34 - i * 22, player.y - 18, 92, 112);
    }
    ctx.globalAlpha = 1;
  }

  const drawW = run.route === 'shogun' ? 82 : 92;
  const drawH = run.route === 'shogun' ? 118 : 94;
  const drawX = player.x - (run.route === 'shogun' ? 14 : 20);
  const drawY = player.y - (run.route === 'shogun' ? 36 : 12);
  drawImageCrop(route.asset, route.crop, drawX, drawY, drawW, drawH);

  if (player.attackTime > 0) {
    ctx.strokeStyle = route.accent;
    ctx.lineWidth = 8;
    ctx.globalAlpha = 0.82;
    ctx.beginPath();
    ctx.arc(player.x + player.w + 12, player.y + 42, route.attackRange, -0.52, 0.7);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (player.morale > 0) {
    ctx.fillStyle = '#f4c542';
    ctx.font = '900 14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('MORALE', player.x + player.w / 2, player.y - 18);
  }

  ctx.restore();
}

function drawAttractCharacters() {
  ctx.save();
  ctx.globalAlpha = 0.52;
  drawBackground(0.2 + Math.sin(performance.now() / 1600) * 0.05);
  drawForeground(0.2);
  drawImageCrop('shogun', ROUTES.shogun.crop, 62, GROUND_Y - 210, 120, 180);
  drawImageCrop('flatulus', ROUTES.ninja.crop, 298, GROUND_Y - 155, 120, 124);
  drawImageCrop('empress', { x: 50, y: 170, w: 315, h: 340 }, 196, GROUND_Y - 188, 96, 130);
  ctx.restore();
}

function drawParticles() {
  run.particles.forEach((particle) => {
    ctx.globalAlpha = clamp(particle.life * 2.6, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawImageCrop(key, crop, x, y, width, height) {
  const image = images[key];
  if (imagesReady && image) {
    ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, x, y, width, height);
    return;
  }

  const route = Object.values(ROUTES).find((item) => item.asset === key);
  ctx.fillStyle = route ? route.secondary : '#314c37';
  roundRect(x, y, width, height, 8);
  ctx.fill();
  ctx.fillStyle = route ? route.accent : '#f4c542';
  ctx.beginPath();
  ctx.arc(x + width / 2, y + height * 0.32, width * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

function updateHud() {
  const route = ROUTES[run.route];
  const distance = Math.floor(run.distance);
  hud.routeName.textContent = route.label;
  hud.coinCount.textContent = String(run.coins);
  hud.distanceCount.textContent = `${distance}m`;
  hud.treeCount.textContent = `${run.coins} symbolic trees`;
  hud.heartCount.textContent = 'I'.repeat(Math.max(0, run.hearts));
  if (run.player.morale > 0) {
    hud.powerName.textContent = 'Morale Rocket';
  } else if (run.player.shield > 0) {
    hud.powerName.textContent = 'Shielded';
  } else if (run.player.dashCooldown <= 0) {
    hud.powerName.textContent = 'Dash Ready';
  } else {
    hud.powerName.textContent = 'Charging';
  }
  hud.biomeName.textContent = run.distance > FINISH_DISTANCE * 0.62 ? 'Capital Plaza: Toxic Block' : 'Queefdom Capital Plaza';
}

function quip(message) {
  quipBox.textContent = message;
  quipBox.classList.add('quip-live');
  quipTimer = 2.5;
}

function updateQuip(dt) {
  if (quipTimer <= 0) return;
  quipTimer -= dt;
  if (quipTimer <= 0) {
    quipBox.classList.remove('quip-live');
  }
}

function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pick(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function blend(a, b, amount) {
  const t = clamp(amount, 0, 1);
  const ac = hexToRgb(a);
  const bc = hexToRgb(b);
  const r = Math.round(ac.r + (bc.r - ac.r) * t);
  const g = Math.round(ac.g + (bc.g - ac.g) * t);
  const blue = Math.round(ac.b + (bc.b - ac.b) * t);
  return `rgb(${r}, ${g}, ${blue})`;
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function roundRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function loop(now) {
  const dt = (now - lastFrame) / 1000;
  lastFrame = now;
  update(dt);
  updateQuip(dt);
  draw();
  requestAnimationFrame(loop);
}

function bindEvents() {
  document.querySelectorAll('[data-start]').forEach((button) => {
    button.addEventListener('click', () => startRun(button.dataset.start));
  });

  document.querySelectorAll('.route-card').forEach((card) => {
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        startRun(card.dataset.route);
      }
    });
  });

  document.querySelector('#retryButton').addEventListener('click', () => startRun(routeKey));
  document.querySelector('#menuButton').addEventListener('click', showMenu);
  pauseButton.addEventListener('click', togglePause);

  document.querySelectorAll('[data-control]').forEach((button) => {
    const control = button.dataset.control;
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (control === 'jump') jump();
      if (control === 'dash') dash();
      if (control === 'attack') attack();
    });
  });

  window.addEventListener('keydown', (event) => {
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
      event.preventDefault();
      jump();
    } else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight' || event.code === 'KeyK') {
      event.preventDefault();
      dash();
    } else if (event.code === 'KeyJ' || event.code === 'KeyX') {
      event.preventDefault();
      attack();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      togglePause();
    } else if (event.code === 'KeyR' && screen === 'result') {
      startRun(routeKey);
    } else if (event.code === 'Enter' && screen === 'menu') {
      startRun(routeKey);
    }
  });

  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (screen === 'running') {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      if (x < rect.width * 0.5) {
        jump();
      } else {
        attack();
      }
    }
  });
}

function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = BASE_WIDTH * ratio;
  canvas.height = BASE_HEIGHT * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

bindEvents();
resizeCanvas();
loadAssets();
updateHud();
window.addEventListener('resize', resizeCanvas);
requestAnimationFrame(loop);
