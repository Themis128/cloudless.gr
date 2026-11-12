/* Top-layer (<dialog>) exit animations — MWG `animate-to-from-top-layer`.
 *
 * Entry animations are pure CSS (@starting-style). Exit animations need
 * `overlay` + discrete `display` transitions, which only Chromium supports
 * today — Firefox/Safari get the `data-closing` + getAnimations() fallback:
 * mark the element, wait for its animations to settle, then close().
 * All detection is lazy so this module is SSR/jsdom safe. */

let displayTransitionSupport: boolean | undefined;

/** Probe real discrete-display transition support — CSS.supports alone is
 *  unreliable (Firefox parses allow-discrete but doesn't transition display). */
function canTransitionDisplay(): boolean {
  if (displayTransitionSupport !== undefined) return displayTransitionSupport;
  if (
    typeof window === "undefined" ||
    typeof window.CSS?.supports !== "function" ||
    !window.CSS.supports("transition-behavior", "allow-discrete") ||
    !document.body
  ) {
    return false;
  }
  /* v8 ignore start -- DOM probe needs a real CSS transition engine; jsdom can't execute it */
  const probe = document.createElement("div");
  // Shorthand is intentional: browsers that can't parse allow-discrete drop
  // the whole declaration, so display:none applies instantly → probe=false.
  // !important guards against global reduced-motion `transition: none` resets.
  probe.style.cssText = "transition: display 1s allow-discrete !important; display: block;";
  document.body.appendChild(probe);
  void getComputedStyle(probe).display;
  probe.style.display = "none";
  displayTransitionSupport = getComputedStyle(probe).display === "block";
  probe.remove();
  /* v8 ignore stop */
  return displayTransitionSupport;
}

/** True only where top-layer exit transitions work natively (Chromium). */
export function supportsTopLayerExit(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.CSS?.supports === "function" &&
    window.CSS.supports("overlay", "auto") &&
    canTransitionDisplay()
  );
}

/** Request an animated close of a modal <dialog>. Resolves `true` when the
 *  dialog accepted the close request (a `close` event will follow), `false`
 *  when the platform can't close dialogs at all (jsdom/legacy embeds) so the
 *  caller can fall back to synchronous state updates. */
export async function requestDialogClose(dialog: HTMLDialogElement): Promise<boolean> {
  if (typeof dialog.close !== "function") return false;

  if (!supportsTopLayerExit()) {
    dialog.setAttribute("data-closing", "");
    const animations =
      typeof dialog.getAnimations === "function" ? dialog.getAnimations({ subtree: true }) : [];
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    }
    // Something else may have closed it while we waited.
    if (!dialog.hasAttribute("data-closing")) return true;
    dialog.removeAttribute("data-closing");
  }

  dialog.close();
  return true;
}
