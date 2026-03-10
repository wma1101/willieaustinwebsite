/* Scroll Reveal Animations — Willie Austin Website
   Uses IntersectionObserver to trigger reveal animations.
*/

const Reveal = (() => {
  let observer;

  function createObserver() {
    if (observer) return observer;
    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });
    return observer;
  }

  function observe() {
    const selector = '.reveal, .reveal-left, .reveal-right, .reveal-scale, .reveal-stagger';

    // Check for reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll(selector).forEach(el => {
        el.classList.add('visible');
      });
      return;
    }

    const obs = createObserver();
    document.querySelectorAll(selector).forEach(el => {
      if (!el.classList.contains('visible')) {
        obs.observe(el);
      }
    });
  }

  function init() {
    observe();
  }

  // Re-observe new elements after dynamic content rendering
  function refresh() {
    observe();
  }

  return { init, refresh };
})();
