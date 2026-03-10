/* Sound System — Willie Austin Website
   Comprehensive audio system with:
   - Background music (ambient loop)
   - Click/tap sounds on buttons
   - Hover sounds on interactive elements
   - Whoosh/transition sounds between pages/sections
   - Menu open/close sounds
   - Notification/popup sounds
   - Loading sounds
   - Page transition jingles
*/

const SoundSystem = (() => {
  let musicEnabled = true;
  let sfxEnabled = true;
  let bgMusic = null;
  let audioCtx = null;
  let initialized = false;

  // Volume levels
  const VOLUMES = {
    music: 0.3,
    click: 0.25,
    hover: 0.08,
    whoosh: 0.2,
    menu: 0.15,
    notification: 0.2,
    loading: 0.15,
    jingle: 0.25,
    gameJump: 0.3,
    gameScore: 0.25,
    gameCrash: 0.4
  };

  function getAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Generate tones procedurally (no external files needed for SFX)
  function playTone(frequency, duration, type = 'sine', volume = 0.2, ramp = true) {
    if (!sfxEnabled) return;
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);

      if (ramp) {
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Silently fail — audio is enhancement, not critical
    }
  }

  // Play a sequence of tones (for jingles)
  function playSequence(notes, baseVolume = 0.2) {
    if (!sfxEnabled) return;
    try {
      const ctx = getAudioContext();
      let time = ctx.currentTime;

      notes.forEach(({ freq, dur, type = 'sine' }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(baseVolume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + dur);
        time += dur * 0.8; // slight overlap
      });
    } catch (e) {}
  }

  // Play noise burst (for whoosh/transition effects)
  function playNoise(duration, volume = 0.15) {
    if (!sfxEnabled) return;
    try {
      const ctx = getAudioContext();
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(2000, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + duration);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    } catch (e) {}
  }

  /* ---- Public SFX Methods ---- */

  // Click / tap sound — crisp retro blip
  function playClick() {
    playTone(800, 0.08, 'square', VOLUMES.click);
    playTone(1200, 0.05, 'sine', VOLUMES.click * 0.5);
  }

  // Hover sound — very subtle soft tone
  function playHover() {
    playTone(600, 0.06, 'sine', VOLUMES.hover);
  }

  // Whoosh / transition sound — filtered noise sweep
  function playWhoosh() {
    playNoise(0.4, VOLUMES.whoosh);
  }

  // Menu open sound — ascending tones
  function playMenuOpen() {
    playSequence([
      { freq: 400, dur: 0.06, type: 'square' },
      { freq: 600, dur: 0.06, type: 'square' },
      { freq: 800, dur: 0.08, type: 'square' }
    ], VOLUMES.menu);
  }

  // Menu close sound — descending tones
  function playMenuClose() {
    playSequence([
      { freq: 800, dur: 0.06, type: 'square' },
      { freq: 600, dur: 0.06, type: 'square' },
      { freq: 400, dur: 0.08, type: 'square' }
    ], VOLUMES.menu);
  }

  // Notification / popup sound — pleasant chime
  function playNotification() {
    playSequence([
      { freq: 880, dur: 0.1, type: 'sine' },
      { freq: 1100, dur: 0.1, type: 'sine' },
      { freq: 1320, dur: 0.15, type: 'sine' }
    ], VOLUMES.notification);
  }

  // Loading complete sound — triumphant jingle
  function playLoadingComplete() {
    playSequence([
      { freq: 523, dur: 0.1, type: 'square' },
      { freq: 659, dur: 0.1, type: 'square' },
      { freq: 784, dur: 0.1, type: 'square' },
      { freq: 1047, dur: 0.2, type: 'square' }
    ], VOLUMES.loading);
  }

  // Page transition jingle — smooth ascending sweep
  function playPageTransition() {
    playWhoosh();
    setTimeout(() => {
      playSequence([
        { freq: 440, dur: 0.08, type: 'sine' },
        { freq: 660, dur: 0.08, type: 'sine' },
        { freq: 880, dur: 0.12, type: 'sine' }
      ], VOLUMES.jingle);
    }, 100);
  }

  // Game sounds
  function playGameJump() {
    playTone(300, 0.1, 'square', VOLUMES.gameJump);
    setTimeout(() => playTone(500, 0.1, 'square', VOLUMES.gameJump * 0.7), 50);
  }

  function playGameScore() {
    playSequence([
      { freq: 880, dur: 0.08, type: 'square' },
      { freq: 1100, dur: 0.12, type: 'square' }
    ], VOLUMES.gameScore);
  }

  function playGameCrash() {
    playTone(200, 0.3, 'sawtooth', VOLUMES.gameCrash);
    playTone(100, 0.5, 'square', VOLUMES.gameCrash * 0.5);
    playNoise(0.3, VOLUMES.gameCrash * 0.3);
  }

  /* ---- Background Music ---- */

  function startMusic() {
    // Try to load external file first, fall back to generated
    const saved = localStorage.getItem('wa-music');
    if (saved === 'off') {
      musicEnabled = false;
      updateMuteButton();
      return;
    }

    bgMusic = new Audio('assets/audio/bg-music.mp3');
    bgMusic.loop = true;
    bgMusic.volume = VOLUMES.music;

    bgMusic.play().catch(() => {
      // File not found — generate ambient music
      generateAmbientLoop();
    });

    musicEnabled = true;
    updateMuteButton();
  }

  function generateAmbientLoop() {
    // Create a simple ambient pad as placeholder
    try {
      const ctx = getAudioContext();

      function playPad() {
        if (!musicEnabled) return;

        const freqs = [220, 277, 330, 440];
        const chosen = freqs[Math.floor(Math.random() * freqs.length)];

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(chosen, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 1);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 4);

        setTimeout(playPad, 3000 + Math.random() * 2000);
      }

      playPad();
    } catch (e) {}
  }

  function toggleMute() {
    musicEnabled = !musicEnabled;
    sfxEnabled = musicEnabled;

    if (bgMusic) {
      if (musicEnabled) {
        bgMusic.play().catch(() => {});
      } else {
        bgMusic.pause();
      }
    }

    localStorage.setItem('wa-music', musicEnabled ? 'on' : 'off');
    updateMuteButton();

    // Play feedback sound when unmuting
    if (musicEnabled) {
      playClick();
    }
  }

  function updateMuteButton() {
    const btn = document.querySelector('.sound-toggle');
    if (!btn) return;
    btn.setAttribute('aria-label', musicEnabled ? 'Mute sound' : 'Unmute sound');
    btn.classList.toggle('muted', !musicEnabled);
    const icon = btn.querySelector('.sound-icon');
    if (icon) {
      icon.textContent = musicEnabled ? '\u266B' : '\u266A';
    }
  }

  /* ---- Auto-bind Events ---- */

  function init() {
    if (initialized) return;
    initialized = true;

    // Load user preference
    const saved = localStorage.getItem('wa-music');
    if (saved === 'off') {
      musicEnabled = false;
      sfxEnabled = false;
    }

    // Bind click sounds to all interactive elements
    document.addEventListener('click', (e) => {
      const target = e.target.closest('a, button, [role="button"], .clickable');
      if (target) playClick();
    });

    // Bind hover sounds to nav items and interactive elements
    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest('.nav-link, .masthead a, [data-hover-sound]');
      if (target && !target.dataset.hovered) {
        target.dataset.hovered = 'true';
        playHover();
      }
    });

    document.addEventListener('mouseout', (e) => {
      const target = e.target.closest('.nav-link, .masthead a, [data-hover-sound]');
      if (target) {
        delete target.dataset.hovered;
      }
    });

    // Bind mute toggle
    const muteBtn = document.querySelector('.sound-toggle');
    if (muteBtn) {
      muteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMute();
      });
    }

    updateMuteButton();
  }

  // Expose public API
  return {
    init,
    playClick,
    playHover,
    playWhoosh,
    playMenuOpen,
    playMenuClose,
    playNotification,
    playLoadingComplete,
    playPageTransition,
    playGameJump,
    playGameScore,
    playGameCrash,
    startMusic,
    toggleMute,
    get musicEnabled() { return musicEnabled; }
  };
})();

// Make globally accessible
window.SoundSystem = SoundSystem;
