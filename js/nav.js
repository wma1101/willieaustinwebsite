/* Masthead Navigation — Willie Austin Website */

const Nav = (() => {
  let lastScroll = 0;
  let masthead;
  let menuToggle;
  let navMenu;

  function init() {
    masthead = document.querySelector('.masthead');
    menuToggle = document.querySelector('.menu-toggle');
    navMenu = document.querySelector('.masthead__nav');
    if (!masthead) return;

    // Scroll behavior: add 'scrolled' class after scrolling past fold
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Mobile menu toggle
    if (menuToggle) {
      menuToggle.addEventListener('click', toggleMenu);
    }

    // Close mobile menu when clicking a link
    if (navMenu) {
      navMenu.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
          if (navMenu.classList.contains('open')) {
            closeMenu();
          }
        });
      });
    }

    // Update folio page number on scroll
    updateFolio();
    window.addEventListener('scroll', updateFolio, { passive: true });

    // Reading progress bar
    updateReadingProgress();
    window.addEventListener('scroll', updateReadingProgress, { passive: true });
  }

  function onScroll() {
    const scrollY = window.scrollY;

    // Add scrolled state after 100px
    if (scrollY > 100) {
      masthead.classList.add('scrolled');
    } else {
      masthead.classList.remove('scrolled');
    }

    lastScroll = scrollY;
  }

  function toggleMenu() {
    const isOpen = menuToggle.classList.contains('open');
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  function openMenu() {
    menuToggle.classList.add('open');
    menuToggle.setAttribute('aria-expanded', 'true');
    navMenu.classList.add('open');
    document.body.classList.add('no-scroll');
    if (window.SoundSystem) SoundSystem.playMenuOpen();
  }

  function closeMenu() {
    menuToggle.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    navMenu.classList.remove('open');
    document.body.classList.remove('no-scroll');
    if (window.SoundSystem) SoundSystem.playMenuClose();
  }

  function updateFolio() {
    const folio = document.querySelector('.folio__number');
    if (!folio) return;

    const scrollPercent = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
    const page = Math.max(1, Math.ceil(scrollPercent * 12));
    folio.textContent = String(page).padStart(2, '0');
  }

  function updateReadingProgress() {
    const bar = document.querySelector('.reading-progress');
    if (!bar) return;

    const scrollPercent = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
    bar.style.width = `${Math.min(100, scrollPercent * 100)}%`;
  }

  return { init };
})();
