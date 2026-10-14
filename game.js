const canvas = document.getElementById('gameCanvas');                      //pagina principale
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('best-score');
const speedEl = document.getElementById('speed');
const rpmEl = document.getElementById('rpm');
const speedGaugeEl = document.getElementById('speed-gauge');
const rpmGaugeEl = document.getElementById('rpm-gauge');
const oilTemperatureEl = document.getElementById('oil-temperature');
const coolantTemperatureEl = document.getElementById('coolant-temperature');
const clockEl = document.getElementById('clock');
const livesEl = document.getElementById('lives');
const lifeHearts = [...livesEl.querySelectorAll('.life-heart')];
const gearButtons = [...document.querySelectorAll('.gear-button')];
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const startBtn = document.getElementById('start-btn');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;                                  //limiti e impostazioni auto
const HORIZON = 105;                                                                
const PLAYER_Y = 500;
const PLAYER_ACCELERATION_SHIFT = 90;
const LANE_COUNT = 4;
const ROAD_CENTER = WIDTH / 2;
const ROAD_LEFT = 110;
const ROAD_RIGHT = WIDTH - ROAD_LEFT;
const MEDIAN_WIDTH = 12;
const SHOULDER_WIDTH = 50;
const CARRIAGEWAY_WIDTH = (ROAD_RIGHT - ROAD_LEFT - MEDIAN_WIDTH - SHOULDER_WIDTH * 2) / 2;
const START_SPEED = 60;
const MIN_SPEED = 20;
const MAX_SPEED = 400;
const SPEED_GAUGE_MAX = 400;
const GEAR_MAX_SPEEDS = [70, 110, 170, 240, 310, 400];
const IDLE_RPM = 950;
const MAX_RPM = 6500;
const OUTSIDE_TEMPERATURE = 7;
const START_ACCELERATION = 40;
const THROTTLE_ACCELERATION = 60;
const COAST_DECELERATION = 10;
const BRAKE_DECELERATION = 80;
const ROAD_SCROLL_PER_KMH = 2.3;
const PLAYER_POSITION_EASING = 6;
const TRAFFIC_LANE_CHANGE_LOOKAHEAD = 2;
const PLAYER_WIDTH = 75.6 * 0.8;
const PLAYER_HEIGHT = 118.8 * 0.8;
const STARTING_LIVES = 3;
const COLLISION_COOLDOWN = 1.15;
const TRAFFIC_MODELS = [                                                         //paesaggi
  { id: 'svj', name: 'SVJ', color: '#e3c51e', renderWidth: 62, renderHeight: 100 },
  { id: 'chiron', name: 'Chiron Pur Sport', color: '#102d58', renderWidth: 62, renderHeight: 100 },
  { id: 'car-carrier', name: 'Car carrier', color: '#b82727', renderWidth: 72, renderHeight: 170 },
  { id: 'ninja-bike', name: 'Green H2R', color: '#58bd32', renderWidth: 34, renderHeight: 100 },
  { id: 'harley-bike', name: 'Harley-Davidson cruiser', color: '#e6e4dc', renderWidth: 38, renderHeight: 100 },
];
const LANDSCAPES = [
  { name: 'CITY', ground: ['#747f70', '#3e5147'], road: ['#515857', '#303738'] },
  { name: 'CANYON', ground: ['#a7754f', '#704b37'], road: ['#5a5751', '#353634'] },
  { name: 'FARMLAND', ground: ['#82985c', '#50633f'], road: ['#555a56', '#323938'] },
  { name: 'MOUNTAINS', ground: ['#6f8970', '#405447'], road: ['#505856', '#303738'] },
];
const SEGMENT_LENGTH = 600;
const SIGN_INTERVAL = 300;

let gameState = 'ready';                                          
let distance = 0;
let bestDistance = Number(localStorage.getItem('redline-run-best') || 0);
let lives = STARTING_LIVES;
let speed = 0;
let currentGear = 1;
let oilTemperature = 80;
let coolantTemperature = 82;
let autoAccelerating = false;
let roadOffset = 0;
let trafficClock = 0;
let lastTimestamp = 0;
let invulnerableTime = 0;
let startInvulnerable = false;
let traffic = [];
let nextTrafficModel = 0;
const keys = { left: false, right: false, accelerate: false, brake: false };
const player = { x: 0, y: PLAYER_Y, steer: 0 };
const utopiaSprite = createUtopiaSprite();
const trafficSprites = new Map(TRAFFIC_MODELS.map((model) => [model.id, createTrafficSprite(model.id)]));

function roadAt(y) {
  const progress = Math.max(0, Math.min(1, (y - HORIZON) / (HEIGHT - HORIZON)));
  return {
    left: ROAD_LEFT,
    right: ROAD_RIGHT,
    progress,
  };
}

function currentLandscape() {
  return LANDSCAPES[Math.floor(distance / SEGMENT_LENGTH) % LANDSCAPES.length];
}

function laneCenter(lane, y) {
  const laneWidth = CARRIAGEWAY_WIDTH / 2;
  if (lane < 2) {
    return ROAD_LEFT + SHOULDER_WIDTH + (lane + 0.5) * laneWidth;
  }
  const rightRoadLeft = ROAD_CENTER + MEDIAN_WIDTH / 2;
  return rightRoadLeft + (lane - 2 + 0.5) * laneWidth;
}

function formatDistance(meters) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.floor(meters)} m`;
}

function engineRpm() {
  return speed === 0
    ? IDLE_RPM
    : Math.min(MAX_RPM, IDLE_RPM + (speed / GEAR_MAX_SPEEDS[currentGear - 1]) * (MAX_RPM - IDLE_RPM));
}

function updateHud() {
  const rpm = engineRpm();
  scoreEl.textContent = formatDistance(distance);
  bestScoreEl.textContent = formatDistance(bestDistance);
  speedEl.textContent = String(Math.round(speed));
  rpmEl.textContent = (rpm / 1000).toFixed(1);
  speedGaugeEl.setAttribute('aria-label', `Speed: ${Math.round(speed)} kilometers per hour`);
  rpmGaugeEl.setAttribute('aria-label', `Engine speed: ${Math.round(rpm)} revolutions per minute`);
  speedGaugeEl.style.setProperty('--needle-angle', `${-135 + (speed / SPEED_GAUGE_MAX) * 270}deg`);
  rpmGaugeEl.style.setProperty('--needle-angle', `${-135 + ((rpm - IDLE_RPM) / (MAX_RPM - IDLE_RPM)) * 270}deg`);
  oilTemperatureEl.textContent = String(Math.round(oilTemperature));
  coolantTemperatureEl.textContent = String(Math.round(coolantTemperature));
  clockEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  document.getElementById('outside-temperature').textContent = `${OUTSIDE_TEMPERATURE}°C`;
  gearButtons.forEach((button) => {
    const selected = Number(button.dataset.gear) === currentGear;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  livesEl.setAttribute('aria-label', `${lives} ${lives === 1 ? 'life' : 'lives'}`);
  lifeHearts.forEach((heart, index) => heart.classList.toggle('is-lost', index >= lives));
}

function selectGear(gear) {
  if (gear < 1 || gear > GEAR_MAX_SPEEDS.length) {
    return;
  }
  currentGear = gear;
  updateHud();
}

function setOverlay(title, text, visible) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.toggle('visible', visible);
}

function resetGame() {
  distance = 0;
  lives = STARTING_LIVES;
  speed = 0;
  currentGear = 1;
  oilTemperature = 80;
  coolantTemperature = 82;
  autoAccelerating = true;
  roadOffset = 0;
  trafficClock = 0.5;
  invulnerableTime = 0;
  startInvulnerable = false;
  traffic = [];
  nextTrafficModel = 0;
  player.x = laneCenter(2, PLAYER_Y);
  player.y = PLAYER_Y;
  player.steer = 0;
  updateHud();
}

function startGame() {
  resetGame();
  startInvulnerable = true;
  gameState = 'playing';
  setOverlay('', '', false);
  startBtn.disabled = false;
}

function endGame() {
  gameState = 'ended';
  if (distance > bestDistance) {
    bestDistance = Math.floor(distance);
    localStorage.setItem('redline-run-best', String(bestDistance));
  }
  updateHud();
  setOverlay('Run over', `You drove ${formatDistance(distance)}. Press W or ↑ to run again.`, true);
}

function trafficSpeedFor(modelId, direction) {
  if (modelId === 'car-carrier') {
    return 65 + Math.random() * 25;
  }
  if (modelId === 'ninja-bike') {
    return 50 + Math.random() * 20;
  }
  if (modelId === 'harley-bike') {
    return 35 + Math.random() * 20;
  }
  return direction === 'same'
    ? 70 + Math.random() * 55
    : 210 + Math.random() * 85;
}

function spawnTraffic() {
  const model = TRAFFIC_MODELS[nextTrafficModel % TRAFFIC_MODELS.length];
  const direction = nextTrafficModel % 2 === 0 ? 'same' : 'oncoming';
  const lane = direction === 'same' ? 3 : 0;
  const trafficSpeed = trafficSpeedFor(model.id, direction);
  const spawnY = direction === 'oncoming' || speed > trafficSpeed ? -100 : HEIGHT + 100;
  const hasRoom = !traffic.some((car) => (
    car.lane === lane
    && Math.abs(car.y - spawnY) < (car.renderHeight + model.renderHeight) / 2 + 18
  ));
  if (!hasRoom) {
    return;
  }

  nextTrafficModel += 1;

  traffic.push({
    lane,
    defaultLane: lane,
    direction,
    speed: trafficSpeed,
    cruiseSpeed: trafficSpeed,
    y: spawnY,
    passingObstacle: null,
    passingPlayer: false,
    lanePosition: lane,
    ...model,
  });
}

function trafficGap(car, obstacle) {
  return car.direction === 'same'
    ? car.y - obstacle.y
    : obstacle.y - car.y;
}

function trafficSafeGap(car, obstacle) {
  return (car.renderHeight + obstacle.renderHeight) / 2 + 18;
}

function playerIsInLane(car, lane) {
  if (car.direction !== 'same') {
    return false;
  }
  return Math.abs(laneCenter(lane, player.y) - player.x)
    < (PLAYER_WIDTH + car.renderWidth) * 0.39;
}

function findTrafficAhead(car, lane) {
  let nearest = null;
  for (const other of traffic) {
    if (other === car || other.direction !== car.direction || other.lane !== lane) {
      continue;
    }
    const gap = trafficGap(car, other);
    if (gap > 0 && (!nearest || gap < nearest.gap)) {
      nearest = { vehicle: other, gap, speed: other.speed };
    }
  }

  if (playerIsInLane(car, lane)) {
    const playerObstacle = {
      renderHeight: PLAYER_HEIGHT,
      y: player.y,
    };
    const gap = trafficGap(car, playerObstacle);
    if (gap > 0 && (!nearest || gap < nearest.gap)) {
      nearest = { vehicle: null, gap, speed };
    }
  }
  return nearest;
}

function canTrafficUseLane(car, lane) {
  for (const other of traffic) {
    if (other === car || other.direction !== car.direction || other.lane !== lane) {
      continue;
    }
    const gap = trafficGap(car, other);
    const safeGap = trafficSafeGap(car, other);
    const closingSpeed = gap > 0
      ? car.speed - other.speed
      : other.speed - car.speed;
    const requiredGap = safeGap
      + Math.max(0, closingSpeed) * ROAD_SCROLL_PER_KMH * TRAFFIC_LANE_CHANGE_LOOKAHEAD;
    if (Math.abs(gap) < requiredGap) {
      return false;
    }
  }

  if (playerIsInLane(car, lane)) {
    const playerObstacle = { renderHeight: PLAYER_HEIGHT, y: player.y };
    const gap = trafficGap(car, playerObstacle);
    const closingSpeed = gap > 0 ? car.speed - speed : speed - car.speed;
    const requiredGap = trafficSafeGap(car, playerObstacle)
      + Math.max(0, closingSpeed) * ROAD_SCROLL_PER_KMH * TRAFFIC_LANE_CHANGE_LOOKAHEAD;
    if (Math.abs(gap) < requiredGap) {
      return false;
    }
  }
  return true;
}

function canPassWithoutCuttingOffPlayer(car, passingLane) {
  if (!playerIsInLane(car, passingLane)) {
    return true;
  }

  const playerGap = trafficGap(car, { y: player.y });
  const playerClosingSpeed = speed - car.speed;
  if (playerGap >= 0 || playerClosingSpeed <= 0) {
    return true;
  }

  return false;
}

function changeTrafficLane(car, lane, obstacle = null) {
  car.lane = lane;
  car.passingObstacle = obstacle;
  car.passingPlayer = lane !== car.defaultLane && obstacle === null;
}

function updateTrafficLanes() {
  for (const car of traffic) {
    car.speed = car.cruiseSpeed;
  }

  const carsInTravelOrder = [...traffic].sort((first, second) => (
    first.direction === 'same'
      ? first.y - second.y
      : second.y - first.y
  ));

  for (const car of carsInTravelOrder) {
    const ahead = findTrafficAhead(car, car.lane);
    if (car.lane === car.defaultLane) {
      if (!ahead) {
        continue;
      }

      const safeGap = ahead.vehicle
        ? trafficSafeGap(car, ahead.vehicle)
        : (PLAYER_HEIGHT + car.renderHeight) / 2 + 18;
      const closingSpeed = car.speed - ahead.speed;
      const lookAheadGap = safeGap
        + Math.max(0, closingSpeed) * ROAD_SCROLL_PER_KMH * TRAFFIC_LANE_CHANGE_LOOKAHEAD;
      if (closingSpeed <= 0 || ahead.gap > lookAheadGap) {
        continue;
      }

      const passingLane = car.direction === 'same' ? car.defaultLane - 1 : car.defaultLane + 1;
      if (canTrafficUseLane(car, passingLane)
        && canPassWithoutCuttingOffPlayer(car, passingLane)) {
        changeTrafficLane(car, passingLane, ahead.vehicle);
      } else {
        car.speed = Math.min(car.speed, ahead.speed);
      }
      continue;
    }

    const passedObstacle = car.passingPlayer
      ? car.y < player.y
      : !car.passingObstacle
        || !traffic.includes(car.passingObstacle)
        || (car.direction === 'same'
          ? car.y < car.passingObstacle.y
          : car.y > car.passingObstacle.y);
    const defaultLaneClear = canTrafficUseLane(car, car.defaultLane);
    const currentLaneClear = canTrafficUseLane(car, car.lane);
    const playerGap = playerIsInLane(car, car.lane)
      ? trafficGap(car, { y: player.y })
      : null;
    const playerIsClosingFromBehind = playerGap !== null
      && playerGap < 0
      && speed > car.speed
      && -playerGap < (PLAYER_HEIGHT + car.renderHeight) / 2 + 18
        + (speed - car.speed) * ROAD_SCROLL_PER_KMH * TRAFFIC_LANE_CHANGE_LOOKAHEAD;
    if (playerIsClosingFromBehind && defaultLaneClear) {
      changeTrafficLane(car, car.defaultLane);
      continue;
    }
    if (passedObstacle && defaultLaneClear && currentLaneClear) {
      changeTrafficLane(car, car.defaultLane);
      continue;
    }

    if (ahead && car.speed > ahead.speed) {
      car.speed = Math.min(car.speed, ahead.speed);
    }
  }
}

function updateTraffic(dt) {
  trafficClock -= dt;
  if (trafficClock <= 0) {
    spawnTraffic();
    trafficClock = 1.4 + Math.random() * 0.8;
  }

  updateTrafficLanes();
  for (let i = traffic.length - 1; i >= 0; i -= 1) {
    const car = traffic[i];
    car.lanePosition += (car.lane - car.lanePosition) * Math.min(1, dt * 3.5);
    const relativeSpeed = car.direction === 'oncoming'
      ? speed + car.speed
      : speed - car.speed;
    car.y += relativeSpeed * ROAD_SCROLL_PER_KMH * dt;

    if (car.y > HEIGHT + 110 || car.y < -110) {
      traffic.splice(i, 1);
      continue;
    }

    if (invulnerableTime <= 0 && !startInvulnerable) {
      const closeVertically = Math.abs(car.y - player.y) < (PLAYER_HEIGHT + car.renderHeight) * 0.38;
      const closeHorizontally = Math.abs(laneCenter(car.lanePosition, car.y) - player.x)
        < (PLAYER_WIDTH + car.renderWidth) * 0.39;

      if (closeVertically && closeHorizontally) {
        traffic.splice(i, 1);
        lives -= 1;
        invulnerableTime = COLLISION_COOLDOWN;
        updateHud();

        if (lives <= 0) {
          endGame();
          return false;
        }
      }
    }
  }
  return true;
}

function updateGame(dt) {
  if (gameState !== 'playing') {
    return;
  }

  if (keys.brake) {
    speed = Math.max(MIN_SPEED, speed - BRAKE_DECELERATION * dt);
  } else if (autoAccelerating) {
    speed = Math.min(START_SPEED, speed + START_ACCELERATION * dt);
    if (speed >= START_SPEED) {
      autoAccelerating = false;
      startInvulnerable = false;
    }
  } else if (keys.accelerate && speed < GEAR_MAX_SPEEDS[currentGear - 1]) {
    speed = Math.min(GEAR_MAX_SPEEDS[currentGear - 1], speed + THROTTLE_ACCELERATION * dt);
  } else if (speed > GEAR_MAX_SPEEDS[currentGear - 1]) {
    speed = Math.max(GEAR_MAX_SPEEDS[currentGear - 1], speed - COAST_DECELERATION * dt);
  } else {
    speed = Math.max(MIN_SPEED, speed - COAST_DECELERATION * dt);
  }

  const engineLoad = (engineRpm() - IDLE_RPM) / (MAX_RPM - IDLE_RPM);
  oilTemperature += (80 + engineLoad * 35 - oilTemperature) * Math.min(1, dt * 0.12);
  coolantTemperature += (82 + engineLoad * 12 - coolantTemperature) * Math.min(1, dt * 0.16);

  const accelerating = (autoAccelerating || keys.accelerate) && !keys.brake;
  const playerYTarget = PLAYER_Y - PLAYER_ACCELERATION_SHIFT
    * (accelerating ? 1 : 2 / 3);
  player.y += (playerYTarget - player.y) * Math.min(1, dt * PLAYER_POSITION_EASING);

  const direction = Number(keys.right) - Number(keys.left);
  player.steer += (direction - player.steer) * Math.min(1, dt * 8);
  player.x += player.steer * 390 * dt;
  roadOffset = (roadOffset + speed * ROAD_SCROLL_PER_KMH * dt) % 64;
  distance += speed / 3.6 * dt;
  invulnerableTime = Math.max(0, invulnerableTime - dt);

  player.x = Math.max(ROAD_LEFT + PLAYER_WIDTH * 0.52, Math.min(ROAD_RIGHT - PLAYER_WIDTH * 0.52, player.x));

  if (!updateTraffic(dt)) {
    return;
  }
  if (Math.floor(distance) > bestDistance) {
    bestDistance = Math.floor(distance);
    localStorage.setItem('redline-run-best', String(bestDistance));
  }
  updateHud();
}

function drawScenery() {
  const landscape = currentLandscape();
  const sideColor = landscape.name === 'CANYON' ? '#835c42'
    : landscape.name === 'FARMLAND' ? '#758a4c'
      : landscape.name === 'CITY' ? '#52665b' : '#526b5a';
  const accentColor = landscape.name === 'CANYON' ? '#b78456'
    : landscape.name === 'FARMLAND' ? '#b4a653'
      : landscape.name === 'CITY' ? '#7b8b7e' : '#8ca58a';

  ctx.fillStyle = sideColor;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = accentColor;
  for (let y = -16 + (roadOffset % 48); y < HEIGHT; y += 48) {
    ctx.fillRect(0, y, ROAD_LEFT - 12, 4);
    ctx.fillRect(ROAD_RIGHT + 12, y, WIDTH - ROAD_RIGHT - 12, 4);
  }

  for (let y = -24 + ((roadOffset * 1.5) % 72); y < HEIGHT; y += 72) {
    const leftX = 18 + ((Math.floor(y / 72) % 2) * 18);
    const rightX = WIDTH - leftX - 12;
    if (landscape.name === 'CITY') {
      ctx.fillStyle = '#354a43';
      ctx.fillRect(leftX, y, 12, 18);
      ctx.fillRect(rightX, y + 22, 12, 18);
      ctx.fillStyle = '#d7c58b';
      ctx.fillRect(leftX + 3, y + 4, 2, 3);
      ctx.fillRect(leftX + 8, y + 4, 2, 3);
      ctx.fillRect(rightX + 3, y + 26, 2, 3);
      ctx.fillRect(rightX + 8, y + 26, 2, 3);
    } else {
      ctx.fillStyle = landscape.name === 'CANYON' ? '#6c4634' : '#3d5a3f';
      ctx.fillRect(leftX + 4, y + 8, 4, 12);
      ctx.fillRect(rightX + 4, y + 32, 4, 12);
      ctx.fillStyle = landscape.name === 'CANYON' ? '#c18b58' : '#78985f';
      ctx.fillRect(leftX, y, 12, 10);
      ctx.fillRect(rightX, y + 24, 12, 10);
      ctx.fillRect(leftX + 2, y - 4, 8, 4);
      ctx.fillRect(rightX + 2, y + 20, 8, 4);
    }
  }
}

function drawRoad() {
  const laneWidth = CARRIAGEWAY_WIDTH / 2;
  const leftCarriagewayLeft = ROAD_LEFT + SHOULDER_WIDTH;
  const leftCarriagewayRight = ROAD_CENTER - MEDIAN_WIDTH / 2;
  const rightCarriagewayLeft = ROAD_CENTER + MEDIAN_WIDTH / 2;
  const rightCarriagewayRight = ROAD_RIGHT - SHOULDER_WIDTH;

  ctx.fillStyle = '#222b2b';
  ctx.fillRect(ROAD_LEFT - 8, 0, ROAD_RIGHT - ROAD_LEFT + 16, HEIGHT);
  ctx.fillStyle = '#292f30';
  ctx.fillRect(ROAD_LEFT, 0, ROAD_RIGHT - ROAD_LEFT, HEIGHT);

  const roadBase = currentLandscape().road[1];
  const roadSurface = currentLandscape().road[0];
  ctx.fillStyle = roadBase;
  ctx.fillRect(leftCarriagewayLeft, 0, leftCarriagewayRight - leftCarriagewayLeft, HEIGHT);
  ctx.fillRect(rightCarriagewayLeft, 0, rightCarriagewayRight - rightCarriagewayLeft, HEIGHT);
  ctx.fillStyle = roadSurface;
  ctx.fillRect(leftCarriagewayLeft + 4, 0, leftCarriagewayRight - leftCarriagewayLeft - 8, HEIGHT);
  ctx.fillRect(rightCarriagewayLeft + 4, 0, rightCarriagewayRight - rightCarriagewayLeft - 8, HEIGHT);

  for (const shoulderLeft of [ROAD_LEFT, rightCarriagewayRight]) {
    ctx.fillStyle = '#8d9088';
    ctx.fillRect(shoulderLeft, 0, SHOULDER_WIDTH, HEIGHT);
    ctx.fillStyle = '#b4b4a7';
    ctx.fillRect(shoulderLeft + 2, 0, 3, HEIGHT);
    ctx.fillStyle = '#727873';
    ctx.fillRect(shoulderLeft + 7, 0, 2, HEIGHT);
    ctx.fillStyle = '#a6a79d';
    for (let y = -14 + (roadOffset % 24); y < HEIGHT; y += 24) {
      ctx.fillRect(shoulderLeft + 12, y, SHOULDER_WIDTH - 16, 2);
    }
  }

  ctx.fillStyle = '#eeeade';
  ctx.fillRect(leftCarriagewayLeft, 0, 3, HEIGHT);
  ctx.fillRect(rightCarriagewayRight - 3, 0, 3, HEIGHT);
  ctx.fillStyle = '#858980';
  ctx.fillRect(leftCarriagewayLeft + 4, 0, 2, HEIGHT);
  ctx.fillRect(rightCarriagewayRight - 6, 0, 2, HEIGHT);

  for (let y = -24 + (roadOffset % 64); y < HEIGHT; y += 64) {
    ctx.fillStyle = '#d0d0c4';
    ctx.fillRect(ROAD_LEFT + 14, y, 4, 14);
    ctx.fillRect(ROAD_RIGHT - 18, y + 32, 4, 14);
    ctx.fillStyle = '#737872';
    ctx.fillRect(ROAD_LEFT + 15, y + 1, 2, 11);
    ctx.fillRect(ROAD_RIGHT - 17, y + 33, 2, 11);
  }

  for (const laneX of [leftCarriagewayLeft + laneWidth, rightCarriagewayLeft + laneWidth]) {
    for (let y = -28 + (roadOffset % 64); y < HEIGHT; y += 64) {
      ctx.fillStyle = '#d9d8c8';
      ctx.fillRect(laneX - 2, y, 4, 30);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(laneX - 1, y, 1, 26);
    }
  }

  ctx.fillStyle = '#454b49';
  ctx.fillRect(ROAD_CENTER - MEDIAN_WIDTH / 2, 0, MEDIAN_WIDTH, HEIGHT);
  ctx.fillStyle = '#d9d8c8';
  for (let y = -28 + (roadOffset % 64); y < HEIGHT; y += 64) {
    ctx.fillRect(ROAD_CENTER - MEDIAN_WIDTH / 2 + 1, y, 2, 30);
    ctx.fillRect(ROAD_CENTER + MEDIAN_WIDTH / 2 - 3, y, 2, 30);
  }

  ctx.fillStyle = '#aaa99b';
  ctx.fillRect(ROAD_CENTER - MEDIAN_WIDTH / 2, 0, 2, HEIGHT);
  ctx.fillRect(ROAD_CENTER + MEDIAN_WIDTH / 2 - 2, 0, 2, HEIGHT);
}

function drawRoadSigns() {
  const signSpacing = 210;
  const signOffset = (roadOffset * 1.4) % signSpacing;
  const signPoints = [];
  for (let y = -signSpacing + signOffset; y < HEIGHT + signSpacing; y += signSpacing) {
    signPoints.push(y);
  }

  for (const y of signPoints) {
    drawPixelSpeedSign(36, y, 130);
    drawPixelSpeedSign(WIDTH - 36, y + signSpacing / 2, 130);
  }
}

function drawPixelSpeedSign(x, y, limit) {
  const pixelSize = 3;
  const radius = 6;
  const postTop = y + radius * pixelSize;
  const postBottom = postTop + 18;

  ctx.fillStyle = '#606764';
  ctx.fillRect(x - 2, postTop, 4, postBottom - postTop);
  ctx.fillStyle = '#a7ada5';
  ctx.fillRect(x - 1, postTop, 1, postBottom - postTop);

  for (let gridY = -radius; gridY <= radius; gridY += 1) {
    for (let gridX = -radius; gridX <= radius; gridX += 1) {
      const distanceFromCenter = gridX * gridX + gridY * gridY;
      if (distanceFromCenter > radius * radius) continue;
      const isBorder = distanceFromCenter >= (radius - 1.5) * (radius - 1.5);
      ctx.fillStyle = isBorder ? '#c83232' : '#f0eee3';
      ctx.fillRect(x + gridX * pixelSize, y + gridY * pixelSize, pixelSize, pixelSize);
    }
  }

  ctx.fillStyle = '#20272a';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(limit), x, y);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

function drawCar(x, y, width, height, color, isPlayer = false, style = 'car') {
  ctx.save();
  ctx.translate(x - width / 2, y - height / 2);
  ctx.scale(width / 32, height / 48);

  if (isPlayer) {
    ctx.translate(16, 24);
    ctx.rotate(player.steer * -0.035);
    ctx.translate(-16, -24);
  }

  ctx.shadowColor = 'rgba(8, 12, 13, 0.52)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#161b1c';
  ctx.beginPath();
  ctx.ellipse(16, 25, 15.5, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const bodyPath = () => {
    ctx.beginPath();
    if (style === 'van' && !isPlayer) {
      ctx.moveTo(10, 2);
      ctx.lineTo(22, 2);
      ctx.quadraticCurveTo(27, 3, 28, 8);
      ctx.lineTo(30, 38);
      ctx.quadraticCurveTo(30, 45, 26, 46);
      ctx.lineTo(6, 46);
      ctx.quadraticCurveTo(2, 45, 2, 38);
      ctx.lineTo(4, 8);
      ctx.quadraticCurveTo(5, 3, 10, 2);
    } else {
      ctx.moveTo(16, 1);
      ctx.bezierCurveTo(12, 1, 11, 4, 9, 8);
      ctx.bezierCurveTo(6, 11, 5, 16, 4, 23);
      ctx.lineTo(2, 34);
      ctx.bezierCurveTo(1, 40, 3, 45, 7, 46);
      ctx.quadraticCurveTo(16, 48, 25, 46);
      ctx.bezierCurveTo(29, 45, 31, 40, 30, 34);
      ctx.lineTo(28, 23);
      ctx.bezierCurveTo(27, 16, 26, 11, 23, 8);
      ctx.bezierCurveTo(21, 4, 20, 1, 16, 1);
    }
    ctx.closePath();
  };

  ctx.save();
  ctx.translate(0, 2.2);
  bodyPath();
  ctx.fillStyle = isPlayer ? '#51171d' : shadeColor(color, -62);
  ctx.fill();
  ctx.restore();

  const paint = isPlayer ? '#db332f' : color;
  const bodyGradient = ctx.createLinearGradient(1, 0, 31, 0);
  bodyGradient.addColorStop(0, isPlayer ? '#721b22' : shadeColor(paint, -55));
  bodyGradient.addColorStop(0.16, isPlayer ? '#c32b30' : shadeColor(paint, -15));
  bodyGradient.addColorStop(0.38, isPlayer ? '#fb6654' : shadeColor(paint, 24));
  bodyGradient.addColorStop(0.56, isPlayer ? '#e5443c' : paint);
  bodyGradient.addColorStop(0.82, isPlayer ? '#c32b30' : shadeColor(paint, -15));
  bodyGradient.addColorStop(1, isPlayer ? '#711b22' : shadeColor(paint, -55));

  bodyPath();
  ctx.fillStyle = bodyGradient;
  ctx.fill();
  ctx.strokeStyle = isPlayer ? 'rgba(255, 170, 143, 0.78)' : 'rgba(255, 255, 255, 0.48)';
  ctx.lineWidth = 0.75;
  ctx.stroke();

  ctx.save();
  bodyPath();
  ctx.clip();

  const panelShade = ctx.createLinearGradient(0, 5, 0, 47);
  panelShade.addColorStop(0, 'rgba(255, 255, 255, 0)');
  panelShade.addColorStop(0.52, 'rgba(255, 255, 255, 0.02)');
  panelShade.addColorStop(0.78, 'rgba(18, 17, 19, 0.14)');
  panelShade.addColorStop(1, 'rgba(10, 12, 14, 0.34)');
  ctx.fillStyle = panelShade;
  ctx.fillRect(0, 0, 32, 48);

  const shoulderShade = ctx.createLinearGradient(0, 0, 32, 0);
  shoulderShade.addColorStop(0, 'rgba(0, 0, 0, 0.48)');
  shoulderShade.addColorStop(0.13, 'rgba(0, 0, 0, 0.08)');
  shoulderShade.addColorStop(0.38, 'rgba(255, 255, 255, 0.11)');
  shoulderShade.addColorStop(0.58, 'rgba(255, 255, 255, 0)');
  shoulderShade.addColorStop(0.87, 'rgba(0, 0, 0, 0.12)');
  shoulderShade.addColorStop(1, 'rgba(0, 0, 0, 0.48)');
  ctx.fillStyle = shoulderShade;
  ctx.fillRect(0, 0, 32, 48);

  const hoodGradient = ctx.createLinearGradient(0, 2, 0, 13);
  hoodGradient.addColorStop(0, isPlayer ? 'rgba(255, 180, 148, 0.58)' : 'rgba(255, 255, 255, 0.46)');
  hoodGradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.12)');
  hoodGradient.addColorStop(1, 'rgba(28, 23, 24, 0.16)');
  ctx.fillStyle = hoodGradient;
  ctx.beginPath();
  ctx.moveTo(16, 2);
  ctx.bezierCurveTo(12, 5, 11, 8, 10, 12);
  ctx.quadraticCurveTo(16, 14, 22, 12);
  ctx.bezierCurveTo(21, 8, 20, 5, 16, 2);
  ctx.fill();

  ctx.strokeStyle = isPlayer ? 'rgba(255, 192, 164, 0.68)' : 'rgba(255, 255, 255, 0.42)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(16, 5);
  ctx.bezierCurveTo(12.5, 8, 11.5, 11, 10.5, 14);
  ctx.moveTo(16, 5);
  ctx.bezierCurveTo(19.5, 8, 20.5, 11, 21.5, 14);
  ctx.stroke();

  const glass = ctx.createLinearGradient(0, 12, 0, 34);
  glass.addColorStop(0, '#193039');
  glass.addColorStop(0.45, '#66838a');
  glass.addColorStop(0.72, '#314b54');
  glass.addColorStop(1, '#15272d');
  ctx.fillStyle = glass;
  ctx.beginPath();
  if (style === 'van' && !isPlayer) {
    ctx.moveTo(7, 9);
    ctx.lineTo(25, 9);
    ctx.lineTo(26, 20);
    ctx.lineTo(6, 20);
  } else {
    ctx.moveTo(9, 13);
    ctx.quadraticCurveTo(16, 10, 23, 13);
    ctx.lineTo(25, 22);
    ctx.quadraticCurveTo(16, 24, 7, 22);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(195, 226, 224, 0.66)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  ctx.fillStyle = 'rgba(225, 244, 240, 0.47)';
  ctx.beginPath();
  ctx.moveTo(10, 14);
  ctx.quadraticCurveTo(16, 12, 21, 14);
  ctx.lineTo(19, 16);
  ctx.quadraticCurveTo(14, 15, 10, 17);
  ctx.closePath();
  ctx.fill();

  if (!isPlayer && style === 'van') {
    ctx.fillStyle = 'rgba(19, 32, 37, 0.78)';
    ctx.fillRect(7, 23, 18, 10);
    ctx.fillStyle = 'rgba(214, 235, 228, 0.45)';
    ctx.fillRect(9, 24, 14, 1);
  } else {
    ctx.fillStyle = '#263b40';
    ctx.beginPath();
    ctx.moveTo(7, 25);
    ctx.quadraticCurveTo(16, 23, 25, 25);
    ctx.lineTo(24, 32);
    ctx.quadraticCurveTo(16, 35, 8, 32);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(181, 211, 206, 0.28)';
    ctx.beginPath();
    ctx.moveTo(10, 26);
    ctx.quadraticCurveTo(16, 25, 22, 26);
    ctx.lineTo(21, 28);
    ctx.quadraticCurveTo(16, 27, 11, 29);
    ctx.closePath();
    ctx.fill();
  }

  if (isPlayer) {
    ctx.strokeStyle = 'rgba(176, 209, 208, 0.62)';
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.moveTo(8, 24);
    ctx.quadraticCurveTo(16, 22, 24, 24);
    ctx.stroke();
  }

  ctx.restore();

  const tireGradient = ctx.createLinearGradient(0, 0, 0, 10);
  tireGradient.addColorStop(0, '#353b3b');
  tireGradient.addColorStop(0.45, '#080d0f');
  tireGradient.addColorStop(1, '#242a2b');
  ctx.fillStyle = tireGradient;
  for (const wheelY of [11, 32]) {
    ctx.beginPath();
    ctx.roundRect(0.5, wheelY, 4.2, 8, 1.5);
    ctx.roundRect(27.3, wheelY, 4.2, 8, 1.5);
    ctx.fill();
    ctx.fillStyle = '#89908b';
    ctx.fillRect(1.9, wheelY + 2, 1.4, 4);
    ctx.fillRect(28.7, wheelY + 2, 1.4, 4);
    ctx.fillStyle = tireGradient;
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.moveTo(4.7, 11.5);
  ctx.quadraticCurveTo(3.5, 15, 4.6, 19);
  ctx.moveTo(27.3, 11.5);
  ctx.quadraticCurveTo(28.5, 15, 27.4, 19);
  ctx.moveTo(4.6, 32);
  ctx.quadraticCurveTo(3.4, 36, 5.4, 39);
  ctx.moveTo(27.4, 32);
  ctx.quadraticCurveTo(28.6, 36, 26.6, 39);
  ctx.stroke();

  ctx.strokeStyle = isPlayer ? 'rgba(255, 157, 132, 0.88)' : 'rgba(255, 255, 255, 0.64)';
  ctx.lineWidth = 0.65;
  ctx.beginPath();
  ctx.moveTo(7, 10);
  ctx.quadraticCurveTo(5, 19, 6, 31);
  ctx.moveTo(25, 10);
  ctx.quadraticCurveTo(27, 19, 26, 31);
  ctx.stroke();

  if (isPlayer) {
    ctx.strokeStyle = 'rgba(105, 19, 28, 0.9)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(9, 33);
    ctx.quadraticCurveTo(16, 35, 23, 33);
    ctx.stroke();

    const tailLight = ctx.createLinearGradient(0, 38, 0, 42);
    tailLight.addColorStop(0, '#ffb096');
    tailLight.addColorStop(0.4, '#ff4037');
    tailLight.addColorStop(1, '#7d101b');
    ctx.fillStyle = tailLight;
    ctx.beginPath();
    ctx.roundRect(4, 38, 10, 3, 1.2);
    ctx.roundRect(18, 38, 10, 3, 1.2);
    ctx.fill();
    ctx.fillStyle = '#d8cbb1';
    ctx.fillRect(14.5, 38.5, 3, 2);
    const bumper = ctx.createLinearGradient(0, 40, 0, 45);
    bumper.addColorStop(0, '#772129');
    bumper.addColorStop(0.5, '#371a1e');
    bumper.addColorStop(1, '#111819');
    ctx.fillStyle = bumper;
    ctx.beginPath();
    ctx.moveTo(4, 41);
    ctx.quadraticCurveTo(16, 44, 28, 41);
    ctx.lineTo(27, 44);
    ctx.quadraticCurveTo(16, 47, 5, 44);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#a9aaa0';
    ctx.fillRect(12, 42.2, 8, 1.7);
    ctx.fillStyle = '#090e10';
    ctx.fillRect(9, 44, 4, 1.6);
    ctx.fillRect(19, 44, 4, 1.6);

    ctx.fillStyle = '#802329';
    ctx.beginPath();
    ctx.ellipse(16, 7, 1, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 213, 183, 0.82)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(16, 4);
    ctx.lineTo(16, 11);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 213, 191, 0.42)';
    ctx.beginPath();
    ctx.ellipse(11, 7, 3.5, 1, -0.35, 0, Math.PI * 2);
    ctx.ellipse(21, 7, 3.5, 1, 0.35, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#f24842';
    ctx.beginPath();
    ctx.roundRect(4, 39, 8, 2.5, 1);
    ctx.roundRect(20, 39, 8, 2.5, 1);
    ctx.fill();
    ctx.fillStyle = '#f1e4ca';
    ctx.fillRect(13, 39, 6, 1.8);
    ctx.fillStyle = '#252c2d';
    ctx.fillRect(7, 42, 18, 2);
  }

  ctx.restore();
}

function shadeColor(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = Math.max(0, Math.min(255, (value >> 16) + amount));
  const green = Math.max(0, Math.min(255, ((value >> 8) & 0xff) + amount));
  const blue = Math.max(0, Math.min(255, (value & 0xff) + amount));
  return `rgb(${red}, ${green}, ${blue})`;
}

function createUtopiaSprite() {                                         //auto player
  const sprite = document.createElement('canvas');
  sprite.width = 28;
  sprite.height = 44;
  const pixel = sprite.getContext('2d');
  pixel.imageSmoothingEnabled = false;

  const spans = [
    null, null, [11, 16], [9, 18], [7, 20], [6, 21], [5, 22], [4, 23],
    [3, 24], [2, 25], [2, 25], [1, 26], [1, 26], [1, 26], [1, 26],
    [1, 26], [1, 26], [1, 26], [2, 25], [3, 24], [4, 23], [4, 23],
    [4, 23], [4, 23], [4, 23], [4, 23], [4, 23], [4, 23], [4, 23],
    [4, 23], [3, 24], [2, 25], [1, 26], [1, 26], [1, 26], [1, 26],
    [1, 26], [2, 25], [2, 25], [3, 24], [4, 23], [5, 22], [6, 21],
    [7, 20], [8, 19], [9, 18],
  ];

  function block(x, y, color, width = 1, height = 1) {
    pixel.fillStyle = color;
    pixel.fillRect(x, y, width, height);
  }

  function silhouette(color, offsetY = 0) {
    spans.forEach((span, y) => {
      if (!span) return;
      block(span[0], y + offsetY, color, span[1] - span[0] + 1);
    });
  }

  pixel.fillStyle = 'rgba(5, 8, 9, 0.75)';
  pixel.fillRect(3, 8, 22, 31);
  pixel.fillRect(5, 4, 18, 38);

  for (const wheelY of [12, 29]) {
    block(0, wheelY, '#101416', 5, 7);
    block(1, wheelY + 1, '#32383a', 2, 5);
    block(2, wheelY + 2, '#969b98', 1, 3);
    block(23, wheelY, '#101416', 5, 7);
    block(25, wheelY + 1, '#32383a', 2, 5);
    block(25, wheelY + 2, '#969b98', 1, 3);
    block(0, wheelY + 2, '#080b0c', 1, 3);
    block(27, wheelY + 2, '#080b0c', 1, 3);
  }

  silhouette('#303538', 1);
  spans.forEach((span, y) => {
    if (!span) return;
    for (let x = span[0]; x <= span[1]; x += 1) {
      let color = '#777d80';
      if (x === span[0] || x === span[1]) color = '#454b4e';
      else if (x <= 4 || x >= 23) color = '#a2a7a8';
      else if (x >= 8 && x <= 19) color = '#8b9193';
      if (y < 5) color = x < 13 ? '#aeb2b2' : '#858b8d';
      if (y > 35) color = x < 13 ? '#646a6d' : '#4d5356';
      block(x, y, color);
    }
  });

  // The long central bonnet ridge and paired highlights give the silver body a Utopia-like top view.
  block(13, 4, '#d1d3d1', 2, 6);
  block(12, 5, '#aeb2b2', 1, 5);
  block(15, 5, '#73797c', 1, 6);
  block(8, 7, '#c0c4c3', 2, 1);
  block(18, 7, '#aeb3b3', 2, 1);
  block(6, 8, '#c8cbca', 2, 1);
  block(20, 8, '#b5b9b9', 2, 1);
  block(4, 9, '#d4d6d2', 3, 1);
  block(21, 9, '#bec2c0', 3, 1);

  // Cockpit glazing and central spine.
  block(8, 12, '#243238', 12, 1);
  block(7, 13, '#1d2a30', 14, 1);
  block(6, 14, '#25383f', 16, 3);
  block(7, 17, '#19272c', 14, 1);
  block(8, 18, '#56696d', 12, 1);
  block(9, 13, '#8a9b9c', 2, 1);
  block(10, 14, '#667c80', 3, 1);
  block(13, 12, '#c6c8c5', 2, 7);
  block(14, 14, '#899194', 1, 4);
  block(8, 19, '#454c4f', 12, 1);

  // Pagani's exposed roof spine and rear engine window.
  block(10, 21, '#596164', 8, 1);
  block(9, 22, '#343c3f', 10, 1);
  block(8, 23, '#272f32', 12, 4);
  block(9, 27, '#30383b', 10, 1);
  block(10, 24, '#697276', 2, 2);
  block(12, 24, '#4a5357', 4, 2);
  block(16, 24, '#697276', 2, 2);
  block(11, 28, '#bdc1bf', 6, 1);
  block(13, 20, '#d1d3d1', 2, 8);

  // Flared fenders and bright front lamps.
  block(2, 11, '#c3c6c4', 2, 5);
  block(24, 11, '#aeb3b3', 2, 5);
  block(2, 26, '#aeb3b3', 2, 4);
  block(24, 26, '#c3c6c4', 2, 4);
  block(4, 4, '#f4e7c9', 3, 1);
  block(21, 4, '#f4e7c9', 3, 1);
  block(5, 5, '#e0d1af', 2, 1);
  block(21, 5, '#e0d1af', 2, 1);
  block(8, 2, '#545a5c', 3, 1);
  block(17, 2, '#454b4e', 3, 1);

  // Tail, four central exhaust outlets, and diffuser.
  block(3, 35, '#494f52', 4, 1);
  block(21, 35, '#494f52', 4, 1);
  block(3, 36, '#d64742', 4, 1);
  block(21, 36, '#d64742', 4, 1);
  block(4, 37, '#f08071', 3, 1);
  block(21, 37, '#f08071', 3, 1);
  block(7, 38, '#373d40', 14, 2);
  block(9, 39, '#c1c1bb', 2, 2);
  block(12, 39, '#c1c1bb', 2, 2);
  block(15, 39, '#c1c1bb', 2, 2);
  block(18, 39, '#c1c1bb', 2, 2);
  block(10, 40, '#171c1e', 1, 1);
  block(13, 40, '#171c1e', 1, 1);
  block(16, 40, '#171c1e', 1, 1);
  block(19, 40, '#171c1e', 1, 1);
  block(8, 42, '#242a2c', 12, 1);

  return sprite;
}

function createTrafficSprite(modelId) {
  const sprite = document.createElement('canvas');
  sprite.width = modelId === 'car-carrier' ? 48 : 32;
  sprite.height = modelId === 'car-carrier' ? 88 : 52;
  const pixel = sprite.getContext('2d');
  pixel.imageSmoothingEnabled = false;

  function block(x, y, color, width = 1, height = 1) {
    pixel.fillStyle = color;
    pixel.fillRect(x, y, width, height);
  }

  if (modelId === 'car-carrier') {
    // One long trailer carrying a red and a black sports car.
    block(3, 26, '#111619', 42, 60);
    block(5, 28, '#697174', 38, 56);
    block(7, 30, '#a9ada8', 34, 51);
    block(2, 31, '#171b1d', 3, 8);
    block(43, 31, '#171b1d', 3, 8);
    block(2, 69, '#171b1d', 3, 8);
    block(43, 69, '#171b1d', 3, 8);
    block(22, 25, '#e2b54b', 4, 5);

    for (const [x, body, light, dark] of [
      [7, '#d8322e', '#ff8980', '#681b1d'],
      [25, '#202528', '#777e80', '#090d10'],
    ]) {
      block(x, 34, '#0a0d0e', 15, 3);
      block(x, 37, dark, 15, 36);
      block(x + 1, 39, body, 13, 31);
      block(x + 2, 40, light, 3, 5);
      block(x + 10, 40, '#101619', 3, 8);
      block(x + 3, 49, '#18242a', 9, 7);
      block(x + 2, 58, body, 11, 7);
      block(x + 1, 69, '#e14b43', 3, 2);
      block(x + 12, 69, '#e14b43', 3, 2);
      block(x - 1, 43, '#090c0d', 2, 8);
      block(x + 14, 43, '#090c0d', 2, 8);
      block(x - 1, 62, '#090c0d', 2, 7);
      block(x + 14, 62, '#090c0d', 2, 7);
    }

    block(8, 5, '#111619', 32, 22);
    block(6, 10, '#1b2225', 36, 15);
    block(9, 3, '#353d40', 30, 5);
    block(11, 7, '#80b5c3', 26, 5);
    block(13, 8, '#c1d9d7', 8, 2);
    block(5, 13, '#d6d8d2', 3, 4);
    block(40, 13, '#d6d8d2', 3, 4);
    block(10, 17, '#b82727', 28, 8);
    block(8, 24, '#121719', 32, 3);
    block(4, 18, '#080b0d', 4, 8);
    block(40, 18, '#080b0d', 4, 8);
    return sprite;
  }

  if (modelId === 'ninja-bike' || modelId === 'harley-bike') {
    const isHarley = modelId === 'harley-bike';
    const body = isHarley ? '#e7e5dc' : '#171d1e';
    const accent = isHarley ? '#c8c8c0' : '#65c832';

    block(14, 1, '#080b0d', 4, 9);
    block(13, 2, '#52585a', 6, 5);
    block(14, 42, '#080b0d', 4, 9);
    block(13, 44, '#52585a', 6, 4);
    block(8, 9, '#151a1c', 16, 2);
    block(6, 8, '#aeb6b2', 5, 2);
    block(21, 8, '#aeb6b2', 5, 2);
    block(12, 10, body, 8, 30);
    block(10, 14, accent, 12, isHarley ? 11 : 17);
    block(12, 13, '#171c1e', 8, 7);
    block(13, 21, isHarley ? '#171c1e' : '#070a0b', 6, 10);
    block(11, 31, body, 10, 6);
    block(13, 37, '#343a3b', 6, 5);

    if (isHarley) {
      block(8, 18, '#d4d2ca', 5, 10);
      block(19, 18, '#d4d2ca', 5, 10);
      block(10, 29, '#101416', 12, 5);
      block(11, 33, '#f4f1e7', 10, 7);
      block(11, 33, '#29487c', 4, 3);
      for (const stripeY of [33, 35, 37, 39]) {
        block(15, stripeY, '#bd3434', 6, 1);
        block(11, stripeY + 1, '#bd3434', 10, 1);
      }
      block(11, 40, '#f4f1e7', 10, 1);
      block(14, 40, '#f5d26d', 4, 2);
      block(11, 11, '#9a9b96', 10, 3);
    } else {
      block(10, 15, '#101617', 3, 14);
      block(19, 15, '#101617', 3, 14);
      block(11, 29, '#292f30', 10, 5);
      block(11, 34, '#65c832', 10, 3);
      block(13, 4, '#91ed55', 6, 2);
      block(12, 10, '#a8f36b', 8, 2);
    }

    block(14, 1, '#e7e2d0', 4, 2);
    block(14, 49, '#e9473e', 4, 2);
    return sprite;
  }

  const isSvj = modelId === 'svj';
  const spans = isSvj ? [
    [5, 26], [4, 27], [3, 28], [2, 29], [2, 29], [1, 30],
    [1, 30], [1, 30], [1, 30], [1, 30], [1, 30], [1, 30],
    [1, 30], [1, 30], [1, 30], [2, 29], [2, 29], [3, 28],
    [3, 28], [4, 27], [4, 27], [5, 26], [5, 26], [5, 26],
    [5, 26], [5, 26], [5, 26], [5, 26], [5, 26], [5, 26],
    [5, 26], [4, 27], [3, 28], [2, 29], [1, 30], [1, 30],
    [1, 30], [1, 30], [1, 30], [1, 30], [2, 29], [2, 29],
    [3, 28], [4, 27], [5, 26], [6, 25], [6, 25], [5, 26],
    [5, 26], [5, 26], [6, 25], [7, 24],
  ] : [
    [6, 25], [4, 27], [3, 28], [2, 29], [2, 29], [1, 30],
    [2, 29], [1, 30], [1, 30], [1, 30], [1, 30], [1, 30],
    [1, 30], [1, 30], [1, 30], [1, 30], [1, 30], [2, 29],
    [2, 29], [3, 28], [3, 28], [4, 27], [4, 27], [5, 26],
    [5, 26], [5, 26], [5, 26], [5, 26], [5, 26], [5, 26],
    [5, 26], [4, 27], [3, 28], [2, 29], [2, 29], [2, 29],
    [2, 29], [2, 29], [2, 29], [2, 29], [3, 28], [3, 28],
    [4, 27], [5, 26], [6, 25], [6, 25], [5, 26], [5, 26],
    [5, 26], [6, 25], [7, 24], [8, 23],
  ];

  const body = isSvj ? '#e5c521' : '#102c58';
  const bodyLight = isSvj ? '#fff080' : '#62c6ed';
  const bodyMid = isSvj ? '#d7ad12' : '#246aa0';
  const bodyDark = isSvj ? '#695313' : '#09172c';

  for (const axleY of [12, 34]) {
    block(0, axleY, '#0b0f12', 6, 8);
    block(1, axleY + 1, '#343a3c', 3, 6);
    block(2, axleY + 2, '#8b918e', 1, 4);
    block(26, axleY, '#0b0f12', 6, 8);
    block(28, axleY + 1, '#343a3c', 3, 6);
    block(29, axleY + 2, '#8b918e', 1, 4);
  }

  spans.forEach(([left, right], y) => {
    for (let x = left; x <= right; x += 1) {
      const edge = x === left || x === right;
      let color = bodyMid;
      if (edge) color = bodyDark;
      else if (x <= left + 2) color = bodyLight;
      else if (x >= right - 2) color = bodyDark;
      else if (y < 6) color = bodyLight;
      else if (y > 43) color = bodyDark;
      block(x, y, color);
    }
  });

  // Hood highlights and signature front lamps.
  block(14, 3, bodyLight, 4, 5);
  block(11, 7, bodyLight, 3, 1);
  block(18, 7, bodyLight, 3, 1);
  block(7, 9, bodyLight, 4, 1);
  block(21, 9, bodyLight, 4, 1);
  block(5, 10, '#fff0bd', 3, 1);
  block(24, 10, '#fff0bd', 3, 1);

  // Windshield, roof, and rear glass are kept blocky for a strong top-down read.
  block(9, 13, '#121e27', 14, 1);
  block(7, 14, '#1a303c', 18, 1);
  block(6, 15, '#284956', 20, 3);
  block(7, 18, '#1a2c35', 18, 1);
  block(10, 15, '#9ac4c5', 4, 1);
  block(13, 14, bodyLight, 2, 6);
  block(10, 21, '#26383f', 12, 1);
  block(8, 22, '#17262d', 16, 1);
  block(7, 23, '#111c24', 18, 5);
  block(8, 28, '#26343a', 16, 1);
  block(10, 24, '#66777a', 3, 2);
  block(19, 24, '#66777a', 3, 2);

  if (isSvj) {
    // SVJ bonnet graphics, dark canopy, and broad rear wing.
    block(9, 5, '#17191a', 14, 2);
    block(7, 8, '#242627', 4, 2);
    block(21, 8, '#242627', 4, 2);
    block(9, 15, '#17191a', 14, 8);
    block(11, 23, '#242627', 10, 1);
    block(6, 11, '#202224', 5, 2);
    block(21, 11, '#202224', 5, 2);
    block(8, 31, '#171a1b', 16, 4);
    block(4, 45, '#151819', 24, 2);
    block(2, 44, '#262a2b', 4, 4);
    block(26, 44, '#262a2b', 4, 4);
    block(7, 46, '#9a801c', 18, 1);
  } else {
    // Chiron Pur Sport: twin blue stripes, curved side accents, and horseshoe grille.
    block(10, 4, bodyLight, 3, 10);
    block(19, 4, bodyLight, 3, 10);
    block(6, 16, bodyLight, 2, 1);
    block(5, 17, bodyLight, 2, 5);
    block(6, 22, bodyLight, 3, 1);
    block(24, 16, bodyLight, 2, 1);
    block(25, 17, bodyLight, 2, 5);
    block(23, 22, bodyLight, 3, 1);
    block(11, 20, bodyLight, 2, 9);
    block(19, 20, bodyLight, 2, 9);
    block(10, 30, '#0a1a31', 12, 6);
    block(12, 31, '#59b9df', 8, 1);
    block(11, 32, '#307ca7', 10, 2);
    block(8, 44, '#071426', 16, 2);
  }

  // Rear lamps, diffuser, and tail details.
  block(4, 39, '#441a1d', 6, 1);
  block(22, 39, '#441a1d', 6, 1);
  block(4, 40, '#ff4b43', 6, 2);
  block(22, 40, '#ff4b43', 6, 2);
  block(7, 43, '#15191a', 18, 2);
  block(11, 44, '#b5b5aa', 2, 1);
  block(19, 44, '#b5b5aa', 2, 1);

  return sprite;
}

function drawPixelatedUtopia(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(player.steer * -0.045);
  if ((invulnerableTime > 0 || startInvulnerable) && Math.floor(performance.now() / 75) % 2 === 0) {
    ctx.globalAlpha = 0.52;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.shadowColor = 'rgba(4, 7, 8, 0.72)';
  ctx.shadowBlur = 7;
  ctx.shadowOffsetY = 5;
  ctx.drawImage(utopiaSprite, -PLAYER_WIDTH / 2, -PLAYER_HEIGHT / 2, PLAYER_WIDTH, PLAYER_HEIGHT);
  ctx.restore();
}

function drawTopDownCar(x, y, width, height, color, style, isPlayer = false) {
  ctx.save();
  ctx.translate(x - width / 2, y - height / 2);
  ctx.scale(width / 110, height / 180);

  if (isPlayer) {
    ctx.translate(50, 90);
    ctx.rotate(player.steer * -0.045);
    ctx.translate(-50, -90);
  }

  const bodyPath = () => {
    ctx.beginPath();
    if (style === 'wedge') {
      ctx.moveTo(50, 3);
      ctx.lineTo(66, 16);
      ctx.lineTo(77, 32);
      ctx.lineTo(88, 56);
      ctx.lineTo(96, 91);
      ctx.lineTo(92, 125);
      ctx.lineTo(86, 151);
      ctx.lineTo(76, 170);
      ctx.lineTo(63, 176);
      ctx.lineTo(37, 176);
      ctx.lineTo(24, 170);
      ctx.lineTo(14, 151);
      ctx.lineTo(8, 125);
      ctx.lineTo(4, 91);
      ctx.lineTo(12, 56);
      ctx.lineTo(23, 32);
      ctx.lineTo(34, 16);
    } else if (style === 'round') {
      ctx.moveTo(50, 3);
      ctx.bezierCurveTo(34, 3, 24, 13, 18, 31);
      ctx.bezierCurveTo(9, 54, 8, 94, 11, 130);
      ctx.bezierCurveTo(13, 158, 25, 175, 50, 177);
      ctx.bezierCurveTo(75, 175, 87, 158, 89, 130);
      ctx.bezierCurveTo(92, 94, 91, 54, 82, 31);
      ctx.bezierCurveTo(76, 13, 66, 3, 50, 3);
    } else if (style === 'mclaren') {
      ctx.moveTo(50, 2);
      ctx.bezierCurveTo(41, 3, 35, 13, 30, 24);
      ctx.bezierCurveTo(20, 44, 15, 72, 14, 104);
      ctx.lineTo(12, 137);
      ctx.bezierCurveTo(12, 162, 27, 176, 50, 177);
      ctx.bezierCurveTo(73, 176, 88, 162, 88, 137);
      ctx.lineTo(86, 104);
      ctx.bezierCurveTo(85, 72, 80, 44, 70, 24);
      ctx.bezierCurveTo(65, 13, 59, 3, 50, 2);
    } else {
      ctx.moveTo(50, 2);
      ctx.bezierCurveTo(40, 3, 34, 11, 27, 21);
      ctx.bezierCurveTo(17, 35, 12, 56, 10, 88);
      ctx.lineTo(7, 129);
      ctx.bezierCurveTo(6, 154, 17, 172, 34, 176);
      ctx.quadraticCurveTo(50, 180, 66, 176);
      ctx.bezierCurveTo(83, 172, 94, 154, 93, 129);
      ctx.lineTo(90, 88);
      ctx.bezierCurveTo(88, 56, 83, 35, 73, 21);
      ctx.bezierCurveTo(66, 11, 60, 3, 50, 2);
    }
    ctx.closePath();
  };

  const paint = isPlayer ? '#d82d31' : color;

  ctx.save();
  ctx.shadowColor = 'rgba(8, 11, 12, 0.66)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 9;
  ctx.fillStyle = '#111719';
  ctx.beginPath();
  ctx.ellipse(50, 91, 45, 84, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const tire = ctx.createLinearGradient(0, 0, 100, 0);
  tire.addColorStop(0, '#090d0f');
  tire.addColorStop(0.25, '#343a3b');
  tire.addColorStop(0.5, '#101516');
  tire.addColorStop(0.8, '#343a3b');
  tire.addColorStop(1, '#090d0f');
  ctx.fillStyle = tire;
  for (const axleY of [42, 120]) {
    for (const side of [0, 1]) {
      const tireX = side === 0 ? 5 : 79;
      ctx.beginPath();
      ctx.roundRect(tireX, axleY, 16, 31, 5);
      ctx.fill();

      const rim = ctx.createLinearGradient(tireX, axleY, tireX + 16, axleY);
      rim.addColorStop(0, '#686f6b');
      rim.addColorStop(0.42, '#d5d1c6');
      rim.addColorStop(0.7, '#858b85');
      rim.addColorStop(1, '#3c4443');
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.roundRect(tireX + 4, axleY + 4, 8, 23, 3);
      ctx.fill();
      ctx.fillStyle = tire;
    }
  }

  ctx.save();
  ctx.translate(0, 3);
  bodyPath();
  ctx.fillStyle = isPlayer ? '#60181e' : shadeColor(paint, -60);
  ctx.fill();
  ctx.restore();

  bodyPath();
  const shell = ctx.createLinearGradient(3, 0, 97, 0);
  shell.addColorStop(0, isPlayer ? '#6f171f' : shadeColor(paint, -68));
  shell.addColorStop(0.12, isPlayer ? '#b51f2b' : shadeColor(paint, -32));
  shell.addColorStop(0.3, isPlayer ? '#f04a43' : shadeColor(paint, 10));
  shell.addColorStop(0.48, isPlayer ? '#ff7560' : shadeColor(paint, 38));
  shell.addColorStop(0.65, isPlayer ? '#db3035' : paint);
  shell.addColorStop(0.88, isPlayer ? '#a91d28' : shadeColor(paint, -28));
  shell.addColorStop(1, isPlayer ? '#55151c' : shadeColor(paint, -68));
  ctx.fillStyle = shell;
  ctx.fill();
  ctx.strokeStyle = isPlayer ? 'rgba(255, 190, 165, 0.9)' : 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.save();
  bodyPath();
  ctx.clip();

  const bodyDepth = ctx.createLinearGradient(0, 0, 0, 180);
  bodyDepth.addColorStop(0, 'rgba(255,255,255,0.19)');
  bodyDepth.addColorStop(0.2, 'rgba(255,255,255,0.04)');
  bodyDepth.addColorStop(0.72, 'rgba(15,10,12,0.03)');
  bodyDepth.addColorStop(1, 'rgba(5,8,9,0.39)');
  ctx.fillStyle = bodyDepth;
  ctx.fillRect(0, 0, 100, 180);

  const reflection = ctx.createLinearGradient(18, 0, 70, 0);
  reflection.addColorStop(0, 'rgba(255,255,255,0)');
  reflection.addColorStop(0.42, isPlayer ? 'rgba(255,230,213,0.28)' : 'rgba(255,255,255,0.22)');
  reflection.addColorStop(0.55, 'rgba(255,255,255,0.07)');
  reflection.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = reflection;
  ctx.fillRect(15, 4, 70, 164);

  ctx.strokeStyle = isPlayer ? 'rgba(255, 204, 180, 0.78)' : 'rgba(255, 255, 255, 0.56)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(24, 26);
  ctx.bezierCurveTo(18, 54, 20, 94, 24, 137);
  ctx.moveTo(76, 26);
  ctx.bezierCurveTo(82, 54, 80, 94, 76, 137);
  ctx.stroke();

  if (style === 'wedge') {
    ctx.fillStyle = 'rgba(25, 29, 31, 0.68)';
    ctx.beginPath();
    ctx.moveTo(16, 51);
    ctx.lineTo(35, 45);
    ctx.lineTo(50, 67);
    ctx.lineTo(65, 45);
    ctx.lineTo(84, 51);
    ctx.lineTo(77, 65);
    ctx.lineTo(50, 76);
    ctx.lineTo(23, 65);
    ctx.closePath();
    ctx.fill();
  }

  const windshield = ctx.createLinearGradient(0, 31, 0, 82);
  windshield.addColorStop(0, '#1a292f');
  windshield.addColorStop(0.18, '#718b91');
  windshield.addColorStop(0.36, '#304a52');
  windshield.addColorStop(0.7, '#1a3038');
  windshield.addColorStop(1, '#111d22');
  ctx.fillStyle = windshield;
  ctx.beginPath();
  if (style === 'wedge') {
    ctx.moveTo(27, 48);
    ctx.lineTo(39, 41);
    ctx.quadraticCurveTo(50, 37, 61, 41);
    ctx.lineTo(73, 48);
    ctx.lineTo(67, 68);
    ctx.lineTo(50, 75);
    ctx.lineTo(33, 68);
  } else if (style === 'round') {
    ctx.moveTo(31, 43);
    ctx.quadraticCurveTo(50, 34, 69, 43);
    ctx.quadraticCurveTo(78, 52, 72, 70);
    ctx.quadraticCurveTo(50, 79, 28, 70);
    ctx.quadraticCurveTo(22, 52, 31, 43);
  } else {
    ctx.moveTo(29, 46);
    ctx.quadraticCurveTo(50, 35, 71, 46);
    ctx.lineTo(67, 70);
    ctx.quadraticCurveTo(50, 78, 33, 70);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(207, 235, 234, 0.82)';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.fillStyle = 'rgba(232, 247, 240, 0.54)';
  ctx.beginPath();
  ctx.moveTo(34, 46);
  ctx.quadraticCurveTo(47, 39, 60, 44);
  ctx.lineTo(53, 48);
  ctx.quadraticCurveTo(43, 47, 35, 53);
  ctx.closePath();
  ctx.fill();

  const roofStyle = style === 'wedge' ? 'rgba(10, 16, 19, 0.55)' : 'rgba(18, 26, 29, 0.55)';
  ctx.fillStyle = roofStyle;
  ctx.beginPath();
  ctx.moveTo(34, 83);
  ctx.quadraticCurveTo(50, 77, 66, 83);
  ctx.lineTo(68, 108);
  ctx.quadraticCurveTo(50, 116, 32, 108);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(205, 231, 227, 0.55)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  const rearGlass = ctx.createLinearGradient(0, 109, 0, 137);
  rearGlass.addColorStop(0, '#182b31');
  rearGlass.addColorStop(0.5, '#50676a');
  rearGlass.addColorStop(1, '#17252a');
  ctx.fillStyle = rearGlass;
  ctx.beginPath();
  ctx.moveTo(32, 111);
  ctx.quadraticCurveTo(50, 117, 68, 111);
  ctx.lineTo(73, 132);
  ctx.quadraticCurveTo(50, 141, 27, 132);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(203, 226, 220, 0.56)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(241, 249, 238, 0.28)';
  ctx.beginPath();
  ctx.moveTo(34, 115);
  ctx.quadraticCurveTo(50, 120, 66, 115);
  ctx.lineTo(62, 120);
  ctx.quadraticCurveTo(49, 124, 37, 120);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  if (isPlayer) {
    ctx.strokeStyle = 'rgba(97, 18, 26, 0.85)';
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    ctx.moveTo(29, 141);
    ctx.quadraticCurveTo(50, 147, 71, 141);
    ctx.stroke();

    const tailGlow = ctx.createRadialGradient(50, 151, 4, 50, 151, 34);
    tailGlow.addColorStop(0, 'rgba(255,65,48,0.26)');
    tailGlow.addColorStop(1, 'rgba(255,65,48,0)');
    ctx.fillStyle = tailGlow;
    ctx.fillRect(10, 133, 80, 38);

    const tailLight = ctx.createLinearGradient(0, 146, 0, 155);
    tailLight.addColorStop(0, '#ffe0ca');
    tailLight.addColorStop(0.27, '#ff5142');
    tailLight.addColorStop(1, '#9a1721');
    ctx.fillStyle = tailLight;
    ctx.beginPath();
    ctx.roundRect(15, 146, 27, 6, 3);
    ctx.roundRect(58, 146, 27, 6, 3);
    ctx.fill();

    const exhaust = ctx.createRadialGradient(50, 159, 1, 50, 159, 9);
    exhaust.addColorStop(0, '#e6e0d3');
    exhaust.addColorStop(0.35, '#7b7b73');
    exhaust.addColorStop(1, '#191e20');
    ctx.fillStyle = exhaust;
    for (const [exhaustX, exhaustY] of [[43, 158], [57, 158], [43, 168], [57, 168]]) {
      ctx.beginPath();
      ctx.arc(exhaustX, exhaustY, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111719';
      ctx.beginPath();
      ctx.arc(exhaustX, exhaustY, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = exhaust;
    }

    ctx.strokeStyle = 'rgba(255, 220, 191, 0.82)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(17, 18);
    ctx.bezierCurveTo(12, 28, 9, 38, 8, 52);
    ctx.moveTo(83, 18);
    ctx.bezierCurveTo(88, 28, 91, 38, 92, 52);
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(16, 22, 23, 0.88)';
    ctx.beginPath();
    ctx.roundRect(18, 145, 64, 7, 3);
    ctx.fill();
    ctx.fillStyle = '#f44740';
    ctx.beginPath();
    ctx.roundRect(16, 140, 22, 5, 2);
    ctx.roundRect(62, 140, 22, 5, 2);
    ctx.fill();
    ctx.fillStyle = '#fff0dc';
    ctx.fillRect(44, 143, 12, 3);
    if (style === 'utopia') {
      const exhaust = ctx.createRadialGradient(50, 157, 1, 50, 157, 8);
      exhaust.addColorStop(0, '#d6d2c7');
      exhaust.addColorStop(0.45, '#737871');
      exhaust.addColorStop(1, '#161b1c');
      ctx.fillStyle = exhaust;
      for (const [exhaustX, exhaustY] of [[44, 157], [56, 157], [44, 167], [56, 167]]) {
        ctx.beginPath();
        ctx.arc(exhaustX, exhaustY, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#101516';
        ctx.beginPath();
        ctx.arc(exhaustX, exhaustY, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = exhaust;
      }
    }
  }

  ctx.restore();
}

function drawTraffic() {
  for (const car of traffic) {
    const x = laneCenter(car.lanePosition ?? car.lane, car.y);
    const width = car.renderWidth;
    const height = car.renderHeight;
    ctx.save();
    ctx.translate(x, car.y);
    if (car.direction === 'oncoming') {
      ctx.rotate(Math.PI);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.shadowColor = 'rgba(4, 7, 8, 0.72)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 4;
    ctx.drawImage(trafficSprites.get(car.id), -width / 2, -height / 2, width, height);
    ctx.restore();
  }
}

function draw() {
  drawScenery();
  drawRoad();
  drawRoadSigns();
  drawTraffic();
  drawPixelatedUtopia(player.x, player.y);
}

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTimestamp) / 1000 || 0.016, 0.04);
  lastTimestamp = timestamp;
  updateGame(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

function setSteering(direction, pressed) {
  keys[direction] = pressed;
}

window.addEventListener('keydown', (event) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) {
    event.preventDefault();
  }
  if (/^[1-6]$/.test(event.key)) {
    selectGear(Number(event.key));
  } else if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
    setSteering('left', true);
  } else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
    setSteering('right', true);
  } else if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') {
    keys.accelerate = true;
    if (gameState !== 'playing') {
      startGame();
    }
  } else if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') {
    keys.brake = true;
  }
});

window.addEventListener('keyup', (event) => {
  if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
    setSteering('left', false);
  } else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
    setSteering('right', false);
  } else if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') {
    keys.accelerate = false;
  } else if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') {
    keys.brake = false;
  }
});

window.addEventListener('blur', () => {
  keys.left = false;
  keys.right = false;
  keys.accelerate = false;
  keys.brake = false;
});

for (const [id, direction] of [['steer-left', 'left'], ['steer-right', 'right']]) {
  const button = document.getElementById(id);
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    setSteering(direction, true);
  });
  button.addEventListener('pointerup', () => setSteering(direction, false));
  button.addEventListener('pointercancel', () => setSteering(direction, false));
  button.addEventListener('lostpointercapture', () => setSteering(direction, false));
}

startBtn.addEventListener('click', startGame);
gearButtons.forEach((button) => {
  button.addEventListener('click', () => selectGear(Number(button.dataset.gear)));
});

bestScoreEl.textContent = formatDistance(bestDistance);
resetGame();
startBtn.disabled = true;
requestAnimationFrame(gameLoop);
