/* Image Loader — Willie Austin Website
   Tries to load local images first. If they don't exist,
   falls back to the Unsplash placeholder URL in data-fallback.

   Usage: <img src="assets/images/cover/hero.jpg"
               data-fallback="https://images.unsplash.com/photo-xxx?w=800"
               alt="...">
*/

const ImageFallback = (() => {
  function init() {
    document.querySelectorAll('img[data-fallback]').forEach(img => {
      if (!img._fallbackBound) {
        img._fallbackBound = true;
        img.onerror = function () {
          if (this.dataset.fallback && this.src !== this.dataset.fallback) {
            this.src = this.dataset.fallback;
            this.onerror = null;
          }
        };
      }
    });
  }
  return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
  ImageFallback.init();
});
