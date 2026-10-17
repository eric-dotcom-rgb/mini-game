const canvas = document.getElementById('canvas');                      //pagina principale
const ctx = canvas.getContext('2d');
const playlist = ['Wanden, Slashtaq - Full Speed Ahead [NCS Release].mp3', 'Fareoh - Under Water [NCS Release].mp3', 'Cepaque - Alone Tonight [NCS Release].mp3']      //playlist di sottofondo
let   currentTrackIndex = 0;                                    //partenza playlist
let   soundtrack = new Audio(playlist[currentTrackIndex]);
      soundtrack.volume = 0.4;
      soundtrack.addEventListener('ended', () =>{    //skip automatico
        currentTrackIndex++;
        if (currentTrackIndex >= playlist.length) {      //quando finisce, ricomincia
          currentTrackIndex = 0;
        }
      soundtrack.src = playlist[currentTrackIndex];
      startSoundtrack();
      });
const lancettarpm = document.getElementById('lancettarpm');
const lancettakmh = document.getElementById('lancettakmh');
const marciainnestata = document.getElementById('marciainnestata');
const startPrompt = document.getElementById('promptAvvio');
const promptTitle = document.getElementById('titoloPrompt');
const promptText = document.getElementById('testoPrompt');
const soundtrackButton = document.getElementById('controlloMusica');
const gearButtons = document.querySelectorAll('[data-gear]');
const oilTemperatureEl = document.getElementById('tempOlio');
const coolantTemperatureEl = document.getElementById('tempAcqua');
const distanceEl = document.getElementById('distanzaAttuale');
const bestDistanceEl = document.getElementById('distanzaRecord');
const livesEl = document.getElementById('vite');
const lifeHearts = livesEl.querySelectorAll('img');

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
const PLAYER_WIDTH = 80;
const PLAYER_HEIGHT = 120;
const STARTING_LIVES = 3;
const COLLISION_COOLDOWN = 1.15;

const TRAFFIC_MODELS = [                                                         //auto del traffico in lista con le loro caratteristiche
  { id: 'svj', name: 'SVJ', sprite: 'lamborghini.png', renderWidth: 80, renderHeight: 120 },
  { id: 'chiron', name: 'Chiron Pur Sport', sprite: 'bugatti.png', renderWidth: PLAYER_WIDTH, renderHeight: PLAYER_HEIGHT },
  { id: 'camion', name: 'Car carrier', color: '#b82727', sprite: 'camion.png', renderWidth: 80, renderHeight: 170 },
  { id: 'ninja-bike', name: 'Green H2R', color: '#58bd32', sprite: 'ninjah2.png', renderWidth: 50, renderHeight: 100 },
  { id: 'harley-bike', name: 'Harley-Davidson cruiser', color: '#e6e4dc', sprite: 'harley.png', renderWidth: 50, renderHeight: 100 },
];

const LANDSCAPES = [                                                             //ambiente di gioco con colori per strada e terreno
  { name: 'CITY', ground: ['#747f70', '#3e5147'], road: ['#515857', '#303738'] },
  { name: 'CANYON', ground: ['#a7754f', '#704b37'], road: ['#5a5751', '#353634'] },
  { name: 'FARMLAND', ground: ['#82985c', '#50633f'], road: ['#555a56', '#323938'] },
  { name: 'MOUNTAINS', ground: ['#6f8970', '#405447'], road: ['#505856', '#303738'] },
];
const SEGMENT_LENGTH = 600;
const SIGN_INTERVAL = 300;
//quando è sulla schermata d' inizio
let gameState = 'ready';                                          
let distance = 0;
let bestDistance = Number(localStorage.getItem('redline-run-best') || 0);
let lives = STARTING_LIVES;
let speed = 0;
let currentGear = 1;
let oilTemperature = 80;
let coolantTemperature = 120;
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
const playerImage = new Image();
playerImage.src = 'players car.png';
const trafficSprites = new Map(TRAFFIC_MODELS.map((model) => {
  const sprite = new Image();
  sprite.src = model.sprite;
  return [model.id, sprite];
}));
//serve a calcolare la strada percorsa calcolando la y rispetto all' orizzonte e serve anche a
//  restituire i limiti della strada in senso orizzontale
function roadAt(y) {
  const progress = Math.max(0, Math.min(1, (y - HORIZON) / (HEIGHT - HORIZON)));
  return {
    left: ROAD_LEFT,
    right: ROAD_RIGHT,
    progress,
  };
}
//serve a scegliere l'ambiente attuale in base alla distanza percorsa e aripetere ciclicamente gli ambienti
function currentLandscape() {
  return LANDSCAPES[Math.floor(distance / SEGMENT_LENGTH) % LANDSCAPES.length];
}
//serve a calcolare il centro della corsia in base al numero della corsia per rimettere il traffico al centro della corsia e 
//anche per rimetterlo sulla corsia più a destra possibile, il tutto tenendo presente della corsia di emergenza
function laneCenter(lane, y) {
  const laneWidth = CARRIAGEWAY_WIDTH / 2;
  if (lane < 2) {
    return ROAD_LEFT + SHOULDER_WIDTH + (lane + 0.5) * laneWidth;
  }
  const rightRoadLeft = ROAD_CENTER + MEDIAN_WIDTH / 2;
  return rightRoadLeft + (lane - 2 + 0.5) * laneWidth;
}
function formatDistance(meters) {
  return `${(meters / 1000).toFixed(2)} km`;
}
//serve a calcolare i giri motore tenendo conto della velocità, della velocita max delle marce e dei giri motore massimi e minimi
//se il player è fermo dà i giri motore minimi
function engineRpm() {
  return speed === 0
    ? IDLE_RPM
    : Math.min(MAX_RPM, IDLE_RPM + (speed / GEAR_MAX_SPEEDS[currentGear - 1]) * (MAX_RPM - IDLE_RPM));
}
//Aggiorna le lancette e la marcia mostrata dal nuovo cruscotto.
function updateHud() {
  const rpm = engineRpm();
  const speedRatio = Math.max(0, Math.min(1, speed / SPEED_GAUGE_MAX));
  const rpmRatio = Math.max(0, Math.min(1, (rpm - IDLE_RPM) / (MAX_RPM - IDLE_RPM)));
  lancettakmh.style.transform = `rotate(${-150 + speedRatio * 300}deg)`;
  lancettarpm.style.transform = `rotate(${-150 + rpmRatio * 300}deg)`;
  lancettakmh.parentElement.setAttribute('role', 'img');
  lancettakmh.parentElement.setAttribute('aria-label', `Velocita: ${Math.round(speed)} km/h`);
  lancettarpm.parentElement.setAttribute('role', 'img');
  lancettarpm.parentElement.setAttribute('aria-label', `Regime motore: ${Math.round(rpm)} giri/min`);
  marciainnestata.textContent = String(currentGear);
  marciainnestata.setAttribute('aria-label', `Marcia ${currentGear}`);
  oilTemperatureEl.textContent = `${Math.round(oilTemperature)}°C`;
  coolantTemperatureEl.textContent = `${Math.round(coolantTemperature)}°C`;
  distanceEl.textContent = formatDistance(distance);
  bestDistanceEl.textContent = formatDistance(bestDistance);
  livesEl.setAttribute('aria-label', `Integrità: ${lives} su ${STARTING_LIVES}`);
  lifeHearts.forEach((heart, index) => heart.classList.toggle('persa', index >= lives));
  gearButtons.forEach((button) => {
    const selected = Number(button.dataset.gear) === currentGear;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}
function updateSoundtrackButton(label) {
  const isPlaying = !soundtrack.paused;
  const buttonLabel = isPlaying ? 'Metti in pausa la musica' : label || 'Attiva musica';
  soundtrackButton.textContent = buttonLabel;
  soundtrackButton.setAttribute('aria-label', buttonLabel);
  soundtrackButton.setAttribute('aria-pressed', String(isPlaying));
}
function startSoundtrack() {
  if (!soundtrack.paused) {
    return;
  }

  soundtrack.play().catch((error) => {
    console.error('Impossibile avviare la musica:', error);
    updateSoundtrackButton('Riprova musica');
  });
}
function updateStartPrompt() {
  const isPlaying = gameState === 'playing';
  startPrompt.hidden = isPlaying;
  if (!isPlaying) {
    promptTitle.textContent = gameState === 'ended' ? 'Partita terminata' : 'Pagani Vs Traffic';
    promptText.textContent = gameState === 'ended'
      ? 'Premi W o fai clic sulla strada per ricominciare.'
      : 'Premi W o fai clic sulla strada per iniziare.';
  }
}
//serve innanzitutto a controlare che la marcia impostata esista, poi la imposta come marcia corrente e la aggiorna sull'HUD
function selectGear(gear) {
  if (gear < 1 || gear > GEAR_MAX_SPEEDS.length) {
    return;
  }
  currentGear = gear;
  updateHud();
}
//serve a resettare tutta l'interfaccia del HUD e impostare i valori iniziali
function resetGame() {
  distance = 0;
  lives = STARTING_LIVES;
  speed = 0;
  currentGear = 1;
  oilTemperature = 80;
  coolantTemperature = 120;
  autoAccelerating = true;
  roadOffset = 0;
  trafficClock = 0.5;
  invulnerableTime = 0;
  startInvulnerable = false;
  traffic = [];
  nextTrafficModel = 0;
  player.x = laneCenter(2, PLAYER_Y);
  player.y = HEIGHT - PLAYER_HEIGHT / 2;
  player.steer = 0;
  updateHud();
}
//serve a far iniziare il gioco, resettando il gioco, togliendo la schermata iniale, accezindendo il ghost e ad aggiornare lo stato di gioco
function startGame() {
  resetGame();
  startInvulnerable = true;
  gameState = 'playing';         
  updateStartPrompt();
  startSoundtrack();
}
//serve a far terminare la partita, salvando il record della distanza percorsa, mostrando di nuovo la schermata di ending e aggiornando
//lo stato di gioco
function endGame() {
  gameState = 'ended';
  updateStartPrompt();
  if (distance > bestDistance) {
    bestDistance = Math.floor(distance);
    localStorage.setItem('redline-run-best', String(bestDistance));
  }
  updateHud();
}
//serve ad assegnare la velocità ad ogni veicolo del traffico in base al tipo di veicolo (casuale con un massimo valore) e una direzione
//(circolazione a destra o a sinistra) 
function trafficSpeedFor(modelId, direction) {
  if (modelId === 'camion') {
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
    : 90 + Math.random() * 30;
}
//serve a spawnare i veicoli del traffico e ad assegnarli velocità, direzione e corsia, evitando di spawnare veicoli ammassati uno sopra
//l'altro
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
//serve a calcolare la distanza tra il veicolo e un soggetto, che esso sia un altro veicolo o un oggetto, tenendo conto del senso di marcia
function trafficGap(car, obstacle) {
  return car.direction === 'same'
    ? car.y - obstacle.y
    : obstacle.y - car.y;
}
//serve a calcolare la distanza inima di sicurezza tra 2 veicoli, considerando le loro dimensioni
function trafficSafeGap(car, obstacle) {
  return (car.renderHeight + obstacle.renderHeight) / 2 + 10;
}
//serve a verificare in che corsia si trova il player, in modo che il traffico possa adattarsi
// i veicoli che vanno in direzione opposta non subiscono variazioni
function playerIsInLane(car, lane) {
  if (car.direction !== 'same') {
    return false;
  }
  return Math.abs(laneCenter(lane, player.y) - player.x)
    < (PLAYER_WIDTH + car.renderWidth) * 0.39;
}
//controlla l'ostacolo più vicino davanti ad un veicolo considerando la corsia in cui si trova, il traffico e il player
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
//controlla se un veicolo possa spostarsi nella corsia di superamento senza avvicinarsi pericolosamente ad altri veicoli o al player
//considerando anche la velocità di avvicinamento e la distanza minima di sicurezza
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
//serve ad impedire ad un veicolo di mettersi nella corsia di superamento se rischia di tagliar la strada al player
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
//serve ad aggiornare lo stato del veicolo: corsia, superamento di un ostacolo o del player
function changeTrafficLane(car, lane, obstacle = null) {
  car.lane = lane;
  car.passingObstacle = obstacle;
  car.passingPlayer = lane !== car.defaultLane && obstacle === null;
}
//serve a gestire la logica completa del sistema di superamento di un veicolo, valutando ostacoli, corsie disponibili, distanze di
//sicurezza minime, rallentamenti dei veicoli e ritorno alla corsia di viaggio normale (destra)
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
        : (PLAYER_HEIGHT + car.renderHeight) / 2 + 10;
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
//serve a gestire i veicoli del traffico: quando spawnano e despawnano (quando escono dallo schermo), controllo delle colisioni 
//(se c'è collisione, meno una vita), quando finiscono le vite finisce la partita
function updateTraffic(dt) {
  trafficClock -= dt;
  if (trafficClock <= 0) {
    spawnTraffic();
    trafficClock = 1.8 + Math.random() * 0.8;
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
//serve ad aggiornare lo stato del gioco in completezza: velocità, accelerazione, frenata, temperature, posizione del player,
//sterzata, la strada, la distanza percorsa, il ghost, il traffico e la distanza record
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
  coolantTemperature = coolantTemperature + (120 + engineLoad * 12 - coolantTemperature) * Math.min(1, dt * 0.16);

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
//disegna lo scenario, colorandoli e aggiungendo elementi
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
//disegna la strada, le strisce, la corsia di sicurezza, lo spartitraffico; usa lo scorrimennto per dare un senso di movimento alla strada
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
//serve a calcolare le posizioni dei cartelli ai lati della carreggiata e a disegnare la funzione del cartello
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
//serve a disegnare i cartelli di limite di velocità
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
//disegna i veicoli, seguendo una procedura; aggiunge animazioni ai veicoli
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

  const bodyPath = () => {                              //serve a definire il contorno della carrozzeria
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
//fa in modo di aggiungere gli effetti di schiarimento-scuramento a un colore
function shadeColor(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = Math.max(0, Math.min(255, (value >> 16) + amount));
  const green = Math.max(0, Math.min(255, ((value >> 8) & 0xff) + amount));
  const blue = Math.max(0, Math.min(255, (value & 0xff) + amount));
  return `rgb(${red}, ${green}, ${blue})`;
}
//serve a creare e restituire il canvas della pixel art di un veicolo 
function createTrafficSprite(modelId) {
  const sprite = document.createElement('canvas');
  sprite.width = modelId === 'camion' ? 48 : 32;
  sprite.height = modelId === 'camion' ? 88 : 52;
  const pixel = sprite.getContext('2d');
  pixel.imageSmoothingEnabled = false;

  function block(x, y, color, width = 1, height = 1) {   //serve a creare un rettangolo colorato 
    pixel.fillStyle = color;
    pixel.fillRect(x, y, width, height);
  }

  if (modelId === 'camion') {
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

  block(14, 3, bodyLight, 4, 5);
  block(11, 7, bodyLight, 3, 1);
  block(18, 7, bodyLight, 3, 1);
  block(7, 9, bodyLight, 4, 1);
  block(21, 9, bodyLight, 4, 1);
  block(5, 10, '#fff0bd', 3, 1);
  block(24, 10, '#fff0bd', 3, 1);
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

  block(4, 39, '#441a1d', 6, 1);
  block(22, 39, '#441a1d', 6, 1);
  block(4, 40, '#ff4b43', 6, 2);
  block(22, 40, '#ff4b43', 6, 2);
  block(7, 43, '#15191a', 18, 2);
  block(11, 44, '#b5b5aa', 2, 1);
  block(19, 44, '#b5b5aa', 2, 1);

  return sprite;
}
//disegna tutti i veicoli, li posiziona nella corsia corretta e cambia senso di marcia seguendo le direzioni
function drawTraffic() {
  for (const car of traffic) {
    const x = laneCenter(car.lanePosition ?? car.lane, car.y);
    const width = car.renderWidth;
    const height = car.renderHeight;
    const sprite = trafficSprites.get(car.id);
    if (!sprite.complete || sprite.naturalWidth === 0) {
      continue;
    }
    ctx.save();
    ctx.translate(x, car.y);
    if (car.direction === 'oncoming') {
      ctx.rotate(Math.PI);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.shadowColor = 'rgba(4, 7, 8, 0.72)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 4;
    ctx.drawImage(sprite, -width / 2, -height / 2, width, height);
    ctx.restore();
  }
}
//disegna il veicolo del player, li da i movimenti e fa fare gli effetti di ghosting
function drawPlayer() {
  if (!playerImage.complete || playerImage.naturalWidth === 0) {
    return;
  }

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.steer * -0.045);
  if ((invulnerableTime > 0 || startInvulnerable) && Math.floor(performance.now() / 75) % 2 === 0) {
    ctx.globalAlpha = 0.52;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.shadowColor = 'rgba(4, 7, 8, 0.72)';
  ctx.shadowBlur = 7;
  ctx.shadowOffsetY = 5;
  ctx.drawImage(playerImage, -PLAYER_WIDTH / 2, -PLAYER_HEIGHT / 2, PLAYER_WIDTH, PLAYER_HEIGHT);
  ctx.restore();
}
//serve a disegnare il fotogramma completo seguendo l'ordine: paesaggio, strada, cartelli, traffico e player
function draw() {
  drawScenery();
  drawRoad();
  drawRoadSigns();
  drawTraffic();
  drawPlayer();
}
//serve per il ciclo continuo: calcola il tempo tra un fotogramma e l'altro, aggiorna il gioco, disegna la scena e il fotogramma dopo
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTimestamp) / 1000 || 0.016, 0.04);
  lastTimestamp = timestamp;
  updateGame(dt);
  draw();
  requestAnimationFrame(gameLoop);
}
//serve ad impostare lo stato di un comando di sterzata (premuto-rilasciato)
function setSteering(direction, pressed) {
  keys[direction] = pressed;
}
//gestisce i tasti di direzione del veicolo e delle marce
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
//serve a dare un comando quando si rilascia un tasto
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
//serve a 'spegnere' i comandi quando si chiude al finestra
window.addEventListener('blur', () => {
  keys.left = false;
  keys.right = false;
  keys.accelerate = false;
  keys.brake = false;
});

for (const [id, direction] of [['steer-left', 'left'], ['steer-right', 'right']]) {
  const button = document.getElementById(id);
  if (!button) {
    continue;
  }
  button.addEventListener('pointerdown', (event) => {     //serve ad attivare la sterzata da un comando touch e 'cattura' il puntatore
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    setSteering(direction, true);
  });
  button.addEventListener('pointerup', () => setSteering(direction, false));     //serve a disattivarla quando finisce il comando
  button.addEventListener('pointercancel', () => setSteering(direction, false));
  button.addEventListener('lostpointercapture', () => setSteering(direction, false));
}
gearButtons.forEach((button) => {
  button.addEventListener('click', () => selectGear(Number(button.dataset.gear)));
});
canvas.addEventListener('click', () => {
  if (gameState !== 'playing') {
    startGame();
  }
});
soundtrackButton.addEventListener('click', () => {
  if (soundtrack.paused) {
    startSoundtrack();
  } else {
    soundtrack.pause();
  }
});
soundtrack.addEventListener('play', () => updateSoundtrackButton());
soundtrack.addEventListener('pause', () => updateSoundtrackButton());
updateSoundtrackButton();
//serve a inizializzare la distanza percorsa, richiama lo stato di inizio gioco, disabilita il bottone start e avvia il ciclo 'frame'
resetGame();
updateStartPrompt();
requestAnimationFrame(gameLoop);