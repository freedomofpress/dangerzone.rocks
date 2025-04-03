document.addEventListener('DOMContentLoaded', () => {
  // --- Elements ---
  const navToggle = document.getElementById('nav-toggle');
  const mainNav = document.getElementById('main-nav');
  const navContent = mainNav?.querySelector('.nav-content');
  const toggleLabel = document.querySelector('.nav-toggle-label');

  // --- Constants ---
  const MOBILE_BREAKPOINT = 960; // Match CSS breakpoint
  const FOCUSABLE_SELECTOR = 'a[href]:not([disabled]), button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled])';

  // --- State ---
  let isMobile = window.innerWidth < MOBILE_BREAKPOINT;
  let focusableElements = [];
  let firstFocusableElement = null;
  let lastFocusableElement = null;

  // --- Guard Clause ---
  if (!navToggle || !mainNav || !navContent || !toggleLabel) {
    console.warn('Mobile navigation elements missing, script not initialized.');
    return;
  }

  // --- Functions ---
  function updateFocusableElements() {
    focusableElements = Array.from(
      navContent.querySelectorAll(FOCUSABLE_SELECTOR)
    );
    firstFocusableElement = focusableElements[0] || null;
    lastFocusableElement = focusableElements[focusableElements.length - 1] || null;
  }

  function handleFocusTrap(e) {
    // Only trap focus when mobile and the nav is open
    if (!isMobile || !navToggle.checked) return;

    const isTabPressed = e.key === 'Tab' || e.keyCode === 9;
    if (!isTabPressed) return;

    // If there are no focusable elements, don't trap
    if (!firstFocusableElement) {
        e.preventDefault(); // Prevent tabbing out of an empty menu
        return;
    }

    if (e.shiftKey) { // Shift + Tab
      // If focused on the first element, wrap to the last
      if (document.activeElement === firstFocusableElement) {
        lastFocusableElement.focus();
        e.preventDefault();
      }
    } else { // Tab
      // If focused on the last element, wrap to the first
      if (document.activeElement === lastFocusableElement) {
        firstFocusableElement.focus();
        e.preventDefault();
      }
    }
  }

  function setNavOpenState(isOpen) {
    if (isOpen && isMobile) {
      updateFocusableElements();
      // Delay focus slightly to allow CSS transition
      setTimeout(() => {
        firstFocusableElement?.focus();
      }, 150); // Short delay after opening animation starts
      mainNav.addEventListener('keydown', handleFocusTrap);
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    } else {
      mainNav.removeEventListener('keydown', handleFocusTrap);
      document.body.style.overflow = ''; // Restore background scroll
    }
  }

  function handleResize() {
    const stillIsMobile = window.innerWidth < MOBILE_BREAKPOINT;
    if (isMobile !== stillIsMobile) {
      isMobile = stillIsMobile;
      // Re-evaluate open state on resize (especially if crossing breakpoint)
      setNavOpenState(navToggle.checked);
    }
  }

  // --- Event Listeners ---
  navToggle.addEventListener('change', () => setNavOpenState(navToggle.checked));
  window.addEventListener('resize', handleResize, { passive: true }); // Use passive listener for resize
  toggleLabel.addEventListener('keydown', (e) => {
    // Toggle menu when Enter or Space is pressed
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navToggle.checked = !navToggle.checked;
      navToggle.dispatchEvent(new Event('change'));
    }
  });

  // Close nav on Escape key
  document.addEventListener('keydown', (e) => {
    if (isMobile && navToggle.checked && (e.key === 'Escape')) {
      navToggle.checked = false; // This will trigger the 'change' event listener above
    }
  });

  // --- Initial Setup ---
  handleResize();
  setNavOpenState(navToggle.checked);
});