/* Main Entry Point — Willie Austin Website
   Initializes all modules on DOMContentLoaded.
*/

document.addEventListener('DOMContentLoaded', () => {
  // Initialize sound system first (sets up event listeners)
  if (window.SoundSystem) SoundSystem.init();

  // Initialize loading screen (only on index.html)
  if (typeof LoadingScreen !== 'undefined') LoadingScreen.init();

  // Initialize navigation
  if (typeof Nav !== 'undefined') Nav.init();

  // Initialize custom cursor
  if (typeof Cursor !== 'undefined') Cursor.init();

  // Initialize scroll reveal animations
  if (typeof Reveal !== 'undefined') Reveal.init();

  // Initialize page transitions
  if (typeof Transitions !== 'undefined') Transitions.init();

  // Initialize horizontal scroll gallery (editorial pages)
  if (typeof HorizontalScroll !== 'undefined') HorizontalScroll.init();

  // Load and render content from JSON files
  if (typeof Content !== 'undefined') Content.init();
});
