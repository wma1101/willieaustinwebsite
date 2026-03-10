/* Custom Cursor — Willie Austin Website */

const Cursor = (() => {
  let cursorEl;
  let enabled = false;

  function init() {
    // Don't enable on touch devices
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;

    // Check for reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    cursorEl = document.querySelector('.custom-cursor');
    if (!cursorEl) return;

    enabled = true;
    document.body.classList.add('cursor-active');

    // Track mouse position
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);

    // Hover state for interactive elements
    const hoverTargets = 'a, button, [role="button"], .stream-item, .clickable, input, textarea, select';

    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(hoverTargets)) {
        cursorEl.classList.add('hovering');
      }
    });

    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(hoverTargets)) {
        cursorEl.classList.remove('hovering');
      }
    });
  }

  function onMouseMove(e) {
    if (!enabled) return;
    cursorEl.style.left = `${e.clientX}px`;
    cursorEl.style.top = `${e.clientY}px`;
  }

  function onMouseDown() {
    if (!enabled) return;
    cursorEl.classList.add('clicking');
  }

  function onMouseUp() {
    if (!enabled) return;
    cursorEl.classList.remove('clicking');
  }

  return { init };
})();
