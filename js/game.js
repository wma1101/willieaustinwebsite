/* "Run From Anna Wintour" — Endless Runner Game
   HTML5 Canvas game with pixel-art aesthetic.
   Player runs down a runway dodging obstacles while Anna Wintour chases from behind.
*/

const RunnerGame = (() => {
  let canvas, ctx;
  let gameState = 'start'; // start | playing | over
  let score = 0;
  let highScore = parseInt(localStorage.getItem('wa-high-score')) || 0;
  let speed = 5;
  let frameCount = 0;
  let animationId;

  // Game dimensions
  const GAME_W = 800;
  const GAME_H = 300;

  // Ground
  const GROUND_Y = GAME_H - 50;

  // Colors (pixel art palette)
  const C = {
    bg: '#1a1a1a',
    ground: '#2a2a28',
    groundLine: '#3d3d3a',
    runway: '#555550',
    runwayLine: '#76766f',
    player: '#f5f2ed',
    playerDetail: '#c4462a',
    anna: '#0a0a0a',
    annaHair: '#8B7355',
    annaSunglasses: '#1a1a1a',
    obstacle: '#9a9a92',
    obstacleAccent: '#c4462a',
    text: '#f5f2ed',
    score: '#c4462a',
    star: '#c4462a'
  };

  // Player
  const player = {
    x: 100,
    y: GROUND_Y,
    w: 24,
    h: 40,
    vy: 0,
    jumping: false,
    runFrame: 0
  };

  // Anna Wintour (chaser in background)
  const anna = {
    x: -40,
    w: 30,
    h: 45,
    frame: 0
  };

  // Obstacles
  let obstacles = [];
  const OBSTACLE_TYPES = [
    { name: 'chair', w: 20, h: 24 },
    { name: 'camera', w: 16, h: 28 },
    { name: 'coffee', w: 14, h: 22 },
    { name: 'vogue', w: 22, h: 18 },
    { name: 'tall-chair', w: 20, h: 36 }
  ];

  // Background elements
  let bgElements = [];
  let groundOffset = 0;

  // Physics
  const GRAVITY = 0.65;
  const JUMP_FORCE = -12;

  function init() {
    canvas = document.getElementById('game-canvas');
    if (!canvas) return;

    ctx = canvas.getContext('2d');
    canvas.width = GAME_W;
    canvas.height = GAME_H;

    // Initialize background
    for (let i = 0; i < 5; i++) {
      bgElements.push({
        x: Math.random() * GAME_W,
        y: 20 + Math.random() * 60,
        size: 1 + Math.random() * 2,
        speed: 0.2 + Math.random() * 0.5
      });
    }

    // Bind controls
    document.addEventListener('keydown', onKeyDown);
    canvas.addEventListener('click', onTap);
    canvas.addEventListener('touchstart', onTap, { passive: false });

    // Start/restart buttons
    const startBtn = document.querySelector('.game-start-btn');
    const restartBtn = document.querySelector('.game-restart-btn');
    if (startBtn) startBtn.addEventListener('click', startGame);
    if (restartBtn) restartBtn.addEventListener('click', startGame);

    updateOverlays();
    drawFrame();
  }

  function onKeyDown(e) {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (gameState === 'start' || gameState === 'over') {
        startGame();
      } else if (gameState === 'playing') {
        jump();
      }
    }
  }

  function onTap(e) {
    e.preventDefault();
    if (gameState === 'start' || gameState === 'over') {
      startGame();
    } else if (gameState === 'playing') {
      jump();
    }
  }

  function startGame() {
    gameState = 'playing';
    score = 0;
    speed = 5;
    frameCount = 0;
    obstacles = [];
    player.y = GROUND_Y;
    player.vy = 0;
    player.jumping = false;
    anna.x = -40;
    updateOverlays();
    updateScoreDisplay();

    if (animationId) cancelAnimationFrame(animationId);
    gameLoop();
  }

  function jump() {
    if (!player.jumping) {
      player.jumping = true;
      player.vy = JUMP_FORCE;
      if (window.SoundSystem) SoundSystem.playGameJump();
    }
  }

  function gameLoop() {
    update();
    drawFrame();
    if (gameState === 'playing') {
      animationId = requestAnimationFrame(gameLoop);
    }
  }

  function update() {
    frameCount++;

    // Increase speed over time
    speed = 5 + Math.floor(frameCount / 200) * 0.5;
    if (speed > 14) speed = 14;

    // Update score
    score = Math.floor(frameCount / 3);
    updateScoreDisplay();

    // Milestone sound
    if (score > 0 && score % 100 === 0 && window.SoundSystem) {
      SoundSystem.playGameScore();
    }

    // Player physics
    if (player.jumping) {
      player.vy += GRAVITY;
      player.y += player.vy;
      if (player.y >= GROUND_Y) {
        player.y = GROUND_Y;
        player.vy = 0;
        player.jumping = false;
      }
    }

    // Player run animation
    if (!player.jumping && frameCount % 6 === 0) {
      player.runFrame = (player.runFrame + 1) % 4;
    }

    // Anna animation
    if (frameCount % 8 === 0) {
      anna.frame = (anna.frame + 1) % 4;
    }
    // Anna slowly creeps forward
    if (anna.x < 30) {
      anna.x += 0.01 * (speed / 5);
    }

    // Spawn obstacles
    const spawnRate = Math.max(60, 120 - Math.floor(frameCount / 100) * 5);
    if (frameCount % spawnRate === 0) {
      const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
      obstacles.push({
        x: GAME_W + 20,
        y: GROUND_Y - type.h + 4,
        w: type.w,
        h: type.h,
        type: type.name
      });
    }

    // Move obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].x -= speed;
      if (obstacles[i].x + obstacles[i].w < 0) {
        obstacles.splice(i, 1);
      }
    }

    // Collision detection
    for (const obs of obstacles) {
      if (
        player.x + 4 < obs.x + obs.w &&
        player.x + player.w - 4 > obs.x &&
        player.y - player.h + 4 < obs.y + obs.h &&
        player.y > obs.y
      ) {
        gameOver();
        return;
      }
    }

    // Ground scroll
    groundOffset = (groundOffset + speed) % 40;

    // Background scroll
    bgElements.forEach(el => {
      el.x -= el.speed * (speed / 5);
      if (el.x < -10) el.x = GAME_W + 10;
    });
  }

  function gameOver() {
    gameState = 'over';
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('wa-high-score', highScore);
    }
    if (window.SoundSystem) SoundSystem.playGameCrash();
    updateOverlays();
  }

  function drawFrame() {
    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // Stars / lights in background
    bgElements.forEach(el => {
      ctx.fillStyle = C.star;
      ctx.globalAlpha = 0.3 + Math.sin(frameCount * 0.02 + el.x) * 0.2;
      ctx.fillRect(Math.floor(el.x), Math.floor(el.y), el.size, el.size);
    });
    ctx.globalAlpha = 1;

    // Runway
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, GROUND_Y + 4, GAME_W, GAME_H - GROUND_Y);

    // Runway center line (dashed)
    ctx.fillStyle = C.runwayLine;
    for (let x = -groundOffset; x < GAME_W; x += 40) {
      ctx.fillRect(x, GROUND_Y + 4, 20, 2);
    }

    // Runway edge lines
    ctx.fillStyle = C.runway;
    ctx.fillRect(0, GROUND_Y + 2, GAME_W, 2);

    // Runway side markers
    ctx.fillStyle = C.groundLine;
    for (let x = -groundOffset; x < GAME_W; x += 80) {
      ctx.fillRect(x, GROUND_Y + 10, 4, 2);
      ctx.fillRect(x, GROUND_Y + 30, 4, 2);
    }

    // Draw Anna Wintour (background chaser)
    drawAnna();

    // Draw obstacles
    obstacles.forEach(obs => drawObstacle(obs));

    // Draw player
    drawPlayer();

    // Draw score on canvas (backup)
    if (gameState === 'playing') {
      ctx.fillStyle = C.score;
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${score}m`, GAME_W - 10, 20);
    }
  }

  function drawPlayer() {
    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    const legOffset = player.jumping ? 0 : [0, 3, 0, -3][player.runFrame];

    // Body (torso)
    ctx.fillStyle = C.player;
    ctx.fillRect(px + 6, py - 36, 12, 18);

    // Head
    ctx.fillRect(px + 7, py - 40, 10, 8);

    // Hair
    ctx.fillStyle = C.playerDetail;
    ctx.fillRect(px + 7, py - 40, 10, 3);

    // Arms
    ctx.fillStyle = C.player;
    if (player.jumping) {
      // Arms up when jumping
      ctx.fillRect(px + 2, py - 36, 4, 3);
      ctx.fillRect(px + 18, py - 36, 4, 3);
    } else {
      // Arms swinging
      ctx.fillRect(px + 2, py - 32 + legOffset, 4, 8);
      ctx.fillRect(px + 18, py - 32 - legOffset, 4, 8);
    }

    // Legs
    ctx.fillStyle = C.playerDetail;
    // Left leg
    ctx.fillRect(px + 7, py - 18, 4, 14 + legOffset);
    // Right leg
    ctx.fillRect(px + 13, py - 18, 4, 14 - legOffset);

    // Shoes
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(px + 5, py - 4 + legOffset, 6, 4);
    ctx.fillRect(px + 13, py - 4 - legOffset, 6, 4);
  }

  function drawAnna() {
    const ax = Math.floor(anna.x);
    const ay = GROUND_Y;
    const legOff = [0, 2, 0, -2][anna.frame];

    // Body
    ctx.fillStyle = '#2a2a28';
    ctx.fillRect(ax + 6, ay - 38, 14, 20);

    // Head
    ctx.fillStyle = '#f0e6d3';
    ctx.fillRect(ax + 8, ay - 44, 10, 9);

    // Iconic bob haircut
    ctx.fillStyle = C.annaHair;
    ctx.fillRect(ax + 6, ay - 46, 14, 6);
    ctx.fillRect(ax + 5, ay - 42, 3, 8);
    ctx.fillRect(ax + 18, ay - 42, 3, 8);

    // Sunglasses (iconic)
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(ax + 8, ay - 40, 10, 3);

    // Legs
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(ax + 9, ay - 18, 4, 14 + legOff);
    ctx.fillRect(ax + 15, ay - 18, 4, 14 - legOff);

    // Heels
    ctx.fillStyle = C.playerDetail;
    ctx.fillRect(ax + 8, ay - 4 + legOff, 5, 4);
    ctx.fillRect(ax + 15, ay - 4 - legOff, 5, 4);

    // Vogue magazine in hand
    ctx.fillStyle = C.obstacleAccent;
    ctx.fillRect(ax + 22, ay - 34, 6, 8);
    ctx.fillStyle = C.player;
    ctx.fillRect(ax + 23, ay - 33, 4, 2);
  }

  function drawObstacle(obs) {
    const x = Math.floor(obs.x);
    const y = Math.floor(obs.y);

    switch (obs.type) {
      case 'chair':
        // Fashion show chair
        ctx.fillStyle = C.obstacle;
        ctx.fillRect(x + 2, y + 4, 16, 2); // seat
        ctx.fillRect(x + 2, y, 2, 4);       // back left
        ctx.fillRect(x + 16, y, 2, 4);      // back right
        ctx.fillRect(x + 4, y + 6, 2, obs.h - 6); // front left leg
        ctx.fillRect(x + 14, y + 6, 2, obs.h - 6); // front right leg
        ctx.fillRect(x, y - 2, 20, 2);      // backrest
        break;

      case 'camera':
        // Camera on tripod
        ctx.fillStyle = C.obstacle;
        ctx.fillRect(x + 4, y, 8, 10);       // camera body
        ctx.fillRect(x + 2, y + 2, 4, 6);    // lens
        ctx.fillStyle = C.obstacleAccent;
        ctx.fillRect(x + 5, y + 1, 2, 2);    // flash
        ctx.fillStyle = C.obstacle;
        ctx.fillRect(x + 6, y + 10, 4, obs.h - 10); // tripod center
        ctx.fillRect(x + 2, y + obs.h - 4, 2, 4);   // tripod left
        ctx.fillRect(x + 12, y + obs.h - 4, 2, 4);  // tripod right
        break;

      case 'coffee':
        // Coffee cup
        ctx.fillStyle = C.obstacle;
        ctx.fillRect(x + 2, y + 2, 10, 16);   // cup body
        ctx.fillStyle = C.obstacleAccent;
        ctx.fillRect(x + 3, y + 3, 8, 4);     // lid
        ctx.fillStyle = '#8B7355';
        ctx.fillRect(x + 12, y + 6, 2, 6);    // handle
        ctx.fillRect(x + 12, y + 6, 4, 2);
        ctx.fillRect(x + 12, y + 10, 4, 2);
        // Steam
        ctx.fillStyle = C.player;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(x + 5, y - 2 - (frameCount % 4), 2, 2);
        ctx.fillRect(x + 8, y - 4 - (frameCount % 4), 2, 2);
        ctx.globalAlpha = 1;
        break;

      case 'vogue':
        // Vogue magazine
        ctx.fillStyle = C.obstacleAccent;
        ctx.fillRect(x, y + 2, obs.w, obs.h - 2); // cover
        ctx.fillStyle = C.player;
        ctx.fillRect(x + 2, y + 4, obs.w - 4, 3); // "VOGUE" text
        ctx.fillStyle = C.obstacle;
        ctx.fillRect(x + 4, y + 9, obs.w - 8, 6); // photo area
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(x, y, obs.w, 2);              // spine
        break;

      case 'tall-chair':
        // Director's chair (tall)
        ctx.fillStyle = C.obstacle;
        ctx.fillRect(x + 2, y + 10, 16, 2);   // seat
        ctx.fillRect(x, y, 2, obs.h);          // back left
        ctx.fillRect(x + 18, y, 2, obs.h);     // back right
        ctx.fillStyle = C.obstacleAccent;
        ctx.fillRect(x + 2, y + 2, 16, 8);    // back canvas
        ctx.fillStyle = C.obstacle;
        ctx.fillRect(x + 4, y + 12, 2, obs.h - 12);
        ctx.fillRect(x + 14, y + 12, 2, obs.h - 12);
        break;
    }
  }

  function updateScoreDisplay() {
    const scoreEl = document.getElementById('game-score-value');
    if (scoreEl) scoreEl.textContent = `${score}m`;
  }

  function updateOverlays() {
    const startOverlay = document.querySelector('.game-start-overlay');
    const overOverlay = document.querySelector('.game-over-overlay');
    const finalScore = document.getElementById('game-final-score');
    const bestScore = document.getElementById('game-best-score');

    if (startOverlay) {
      startOverlay.classList.toggle('hidden', gameState !== 'start');
    }
    if (overOverlay) {
      overOverlay.classList.toggle('hidden', gameState !== 'over');
      if (gameState === 'over') {
        if (finalScore) finalScore.textContent = `${score} runway meters`;
        if (bestScore) bestScore.textContent = `Best: ${highScore}m`;
      }
    }
  }

  return { init };
})();
