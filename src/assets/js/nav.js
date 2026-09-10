/*
 * Progressive enhancement for the mobile navigation drawer.
 *
 * The drawer is a native popover, so opening it, closing it, dismissing it
 * with Escape and dismissing it by clicking outside all work with JavaScript
 * disabled. This adds the parts the platform doesn't hand us:
 *
 *   - moving focus into the drawer when it opens, and back onto the toggle
 *     when it closes
 *   - keeping Tab inside the drawer while it is open
 *   - closing the drawer when the viewport grows past the mobile breakpoint
 *   - an explicit aria-expanded on the toggle, since browsers don't all expose
 *     the implicit expanded state of a popover invoker
 */

// Match the breakpoint in style.css.
const MOBILE_MEDIA_QUERY = "(max-width: 960px)";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

class NavMenu extends HTMLElement {
  connectedCallback() {
    // Without popover support the CSS leaves the plain horizontal nav in
    // place, so there is nothing to enhance -- and `:popover-open` would be
    // an unparseable selector, which makes matches() throw.
    if (!("popover" in HTMLElement.prototype)) return;

    this.drawer = this.querySelector("[popover]");
    if (!this.drawer) return;

    this.toggle = this.querySelector(
      `[popovertarget="${this.drawer.id}"]:not([popovertargetaction="hide"])`,
    );
    this.toggle?.setAttribute("aria-expanded", "false");

    this.mobile = window.matchMedia(MOBILE_MEDIA_QUERY);

    this.onBeforeToggle = this.onBeforeToggle.bind(this);
    this.onToggle = this.onToggle.bind(this);
    this.onKeydown = this.onKeydown.bind(this);
    this.onBreakpointChange = this.onBreakpointChange.bind(this);

    this.drawer.addEventListener("beforetoggle", this.onBeforeToggle);
    this.drawer.addEventListener("toggle", this.onToggle);
    this.drawer.addEventListener("keydown", this.onKeydown);
    this.mobile.addEventListener("change", this.onBreakpointChange);
  }

  disconnectedCallback() {
    if (!this.drawer) return;

    this.drawer.removeEventListener("beforetoggle", this.onBeforeToggle);
    this.drawer.removeEventListener("toggle", this.onToggle);
    this.drawer.removeEventListener("keydown", this.onKeydown);
    this.mobile.removeEventListener("change", this.onBreakpointChange);
  }

  get focusable() {
    return Array.from(this.drawer.querySelectorAll(FOCUSABLE_SELECTOR));
  }

  get isOpen() {
    return this.drawer.matches(":popover-open");
  }

  onBeforeToggle(event) {
    // Checked while the drawer is still open, because by the time it has
    // closed the focused element is gone and activeElement is the body.
    this.heldFocus =
      event.newState !== "open" && this.drawer.contains(document.activeElement);
  }

  onToggle(event) {
    const open = event.newState === "open";
    this.toggle?.setAttribute("aria-expanded", String(open));

    if (open) {
      this.focusable[0]?.focus();
    } else if (this.heldFocus) {
      // Past the breakpoint the toggle is display:none and focusing it is a
      // no-op that drops focus on the body, so fall back to the nav itself.
      const target = [this.toggle, ...this.focusable].find((el) =>
        el?.checkVisibility(),
      );
      target?.focus();
    }
  }

  onKeydown(event) {
    if (event.key !== "Tab" || !this.isOpen) return;

    // The drawer covers the page, so wrap Tab around rather than letting focus
    // wander behind it.
    const focusable = this.focusable;
    if (focusable.length === 0) return;

    const edge = event.shiftKey ? focusable[0] : focusable[focusable.length - 1];
    if (document.activeElement !== edge) return;

    event.preventDefault();
    (event.shiftKey ? focusable[focusable.length - 1] : focusable[0]).focus();
  }

  onBreakpointChange(event) {
    // The drawer only exists at mobile widths; growing past the breakpoint
    // turns the nav back into a plain horizontal list.
    if (!event.matches && this.isOpen) this.drawer.hidePopover();
  }
}

customElements.define("nav-menu", NavMenu);
