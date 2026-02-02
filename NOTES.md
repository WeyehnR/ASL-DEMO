# Lessons Learned

Personal reference notes from building the ASL extension.

---

## LRU Cache (Least Recently Used)

### What it solves
When you have limited memory (or want to limit it), you need a strategy for deciding
what to keep and what to throw away. LRU keeps the most recently accessed items and
evicts the oldest one when the cache is full.

In our case: we cache video blobs so re-hovering a word doesn't re-fetch the `.mp4`
from the network. Capacity is 20 words — the 21st evicts the least recently used one.

### Data structures: HashMap + Doubly Linked List

Neither structure works alone:

| Structure         | Lookup | Insert/Delete | Ordering |
|-------------------|--------|---------------|----------|
| HashMap           | O(1)   | O(1)          | None     |
| Doubly Linked List| O(n)   | O(1)*         | Yes      |

*O(1) delete only if you already have a pointer to the node.

**Together they give O(1) for everything:**
- HashMap maps `key -> Node` (instant lookup)
- Linked list maintains access order (most recent = head, least recent = tail)
- On `get()`: HashMap finds the node, then we unlink it and move it to the head
- On `put()`: create a new node at the head, evict the tail if over capacity

### Node is a dumb container

```javascript
class Node {
    constructor(key, value) {
        this.key = key;     // needed so we can delete from HashMap on eviction
        this.value = value;
        this.prev = null;
        this.next = null;
    }
}
```

No methods. The key is stored on the node so that when we evict the tail,
we know which HashMap entry to delete (`this.map.delete(evict.key)`).

### Unlinking a node (removeNode)

This is the core linked list operation. To remove a node from the middle:

```
Before:  A <-> B <-> C
Remove B:
  1. A.next = C        (prev_item.next = next_item)
  2. C.prev = A        (next_item.prev = prev_item)
  3. B.prev = null     (clean up removed node)
  4. B.next = null
After:   A <-> C       (B is floating, unlinked)
```

Edge cases to handle:
- Node is the head -> update `this.head` to next
- Node is the tail -> update `this.tail` to prev
- Node is both (only element) -> both head and tail become null

### moveToHead = removeNode + addToHead

Every access (get or put) moves the node to the head. This is how "recency" is tracked
without timestamps or counters.

### onEvict callback

When the cache is full and a new entry pushes one out, we need to clean up.
In our case that means calling `URL.revokeObjectURL()` on cached blob URLs
to free the memory the browser allocated for them.

```javascript
const cache = new LRUCache(20, (key, value) => {
    // called automatically when an entry is evicted
    value.blobUrls.forEach(url => URL.revokeObjectURL(url));
});
```

### Mistakes I made building it

1. **Put `get()` and `put()` on Node** — these belong on the Cache, not the Node.
   Node is just a container with 4 fields.

2. **Walked the linked list in `get()`** — defeats the purpose. The whole point of the
   HashMap is O(1) lookup. `this.map.get(key)` gives you the node directly.

3. **Set `this.key = key` in `put()`** — stored data on the cache object itself
   instead of creating a Node.

4. **Evicted the wrong node** — `this.removeNode(node)` removed the new node instead
   of `this.tail`. Eviction should always remove the tail (least recently used).

5. **Mixed variable names** — used `item` in `removeNode()` when the parameter was `node`.
   Caused `ReferenceError` at runtime.

6. **Inverted tail check in `addToHead()`** — `if (this.tail !== null)` should be
   `if (this.tail == null)`. You only set tail to the new node when the list was empty.

---

## Blobs (Binary Large Objects)

### What is a Blob?

A Blob is the browser's way of holding raw binary data in JavaScript memory.
Think of it as a byte array that the browser manages for you.

```javascript
// Fetching a file as a Blob
const response = await fetch("video.mp4");
const blob = await response.blob();  // raw bytes, now in JS memory
```

The Blob itself isn't directly usable as a video `src`. You need a Blob URL.

### Blob URLs

`URL.createObjectURL(blob)` creates a special URL that points to the in-memory bytes:

```javascript
const blobUrl = URL.createObjectURL(blob);
// blobUrl looks like: "blob:http://localhost/a1b2c3d4-e5f6-..."

videoElement.src = blobUrl;
// Browser reads bytes from memory — no network request
```

### Why this matters for video caching

**Without blobs (what we had before):**
```
videoElement.src = "../archive/asl_lex_videos/accept.mp4"
  -> Browser makes HTTP request every time
  -> On hide(), src is cleared
  -> Re-hover = re-fetch from network
```

**With blobs (what we have now):**
```
First hover:
  fetch("accept.mp4") -> blob -> URL.createObjectURL() -> cache it
  videoElement.src = "blob:..." -> plays from memory

Re-hover:
  LRU cache hit -> blob URL still valid -> plays instantly
  No network request at all
```

### Memory management: revokeObjectURL

Blob URLs hold a reference to the blob data in memory. The browser won't garbage
collect it until you explicitly revoke it:

```javascript
URL.revokeObjectURL(blobUrl);  // frees the memory
```

After revoking, the blob URL becomes invalid — setting it as a video `src` would fail.

This is why the LRU cache's `onEvict` callback is important: when an entry is evicted
to make room, we revoke its blob URLs so the memory is freed.

### Our cache value structure

Each cached word stores all its sign variants:

```javascript
{
    entries: [                    // glossary metadata for each variant
        { entryId: "bat_1", meanings: "animal, bat", lexicalClass: "Noun", ... },
        { entryId: "bat_3", meanings: "hit, swing", lexicalClass: "Verb", ... }
    ],
    blobUrls: [                   // corresponding blob URLs
        "blob:http://localhost/abc...",   // bat_1.mp4 bytes
        "blob:http://localhost/def..."    // bat_3.mp4 bytes
    ],
    currentIndex: 0               // which variant is currently displayed
}
```

The first variant is fetched eagerly (blocks the popup display).
Remaining variants are fetched in the background after the first one loads.

### Race conditions

If the user hovers word A, then quickly moves to word B before A's fetch resolves,
we don't want A's blob to overwrite B's display. We track `_loadingWord` and check
it when the fetch resolves:

```javascript
this._loadingWord = word;

fetch(videoPath)
    .then(response => response.blob())
    .then(blob => {
        // Stale response — user already moved on
        if (this._loadingWord !== word) return;

        // Safe to update UI
        ...
    });
```

---

## Disambiguation (Word Sense Disambiguation)

### The problem

Many English words have multiple meanings, and in ASL each meaning can be a completely
different sign. "Bat" has 3 glossary entries: the animal, the baseball tool, and the
verb (to swing). When a user hovers over "bat", we need to pick the right video.

This is a classic NLP (Natural Language Processing) problem called
**word sense disambiguation (WSD)** — given a word with multiple senses, determine
which sense is meant from context.

### Our approach: nearby-word context scoring

Instead of using ML models or word embeddings (which would be overkill for a browser
extension), we use a lightweight heuristic based on the glossary's own metadata.

**How it works:**

1. When the user hovers a multi-variant word (e.g., "bat"), we look at the same
   paragraph for other highlighted `<mark>` words
2. For each nearby word, we pull its `lexicalClass` and `semanticField` from the glossary
3. We score each variant of "bat" against these neighbors:
   - **+1** for each neighbor that shares the same lexical class (Noun, Verb, etc.)
   - **+2** for each neighbor that shares the same semantic field (Animals, Sports, etc.)
4. The highest-scoring variant wins

**Example with the bat article:**

```
Paragraph: "The bat is a nocturnal animal that uses echolocation..."

Nearby highlighted words: [animal, night, fly]
  - "animal" is a Noun → bat_1 (animal, Noun) gets +1
  - "fly" is a Verb → bat_3 (verb, Verb) gets +1

But bat_1 also matches semantic field "Animals" with "animal" → +2

Scores: bat_1 = 3, bat_2 = 0, bat_3 = 1
Winner: bat_1 (the animal) ✓
```

### Why lexical class + semantic field?

The ASL-LEX dataset has 191 columns, but for disambiguation we only use two:

| Signal         | Coverage | Weight | Why                                    |
|----------------|----------|--------|----------------------------------------|
| Lexical class  | 99%      | +1     | Almost always available, broad signal  |
| Semantic field | 35%      | +2     | Sparse but very precise when present   |

Semantic field gets double weight because it's a stronger signal — if "bat" and "animal"
share the field "Animals", that's almost certain to be the right variant.

### The self-voting bug

Our first implementation had a subtle bug: `_getNearbyContext()` collected ALL `<mark>`
elements in the paragraph, including other instances of the word being disambiguated.
In the bat article, the paragraph "a bat has wings... afraid of the bat" had 3 `<mark>`
elements containing "bat" itself. These all voted Noun (bat_1's class), drowning out
the actual context signal.

**Fix:** filter out any nearby `<mark>` whose base word matches the target word:
```javascript
if (!base || base === word) continue;  // skip the word we're disambiguating
```

### Limitations

- Only works when there are other highlighted words nearby for context
- If a paragraph has no other glossary words, all variants score 0 and we default
  to the first entry (index 0)
- Semantic field coverage is only 35%, so most disambiguation relies on lexical class
- Doesn't consider word order or syntactic role (a true NLP parser would)

### Relation to NLP

Word sense disambiguation is one of the oldest problems in NLP. Industrial approaches
use techniques like:
- **Word embeddings** (Word2Vec, GloVe) — vector similarity between context words
- **Transformer models** (BERT) — deep contextual understanding
- **Knowledge bases** (WordNet) — structured semantic relationships

Our approach is closest to the **Lesk algorithm** (1986), which disambiguates by
comparing dictionary definitions of nearby words. We're doing the same thing but with
glossary metadata (lexical class + semantic field) instead of definitions.

### ASL-specific: the Agent Marker

Related to disambiguation is the ASL **agent marker** (PERSON sign). English agent
nouns like "player", "teacher", "singer" are signed in ASL as BASE VERB + PERSON:
- PLAY + PERSON = player
- TEACH + PERSON = teacher
- SIGN + PERSON = signer

This is a derivational affix in ASL, not a separate compound. Some words like "doctor"
are exceptions — they have their own dedicated sign and don't use the agent marker.

For the extension, this means agent nouns should map to their base verb's video (or
to a dedicated glossary entry if one exists, like `players.mp4` which shows the
compound sign). We handle these case-by-case in the irregular inflections list rather
than with a blanket rule, to avoid false positives like "doctor" → "doct".

---

## Highlight Logic (mark.js)

### How it works

The highlighter lives in `HighlightView`. It takes all words to highlight (base forms +
inflections, ~7600 total), builds a single regex `\b(?:word1|word2|...)\b`, and calls
`mark.markRegExp()` — one DOM traversal for all words.

Key details:

- Words are sorted **longest-first** before joining. This matters for regex alternation:
  "running" must be tried before "run", otherwise "run" matches first inside "running".
- Special regex characters are escaped per word to prevent pattern injection.
- `mark.js` is initialized with the `#article-container` as its scope.

### Why one regex instead of mark.js's built-in `mark(array)`

`mark.js` has a `mark(array)` method that accepts a word list. Internally it loops per
word, doing a separate DOM traversal for each. With ~2000 base words + ~5600 inflections,
that's thousands of separate DOM walks. The single-regex approach via `markRegExp()` does
it in one pass.

### Why mark.js instead of a manual TreeWalker

Under the hood, mark.js **is** a TreeWalker — it does a DFS through text nodes and wraps
regex matches in `<mark>` elements. A manual version would look like:

```
create TreeWalker(container, SHOW_TEXT)
for each text node:
    regex.exec(node.textContent)
    for each match:
        splitText() to isolate the match
        wrap in <mark>
```

For our controlled article HTML, this would work fine. mark.js earns its keep by handling
edge cases that matter on arbitrary web pages:

1. **Cross-element text** — a word split across tags like `<em>hel</em>lo`. A TreeWalker
   sees "hel" and "lo" as separate text nodes and the regex matches neither. mark.js
   stitches adjacent text nodes conceptually and wraps each piece separately.

2. **Safe unwrapping** — `unmark()` needs to remove `<mark>` elements and merge the text
   nodes back together. Without merging, the DOM ends up with fragmented text nodes that
   break text selection, confuse other scripts, and cause double-wrapping on re-highlight.

3. **Split-node bookkeeping** — wrapping a match requires `splitText()` which changes the
   text node the walker is currently on. mark.js tracks position correctly through these
   mutations.

For our demo with clean authored HTML, none of these fire. On real web pages (Grammarly
spans, CMS bold-in-middle-of-word, ad-injected tracking spans), they would.

### The `each` callback

`markRegExp()` takes an `each` callback that fires for every `<mark>` element created.
This is where the presenter attaches `mouseenter`, `mouseleave`, and `click` handlers
to each highlighted word. The callback also resolves the base word via
`VideoData.findBaseWord(element.textContent)` so the hover handler knows which glossary
entry to load.

### Two highlight modes

1. **highlightAll** — runs on page load, highlights every glossary word + inflection.
   No match tracking, no navigation.
2. **highlightWord** — runs when a word chip is clicked. Highlights only that word's forms,
   stores matches in an array, enables prev/next navigation with `goToMatch()`, and scrolls
   to the first match.

---

## Production News Site DOM Research

Research into what the highlighter will face on real news sites when this becomes a
browser extension. Based on web research (Feb 2026).

### Article body detection — the core problem

News sites don't reliably use semantic HTML. CNN's article body is a
`<div class="article__content">` with the headline in `<h1 class="headline__text">` —
all class-based, no `<article>` tag. This is typical across major news sites. CMSs
generate div-heavy markup, and some sites actively abuse semantic tags (dozens of
`<article>` elements for link lists, `<h2>` used for visual sizing rather than structure).

This means you can't just target `<article>` or `role="main"` and expect it to work
everywhere.

### Mozilla Readability.js — how article extraction actually works

Readability.js (https://github.com/mozilla/readability) is what powers Firefox Reader
View. It's heuristic-based, not ML. The algorithm:

1. **Pre-check** (`isProbablyReaderable()`) — quick scan: does the page have enough
   content to be worth processing? Checks `minContentLength` (default 140 chars) and
   `minScore` (default 20).

2. **Preprocessing** — remove scripts/styles, unwrap noscript tags (reveals lazy-loaded
   images), replace deprecated font tags with spans.

3. **Content scoring** (the heart of it):
   - **Tag type points**: `<article>` = 8, `<section>` = 8, `<p>` = 5, `<div>` = 2-5
   - **Class/ID name scoring**: +25 for names like "article", "content", "entry", "post".
     -25 for "sidebar", "comment", "footer", "banner", "hidden"
   - **Text density**: character count, comma frequency (commas signal substantial prose)
   - **Link density penalties**: navigation-heavy sections get penalized

4. **Score bubbling** — paragraph scores bubble up to parents and grandparents
   (grandparents get half). The highest-scoring ancestor container wins.

5. **Candidate selection** — top 5 candidates compared. If the winner has no siblings,
   traverse up to check parent's siblings for adjacent content.

6. **Post-processing** — remove layout tables (keep data tables), preserve images/video,
   filter hidden elements and empty paragraphs. Minimum 500 chars to return a result.

Key insight: it works because most article containers naturally accumulate high scores
(lots of `<p>` tags with long text, few links) while sidebars and nav score low (many
links, short text, negative class names). Readability has the highest median extraction
score (0.970) compared to even neural approaches.

### Paywall DOM patterns — two types

**Soft paywalls** (most common): the full article IS in the DOM, but JavaScript
overlays or blurs it. Sites do this for SEO — Google needs to see the full text to rank
the article. Common paywall elements:
- `#subscription-modal`, `.modal-backdrop`, `.redacted-overlay`
- `.subscriber-only`, `.subscription-required`
- CSS: `filter: blur(5px)`, `overflow: hidden`, `max-height` with `overflow: hidden`
  on the article container to truncate visually

This is good for us — the text is in the DOM, our highlighter can reach it. But the
overlay creates z-index and pointer-event problems for our popup.

**Hard paywalls**: the article content is NOT sent to the browser. The server returns a
truncated version (2-3 paragraphs). Nothing to highlight beyond what's shown.

### Cookie consent banners — the DOM vandals

Consent banners do several hostile things to the page:

1. **Injection location** — inserted as first or last child of `<body>`. Not inside the
   article, so container scoping protects our highlights from being marked inside banners.

2. **Scroll lock** — JavaScript adds `overflow: hidden` to `<body>`, preventing scrolling.
   This can affect our popup positioning if it relies on scroll coordinates.

3. **Accessibility override** — set `aria-hidden="true"` on ALL content behind the modal.
   Screen readers can't reach our highlights until the banner is dismissed.

4. **Visual hiding** — `backdrop-filter: blur(10px)` on the overlay blurs everything
   behind it, making highlights invisible even though they're in the DOM.

5. **Keyboard trapping** — focus is trapped inside the consent modal. Users can't Tab
   to our highlighted words until they interact with the banner.

### Anti-tampering: sites that fight back

Some sites deploy their own `MutationObserver` watching for DOM changes. If our extension
wraps text in `<mark>` elements (which is a DOM mutation inside the article container),
their observer could detect it and:
- Reload the page
- Re-inject the paywall overlay
- Remove our modifications

This means we may need to be careful about when we run the highlighter relative to the
site's own scripts, or use techniques like Shadow DOM to isolate our changes.

### The `innerHTML` replacement attack

Some paywalls don't just overlay — they replace `article.innerHTML` with a truncated
version after a delay. This destroys all our `<mark>` elements and their event listeners.
The one-line pattern: `document.body.outerHTML = truncatedHTML`. Our highlights vanish
with no error.

Detection requires a `MutationObserver` on the article container watching for `childList`
mutations. If we detect bulk removal of our `<mark>` elements, we know the content was
replaced and can re-highlight whatever remains.

### Approach options for article body detection

Three options, from most robust to simplest:

1. **Use Readability.js** — extract the article container before highlighting. Most
   accurate, handles all site structures, but adds a ~15KB dependency and requires
   cloning the DOM (Readability modifies the document it's given).

2. **Simple heuristic** — find `<article>`, fall back to `role="main"`, fall back to
   the largest text block (most `<p>` children). Less accurate but no dependency.

3. **User selection** — let the user right-click or use a keyboard shortcut to select
   the region to highlight. Most accurate for the user's intent, but requires interaction.

### Sources

- Mozilla Readability.js: https://github.com/mozilla/readability
- Readability algorithm deep dive: https://deepwiki.com/mozilla/readability
- web.dev cookie notice best practices: https://web.dev/articles/cookie-notice-best-practices
- Cookie consent accessibility analysis: https://cerovac.com/a11y/2020/07/cookie-consent-banners-and-overlays-thoughts-on-accessibility-usability-and-seo/
- Google paywalled content structured data: https://developers.google.com/search/docs/appearance/structured-data/paywalled-content
