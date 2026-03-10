/* Horizontal Scroll Gallery — Willie Austin Website
   Vertical scrolling drives horizontal panning through full-viewport image panels.
   Uses GSAP ScrollTrigger if available, falls back to native scroll-snap.
*/

const HorizontalScroll = (() => {
  function init() {
    const gallery = document.querySelector('.horizontal-gallery');
    if (!gallery) return;

    const track = gallery.querySelector('.horizontal-gallery__track');
    const panels = gallery.querySelectorAll('.horizontal-gallery__panel');
    if (!track || panels.length === 0) return;

    // Check for reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      fallbackVertical(gallery, track);
      return;
    }

    // Check for mobile — use vertical fallback
    if (window.innerWidth <= 768) {
      fallbackVertical(gallery, track);
      return;
    }

    // Try GSAP ScrollTrigger
    if (window.gsap && window.ScrollTrigger) {
      initGSAP(gallery, track, panels);
    } else {
      // Fallback: CSS scroll-snap horizontal
      initNativeScroll(gallery, track, panels);
    }

    // Update counter
    updateCounter(gallery, panels);
  }

  function initGSAP(gallery, track, panels) {
    const totalWidth = panels.length * window.innerWidth;

    // Set gallery height to create scroll space
    gallery.style.height = `${totalWidth}px`;

    gsap.to(track, {
      x: () => -(totalWidth - window.innerWidth),
      ease: 'none',
      scrollTrigger: {
        trigger: gallery,
        start: 'top top',
        end: () => `+=${totalWidth - window.innerWidth}`,
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const index = Math.round(self.progress * (panels.length - 1));
          updateActivePanel(gallery, index, panels.length);
        }
      }
    });
  }

  function initNativeScroll(gallery, track, panels) {
    // Transform to horizontal scrollable container
    gallery.style.height = `${panels.length * 100}vh`;
    gallery.style.position = 'relative';

    const stickyWrap = document.createElement('div');
    stickyWrap.style.cssText = 'position:sticky;top:0;height:100vh;overflow:hidden;';

    track.parentNode.insertBefore(stickyWrap, track);
    stickyWrap.appendChild(track);

    function onScroll() {
      const rect = gallery.getBoundingClientRect();
      const galleryHeight = gallery.offsetHeight - window.innerHeight;
      const progress = Math.max(0, Math.min(1, -rect.top / galleryHeight));
      const translateX = progress * (track.scrollWidth - window.innerWidth);

      track.style.transform = `translateX(-${translateX}px)`;

      const index = Math.round(progress * (panels.length - 1));
      updateActivePanel(gallery, index, panels.length);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function fallbackVertical(gallery, track) {
    // Just stack panels vertically
    track.style.flexDirection = 'column';
    gallery.style.height = 'auto';
  }

  function updateActivePanel(gallery, index, total) {
    const counter = gallery.querySelector('.horizontal-gallery__counter');
    if (counter) {
      counter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
    }
  }

  function updateCounter(gallery, panels) {
    const counter = gallery.querySelector('.horizontal-gallery__counter');
    if (counter) {
      counter.textContent = `01 / ${String(panels.length).padStart(2, '0')}`;
    }
  }

  return { init };
})();
