// Handle the navigation drawer functionality
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    const navToggle = document.getElementById('nav-toggle');
    const navDrawer = document.getElementById('nav-drawer');
    const focusableElements = navDrawer.querySelectorAll('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])');

    // Helper function to check if we're in mobile view (when the toggle button is visible)
    function isMobileView() {
      // Use getComputedStyle to check if the button is displayed
      return window.getComputedStyle(navToggle).display !== 'none';
    }

    // Helper function to manage tabindexes based on current view and drawer state
    function updateTabIndexes() {
      const mobile = isMobileView();
      const drawerOpen = navDrawer.classList.contains('open');

      focusableElements.forEach(el => {
        if (mobile && !drawerOpen) {
          // In mobile view with closed drawer - make not tabbable
          el.setAttribute('tabindex', '-1');
        } else {
          // In desktop view OR open drawer - make tabbable
          if (el.getAttribute('tabindex') === '-1') {
            el.removeAttribute('tabindex');
          }
        }
      });
    }

    // Initial setup
    updateTabIndexes();

    // Update when window resizes
    window.addEventListener('resize', updateTabIndexes);

    if (navToggle && navDrawer) {
      // Toggle menu when button is clicked
      navToggle.addEventListener('click', function() {
        const expanded = this.getAttribute('aria-expanded') === 'true';
        const newExpandedState = !expanded;

        this.setAttribute('aria-expanded', newExpandedState);
        navDrawer.classList.toggle('open');
        document.body.classList.toggle('menu-open');

        // Update tabindex based on menu state
        updateTabIndexes();

        // If opening the menu, focus the first focusable element
        if (newExpandedState && focusableElements.length > 0) {
          setTimeout(() => focusableElements[0].focus(), 100);
        }
      });

      // Close menu when clicking outside
      document.addEventListener('click', function(event) {
        if (navDrawer.classList.contains('open') &&
            !navDrawer.contains(event.target) &&
            !navToggle.contains(event.target)) {
          navToggle.setAttribute('aria-expanded', 'false');
          navDrawer.classList.remove('open');
          document.body.classList.remove('menu-open');
          updateTabIndexes();
        }
      });

      // Close menu with Escape key
      document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && navDrawer.classList.contains('open')) {
          navToggle.setAttribute('aria-expanded', 'false');
          navDrawer.classList.remove('open');
          document.body.classList.remove('menu-open');
          updateTabIndexes();
          navToggle.focus();
        }
      });

      // Trap focus within the menu when open for accessibility
      if (focusableElements.length > 0) {
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        navDrawer.addEventListener('keydown', function(event) {
          if (event.key === 'Tab' && navDrawer.classList.contains('open') && isMobileView()) {
            if (event.shiftKey && document.activeElement === firstFocusable) {
              event.preventDefault();
              lastFocusable.focus();
            } else if (!event.shiftKey && document.activeElement === lastFocusable) {
              event.preventDefault();
              firstFocusable.focus();
            }
          }
        });
      }
    }
  });
})();