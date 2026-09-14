/*
 * The drawer is a native popover, so it works with JavaScript disabled.
 * This adds what the platform doesn't hand us: focus management, Tab
 * trapping, aria-expanded, and closing when the viewport leaves mobile.
 */

// Match the breakpoint in style.css.
const MOBILE_MEDIA_QUERY = "(max-width: 960px)";

const FOCUSABLE_SELECTOR = "a[href], button";

// Not checkVisibility(), which Safari only picked up after popover.
const isRendered = (element) => element.getClientRects().length > 0;

class NavMenu extends HTMLElement {
  connectedCallback() {
    // No popover, no drawer -- and :popover-open would make matches() throw.
    if (!("popover" in HTMLElement.prototype)) return;

    this.drawer = this.querySelector("[popover]");
    this.toggle = this.querySelector(".nav-menu-toggle");
    if (!this.drawer || !this.toggle) return;

    this.toggle.setAttribute("aria-expanded", "false");

    this.controller = new AbortController();
    const { signal } = this.controller;

    this.drawer.addEventListener("toggle", this.onToggle, { signal });
    this.drawer.addEventListener("keydown", this.onKeydown, { signal });
    window
      .matchMedia(MOBILE_MEDIA_QUERY)
      .addEventListener("change", this.onBreakpointChange, { signal });
  }

  disconnectedCallback() {
    this.controller?.abort();
  }

  get focusable() {
    return [...this.drawer.querySelectorAll(FOCUSABLE_SELECTOR)];
  }

  get isOpen() {
    return this.drawer.matches(":popover-open");
  }

  onToggle = (event) => {
    const open = event.newState === "open";
    this.toggle.setAttribute("aria-expanded", String(open));

    if (open) {
      this.focusable[0]?.focus();
      return;
    }

    // Browsers only restore focus to the invoker for some dismissals, and
    // past the breakpoint the toggle is display:none, so pick what's visible.
    if (document.activeElement === document.body) {
      [this.toggle, ...this.focusable].find(isRendered)?.focus();
    }
  };

  onKeydown = (event) => {
    if (event.key !== "Tab" || !this.isOpen) return;

    const focusable = this.focusable;
    if (focusable.length === 0) return;

    const [edge, wrapTo] = event.shiftKey
      ? [focusable[0], focusable.at(-1)]
      : [focusable.at(-1), focusable[0]];

    if (document.activeElement !== edge) return;

    event.preventDefault();
    wrapTo.focus();
  };

  onBreakpointChange = (event) => {
    if (!event.matches && this.isOpen) this.drawer.hidePopover();
  };
}

customElements.define("nav-menu", NavMenu);
