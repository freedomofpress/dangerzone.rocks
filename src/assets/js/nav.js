/*
 * Progressive enhancement for the mobile navigation drawer.
 *
 * The drawer is a native popover, so opening it, closing it, dismissing it
 * with Escape and dismissing it by clicking outside all work with JavaScript
 * disabled. This adds the parts the platform doesn't hand us:
 *
 *   - moving focus into the drawer when it opens, and back out when it closes
 *   - keeping Tab inside the drawer while it is open
 *   - an explicit aria-expanded on the toggle, since browsers don't all expose
 *     the implicit expanded state of a popover invoker
 *   - closing the drawer when the viewport grows past the mobile breakpoint
 */

// Match the breakpoint in style.css.
const MOBILE_MEDIA_QUERY = "(max-width: 960px)";

// The drawer only ever holds nav links and the close button.
const FOCUSABLE_SELECTOR = "a[href], button:not([disabled])";

// Whether the element is rendered at all. Cheaper to reason about than
// checkVisibility(), which Safari only picked up in 17.4 -- after popover.
const isRendered = (element) => element.getClientRects().length > 0;

class NavMenu extends HTMLElement {
  connectedCallback() {
    // Without popover support the CSS leaves the plain horizontal nav in
    // place, so there is nothing to enhance -- and `:popover-open` would be an
    // unparseable selector, which makes matches() throw.
    if (!("popover" in HTMLElement.prototype)) return;

    this.drawer = this.querySelector("[popover]");
    this.toggle = this.querySelector(".nav-menu-toggle");
    if (!this.drawer || !this.toggle) return;

    this.toggle.setAttribute("aria-expanded", "false");

    // One controller to unsubscribe everything on disconnect.
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

    // Closing took the focused element off the page. Browsers only restore
    // focus to the invoker for some dismissals, and past the breakpoint the
    // toggle itself is display:none, so fall back to whatever is on screen.
    if (document.activeElement === document.body) {
      [this.toggle, ...this.focusable].find(isRendered)?.focus();
    }
  };

  onKeydown = (event) => {
    if (event.key !== "Tab" || !this.isOpen) return;

    // The drawer covers the page, so wrap Tab around rather than letting focus
    // wander behind it.
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
    // The drawer only exists at mobile widths; growing past the breakpoint
    // turns the nav back into a plain horizontal list.
    if (!event.matches && this.isOpen) this.drawer.hidePopover();
  };
}

customElements.define("nav-menu", NavMenu);
