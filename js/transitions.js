/* Page Transitions — Willie Austin Website
   Crossfade overlay when navigating between pages.
*/

const Transitions = (() => {
  let overlay;

  function init() {
    overlay = document.querySelector('.page-transition');
    if (!overlay) return;

    // Intercept internal link clicks
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (!link) return;

      const href = link.getAttribute('href');

      // Skip external links, anchors, mailto, tel
      if (!href ||
          href.startsWith('#') ||
          href.startsWith('mailto:') ||
          href.startsWith('tel:') ||
          href.startsWith('http') ||
          link.target === '_blank') {
        return;
      }

      // Skip if modifier key held
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;

      e.preventDefault();

      // Play transition sound
      if (window.SoundSystem) SoundSystem.playPageTransition();

      // Fade out
      overlay.classList.add('active');

      setTimeout(() => {
        window.location.href = href;
      }, 350);
    });

    // Fade in on page load
    if (overlay.classList.contains('active')) {
      setTimeout(() => {
        overlay.classList.remove('active');
      }, 100);
    }
  }

  return { init };
})();
