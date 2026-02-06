# HighlightOverlayView — Original Pseudocode & Learning Notes

Saved from `Test/js/view/highlight-overlay-view.js` after implementation was complete.

---

## Why This Exists

highlight-view.js uses mark.js, which wraps every matched word in a `<mark>` element.
That's a DOM mutation — and on real websites, the page's own MutationObserver can
detect it, frameworks can break, and DOM weight balloons.

The CSS Custom Highlight API lets you paint highlights on text WITHOUT touching the DOM.
It works by creating Range objects over text nodes and registering them with the browser.
The browser handles the painting — no elements inserted, no tree modified.

### Things to Learn

1. TreeWalker — how to walk all text nodes in a subtree
2. Range — how to point at a slice of a text node (start offset -> end offset)
3. Highlight — the API that takes Ranges and tells the browser "paint these"
4. CSS.highlights — the registry where you store named Highlights

### Resources

- [MDN TreeWalker](https://developer.mozilla.org/en-US/docs/Web/API/TreeWalker)
- [MDN Range](https://developer.mozilla.org/en-US/docs/Web/API/Range)
- [MDN CSS Custom Highlight API (start here)](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API)
- [MDN Highlight object](https://developer.mozilla.org/en-US/docs/Web/API/Highlight)
- [Frontend Masters deep dive](https://frontendmasters.com/blog/using-the-custom-highlight-api/)
- [freeCodeCamp tutorial](https://www.freecodecamp.org/news/how-to-programmatically-highlight-text-with-the-css-custom-highlight-api/)
- [Microsoft Edge demo (interactive)](https://microsoftedge.github.io/Demos/custom-highlight-api/)

---

## highlightAll() — Highlight Matching Words

```
1. Build a regex from the words array (same approach as highlight-view.js)
   - Sort words longest-first so "running" matches before "run"
   - Escape special regex characters
   - Join with | and wrap in \b word boundaries

2. Create a TreeWalker that visits only TEXT_NODE types
   HINT: document.createTreeWalker(container, NodeFilter.SHOW_TEXT)

3. For each text node:
   - Run the regex against textNode.textContent
   - For each match:
       a. Create a new Range()
       b. range.setStart(textNode, match.index)
       c. range.setEnd(textNode, match.index + match[0].length)
       d. Push the range into this._ranges
       e. Call onEachMatch(match[0], textNode, match.index)
          (the presenter needs this to know which words were found)

4. Create a Highlight from all ranges and register it:
     const highlight = new Highlight(...this._ranges);
     CSS.highlights.set(this._highlightName, highlight);
```

---

## clear() — Remove All Highlights

```
1. CSS.highlights.delete(this._highlightName)
   — this instantly removes all visual highlights
2. Empty this._ranges array
```

That's it. No DOM cleanup needed (unlike mark.js's unmark() which has to
remove `<mark>` elements and merge text nodes back together).

---

## _injectStyles() — CSS Rule Injection

```
1. Create a <style> element
2. Set its textContent to: ::highlight(asl-words) { background-color: ...; }
3. Append it to document.head
```

NOTE: this is the ONLY DOM mutation this entire view makes
(compared to mark.js which creates one `<mark>` per matched word).

TIP: store a reference to the `<style>` element so you can remove it
in a future destroy() method if needed.

`::highlight()` supports: color, background-color, text-decoration,
text-shadow — nothing else (no padding, border, font changes).

Resource: https://developer.mozilla.org/en-US/docs/Web/CSS/::highlight

---

## _buildRegex() — Word Matching Regex

Sort longest-first before joining, so "running" gets matched before "run"
in the alternation. Same logic as highlight-view.js.
