/*
  ORGANISMO SONORO
  Arte generativo audiovisual interactivo.
  Cámara + movimiento + sonido ambiental reactivo.

  IMPORTANTE:
  Instalar la biblioteca p5.sound.
  Presionar ACTIVAR SONIDO después de ejecutar.
*/

let cam;
let previousFrame;
let motion;

let particles = [];
let bursts = [];
let waves = [];

let palette = 0;
let sensitivity = 32;
let movementAmount = 0;
let initialized = false;

let audioReady = false;
let audioStarting = false;

let bassOsc, droneOsc, highOsc;
let bassGain, droneGain, highGain;
let filterAudio, reverbAudio;

let lastHit = 0;
let lastWave = 0;
let lastBurst = 0;

const camW = 160;
const camH = 120;
const threshold = 22;

const palettes = [
  [[2, 5, 24], [0, 220, 255], [40, 70, 255], [255, 40, 190]],
  [[12, 3, 18], [255, 45, 75], [255, 125, 45], [255, 230, 140]],
  [[5, 0, 24], [140, 50, 255], [0, 240, 220], [255, 50, 180]],
  [[0, 12, 5], [80, 255, 35], [230, 255, 0], [0, 230, 180]]
];

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  background(2, 5, 20);

  cam = createCapture(VIDEO);
  cam.size(camW, camH);
  cam.hide();

  motion = new Float32Array(camW * camH);
  previousFrame = new Uint8ClampedArray(camW * camH);

  for (let i = 0; i < 2200; i++) {
    particles.push(newParticle(random(width), random(height)));
  }

  createControls();
}

function createControls() {
  let panel = createDiv();
  panel.position(12, 12);
  panel.style("z-index", "10");
  panel.style("display", "flex");
  panel.style("flex-wrap", "wrap");
  panel.style("gap", "8px");
  panel.style("max-width", "calc(100% - 24px)");

  function makeButton(label, action, color) {
    let b = createButton(label);
    b.parent(panel);
    b.style("background", color || "#171b32");
    b.style("color", "white");
    b.style("border", "1px solid #6874a5");
    b.style("padding", "10px 12px");
    b.style("border-radius", "7px");
    b.style("font-size", "12px");
    b.style("cursor", "pointer");
    b.mousePressed(action);
    return b;
  }

  makeButton("ACTIVAR SONIDO", activateAudio, "#51266d");

  makeButton("CAMBIAR PALETA", () => {
    palette = (palette + 1) % palettes.length;
  });

  makeButton("MÁS REACCIÓN", () => {
    sensitivity = min(80, sensitivity + 8);
  });

  makeButton("MENOS REACCIÓN", () => {
    sensitivity = max(8, sensitivity - 8);
  });

  makeButton("PANTALLA COMPLETA", () => {
    let fs = fullscreen();
    fullscreen(!fs);
  }, "#1f3b5c");

  makeButton("REINICIAR", () => {
    bursts = [];
    waves = [];
    background(2, 5, 20);

    for (let p of particles) {
      p.x = random(width);
      p.y = random(height);
      p.px = p.x;
      p.py = p.y;
      p.vx = random(-1, 1);
      p.vy = random(-1, 1);
      p.life = random(50, 180);
    }
  });
}

function newParticle(x, y) {
  return {
    x: x,
    y: y,
    px: x,
    py: y,
    vx: random(-1, 1),
    vy: random(-1, 1),
    life: random(50, 180),
    size: random(1, 3)
  };
}

// --------------------------------------------------
// AUDIO
// --------------------------------------------------

async function activateAudio() {
  if (audioReady || audioStarting) return;

  audioStarting = true;

  try {
    await userStartAudio();

    // Crear las fuentes.
    bassOsc = new p5.Oscillator("sine");
    droneOsc = new p5.Oscillator("triangle");
    highOsc = new p5.Oscillator("sine");

    // Crear las ganancias.
    bassGain = new p5.Gain();
    droneGain = new p5.Gain();
    highGain = new p5.Gain();

    // El filtro se conecta a la salida maestra de p5.sound.
    filterAudio = new p5.LowPass();
    filterAudio.freq(1800);
    filterAudio.res(0.7);

    // Desconectar las fuentes de su salida automática.
    bassOsc.disconnect();
    droneOsc.disconnect();
    highOsc.disconnect();

    // Ruta: oscilador -> ganancia -> filtro -> salida.
    bassOsc.connect(bassGain);
    droneOsc.connect(droneGain);
    highOsc.connect(highGain);

    bassGain.connect(filterAudio);
    droneGain.connect(filterAudio);
    highGain.connect(filterAudio);

    filterAudio.connect();

    // Volúmenes iniciales suaves pero audibles.
    bassGain.amp(0.12);
    droneGain.amp(0.07);
    highGain.amp(0.025);

    bassOsc.freq(55);
    droneOsc.freq(110);
    highOsc.freq(220);

    bassOsc.start();
    droneOsc.start();
    highOsc.start();

    // Reverberación ambiental.
    reverbAudio = new p5.Reverb();
    reverbAudio.process(filterAudio, 4, 0.4);

    audioReady = true;
    console.log("Audio iniciado correctamente.");

  } catch (err) {
    console.error("No se pudo iniciar el audio:", err);
  }

  audioStarting = false;
}

function updateAudio() {
  if (!audioReady) return;

  let energy = constrain(movementAmount / 70, 0, 1);
  let t = millis() * 0.001;

  // Sonido grave continuo que responde al movimiento.
  let root = 55 + energy * 30;

  bassOsc.freq(root, 0.15);
  droneOsc.freq(root * 2, 0.2);
  highOsc.freq(root * 3 + sin(t) * 15, 0.15);

  bassGain.amp(0.10 + energy * 0.12, 0.15);
  droneGain.amp(0.04 + energy * 0.08, 0.15);
  highGain.amp(0.015 + energy * 0.05, 0.15);

  // El sonido se vuelve más brillante con el movimiento.
  filterAudio.freq(lerp(500, 3500, energy));

  // Pequeños destellos tonales cuando hay mucho movimiento.
  if (energy > 0.4 && millis() - lastHit > 900) {
    lastHit = millis();

    let notes = [220, 261.63, 329.63, 392, 440, 523.25];
    highOsc.freq(random(notes), 0.05);
  }
}

// --------------------------------------------------
// DETECCIÓN DE MOVIMIENTO
// --------------------------------------------------

function analyzeCamera() {
  if (!cam || cam.width === 0 || cam.height === 0) return;

  cam.loadPixels();

  if (!cam.pixels || cam.pixels.length < camW * camH * 4) return;

  let total = 0;
  let count = 0;

  for (let y = 0; y < camH; y += 2) {
    for (let x = 0; x < camW; x += 2) {
      let i = (x + y * camW) * 4;

      let gray =
        cam.pixels[i] * 0.299 +
        cam.pixels[i + 1] * 0.587 +
        cam.pixels[i + 2] * 0.114;

      let diff = initialized
        ? abs(gray - previousFrame[x + y * camW])
        : 0;

      let value = diff > threshold
        ? constrain((diff - threshold) / 65, 0, 1)
        : 0;

      let index = x + y * camW;

      motion[index] =
        motion[index] * 0.28 + value * 0.72;

      total += value;
      count++;

      previousFrame[index] = gray;
    }
  }

  initialized = true;

  let average = total / max(1, count);

  movementAmount = lerp(
    movementAmount,
    constrain(average * 2800, 0, 100),
    0.4
  );

  if (average > 0.035 && millis() - lastBurst > 100) {
    lastBurst = millis();

    bursts.push({
      x: random(width),
      y: random(height),
      r: random(5, 20),
      life: 1,
      hue: random()
    });
  }

  if (movementAmount > 18 && millis() - lastWave > 220) {
    lastWave = millis();

    waves.push({
      x: random(width),
      y: random(height),
      r: 3,
      alpha: 170,
      hue: random()
    });
  }
}

// --------------------------------------------------
// VISUALIZACIÓN
// --------------------------------------------------

function draw() {
  analyzeCamera();

  background(2, 5, 20, 24);

  movementAmount *= 0.995;

  updateAudio();

  blendMode(ADD);

  for (let p of particles) {
    p.px = p.x;
    p.py = p.y;

    let gx = constrain(
      floor(map(p.x, 0, width, 0, camW - 1)),
      0, camW - 1
    );

    let gy = constrain(
      floor(map(p.y, 0, height, 0, camH - 1)),
      0, camH - 1
    );

    let power = motion[gx + gy * camW] || 0;

    let angle =
      noise(
        p.x * 0.0025,
        p.y * 0.0025,
        frameCount * 0.003
      ) * TWO_PI * 3;

    p.vx += cos(angle) * 0.12;
    p.vy += sin(angle) * 0.12;

    if (power > 0.02) {
      let force = power * sensitivity * 0.09;
      let forceAngle = angle + HALF_PI;

      p.vx += cos(forceAngle) * force + random(-force, force);
      p.vy += sin(forceAngle) * force + random(-force, force);

      if (random() < power * 0.12) {
        bursts.push({
          x: p.x,
          y: p.y,
          r: random(2, 9),
          life: 1,
          hue: random()
        });
      }
    }

    let globalForce = movementAmount * 0.003;

    p.vx += (
      noise(p.x * 0.005, frameCount * 0.01) - 0.5
    ) * globalForce;

    p.vy += (
      noise(p.y * 0.005, frameCount * 0.01 + 30) - 0.5
    ) * globalForce;

    p.vx *= 0.95;
    p.vy *= 0.95;

    p.x += p.vx;
    p.y += p.vy;

    if (p.x < 0) p.x = width;
    if (p.x > width) p.x = 0;
    if (p.y < 0) p.y = height;
    if (p.y > height) p.y = 0;

    let colorValue = constrain(
      power * 2.5 +
      noise(p.x * 0.003, p.y * 0.003) * 0.55,
      0, 1
    );

    let c = getColor(colorValue);

    stroke(c[0], c[1], c[2], 70 + power * 180);
    strokeWeight(p.size + power * 5);
    line(p.px, p.py, p.x, p.y);
  }

  // Ondas.
  for (let i = waves.length - 1; i >= 0; i--) {
    let w = waves[i];
    let c = getColor(w.hue);

    noFill();
    stroke(c[0], c[1], c[2], w.alpha);
    strokeWeight(1.5);
    circle(w.x, w.y, w.r * 2);

    w.r += 2 + movementAmount * 0.025;
    w.alpha -= 1.5;

    if (w.alpha <= 0) waves.splice(i, 1);
  }

  // Explosiones.
  for (let i = bursts.length - 1; i >= 0; i--) {
    let b = bursts[i];
    let c = getColor(b.hue);

    noFill();
    stroke(c[0], c[1], c[2], b.life * 190);
    strokeWeight(1.5);
    circle(b.x, b.y, b.r * 2);

    b.r += 2 + movementAmount * 0.02;
    b.life -= 0.025;

    if (b.life <= 0) bursts.splice(i, 1);
  }

  blendMode(BLEND);

  noStroke();
  fill(240, 245, 255, 210);
  textSize(12);
  textAlign(LEFT);

  let status = !initialized
    ? "INICIANDO CÁMARA..."
    : movementAmount > 15
      ? "ORGANISMO ACTIVO"
      : "ESPERANDO MOVIMIENTO";

  text(status, 15, height - 37);

  text(
    "ENERGÍA " + floor(movementAmount) +
    " | SENSIBILIDAD " + sensitivity +
    " | " + (audioReady ? "AUDIO ACTIVO" : "AUDIO DESACTIVADO"),
    15, height - 18
  );
}

function getColor(t) {
  let pal = palettes[palette];
  let pos = constrain(t, 0, 0.9999) * (pal.length - 1);
  let idx = floor(pos);
  let amt = pos - idx;

  return [
    lerp(pal[idx][0], pal[idx + 1][0], amt),
    lerp(pal[idx][1], pal[idx + 1][1], amt),
    lerp(pal[idx][2], pal[idx + 1][2], amt)
  ];
}

function mousePressed() {
  // Ignorar clics en la barra de controles superior
  if (mouseY < 70 && mouseX < 600) {
    return;
  }

  for (let i = 0; i < 80; i++) {
    let p = newParticle(mouseX, mouseY);
    p.vx = random(-8, 8);
    p.vy = random(-8, 8);
    particles.push(p);
  }

  if (particles.length > 3000) {
    particles.splice(0, particles.length - 3000);
  }

  waves.push({
    x: mouseX,
    y: mouseY,
    r: 3,
    alpha: 190,
    hue: random()
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(2, 5, 20);
}

function keyPressed() {
  if (key === 'f' || key === 'F') {
    let fs = fullscreen();
    fullscreen(!fs);
  }
}
