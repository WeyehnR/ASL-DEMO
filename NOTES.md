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
