/* Loading Screen — Willie Austin Website */

const LoadingScreen = (() => {
  const messages = [
    'Loading haute couture...',
    'Pressing garments...',
    'Steaming the runway...',
    'Adjusting hemlines...',
    'Dodging Anna Wintour...',
    'Curating the collection...',
    'Setting the mood lighting...',
    'Choosing the right fabric...',
    'Stitching final seams...',
    'Ready for the front row...'
  ];

  let messageIndex = 0;
  let progress = 0;
  let progressInterval;
  let messageInterval;

  function init() {
    const screen = document.querySelector('.loading-screen');
    if (!screen) return;

    // Skip if already visited this session
    if (sessionStorage.getItem('wa-loaded')) {
      screen.classList.add('hidden');
      document.body.classList.remove('no-scroll');
      return;
    }

    // Show loading screen
    screen.classList.remove('hidden');
    document.body.classList.add('no-scroll');
    animateTitle();
    startProgress();
    cycleMessages();
  }

  function animateTitle() {
    const titleEl = document.querySelector('.loading-title');
    if (!titleEl) return;

    const text = titleEl.textContent;
    titleEl.textContent = '';

    [...text].forEach((char, i) => {
      const span = document.createElement('span');
      span.classList.add('letter');
      span.textContent = char === ' ' ? '\u00A0' : char;
      span.style.animationDelay = `${i * 0.08}s`;
      titleEl.appendChild(span);
    });
  }

  function startProgress() {
    const fill = document.querySelector('.loading-bar-fill');
    const pct = document.querySelector('.loading-percentage');
    if (!fill) return;

    progressInterval = setInterval(() => {
      progress += Math.random() * 8 + 2;
      if (progress >= 100) {
        progress = 100;
        clearInterval(progressInterval);
        clearInterval(messageInterval);
        showEnterButton();
      }
      fill.style.width = `${progress}%`;
      if (pct) pct.textContent = `${Math.floor(progress)}%`;
    }, 200);
  }

  function cycleMessages() {
    const msgEl = document.querySelector('.loading-message');
    if (!msgEl) return;

    msgEl.textContent = messages[0];
    messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % messages.length;
      msgEl.textContent = messages[messageIndex];
    }, 800);
  }

  function showEnterButton() {
    const enterBtn = document.querySelector('.loading-enter');
    if (!enterBtn) return;

    setTimeout(() => {
      enterBtn.classList.add('visible');
    }, 300);

    enterBtn.querySelector('button').addEventListener('click', () => {
      // Play loading complete sound
      if (window.SoundSystem) {
        window.SoundSystem.playLoadingComplete();
        // Start background music after user interaction
        window.SoundSystem.startMusic();
      }
      exitLoadingScreen();
    });
  }

  function exitLoadingScreen() {
    const screen = document.querySelector('.loading-screen');
    if (!screen) return;

    // Create curtain elements
    const curtainLeft = document.createElement('div');
    curtainLeft.classList.add('loading-curtain-left');
    const curtainRight = document.createElement('div');
    curtainRight.classList.add('loading-curtain-right');
    screen.appendChild(curtainLeft);
    screen.appendChild(curtainRight);

    screen.classList.add('exit');

    sessionStorage.setItem('wa-loaded', 'true');

    setTimeout(() => {
      screen.classList.add('hidden');
      document.body.classList.remove('no-scroll');
    }, 1000);
  }

  return { init };
})();
