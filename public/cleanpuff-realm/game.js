const BASE_WIDTH = 960;
const BASE_HEIGHT = 540;
const STORAGE_KEY = 'cleanpuff.realm.protocolTactics.v1';
const ASSET_DIR = 'cleanpuff-realm/assets/';
const LANES = [
  { id: 'front', label: 'Front', y: 162 },
  { id: 'mid', label: 'Mid', y: 282 },
  { id: 'back', label: 'Back', y: 402 }
];

const ART = {
  puff: {
    src: `${ASSET_DIR}Empress-256-ref.png`,
    crop: { x: 170, y: 55, w: 430, h: 500 },
    focus: '45% 14%'
  },
  airabella: {
    src: `${ASSET_DIR}Airabella-256-ref.png`,
    crop: { x: 440, y: 20, w: 520, h: 540 },
    focus: '60% 18%'
  },
  prep: {
    src: `${ASSET_DIR}Prep-the-frog-256-ref.png`,
    crop: { x: 520, y: 20, w: 590, h: 520 },
    focus: '67% 16%'
  },
  shogun: {
    src: `${ASSET_DIR}ShogunSheba-256-ref.png`,
    crop: { x: 455, y: 20, w: 450, h: 520 },
    focus: '60% 16%'
  },
  romeo: {
    src: `${ASSET_DIR}Romeo-256-ref.png`,
    crop: { x: 430, y: 40, w: 455, h: 530 },
    focus: '57% 16%'
  },
  knight: {
    src: `${ASSET_DIR}Knight-of-question-256-ref.png`,
    crop: { x: 365, y: 25, w: 600, h: 485 },
    focus: '52% 20%'
  },
  queen: {
    src: `${ASSET_DIR}Queen-Mom-Airelyyn-256-ref.png`,
    crop: { x: 530, y: 20, w: 470, h: 470 },
    focus: '64% 15%'
  },
  maximus: {
    src: `${ASSET_DIR}Maximus-256-ref.png`,
    crop: { x: 150, y: 60, w: 430, h: 520 },
    focus: '42% 17%'
  },
  sirgas: {
    src: `${ASSET_DIR}SirGas-256-ref.png`,
    crop: { x: 235, y: 55, w: 410, h: 455 },
    focus: '38% 15%'
  },
  cropduster: {
    src: `${ASSET_DIR}CropDuster-256-ref.png`,
    crop: { x: 420, y: 35, w: 500, h: 500 },
    focus: '65% 16%'
  },
  flatulus: {
    src: `${ASSET_DIR}Flatulus-256-ref.png`,
    crop: { x: 175, y: 60, w: 400, h: 470 },
    focus: '32% 15%'
  },
  prince: {
    src: `${ASSET_DIR}Prince-of-fartness-256-ref.png`,
    crop: { x: 210, y: 40, w: 360, h: 470 },
    focus: '38% 15%'
  }
};

const HEROES = [
  {
    id: 'puff',
    name: 'Princess Puff',
    title: 'Curator / Leader',
    lane: 1,
    tags: ['Clean', 'Truth', 'Resistance'],
    stats: { hp: 760, power: 54, guard: 35, tempo: 1.04, focus: 23 },
    ultimate: 'Clean Puff Protocol',
    summary: 'Team cleanse, healing, and morale pressure.'
  },
  {
    id: 'airabella',
    name: 'Lady Airabella',
    title: 'Mist Curator',
    lane: 2,
    tags: ['Mist', 'Wind', 'Clean'],
    stats: { hp: 650, power: 50, guard: 28, tempo: 1.0, focus: 28 },
    ultimate: 'Matron Mist',
    summary: 'Mist shields and slows corrupted lanes.'
  },
  {
    id: 'prep',
    name: 'Prep the Frog',
    title: 'Pattern Arcanist',
    lane: 2,
    tags: ['Truth', 'Alchemy', 'Trickster'],
    stats: { hp: 600, power: 68, guard: 22, tempo: 1.16, focus: 31 },
    ultimate: 'Pattern Inversion',
    summary: 'Turns Gas Pressure into Clean Flow.'
  },
  {
    id: 'shogun',
    name: 'Shogun Sheba',
    title: 'Duelist / Vanguard',
    lane: 0,
    tags: ['Resistance', 'Duelist', 'Eastern Realm'],
    stats: { hp: 880, power: 74, guard: 42, tempo: 0.92, focus: 18 },
    ultimate: 'Crimson Oath',
    summary: 'Lane charge, taunt, and sword burst.'
  },
  {
    id: 'romeo',
    name: 'Romeo',
    title: 'Two-Winds Support',
    lane: 1,
    tags: ['Wind', 'Gas', 'Truth'],
    stats: { hp: 610, power: 58, guard: 24, tempo: 1.22, focus: 25 },
    ultimate: 'Two Winds',
    summary: 'Adaptive heal and pressure vent.'
  },
  {
    id: 'knight',
    name: 'Knight of Question',
    title: 'Inquiry Warden',
    lane: 0,
    tags: ['Truth', 'Mystery', 'Warden'],
    stats: { hp: 910, power: 61, guard: 50, tempo: 0.82, focus: 20 },
    ultimate: 'Unanswered Guard',
    summary: 'Question shield and enemy stun.'
  },
  {
    id: 'queen',
    name: 'Queen Airelynn',
    title: 'Legacy Wind',
    lane: 1,
    tags: ['Wind', 'Clean', 'Royal'],
    stats: { hp: 690, power: 72, guard: 30, tempo: 0.98, focus: 32 },
    ultimate: 'Airelynn Ascendant',
    summary: 'Royal wind surge and team recovery.'
  },
  {
    id: 'maximus',
    name: 'Maximus',
    title: 'Future of the Realm',
    lane: 2,
    tags: ['Clean', 'Hope', 'Support'],
    stats: { hp: 570, power: 42, guard: 26, tempo: 1.28, focus: 36 },
    ultimate: 'Giggle Stabilizer',
    summary: 'Energy boost, cleanse, and anti-panic pulse.'
  }
];

const ENEMIES = {
  gasMiner: {
    name: 'Gas Miner',
    art: null,
    color: '#95683a',
    glyph: 'M',
    stats: { hp: 470, power: 45, guard: 22, tempo: 0.92 },
    pressure: 5,
    special: 'rupture'
  },
  fudster: {
    name: 'FUDcaster',
    art: null,
    color: '#4b82a8',
    glyph: 'FUD',
    stats: { hp: 390, power: 38, guard: 18, tempo: 1.12 },
    pressure: 8,
    special: 'propaganda'
  },
  toxicRig: {
    name: 'Toxic Rig',
    art: null,
    color: '#6d7d32',
    glyph: 'RIG',
    stats: { hp: 620, power: 42, guard: 36, tempo: 0.72 },
    pressure: 10,
    special: 'smog'
  },
  prince: {
    name: 'Prince of Fartness',
    art: 'prince',
    color: '#bd442c',
    stats: { hp: 760, power: 55, guard: 28, tempo: 1.05 },
    pressure: 11,
    special: 'tantrum'
  },
  flatulus: {
    name: 'Flatulus',
    art: 'flatulus',
    color: '#161918',
    stats: { hp: 700, power: 74, guard: 26, tempo: 1.2 },
    pressure: 13,
    special: 'vanish'
  },
  cropduster: {
    name: 'CropDuster',
    art: 'cropduster',
    color: '#8a6a38',
    stats: { hp: 980, power: 63, guard: 34, tempo: 0.92 },
    pressure: 15,
    special: 'airstrike'
  },
  sirgas: {
    name: 'Sir Gas',
    art: 'sirgas',
    color: '#9c3124',
    stats: { hp: 1320, power: 78, guard: 42, tempo: 0.88 },
    pressure: 18,
    special: 'edict'
  }
};

const REGIONS = [
  {
    id: 'bide',
    name: 'Isle of Bide',
    chapter: 'Exile and Spark',
    faction: 'Guardians of the Puff',
    tone: ['#6d8ca1', '#48614c', '#2b2a25'],
    brief: 'Broken tokens drift around Puff and Airabella as the first resistance cell comes online.',
    rewards: { tokens: 130, shards: 10, seals: 2, resin: 2 },
    restorePower: 19,
    waves: [
      [
        ['gasMiner', 0, 0.92],
        ['fudster', 1, 0.9],
        ['gasMiner', 2, 0.86]
      ],
      [
        ['prince', 1, 0.82, true],
        ['fudster', 2, 0.98],
        ['gasMiner', 0, 1.05]
      ]
    ],
    nodes: [
      {
        id: 'dock',
        name: 'Broken Token Dock',
        cost: { shards: 7 },
        effect: 'Starting Clean Flow +12',
        buff: 'flowStart'
      },
      {
        id: 'signal',
        name: 'Resistance Signal',
        cost: { seals: 3, tokens: 70 },
        effect: 'Truth rewards +1',
        buff: 'truthPlus'
      },
      {
        id: 'windshrine',
        name: 'Small Wind Shrine',
        cost: { resin: 3, shards: 5 },
        effect: 'Allies gain energy faster',
        buff: 'energyStart'
      }
    ]
  },
  {
    id: 'miners',
    name: 'Miner Tunnels',
    chapter: 'A Miner Inconvenience',
    faction: 'Miners Guild',
    requires: 'bide',
    tone: ['#8d6f48', '#384536', '#1f211d'],
    brief: 'Collapsed tunnels, skeptical miners, and CropDuster spelling errors over the ridge.',
    rewards: { tokens: 185, shards: 13, seals: 2, resin: 3 },
    restorePower: 22,
    waves: [
      [
        ['toxicRig', 0, 0.98],
        ['gasMiner', 1, 1.02],
        ['fudster', 2, 0.98]
      ],
      [
        ['cropduster', 1, 0.86, true],
        ['gasMiner', 0, 1.08],
        ['toxicRig', 2, 0.92]
      ]
    ],
    nodes: [
      {
        id: 'props',
        name: 'Tunnel Props',
        cost: { tokens: 150, shards: 6 },
        effect: 'Front lane Guard +8',
        buff: 'frontGuard'
      },
      {
        id: 'quota',
        name: 'Fair Quota Board',
        cost: { seals: 4, tokens: 90 },
        effect: 'Miners trust improves faster',
        buff: 'trustPlus'
      },
      {
        id: 'vent',
        name: 'Clean Air Vent',
        cost: { resin: 4, shards: 9 },
        effect: 'Gas Pressure builds slower',
        buff: 'gasResist'
      }
    ]
  },
  {
    id: 'monastery',
    name: 'Validated Truth',
    chapter: 'The Validator Monks',
    faction: 'Validator Monks',
    requires: 'miners',
    tone: ['#556787', '#463d56', '#22211f'],
    brief: 'Truth scrolls, trial chambers, and a public record Sir Gas would very much like deleted.',
    rewards: { tokens: 210, shards: 14, seals: 5, resin: 4 },
    restorePower: 24,
    waves: [
      [
        ['fudster', 0, 1.12],
        ['flatulus', 1, 0.92],
        ['fudster', 2, 1.08]
      ],
      [
        ['flatulus', 2, 1.05, true],
        ['toxicRig', 0, 1.08],
        ['fudster', 1, 1.15]
      ]
    ],
    nodes: [
      {
        id: 'archive',
        name: 'Scroll Archive',
        cost: { seals: 6, tokens: 120 },
        effect: 'Clean Surge damages harder',
        buff: 'surgePlus'
      },
      {
        id: 'trial',
        name: 'Patience Court',
        cost: { resin: 5, shards: 8 },
        effect: 'Stuns last longer',
        buff: 'longStun'
      },
      {
        id: 'witness',
        name: 'Witness Bench',
        cost: { seals: 5, shards: 8 },
        effect: 'Defeats still keep partial trust',
        buff: 'defeatTrust'
      }
    ]
  },
  {
    id: 'forkcast',
    name: 'Forkcast Tower',
    chapter: 'The Algorithm Fights Back',
    faction: 'Public Signal',
    requires: 'monastery',
    tone: ['#9f7546', '#314a55', '#201a1b'],
    brief: 'A broadcast war erupts while Sir Gas tries to turn every microphone into a fog machine.',
    rewards: { tokens: 300, shards: 18, seals: 7, resin: 5 },
    restorePower: 28,
    waves: [
      [
        ['fudster', 0, 1.18],
        ['fudster', 1, 1.15],
        ['flatulus', 2, 1.0]
      ],
      [
        ['sirgas', 1, 0.88, true],
        ['cropduster', 0, 0.88],
        ['prince', 2, 1.0]
      ]
    ],
    nodes: [
      {
        id: 'relay',
        name: 'Open Relay',
        cost: { seals: 7, tokens: 180 },
        effect: 'All ultimates start at +15 energy',
        buff: 'ultStart'
      },
      {
        id: 'clinic',
        name: 'Settlement Clinic',
        cost: { shards: 13, resin: 5 },
        effect: 'Victory healing grants extra shards',
        buff: 'shardPlus'
      },
      {
        id: 'feed',
        name: 'Truth Feed',
        cost: { seals: 8, tokens: 220 },
        effect: 'Propaganda attacks are weaker',
        buff: 'propResist'
      }
    ]
  }
];

const canvas = document.querySelector('#arena');
const ctx = canvas.getContext('2d');
const els = {
  resourceBar: document.querySelector('#resourceBar'),
  regionList: document.querySelector('#regionList'),
  rosterList: document.querySelector('#rosterList'),
  squadSlots: document.querySelector('#squadSlots'),
  squadCount: document.querySelector('#squadCount'),
  regionName: document.querySelector('#regionName'),
  regionState: document.querySelector('#regionState'),
  regionBrief: document.querySelector('#regionBrief'),
  restorationNodes: document.querySelector('#restorationNodes'),
  battleLog: document.querySelector('#battleLog'),
  battleWave: document.querySelector('#battleWave'),
  ultimateBar: document.querySelector('#ultimateBar'),
  cleanFill: document.querySelector('#cleanFill'),
  gasFill: document.querySelector('#gasFill'),
  cleanValue: document.querySelector('#cleanValue'),
  gasValue: document.querySelector('#gasValue'),
  stageEyebrow: document.querySelector('#stageEyebrow'),
  stageTitle: document.querySelector('#stageTitle'),
  battleButton: document.querySelector('#battleButton'),
  pauseButton: document.querySelector('#pauseButton'),
  speedButton: document.querySelector('#speedButton'),
  resetButton: document.querySelector('#resetButton'),
  arenaBanner: document.querySelector('#arenaBanner')
};

const images = {};
let imagesReady = false;
let lastFrame = performance.now();
let renderTimer = 0;

const state = {
  currentRegionId: 'bide',
  selectedSquad: ['puff', 'shogun', 'prep', 'airabella', 'romeo'],
  progress: loadProgress(),
  battle: null,
  paused: false,
  speed: 1,
  bannerTimer: 0,
  lastResult: null
};

function defaultProgress() {
  const regions = {};
  REGIONS.forEach((region) => {
    regions[region.id] = {
      wins: 0,
      corruption: region.id === 'bide' ? 74 : 88,
      trust: region.id === 'bide' ? 1 : 0,
      restored: []
    };
  });

  const heroes = {};
  HEROES.forEach((hero) => {
    heroes[hero.id] = { level: ['puff', 'shogun', 'prep', 'airabella', 'romeo'].includes(hero.id) ? 2 : 1 };
  });

  return {
    resources: { tokens: 340, shards: 26, seals: 7, resin: 7 },
    heroes,
    regions
  };
}

function loadProgress() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    const base = defaultProgress();
    if (!stored) return base;
    return {
      resources: { ...base.resources, ...(stored.resources || {}) },
      heroes: { ...base.heroes, ...(stored.heroes || {}) },
      regions: mergeRegions(base.regions, stored.regions || {})
    };
  } catch {
    return defaultProgress();
  }
}

function mergeRegions(base, stored) {
  const next = { ...base };
  Object.keys(base).forEach((id) => {
    next[id] = { ...base[id], ...(stored[id] || {}) };
    next[id].restored = Array.isArray(next[id].restored) ? next[id].restored : [];
  });
  return next;
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
  } catch {
    // Embedded previews can disable localStorage.
  }
}

function loadImages() {
  const artEntries = Object.entries(ART);
  Promise.all(
    artEntries.map(([key, art]) => {
      return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
          images[key] = image;
          resolve();
        };
        image.onerror = () => resolve();
        image.src = art.src;
      });
    })
  ).then(() => {
    imagesReady = true;
    draw();
  });
}

function getHero(id) {
  return HEROES.find((hero) => hero.id === id);
}

function getRegion(id = state.currentRegionId) {
  return REGIONS.find((region) => region.id === id);
}

function getRegionProgress(id = state.currentRegionId) {
  return state.progress.regions[id];
}

function isRegionUnlocked(region) {
  if (!region.requires) return true;
  const previous = getRegionProgress(region.requires);
  return previous && (previous.wins > 0 || previous.corruption <= 62 || previous.trust >= 2);
}

function activeBuffs(regionId = state.currentRegionId) {
  const region = getRegion(regionId);
  const progress = getRegionProgress(regionId);
  return region.nodes
    .filter((node) => progress.restored.includes(node.id))
    .map((node) => node.buff);
}

function hasBuff(buff, regionId = state.currentRegionId) {
  return activeBuffs(regionId).includes(buff);
}

function renderAll() {
  renderResources();
  renderRegions();
  renderSquad();
  renderRegionDetail();
  renderLog();
  renderUltimates();
  updateStageLabels();
}

function renderResources() {
  const resources = state.progress.resources;
  const restored = Object.values(state.progress.regions).reduce((total, region) => total + region.restored.length, 0);
  const items = [
    ['Chain Tokens', resources.tokens],
    ['Clean Shards', resources.shards],
    ['Truth Seals', resources.seals],
    ['Mist Resin', resources.resin],
    ['Restored', restored]
  ];
  els.resourceBar.innerHTML = items
    .map(
      ([label, value]) => `
        <div class="resource">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `
    )
    .join('');
}

function renderRegions() {
  els.regionList.innerHTML = REGIONS.map((region) => {
    const progress = getRegionProgress(region.id);
    const locked = !isRegionUnlocked(region);
    const active = region.id === state.currentRegionId;
    const corruption = Math.round(progress.corruption);
    const trust = Math.min(100, progress.trust * 22);
    return `
      <article class="region-card ${active ? 'active' : ''} ${locked ? 'locked' : ''}" data-region="${region.id}">
        <header>
          <h2>${region.name}</h2>
          <span class="pill">${locked ? 'Locked' : `${corruption}%`}</span>
        </header>
        <small>${region.chapter}</small>
        <div class="progress-track"><i class="corruption-fill" style="width:${corruption}%"></i></div>
        <div class="progress-track"><i class="trust-fill" style="width:${trust}%"></i></div>
      </article>
    `;
  }).join('');
}

function renderSquad() {
  els.squadCount.textContent = `${state.selectedSquad.length}/5`;
  els.squadSlots.innerHTML = Array.from({ length: 5 }, (_, index) => {
    const heroId = state.selectedSquad[index];
    if (!heroId) return '<div class="squad-slot"></div>';
    const hero = getHero(heroId);
    const art = ART[hero.id];
    return `<div class="squad-slot"><img src="${art.src}" alt="${hero.name}" style="object-position:${art.focus}" /></div>`;
  }).join('');

  els.rosterList.innerHTML = HEROES.map((hero) => {
    const selected = state.selectedSquad.includes(hero.id);
    const level = state.progress.heroes[hero.id].level;
    const trainCost = trainCostFor(hero.id);
    const art = ART[hero.id];
    return `
      <article class="hero-card ${selected ? 'selected' : ''}" data-hero="${hero.id}">
        <img src="${art.src}" alt="${hero.name}" style="object-position:${art.focus}" />
        <div>
          <header>
            <h3>${hero.name}</h3>
            <span class="pill">Lv ${level}</span>
          </header>
          <p>${hero.title}. ${hero.summary}</p>
          <footer>
            <span class="pill">${hero.tags[0]}</span>
            <button type="button" class="mini-button" data-train="${hero.id}">Train ${trainCost}</button>
          </footer>
        </div>
      </article>
    `;
  }).join('');
}

function renderRegionDetail() {
  const region = getRegion();
  const progress = getRegionProgress();
  const corruption = Math.round(progress.corruption);
  const trustLabel = trustName(progress.trust);
  els.regionName.textContent = region.name;
  els.regionState.textContent = `${corruption}% gas`;
  els.regionBrief.innerHTML = `
    <p>${region.brief}</p>
    <div class="brief-stats">
      <div class="brief-stat"><span>Faction</span><strong>${region.faction}</strong></div>
      <div class="brief-stat"><span>Trust</span><strong>${trustLabel}</strong></div>
      <div class="brief-stat"><span>Wins</span><strong>${progress.wins}</strong></div>
      <div class="brief-stat"><span>Restored</span><strong>${progress.restored.length}/${region.nodes.length}</strong></div>
    </div>
  `;

  els.restorationNodes.innerHTML = region.nodes.map((node) => {
    const restored = progress.restored.includes(node.id);
    const affordable = canAfford(node.cost);
    return `
      <article class="node-card ${restored ? 'restored' : ''}">
        <header>
          <h3>${node.name}</h3>
          <span class="pill">${restored ? 'Online' : costLabel(node.cost)}</span>
        </header>
        <p>${node.effect}</p>
        <button type="button" data-restore="${node.id}" ${restored || !affordable ? 'disabled' : ''}>
          ${restored ? 'Restored' : 'Restore'}
        </button>
      </article>
    `;
  }).join('');
}

function renderLog() {
  const lines = state.battle ? state.battle.log : seedLog();
  els.battleLog.innerHTML = lines.slice(-8).reverse().map((line) => `<li>${line}</li>`).join('');
  if (state.battle && state.battle.status === 'active') {
    els.battleWave.textContent = `Wave ${state.battle.waveIndex + 1}/${state.battle.waves.length}`;
  } else if (state.lastResult) {
    els.battleWave.textContent = state.lastResult;
  } else {
    els.battleWave.textContent = 'Ready';
  }
}

function seedLog() {
  const region = getRegion();
  const progress = getRegionProgress();
  const lines = [
    `${region.faction}: ${trustName(progress.trust)}.`,
    `${region.name}: ${Math.round(progress.corruption)}% corruption remaining.`
  ];
  if (progress.restored.length) {
    lines.push(`${progress.restored.length} restoration node${progress.restored.length === 1 ? '' : 's'} online.`);
  } else {
    lines.push('Clean Puff Protocol awaiting deployment.');
  }
  return lines;
}

function renderUltimates() {
  const battle = state.battle;
  els.ultimateBar.innerHTML = state.selectedSquad.map((heroId) => {
    const hero = getHero(heroId);
    const unit = battle ? battle.allies.find((ally) => ally.heroId === heroId) : null;
    const energy = unit ? Math.round(unit.energy) : 0;
    const alive = unit ? unit.hp > 0 : true;
    const ready = unit && unit.energy >= 100 && battle.status === 'active' && alive;
    return `
      <article class="ultimate-card ${ready ? 'ready' : ''}">
        <span>${hero.name}</span>
        <div class="energy-track"><i style="width:${Math.min(100, energy)}%"></i></div>
        <button type="button" data-ultimate="${hero.id}" ${ready ? '' : 'disabled'}>
          ${hero.ultimate}
        </button>
      </article>
    `;
  }).join('');
}

function updateStageLabels() {
  const region = getRegion();
  els.stageEyebrow.textContent = region.name;
  els.stageTitle.textContent = region.chapter;
  els.speedButton.textContent = `${state.speed}x`;
  els.pauseButton.textContent = state.paused ? '>' : 'II';
  if (state.battle && state.battle.status === 'active') {
    els.battleButton.textContent = 'Retreat';
  } else {
    els.battleButton.textContent = 'Engage';
  }
}

function trustName(value) {
  if (value >= 5) return 'Committed';
  if (value >= 4) return 'Allied';
  if (value >= 3) return 'Cooperative';
  if (value >= 2) return 'Tolerant';
  if (value >= 1) return 'Suspicious';
  return 'Hostile';
}

function trainCostFor(heroId) {
  const level = state.progress.heroes[heroId].level;
  return 70 + level * 35;
}

function canAfford(cost) {
  return Object.entries(cost).every(([key, amount]) => state.progress.resources[key] >= amount);
}

function spend(cost) {
  Object.entries(cost).forEach(([key, amount]) => {
    state.progress.resources[key] -= amount;
  });
}

function costLabel(cost) {
  return Object.entries(cost)
    .map(([key, amount]) => `${amount} ${shortResource(key)}`)
    .join(' + ');
}

function shortResource(key) {
  return {
    tokens: 'Tok',
    shards: 'Shard',
    seals: 'Seal',
    resin: 'Resin'
  }[key] || key;
}

function startBattle() {
  const region = getRegion();
  if (!isRegionUnlocked(region) || state.selectedSquad.length === 0) return;
  state.battle = createBattle(region);
  state.paused = false;
  state.lastResult = null;
  showBanner(region.chapter);
  logBattle(`Mission started in ${region.name}.`);
  renderAll();
}

function retreatBattle() {
  if (!state.battle || state.battle.status !== 'active') return;
  state.battle.status = 'defeat';
  state.lastResult = 'Retreat';
  showBanner('Retreat');
  logBattle('The squad withdrew before the pressure spiked.');
  renderAll();
}

function createBattle(region) {
  const buffs = activeBuffs(region.id);
  const progress = getRegionProgress(region.id);
  const cleanStart = (buffs.includes('flowStart') ? 12 : 0) + progress.restored.length * 4;
  const energyStart = (buffs.includes('energyStart') ? 10 : 0) + (buffs.includes('ultStart') ? 15 : 0);
  const allies = state.selectedSquad.map((heroId, index) => createAlly(heroId, index, energyStart, buffs));
  const battle = {
    regionId: region.id,
    waves: region.waves,
    waveIndex: 0,
    allies,
    enemies: [],
    projectiles: [],
    floaters: [],
    effects: [],
    cleanFlow: cleanStart,
    gasPressure: Math.max(6, progress.corruption * 0.18),
    time: 0,
    status: 'active',
    log: [],
    shake: 0,
    resultTimer: 0
  };
  spawnWave(battle);
  return battle;
}

function createAlly(heroId, index, energyStart, buffs) {
  const hero = getHero(heroId);
  const level = state.progress.heroes[heroId].level;
  const lane = hero.lane;
  const stats = scaleHeroStats(hero, level);
  if (buffs.includes('frontGuard') && lane === 0) {
    stats.guard += 8;
  }
  return {
    id: `ally-${heroId}`,
    team: 'ally',
    heroId,
    name: hero.name,
    lane,
    x: 170 + (index % 2) * 38,
    y: LANES[lane].y,
    radius: 35,
    maxHp: stats.hp,
    hp: stats.hp,
    power: stats.power,
    guard: stats.guard,
    tempo: stats.tempo,
    focus: stats.focus,
    energy: energyStart,
    cooldown: 0.4 + index * 0.12,
    shield: 0,
    poison: 0,
    slow: 0,
    stun: 0,
    taunt: 0,
    castFlash: 0
  };
}

function scaleHeroStats(hero, level) {
  return {
    hp: Math.round(hero.stats.hp + level * 58),
    power: Math.round(hero.stats.power + level * 6),
    guard: Math.round(hero.stats.guard + level * 3),
    tempo: hero.stats.tempo + level * 0.012,
    focus: hero.stats.focus + level * 2
  };
}

function spawnWave(battle) {
  const regionProgress = getRegionProgress(battle.regionId);
  const difficulty = 1 + regionProgress.wins * 0.08 + (100 - regionProgress.corruption) * 0.002;
  battle.enemies = battle.waves[battle.waveIndex].map(([enemyId, lane, scale = 1, boss = false], index) =>
    createEnemy(enemyId, lane, scale * difficulty, boss, index)
  );
  showBanner(`Wave ${battle.waveIndex + 1}`);
}

function createEnemy(enemyId, lane, scale, boss, index) {
  const enemy = ENEMIES[enemyId];
  const hpScale = boss ? 1.55 : 1;
  return {
    id: `enemy-${enemyId}-${index}-${Math.random().toString(16).slice(2)}`,
    enemyId,
    team: 'enemy',
    name: enemy.name,
    art: enemy.art,
    color: enemy.color,
    glyph: enemy.glyph,
    lane,
    x: 760 - (index % 2) * 38,
    y: LANES[lane].y,
    radius: boss ? 43 : 35,
    maxHp: Math.round(enemy.stats.hp * scale * hpScale),
    hp: Math.round(enemy.stats.hp * scale * hpScale),
    power: Math.round(enemy.stats.power * scale),
    guard: Math.round(enemy.stats.guard * scale),
    tempo: enemy.stats.tempo + (boss ? 0.05 : 0),
    pressure: enemy.pressure,
    special: enemy.special,
    cooldown: 0.6 + index * 0.18,
    specialTimer: boss ? 2.2 : 3.4 + index * 0.5,
    shield: 0,
    poison: 0,
    slow: 0,
    stun: 0,
    taunt: 0,
    castFlash: 0,
    boss
  };
}

function update(dt) {
  if (state.bannerTimer > 0) {
    state.bannerTimer -= dt;
    if (state.bannerTimer <= 0) els.arenaBanner.classList.remove('live');
  }

  if (!state.battle || state.battle.status !== 'active' || state.paused) return;
  const battle = state.battle;
  const region = getRegion(battle.regionId);
  const progress = getRegionProgress(battle.regionId);
  const buffs = activeBuffs(battle.regionId);
  const simDt = Math.min(dt, 0.033) * state.speed;
  battle.time += simDt;
  battle.shake = Math.max(0, battle.shake - simDt * 18);

  battle.cleanFlow = clamp(battle.cleanFlow + simDt * (0.8 + progress.restored.length * 0.08), 0, 100);
  const gasRate = (0.62 + progress.corruption / 140) * (buffs.includes('gasResist') ? 0.72 : 1);
  battle.gasPressure = clamp(battle.gasPressure + simDt * gasRate, 0, 100);

  updateStatuses(battle, simDt);
  updateUnitActions(battle, simDt);
  updateProjectiles(battle, simDt);
  updateFloaters(battle, simDt);

  if (battle.cleanFlow >= 100) triggerCleanSurge(battle);
  if (battle.gasPressure >= 100) triggerGreatRip(battle);

  const enemiesAlive = battle.enemies.some((enemy) => enemy.hp > 0);
  const alliesAlive = battle.allies.some((ally) => ally.hp > 0);
  if (!alliesAlive) finishBattle(false);
  if (!enemiesAlive) {
    if (battle.waveIndex < battle.waves.length - 1) {
      battle.waveIndex += 1;
      spawnWave(battle);
      logBattle('The next corruption wave enters the lanes.');
    } else {
      finishBattle(true);
    }
  }
}

function updateStatuses(battle, dt) {
  getLivingUnits(battle).forEach((unit) => {
    unit.castFlash = Math.max(0, unit.castFlash - dt);
    unit.slow = Math.max(0, unit.slow - dt);
    unit.stun = Math.max(0, unit.stun - dt);
    unit.taunt = Math.max(0, unit.taunt - dt);
    if (unit.poison > 0) {
      unit.poison = Math.max(0, unit.poison - dt);
      dealDamage(unit, 10 * dt, null, { silent: true, pressure: false });
    }
  });
}

function updateUnitActions(battle, dt) {
  getLivingUnits(battle).forEach((unit) => {
    if (unit.stun > 0) return;
    const rate = unit.slow > 0 ? 0.55 : 1;
    unit.cooldown -= dt * rate;
    if (unit.team === 'enemy') {
      unit.specialTimer -= dt * rate;
      if (unit.specialTimer <= 0) {
        useEnemySpecial(battle, unit);
        unit.specialTimer = unit.boss ? 4.3 : 5.5 + Math.random() * 1.2;
      }
    }
    if (unit.cooldown <= 0) {
      basicAttack(battle, unit);
      unit.cooldown = Math.max(0.42, 1.55 / unit.tempo);
    }
  });
}

function basicAttack(battle, unit) {
  const target = chooseTarget(battle, unit);
  if (!target) return;
  const variance = 0.86 + Math.random() * 0.28;
  const damage = Math.max(8, unit.power * variance - target.guard * 0.42);
  unit.castFlash = 0.18;
  createProjectile(battle, unit, target, unit.team === 'ally' ? '#69e6ca' : '#93d84d');
  dealDamage(target, damage, unit, { pressure: unit.team === 'enemy' });
  if (unit.team === 'ally') {
    unit.energy = clamp(unit.energy + 12 + unit.focus * 0.12, 0, 100);
    battle.cleanFlow = clamp(battle.cleanFlow + 2.1, 0, 100);
  } else {
    battle.gasPressure = clamp(battle.gasPressure + ENEMIES[unit.enemyId].pressure * 0.16, 0, 100);
  }
}

function chooseTarget(battle, unit) {
  const opponents = unit.team === 'ally' ? battle.enemies : battle.allies;
  const living = opponents.filter((candidate) => candidate.hp > 0);
  if (!living.length) return null;
  const taunter = living.find((candidate) => candidate.taunt > 0);
  if (taunter) return taunter;
  const sameLane = living.filter((candidate) => candidate.lane === unit.lane);
  const pool = sameLane.length ? sameLane : living;
  return pool.reduce((best, candidate) => {
    if (!best) return candidate;
    return candidate.hp / candidate.maxHp < best.hp / best.maxHp ? candidate : best;
  }, null);
}

function useEnemySpecial(battle, unit) {
  if (unit.hp <= 0) return;
  unit.castFlash = 0.32;
  const buffs = activeBuffs(battle.regionId);
  const propResist = buffs.includes('propResist') ? 0.62 : 1;
  if (unit.special === 'propaganda') {
    battle.allies.filter((ally) => ally.hp > 0).forEach((ally) => {
      ally.energy = Math.max(0, ally.energy - 9 * propResist);
      ally.slow = Math.max(ally.slow, 1.2 * propResist);
    });
    battle.gasPressure = clamp(battle.gasPressure + 11 * propResist, 0, 100);
    addEffect(unit.x, unit.y, '#4b82a8', 'FUD');
    logBattle('FUDcasters flood the feed with blame.');
  } else if (unit.special === 'smog' || unit.special === 'rupture') {
    const targets = battle.allies.filter((ally) => ally.hp > 0 && ally.lane === unit.lane);
    targets.forEach((ally) => {
      dealDamage(ally, unit.power * 0.72, unit, { pressure: true });
      ally.poison = Math.max(ally.poison, 2.4);
    });
    battle.gasPressure = clamp(battle.gasPressure + 10, 0, 100);
    addEffect(unit.x - 40, unit.y, '#93d84d', 'SMOG');
  } else if (unit.special === 'vanish') {
    const target = battle.allies
      .filter((ally) => ally.hp > 0)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (target) {
      unit.x = Math.max(610, target.x + 430);
      dealDamage(target, unit.power * 1.35, unit, { pressure: true });
      target.poison = Math.max(target.poison, 1.8);
      addEffect(target.x, target.y, '#93d84d', 'POOF');
      logBattle('Flatulus appears where the squad forgot to look.');
    }
  } else if (unit.special === 'airstrike') {
    battle.allies.filter((ally) => ally.hp > 0).forEach((ally) => {
      if (ally.lane !== unit.lane || Math.random() < 0.65) {
        dealDamage(ally, unit.power * 0.62, unit, { pressure: true });
      }
    });
    battle.gasPressure = clamp(battle.gasPressure + 14, 0, 100);
    battle.shake = 8;
    addEffect(500, 160 + unit.lane * 116, '#e7b83f', 'AIR RAID');
  } else if (unit.special === 'tantrum') {
    battle.enemies.filter((enemy) => enemy.hp > 0).forEach((enemy) => {
      enemy.shield += 38;
    });
    battle.gasPressure = clamp(battle.gasPressure + 9, 0, 100);
    addEffect(unit.x, unit.y, '#c33c2d', 'ROYAL FIT');
  } else if (unit.special === 'edict') {
    battle.allies.filter((ally) => ally.hp > 0).forEach((ally) => {
      dealDamage(ally, unit.power * 0.54, unit, { pressure: true });
      ally.slow = Math.max(ally.slow, 1.6);
    });
    battle.gasPressure = clamp(battle.gasPressure + 18, 0, 100);
    battle.shake = 10;
    addEffect(unit.x - 120, unit.y - 60, '#c33c2d', 'DECREE');
    logBattle('Sir Gas declares the air taxable.');
  }
}

function castUltimate(heroId) {
  const battle = state.battle;
  if (!battle || battle.status !== 'active') return;
  const unit = battle.allies.find((ally) => ally.heroId === heroId);
  if (!unit || unit.hp <= 0 || unit.energy < 100) return;
  unit.energy = 0;
  unit.castFlash = 0.45;
  const hero = getHero(heroId);
  showBanner(hero.ultimate);

  if (heroId === 'puff') {
    battle.allies.filter((ally) => ally.hp > 0).forEach((ally) => {
      ally.poison = 0;
      ally.slow = 0;
      heal(ally, 125 + unit.focus * 2.2);
      ally.energy = clamp(ally.energy + 8, 0, 100);
    });
    battle.cleanFlow = clamp(battle.cleanFlow + 26, 0, 100);
    battle.gasPressure = Math.max(0, battle.gasPressure - 20);
    addEffect(250, 270, '#69e6ca', 'CLEAN');
    logBattle('Princess Puff steadies the whole resistance.');
  } else if (heroId === 'airabella') {
    battle.allies.filter((ally) => ally.hp > 0).forEach((ally) => {
      ally.shield += 95 + unit.focus;
      heal(ally, 45);
    });
    battle.enemies.filter((enemy) => enemy.hp > 0).forEach((enemy) => {
      enemy.slow = Math.max(enemy.slow, 2.8);
    });
    battle.cleanFlow = clamp(battle.cleanFlow + 18, 0, 100);
    addEffect(490, 290, '#7b4ab3', 'MIST');
    logBattle('Airabella folds the lane into protective mist.');
  } else if (heroId === 'prep') {
    const converted = Math.min(38, battle.gasPressure * 0.55);
    battle.gasPressure -= converted;
    battle.cleanFlow = clamp(battle.cleanFlow + converted + 16, 0, 100);
    battle.enemies.filter((enemy) => enemy.hp > 0).forEach((enemy) => {
      dealDamage(enemy, 72 + unit.focus * 1.8, unit, { pressure: false });
      enemy.stun = Math.max(enemy.stun, hasBuff('longStun', battle.regionId) ? 1.2 : 0.75);
    });
    addEffect(560, 260, '#69e6ca', 'INVERT');
    logBattle('Prep proves the bad news is now useful.');
  } else if (heroId === 'shogun') {
    battle.enemies.filter((enemy) => enemy.hp > 0 && enemy.lane === unit.lane).forEach((enemy) => {
      dealDamage(enemy, 185 + unit.power * 0.8, unit, { pressure: false });
      enemy.taunt = 0;
    });
    unit.taunt = 4.2;
    unit.shield += 155;
    battle.cleanFlow = clamp(battle.cleanFlow + 13, 0, 100);
    addEffect(600, unit.y, '#e7b83f', 'OATH');
    logBattle('Shogun Sheba locks the lane by sheer loyalty.');
  } else if (heroId === 'romeo') {
    const weakest = battle.allies
      .filter((ally) => ally.hp > 0)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (weakest) {
      heal(weakest, 180 + unit.focus * 2);
      weakest.energy = clamp(weakest.energy + 14, 0, 100);
    }
    const target = battle.enemies
      .filter((enemy) => enemy.hp > 0)
      .sort((a, b) => b.hp - a.hp)[0];
    if (target) dealDamage(target, 150 + unit.power, unit, { pressure: false });
    battle.gasPressure = Math.max(0, battle.gasPressure - 18);
    addEffect(480, 260, '#4b82a8', 'TWO WINDS');
    logBattle('Romeo chooses the cleaner wind.');
  } else if (heroId === 'knight') {
    battle.allies.filter((ally) => ally.hp > 0 && ally.lane === unit.lane).forEach((ally) => {
      ally.shield += 210;
    });
    const target = battle.enemies
      .filter((enemy) => enemy.hp > 0)
      .sort((a, b) => b.power - a.power)[0];
    if (target) {
      target.stun = Math.max(target.stun, hasBuff('longStun', battle.regionId) ? 2.6 : 1.65);
      dealDamage(target, 110 + unit.focus * 2, unit, { pressure: false });
    }
    battle.cleanFlow = clamp(battle.cleanFlow + 15, 0, 100);
    addEffect(540, unit.y, '#7b4ab3', '?');
    logBattle('The Knight of Question makes certainty flinch.');
  } else if (heroId === 'queen') {
    battle.allies.filter((ally) => ally.hp > 0).forEach((ally) => {
      heal(ally, 95 + unit.focus * 2);
      ally.shield += 65;
      ally.slow = 0;
    });
    battle.enemies.filter((enemy) => enemy.hp > 0).forEach((enemy) => {
      dealDamage(enemy, 125 + unit.power * 0.55, unit, { pressure: false });
    });
    battle.cleanFlow = clamp(battle.cleanFlow + 24, 0, 100);
    addEffect(485, 250, '#e7b83f', 'LEGACY');
    logBattle('Airelynns legacy crosses the battlefield.');
  } else if (heroId === 'maximus') {
    battle.allies.filter((ally) => ally.hp > 0).forEach((ally) => {
      ally.poison = 0;
      ally.energy = clamp(ally.energy + 24, 0, 100);
      heal(ally, 52 + unit.focus);
    });
    battle.gasPressure = Math.max(0, battle.gasPressure - 22);
    battle.cleanFlow = clamp(battle.cleanFlow + 20, 0, 100);
    addEffect(310, 340, '#e7b83f', 'HOPE');
    logBattle('Maximus giggles and the whole room unclenches.');
  }
  renderUltimates();
}

function triggerCleanSurge(battle) {
  battle.cleanFlow = 0;
  const bonus = hasBuff('surgePlus', battle.regionId) ? 1.28 : 1;
  battle.allies.filter((ally) => ally.hp > 0).forEach((ally) => {
    ally.poison = 0;
    ally.slow = 0;
    heal(ally, ally.maxHp * 0.12);
    ally.energy = clamp(ally.energy + 10, 0, 100);
  });
  battle.enemies.filter((enemy) => enemy.hp > 0).forEach((enemy) => {
    dealDamage(enemy, 78 * bonus, null, { pressure: false });
  });
  battle.gasPressure = Math.max(0, battle.gasPressure - 24);
  addEffect(480, 270, '#69e6ca', 'SURGE');
  logBattle('Clean Puff Surge purges the lanes.');
}

function triggerGreatRip(battle) {
  battle.gasPressure = 34;
  battle.allies.filter((ally) => ally.hp > 0).forEach((ally) => {
    dealDamage(ally, 92, null, { pressure: false });
    ally.poison = Math.max(ally.poison, 3);
    ally.slow = Math.max(ally.slow, 1.6);
  });
  battle.shake = 14;
  addEffect(480, 260, '#93d84d', 'GREAT RIP');
  logBattle('Gas Pressure caps and the Great Rip tears through.');
}

function finishBattle(victory) {
  const battle = state.battle;
  if (!battle || battle.status !== 'active') return;
  battle.status = victory ? 'victory' : 'defeat';
  battle.resultTimer = 1.2;
  state.lastResult = victory ? 'Victory' : 'Defeat';
  if (victory) {
    applyVictoryRewards(battle.regionId);
    showBanner('Region Secured');
  } else {
    applyDefeatConsolation(battle.regionId);
    showBanner('Squad Routed');
  }
  saveProgress();
  renderAll();
}

function applyVictoryRewards(regionId) {
  const region = getRegion(regionId);
  const progress = getRegionProgress(regionId);
  const rewardScale = 1 + progress.wins * 0.06;
  progress.wins += 1;
  progress.corruption = Math.max(0, progress.corruption - region.restorePower - progress.restored.length * 3);
  progress.trust = Math.min(5, progress.trust + (hasBuff('trustPlus', regionId) ? 1.25 : 1));
  state.progress.resources.tokens += Math.round(region.rewards.tokens * rewardScale);
  state.progress.resources.shards += region.rewards.shards + (hasBuff('shardPlus', regionId) ? 3 : 0);
  state.progress.resources.seals += region.rewards.seals + (hasBuff('truthPlus', regionId) ? 1 : 0);
  state.progress.resources.resin += region.rewards.resin;
  logBattle(`${region.name} corruption falls to ${Math.round(progress.corruption)}%.`);
}

function applyDefeatConsolation(regionId) {
  const region = getRegion(regionId);
  state.progress.resources.tokens += Math.round(region.rewards.tokens * 0.18);
  if (hasBuff('defeatTrust', regionId)) {
    const progress = getRegionProgress(regionId);
    progress.trust = Math.min(5, progress.trust + 0.25);
  }
  logBattle('The cell keeps enough supplies to try again.');
}

function restoreNode(nodeId) {
  const region = getRegion();
  const progress = getRegionProgress();
  const node = region.nodes.find((item) => item.id === nodeId);
  if (!node || progress.restored.includes(node.id) || !canAfford(node.cost)) return;
  spend(node.cost);
  progress.restored.push(node.id);
  progress.corruption = Math.max(0, progress.corruption - 8);
  progress.trust = Math.min(5, progress.trust + 0.35);
  saveProgress();
  state.lastResult = 'Restored';
  showBanner(node.name);
  renderAll();
}

function trainHero(heroId) {
  const cost = trainCostFor(heroId);
  if (state.progress.resources.tokens < cost) return;
  state.progress.resources.tokens -= cost;
  state.progress.heroes[heroId].level += 1;
  saveProgress();
  state.lastResult = 'Trained';
  renderAll();
}

function toggleHero(heroId) {
  if (state.battle && state.battle.status === 'active') return;
  if (state.selectedSquad.includes(heroId)) {
    if (state.selectedSquad.length <= 1) return;
    state.selectedSquad = state.selectedSquad.filter((id) => id !== heroId);
  } else if (state.selectedSquad.length < 5) {
    state.selectedSquad.push(heroId);
  } else {
    state.selectedSquad = [...state.selectedSquad.slice(1), heroId];
  }
  renderAll();
}

function dealDamage(target, amount, source, options = {}) {
  if (target.hp <= 0) return 0;
  let remaining = amount;
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, remaining);
    target.shield -= absorbed;
    remaining -= absorbed;
    if (!options.silent) addFloater(target.x, target.y - 42, `-${Math.round(absorbed)}`, '#69e6ca');
  }
  if (remaining > 0) {
    target.hp = Math.max(0, target.hp - remaining);
    if (!options.silent) addFloater(target.x, target.y - 52, `${Math.round(remaining)}`, target.team === 'ally' ? '#f6a05f' : '#f8f0da');
  }
  if (target.hp <= 0 && !options.silent) {
    addEffect(target.x, target.y, target.team === 'ally' ? '#c33c2d' : '#69e6ca', 'DOWN');
  }
  if (options.pressure && state.battle) {
    state.battle.gasPressure = clamp(state.battle.gasPressure + 1.2, 0, 100);
  }
  return remaining;
}

function heal(unit, amount) {
  if (unit.hp <= 0) return;
  const before = unit.hp;
  unit.hp = Math.min(unit.maxHp, unit.hp + amount);
  const gained = unit.hp - before;
  if (gained > 1) addFloater(unit.x, unit.y - 60, `+${Math.round(gained)}`, '#69e6ca');
}

function createProjectile(battle, source, target, color) {
  battle.projectiles.push({
    sx: source.x,
    sy: source.y - 8,
    tx: target.x,
    ty: target.y - 8,
    color,
    life: 0,
    max: 0.26
  });
}

function updateProjectiles(battle, dt) {
  battle.projectiles.forEach((projectile) => {
    projectile.life += dt;
  });
  battle.projectiles = battle.projectiles.filter((projectile) => projectile.life < projectile.max);
}

function updateFloaters(battle, dt) {
  battle.floaters.forEach((floater) => {
    floater.y -= dt * 38;
    floater.life -= dt;
  });
  battle.effects.forEach((effect) => {
    effect.life -= dt;
    effect.radius += dt * 42;
  });
  battle.floaters = battle.floaters.filter((floater) => floater.life > 0);
  battle.effects = battle.effects.filter((effect) => effect.life > 0);
}

function addFloater(x, y, text, color) {
  if (!state.battle) return;
  state.battle.floaters.push({ x, y, text, color, life: 0.85 });
}

function addEffect(x, y, color, label) {
  if (!state.battle) return;
  state.battle.effects.push({ x, y, color, label, life: 0.8, radius: 18 });
}

function logBattle(message) {
  if (state.battle) {
    state.battle.log.push(message);
    if (state.battle.log.length > 24) state.battle.log.shift();
  }
  renderLog();
}

function getLivingUnits(battle) {
  return [...battle.allies, ...battle.enemies].filter((unit) => unit.hp > 0);
}

function draw() {
  ctx.save();
  ctx.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
  const battle = state.battle;
  if (battle && battle.shake > 0) {
    ctx.translate((Math.random() - 0.5) * battle.shake, (Math.random() - 0.5) * battle.shake);
  }
  drawArenaBackground();
  drawLanes();
  if (battle) {
    drawBattle(battle);
  } else {
    drawHubPreview();
  }
  drawAtmosphere();
  ctx.restore();
}

function drawArenaBackground() {
  const region = getRegion();
  const progress = getRegionProgress();
  const clean = 1 - progress.corruption / 100;
  const [skyA, skyB, ground] = region.tone;
  const grad = ctx.createLinearGradient(0, 0, 0, BASE_HEIGHT);
  grad.addColorStop(0, blend('#1f2430', skyA, clean * 0.7));
  grad.addColorStop(0.55, blend('#293225', skyB, clean * 0.68));
  grad.addColorStop(1, ground);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

  ctx.globalAlpha = 0.26 + clean * 0.22;
  ctx.fillStyle = '#e7b83f';
  ctx.beginPath();
  ctx.arc(790, 74, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  for (let i = 0; i < 9; i += 1) {
    const x = (i * 132 - ((state.battle?.time || performance.now() / 1000) * 18)) % 1120;
    const y = 92 + (i % 4) * 46;
    drawChainLink(x - 80, y, 52, clean);
  }

  const ridge = ctx.createLinearGradient(0, 285, 0, 470);
  ridge.addColorStop(0, `rgba(36, 62, 50, ${0.55 + clean * 0.12})`);
  ridge.addColorStop(1, 'rgba(10, 12, 10, 0.34)');
  ctx.fillStyle = ridge;
  ctx.beginPath();
  ctx.moveTo(0, 360);
  for (let x = -80; x < BASE_WIDTH + 120; x += 120) {
    ctx.quadraticCurveTo(x + 62, 260 - clean * 25, x + 140, 360);
  }
  ctx.lineTo(BASE_WIDTH, BASE_HEIGHT);
  ctx.lineTo(0, BASE_HEIGHT);
  ctx.closePath();
  ctx.fill();
}

function drawLanes() {
  LANES.forEach((lane, index) => {
    const y = lane.y;
    ctx.fillStyle = index % 2 === 0 ? 'rgba(255, 255, 255, 0.055)' : 'rgba(0, 0, 0, 0.10)';
    roundRect(62, y - 52, 836, 88, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(248, 240, 218, 0.13)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(248, 240, 218, 0.34)';
    ctx.font = '900 12px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(lane.label.toUpperCase(), 76, y - 33);
  });

  ctx.strokeStyle = 'rgba(231, 184, 63, 0.32)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 12]);
  ctx.beginPath();
  ctx.moveTo(480, 92);
  ctx.lineTo(480, 462);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawBattle(battle) {
  battle.projectiles.forEach(drawProjectile);
  [...battle.enemies, ...battle.allies]
    .sort((a, b) => a.y - b.y)
    .forEach(drawUnit);
  battle.effects.forEach(drawEffect);
  battle.floaters.forEach(drawFloater);

  if (battle.status !== 'active') {
    ctx.fillStyle = 'rgba(10, 12, 10, 0.58)';
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    ctx.fillStyle = battle.status === 'victory' ? '#69e6ca' : '#e7b83f';
    ctx.font = '950 46px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(battle.status === 'victory' ? 'REGION SECURED' : 'SQUAD ROUTED', BASE_WIDTH / 2, 250);
    ctx.fillStyle = '#f8f0da';
    ctx.font = '800 18px system-ui';
    ctx.fillText('Restoration and rewards have been updated.', BASE_WIDTH / 2, 286);
  }
}

function drawHubPreview() {
  const region = getRegion();
  ctx.fillStyle = 'rgba(12, 13, 10, 0.54)';
  roundRect(270, 78, 420, 56, 8);
  ctx.fill();
  ctx.fillStyle = '#e7b83f';
  ctx.font = '950 28px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(region.name, BASE_WIDTH / 2, 114);

  state.selectedSquad.forEach((heroId, index) => {
    const hero = getHero(heroId);
    const lane = hero.lane;
    const x = 170 + index * 56;
    drawPortraitBadge(hero.id, x, LANES[lane].y, 38, '#69e6ca', hero.name);
  });

  const previewEnemies = region.waves[0].slice(0, 3);
  previewEnemies.forEach(([enemyId, lane], index) => {
    const enemy = ENEMIES[enemyId];
    drawEnemyBadge(enemy, 760 - index * 58, LANES[lane].y, 38, enemy.name);
  });
}

function drawUnit(unit) {
  const alive = unit.hp > 0;
  ctx.save();
  ctx.globalAlpha = alive ? 1 : 0.28;
  if (unit.castFlash > 0) {
    ctx.shadowBlur = 26;
    ctx.shadowColor = unit.team === 'ally' ? '#69e6ca' : '#93d84d';
  }
  if (unit.team === 'ally') {
    drawPortraitBadge(unit.heroId, unit.x, unit.y, unit.radius, '#69e6ca', unit.name);
  } else {
    drawEnemyBadge(ENEMIES[unit.enemyId], unit.x, unit.y, unit.radius, unit.name);
  }
  ctx.shadowBlur = 0;
  drawBars(unit);
  drawStatusPips(unit);
  ctx.restore();
}

function drawPortraitBadge(artKey, x, y, radius, ringColor, label) {
  const art = ART[artKey];
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
  ctx.beginPath();
  ctx.ellipse(x, y + radius + 9, radius * 0.98, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  if (imagesReady && images[artKey]) {
    ctx.drawImage(
      images[artKey],
      art.crop.x,
      art.crop.y,
      art.crop.w,
      art.crop.h,
      x - radius,
      y - radius,
      radius * 2,
      radius * 2
    );
  } else {
    ctx.fillStyle = '#2f4b42';
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  ctx.restore();
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  drawUnitLabel(x, y, label);
}

function drawEnemyBadge(enemy, x, y, radius, label) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
  ctx.beginPath();
  ctx.ellipse(x, y + radius + 9, radius * 0.98, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  if (enemy.art && imagesReady && images[enemy.art]) {
    const art = ART[enemy.art];
    ctx.drawImage(images[enemy.art], art.crop.x, art.crop.y, art.crop.w, art.crop.h, x - radius, y - radius, radius * 2, radius * 2);
  } else {
    const grad = ctx.createRadialGradient(x - 10, y - 14, 8, x, y, radius);
    grad.addColorStop(0, '#f8f0da');
    grad.addColorStop(0.34, enemy.color);
    grad.addColorStop(1, '#151711');
    ctx.fillStyle = grad;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.fillStyle = '#10110d';
    ctx.font = '950 16px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(enemy.glyph || 'G', x, y + 1);
  }
  ctx.restore();
  ctx.strokeStyle = '#93d84d';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  drawUnitLabel(x, y, label);
}

function drawUnitLabel(x, y, label) {
  const short = label.length > 14 ? `${label.slice(0, 12)}...` : label;
  ctx.font = '850 11px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const width = Math.min(118, ctx.measureText(short).width + 18);
  ctx.fillStyle = 'rgba(12, 13, 10, 0.76)';
  roundRect(x - width / 2, y + 44, width, 20, 8);
  ctx.fill();
  ctx.fillStyle = '#f8f0da';
  ctx.fillText(short, x, y + 55);
}

function drawBars(unit) {
  const width = unit.radius * 2.05;
  const x = unit.x - width / 2;
  const y = unit.y - unit.radius - 17;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  roundRect(x, y, width, 8, 5);
  ctx.fill();
  ctx.fillStyle = unit.team === 'ally' ? '#69e6ca' : '#d84c37';
  roundRect(x, y, width * clamp(unit.hp / unit.maxHp, 0, 1), 8, 5);
  ctx.fill();
  if (unit.team === 'ally') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    roundRect(x, y - 10, width, 5, 4);
    ctx.fill();
    ctx.fillStyle = '#7b4ab3';
    roundRect(x, y - 10, width * clamp(unit.energy / 100, 0, 1), 5, 4);
    ctx.fill();
  }
  if (unit.shield > 0) {
    ctx.strokeStyle = 'rgba(105, 230, 202, 0.78)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, unit.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawStatusPips(unit) {
  const statuses = [
    [unit.poison > 0, '#93d84d'],
    [unit.slow > 0, '#4b82a8'],
    [unit.stun > 0, '#e7b83f'],
    [unit.taunt > 0, '#c33c2d']
  ].filter(([on]) => on);
  statuses.forEach(([, color], index) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(unit.x - 20 + index * 13, unit.y + unit.radius + 25, 5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawProjectile(projectile) {
  const t = projectile.life / projectile.max;
  const x = projectile.sx + (projectile.tx - projectile.sx) * t;
  const y = projectile.sy + (projectile.ty - projectile.sy) * t - Math.sin(t * Math.PI) * 24;
  ctx.save();
  ctx.shadowBlur = 16;
  ctx.shadowColor = projectile.color;
  ctx.fillStyle = projectile.color;
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFloater(floater) {
  ctx.globalAlpha = clamp(floater.life, 0, 1);
  ctx.fillStyle = floater.color;
  ctx.font = '950 17px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(floater.text, floater.x, floater.y);
  ctx.globalAlpha = 1;
}

function drawEffect(effect) {
  ctx.save();
  ctx.globalAlpha = clamp(effect.life, 0, 1) * 0.82;
  ctx.strokeStyle = effect.color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = effect.color;
  ctx.font = '950 18px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(effect.label, effect.x, effect.y - effect.radius - 10);
  ctx.restore();
}

function drawAtmosphere() {
  const progress = getRegionProgress();
  const corruption = progress.corruption / 100;
  const time = state.battle?.time || performance.now() / 1000;
  ctx.save();
  ctx.globalAlpha = corruption * 0.38;
  for (let i = 0; i < 8; i += 1) {
    const x = (i * 150 + Math.sin(time * 0.5 + i) * 40) % BASE_WIDTH;
    const y = 72 + ((i * 63 + time * 18) % 420);
    drawGasCloud(x, y, 42 + i * 3);
  }
  ctx.restore();
}

function drawGasCloud(x, y, size) {
  ctx.fillStyle = '#93d84d';
  ctx.beginPath();
  ctx.arc(x - size * 0.25, y + size * 0.05, size * 0.28, 0, Math.PI * 2);
  ctx.arc(x + size * 0.02, y - size * 0.15, size * 0.35, 0, Math.PI * 2);
  ctx.arc(x + size * 0.28, y + size * 0.08, size * 0.25, 0, Math.PI * 2);
  ctx.arc(x + size * 0.02, y + size * 0.18, size * 0.31, 0, Math.PI * 2);
  ctx.fill();
}

function drawChainLink(x, y, size, clean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.45);
  ctx.strokeStyle = `rgba(231, 184, 63, ${0.14 + clean * 0.16})`;
  ctx.lineWidth = 8;
  roundRect(-size / 2, -size / 4, size, size / 2, 20);
  ctx.stroke();
  ctx.restore();
}

function updateMeters() {
  const battle = state.battle;
  const clean = battle ? battle.cleanFlow : progressCleanFlow();
  const gas = battle ? battle.gasPressure : getRegionProgress().corruption;
  els.cleanFill.style.width = `${clamp(clean, 0, 100)}%`;
  els.gasFill.style.width = `${clamp(gas, 0, 100)}%`;
  els.cleanValue.textContent = `${Math.round(clean)}`;
  els.gasValue.textContent = `${Math.round(gas)}`;
}

function progressCleanFlow() {
  const progress = getRegionProgress();
  return Math.max(0, 100 - progress.corruption + progress.restored.length * 8);
}

function showBanner(message) {
  els.arenaBanner.textContent = message;
  els.arenaBanner.classList.add('live');
  state.bannerTimer = 1.7;
}

function bindEvents() {
  els.regionList.addEventListener('click', (event) => {
    const card = event.target.closest('[data-region]');
    if (!card) return;
    const region = getRegion(card.dataset.region);
    if (!isRegionUnlocked(region)) return;
    if (state.battle && state.battle.status === 'active') return;
    state.currentRegionId = region.id;
    state.battle = null;
    state.lastResult = null;
    renderAll();
  });

  els.rosterList.addEventListener('click', (event) => {
    const train = event.target.closest('[data-train]');
    if (train) {
      event.stopPropagation();
      trainHero(train.dataset.train);
      return;
    }
    const card = event.target.closest('[data-hero]');
    if (card) toggleHero(card.dataset.hero);
  });

  els.restorationNodes.addEventListener('click', (event) => {
    const button = event.target.closest('[data-restore]');
    if (button) restoreNode(button.dataset.restore);
  });

  els.ultimateBar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-ultimate]');
    if (button) castUltimate(button.dataset.ultimate);
  });

  els.battleButton.addEventListener('click', () => {
    if (state.battle && state.battle.status === 'active') {
      retreatBattle();
    } else {
      startBattle();
    }
  });

  els.pauseButton.addEventListener('click', () => {
    state.paused = !state.paused;
    updateStageLabels();
    showBanner(state.paused ? 'Paused' : 'Resumed');
  });

  els.speedButton.addEventListener('click', () => {
    state.speed = state.speed === 1 ? 2 : 1;
    updateStageLabels();
  });

  els.resetButton.addEventListener('click', () => {
    if (!window.confirm('Reset CleanPuff Realm progress?')) return;
    state.progress = defaultProgress();
    state.selectedSquad = ['puff', 'shogun', 'prep', 'airabella', 'romeo'];
    state.currentRegionId = 'bide';
    state.battle = null;
    state.lastResult = null;
    saveProgress();
    renderAll();
  });

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Digit1') castUltimate(state.selectedSquad[0]);
    if (event.code === 'Digit2') castUltimate(state.selectedSquad[1]);
    if (event.code === 'Digit3') castUltimate(state.selectedSquad[2]);
    if (event.code === 'Digit4') castUltimate(state.selectedSquad[3]);
    if (event.code === 'Digit5') castUltimate(state.selectedSquad[4]);
    if (event.code === 'Space') {
      event.preventDefault();
      if (state.battle && state.battle.status === 'active') state.paused = !state.paused;
    }
  });

  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = BASE_WIDTH * ratio;
  canvas.height = BASE_HEIGHT * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  draw();
}

function loop(now) {
  const dt = (now - lastFrame) / 1000;
  lastFrame = now;
  update(dt);
  renderTimer -= dt;
  if (renderTimer <= 0) {
    updateMeters();
    renderUltimates();
    renderLog();
    updateStageLabels();
    renderTimer = 0.16;
  }
  draw();
  requestAnimationFrame(loop);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function blend(a, b, amount) {
  const t = clamp(amount, 0, 1);
  const ac = hexToRgb(a);
  const bc = hexToRgb(b);
  return `rgb(${Math.round(ac.r + (bc.r - ac.r) * t)}, ${Math.round(ac.g + (bc.g - ac.g) * t)}, ${Math.round(ac.b + (bc.b - ac.b) * t)})`;
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
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

bindEvents();
resizeCanvas();
loadImages();
renderAll();
updateMeters();
requestAnimationFrame(loop);
