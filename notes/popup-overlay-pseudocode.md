# PopupOverlayView — Original Pseudocode & Learning Notes

Saved from `Test/js/view/popup-overlay-view.js` after implementation was complete.

---

## Why Shadow DOM?

When our extension runs on a real website, the page's CSS could accidentally
style our popup (or our popup's CSS could break the page). Shadow DOM creates
a boundary — styles don't leak in or out. The page's JavaScript also can't
querySelector into our shadow tree, so frameworks and MutationObservers
won't see our popup's internal DOM changes.

The ONE thing the page CAN see is the host element (`<div id="asl-popup-host">`).
That's one single DOM mutation, and it's an empty div — harmless.

### Things to Learn
1. Shadow DOM — what it is, how to attach one, open vs closed mode
2. caretPositionFromPoint / caretRangeFromPoint — hover detection without DOM event listeners on highlighted text
3. pointer-events: none — why the popup needs it (so the mouse "passes through")

### Resources
- MDN Shadow DOM guide (start here): https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM
- MDN attachShadow: https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow
- MDN caretPositionFromPoint (Firefox): https://developer.mozilla.org/en-US/docs/Web/API/Document/caretPositionFromPoint
- MDN caretRangeFromPoint (Chrome/Safari): https://developer.mozilla.org/en-US/docs/Web/API/Document/caretRangeFromPoint
- Shadow DOM styling guide: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM#applying_styles
- Google web.dev Shadow DOM intro: https://web.dev/articles/shadowdom-v1

---

## create() — Shadow DOM Setup

```
1. Create a <div> element — this is the "host" that lives in the real DOM
   - Give it an id like "asl-popup-host"
   - Style it as position:fixed, top:0, left:0, width:0, height:0
     (it's just an anchor point, not visible itself)

2. Attach a shadow root to it:
     this._shadow = this._host.attachShadow({ mode: 'closed' })

   WHY 'closed'?
     - 'open'  = page JS can access it via element.shadowRoot
     - 'closed' = element.shadowRoot returns null
     For an extension, 'closed' is safer — the page can't inspect our popup.
     But 'open' is easier to debug (you can see it in DevTools).
     Start with 'open' while developing, switch to 'closed' for production.

3. Inside the shadow, create:
   - A <style> element with all popup CSS (positioned, styled however you want)
   - A popup container <div>
   - A <video> element inside it
   - Any other elements you need (title, definitions, etc.)

   IMPORTANT: because this is inside a shadow root, you can use any class names
   without worrying about collisions with the page. ".popup" is fine.

4. Append the host to document.body
   — this is the ONLY mutation the page sees
```

TIP: look at popup-view.js for the DOM structure you already have.
The elements are the same — you're just putting them inside a shadow
instead of directly in document.body.

RESOURCE: https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow

---

## destroy() — Cleanup

```
1. this._host.remove()
2. Null out references
```

---

## startHoverDetection() — Mousemove Word Detection

CONTEXT:
Since highlights (from HighlightOverlayView) are NOT DOM elements,
we can't attach mouseenter/mouseleave to them. Instead, we listen
for mousemove on the document and figure out which word (if any)
the cursor is over.

```
1. Add a 'mousemove' listener on document

2. In the handler:
   a. Get the text node + offset under the cursor:

      FIREFOX:
        const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
        node = pos.offsetNode;   offset = pos.offset;

      CHROME/SAFARI:
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        node = range.startContainer;   offset = range.startOffset;

   b. If node is not a TEXT_NODE, call onLeaveWord and return

   c. Extract the full word at that offset:
        const before = text.slice(0, offset).match(/\w+$/);
        const after  = text.slice(offset).match(/^\w+/);
        const word   = (before?.[0] || '') + (after?.[0] || '');

   d. If word is different from this._lastWord:
        - If there was a previous word, call this._onLeaveWord(prevWord)
        - If new word is not empty, call this._onHoverWord(word, e.clientX, e.clientY)
        - Update this._lastWord
```

PERFORMANCE NOTE:
mousemove fires A LOT. Two ways to keep it fast:
  1. The word comparison (step d) already avoids unnecessary work
  2. If needed, throttle the handler (e.g., only run every 50ms)
     https://developer.mozilla.org/en-US/docs/Web/API/Document/mousemove_event

RESOURCE: https://developer.mozilla.org/en-US/docs/Web/API/Document/caretPositionFromPoint

---

## show() — Popup Positioning

```
1. Set popup display to 'block'
2. Position it relative to clientX/clientY
   — same logic as popup-view.js position(), but using
     fixed positioning (clientX/clientY) instead of element offsets
3. Make sure it doesn't overflow the viewport edges
```
