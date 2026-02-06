/**
 * HighlightOverlayView — Replaces mark.js with the CSS Custom Highlight API.
 *
 * Uses Range objects + CSS.highlights to paint highlights without DOM mutations.
 * Learning notes & pseudocode saved in notes/highlight-overlay-pseudocode.md.
 */

export class HighlightOverlayView {
  constructor() {
    // The name used to register our highlight with CSS.highlights
    // This is what you reference in CSS: ::highlight(asl-words) { ... }
    this._highlightName = "asl-words";

    // Store all Range objects so we can clear them later
    this._ranges = [];

    this._injectStyles();
  }

  // ─── PUBLIC METHODS ─────────────────────────────────────────────────

  /**
   * Highlight all matching words in a container element.
   *
   * @param {HTMLElement} container — the element to search within
   * @param {string[]}   words     — array of words/inflections to highlight
   * @param {Function}   onEachMatch — callback(matchedText, textNode, offset)
   */
  highlightAll(container, words, onEachMatch) {
    this.clear();

    // Guard against empty words array (causes infinite loop with empty regex)
    if (!words || words.length === 0) {
      return;
    }

    const regex = this._buildRegex(words);
    regex.lastIndex = 0;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);

    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      let match;
      while ((match = regex.exec(textNode.textContent)) !== null) {
        //only runs if the regex found something - skips whitespace nodes automatically
        const range = new Range();
        range.setStart(textNode, match.index);
        range.setEnd(textNode, match.index + match[0].length);
        this._ranges.push(range);

        if (onEachMatch) onEachMatch(match[0], textNode, match.index);
      }
    }

    const highlight = new Highlight();
    for (const r of this._ranges) highlight.add(r);// for content heavy sites in my e2e test, this would preven stack overflow
    CSS.highlights.set(this._highlightName, highlight);
  }

  /**
   * Remove all highlights.
   */
  clear() {
    CSS.highlights.delete(this._highlightName)
    this._ranges.length = 0;
  }

  // ─── PRIVATE METHODS ───────────────────────────────────────────────

  /**
   * Inject the ::highlight() CSS rule into the page.
   */
  _injectStyles() {
    this._styleEl = document.createElement("style");
    this._styleEl.textContent = `
        ::highlight(${this._highlightName}){
          background-color: yellow;
        }
    `;
    document.head.appendChild(this._styleEl);
  }

  /**
   * Build a regex that matches any of the given words (longest-first).
   *
   * @param {string[]} words
   * @returns {RegExp}
   */
  _buildRegex(words) {
    const escaped = words
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .sort((a, b) => b.length - a.length);
    const regex = new RegExp(`\\b(?:${escaped.join("|")})\\b`, "gi");
    return regex;
  }
}
