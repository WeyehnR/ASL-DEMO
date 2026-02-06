/**
 * popup-overlay.template.js — Shadow DOM template for the ASL popup.
 *
 * Assembles the <style> + HTML markup that gets injected into the
 * shadow root. This is the only place that knows the popup's DOM structure.
 *
 * WHY A SEPARATE FILE:
 *   The view (popup-overlay-view.js) should only contain behavior —
 *   show/hide, hover detection, rendering state. The "what it looks like"
 *   (CSS) and "what elements exist" (HTML) are separate concerns.
 */

import { POPUP_STYLES } from "./popup-overlay.styles.js";

/**
 * Returns the full shadow DOM innerHTML: scoped styles + popup markup.
 *
 * @returns {string} HTML string ready to assign to shadowRoot.innerHTML
 */
export function createPopupTemplate() {
  return /* html */ `
    <style>${POPUP_STYLES}</style>
    <div class="asl-popup">
      <div class="asl-popup-header">
        <span class="asl-popup-title">ASL Sign</span>
        <span class="asl-popup-lexical-class"></span>
        <button class="asl-popup-close" title="Close">\u00D7</button>
      </div>
      <div class="asl-popup-video-container">
        <video class="asl-popup-video" autoplay loop muted playsinline></video>
        <div class="asl-popup-loading">Loading...</div>
        <div class="asl-popup-no-video">No video available</div>
      </div>
      <div class="asl-popup-word"></div>
      <div class="asl-popup-meanings"></div>
      <div class="asl-popup-person-hint">Can combine with PERSON sign</div>
    </div>
  `;
}
