/**
 * HighlightOverlayView — Replaces mark.js with the CSS Custom Highlight API.
 *
 * WHY THIS EXISTS:
 *   highlight-view.js uses mark.js, which wraps every matched word in a <mark> element.
 *   That's a DOM mutation — and on real websites, the page's own MutationObserver can
 *   detect it, frameworks can break, and DOM weight balloons.
 *
 *   The CSS Custom Highlight API lets you paint highlights on text WITHOUT touching the DOM.
 *   It works by creating Range objects over text nodes and registering them with the browser.
 *   The browser handles the painting — no elements inserted, no tree modified.
 *
 * WHAT YOU NEED TO LEARN:
 *   1. TreeWalker   — how to walk all text nodes in a subtree
 *   2. Range        — how to point at a slice of a text node (start offset → end offset)
 *   3. Highlight    — the API that takes Ranges and tells the browser "paint these"
 *   4. CSS.highlights — the registry where you store named Highlights
 *
 * RESOURCES:
 *   - MDN TreeWalker:
 *     https://developer.mozilla.org/en-US/docs/Web/API/TreeWalker
 *
 *   - MDN Range:
 *     https://developer.mozilla.org/en-US/docs/Web/API/Range
 *
 *   - MDN CSS Custom Highlight API (start here):
 *     https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API
 *
 *   - MDN Highlight object:
 *     https://developer.mozilla.org/en-US/docs/Web/API/Highlight
 *
 *   - Frontend Masters deep dive (good walkthrough with examples):
 *     https://frontendmasters.com/blog/using-the-custom-highlight-api/
 *
 *   - freeCodeCamp tutorial:
 *     https://www.freecodecamp.org/news/how-to-programmatically-highlight-text-with-the-css-custom-highlight-api/
 *
 *   - Microsoft Edge demo (interactive, try in browser):
 *     https://microsoftedge.github.io/Demos/custom-highlight-api/
 */

export class HighlightOverlayView {
  constructor() {
    // The name used to register our highlight with CSS.highlights
    // This is what you reference in CSS: ::highlight(asl-words) { ... }
    this._highlightName = "asl-words";

    // Store all Range objects so we can clear them later
    this._ranges = [];

    // TODO: inject a <style> tag into the page for ::highlight(asl-words)
    // HINT: you only need background-color for now
    //       ::highlight() supports: color, background-color, text-decoration,
    //       text-shadow — nothing else (no padding, border, font changes)
    //
    // RESOURCE: https://developer.mozilla.org/en-US/docs/Web/CSS/::highlight
    this._injectStyles();
  }

  // ─── PUBLIC METHODS ─────────────────────────────────────────────────

  /**
   * Highlight all matching words in a container element.
   *
   * PSEUDOCODE:
   *   1. Build a regex from the words array (same approach as highlight-view.js)
   *      - Sort words longest-first so "running" matches before "run"
   *      - Escape special regex characters
   *      - Join with | and wrap in \b word boundaries
   *
   *   2. Create a TreeWalker that visits only TEXT_NODE types
   *      HINT: document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
   *
   *   3. For each text node:
   *      - Run the regex against textNode.textContent
   *      - For each match:
   *          a. Create a new Range()
   *          b. range.setStart(textNode, match.index)
   *          c. range.setEnd(textNode, match.index + match[0].length)
   *          d. Push the range into this._ranges
   *          e. Call onEachMatch(match[0], textNode, match.index)
   *             (the presenter needs this to know which words were found)
   *
   *   4. Create a Highlight from all ranges and register it:
   *        const highlight = new Highlight(...this._ranges);
   *        CSS.highlights.set(this._highlightName, highlight);
   *
   * @param {HTMLElement} container — the element to search within
   * @param {string[]}   words     — array of words/inflections to highlight
   * @param {Function}   onEachMatch — callback(matchedText, textNode, offset)
   */
  highlightAll(container, words, onEachMatch) {
    this.clear();

    // TODO: implement the 4 steps above
    //
    // HINTS:
    //   - Remember to reset regex.lastIndex or use a new regex per text node
    //     if using the 'g' flag (global regexes are stateful!)
    //   - TreeWalker docs: https://developer.mozilla.org/en-US/docs/Web/API/TreeWalker
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

    const highlight = new Highlight(...this._ranges);
    CSS.highlights.set(this._highlightName, highlight);
  }

  /**
   * Remove all highlights.
   *
   * PSEUDOCODE:
   *   1. CSS.highlights.delete(this._highlightName)
   *      — this instantly removes all visual highlights
   *   2. Empty this._ranges array
   *
   * That's it. No DOM cleanup needed (unlike mark.js's unmark() which has to
   * remove <mark> elements and merge text nodes back together).
   */
  clear() {
    // TODO: implement the 2 steps above
    CSS.highlights.delete(this._highlightName)
    this._ranges.length = 0;
  }

  // ─── PRIVATE METHODS ───────────────────────────────────────────────

  /**
   * Inject the ::highlight() CSS rule into the page.
   *
   * PSEUDOCODE:
   *   1. Create a <style> element
   *   2. Set its textContent to: ::highlight(asl-words) { background-color: ...; }
   *   3. Append it to document.head
   *
   * NOTE: this is the ONLY DOM mutation this entire view makes.
   *       (compared to mark.js which creates one <mark> per matched word)
   *
   * TIP: store a reference to the <style> element so you can remove it
   *      in a future destroy() method if needed.
   */
  _injectStyles() {
    // TODO: implement

    this._styleEl = document.createElement("style");
    this._styleEl.textContent = `
        ::highlight(${this._highlightName}){
          background-color: yellow;
        }
    `;
    document.head.appendChild(this._styleEl);
  }

  /**
   * Build a regex that matches any of the given words.
   *
   * You already have this logic in highlight-view.js — bring it over.
   * The key detail: sort longest-first before joining, so "running"
   * gets matched before "run" in the alternation.
   *
   * @param {string[]} words
   * @returns {RegExp}
   */
  _buildRegex(words) {
    // TODO: implement (reference highlight-view.js)
    const escaped = words
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .sort((a, b) => b.length - a.length);
    const regex = new RegExp(`\\b(?:${escaped.join("|")})\\b`, "gi");
    return regex;
  }
}
