# ASL Demo - Architecture & Flow Diagrams

## Architecture Overview (MVP Pattern)

```mermaid
graph TB
    subgraph Models["Model Layer"]
        AppState["AppState<br/>currentWord, entry, loading,<br/>hasVideo, matchCount"]
        VideoData["VideoData<br/>glossary lookup, stemming,<br/>word matching"]
    end

    subgraph Presenters["Presenter Layer"]
        AppP["AppPresenter<br/>Main coordinator"]
        HighP["HighlightPresenter<br/>Highlighting + navigation"]
        PopupP["PopupPresenter<br/>Popup + video loading"]
    end

    subgraph Views["View Layer"]
        HView["HighlightView<br/>mark.js wrapper"]
        PView["PopupView<br/>Video popup DOM"]
        RView["ResultView<br/>Match count + nav"]
        WView["WordChipsView<br/>Sidebar word selector"]
    end

    subgraph External["External"]
        MarkJS["mark.js"]
        Glossary["asl-lex-glossary.json"]
        Videos["ASL Video Files (MP4)"]
    end

    AppP --> HighP
    AppP --> PopupP
    AppP --> WView
    HighP --> HView
    HighP --> RView
    HighP --> PopupP
    PopupP --> PView
    HighP --> AppState
    PopupP --> AppState
    PopupP --> VideoData
    HighP --> VideoData
    HView --> MarkJS
    VideoData --> Glossary
    PView --> Videos
```

## Application Startup Flow

```mermaid
sequenceDiagram
    participant Browser
    participant HTML as mvp_test.html
    participant VP as AppPresenter
    participant VD as VideoData
    participant HP as HighlightPresenter
    participant HV as HighlightView
    participant PP as PopupPresenter
    participant WC as WordChipsView

    Browser->>HTML: Load page
    HTML->>HTML: Load mark.js
    HTML->>VP: Load app-presenter.js (ES module)
    VP->>VP: DOMContentLoaded

    VP->>VD: await init()
    VD->>VD: Fetch asl-lex-glossary.json
    VD->>VD: Extract __inflectionMap, build reverseMap
    VD-->>VP: ~2000 words + ~5600 inflections loaded

    VP->>PP: init()
    PP->>PP: Create popup DOM + bind events

    VP->>VP: loadArticle()
    VP->>VP: Fetch asl_article.html → inject into DOM

    VP->>HP: highlightAllGlossaryWords()
    HP->>VD: base words + inflection map keys
    HP->>HV: highlightAll(~7600 words)
    HV->>HV: Build single regex: \b(word1|word2|...)\b
    HV->>HV: mark.js ONE DOM pass
    HV-->>HP: Each match → attach hover/click handlers

    VP->>VP: populateWordChipsFromDOM()
    VP->>WC: build(uniqueWords, onChipClick)
    WC->>WC: Group alphabetically, render chips
```

## Hover Interaction Flow

```mermaid
sequenceDiagram
    participant User
    participant Mark as <mark> element
    participant PP as PopupPresenter
    participant VD as VideoData
    participant AS as AppState
    participant PV as PopupView

    User->>Mark: mouseenter "conflicting"
    Note over Mark: findBaseWord("conflicting") → "conflict"
    Mark->>PP: showPopup(element, "conflict")
    PP->>AS: setCurrentWord("conflict")
    PP->>AS: setLoading(true)
    PP->>PV: render(state) → show loading spinner
    PP->>PV: position(element) → place near word
    PP->>PV: show()

    PP->>VD: getRandomEntryForWord("conflict")
    VD-->>PP: {entryId, meanings, lexicalClass, videoFile}

    PP->>AS: setCurrentEntry(entry)
    PP->>PV: loadVideo(videoPath)
    PV->>PV: Set <video> src
    PV-->>PP: canplay event
    PP->>AS: setHasVideo(true)
    PP->>PV: render(state) → show video + meanings

    User->>Mark: mouseleave
    Mark->>PP: hidePopup() (200ms delay)
    PP->>PV: hide()
```

## Click to Pin / Word Chip Flow

```mermaid
sequenceDiagram
    participant User
    participant WC as WordChipsView
    participant HP as HighlightPresenter
    participant HV as HighlightView
    participant RV as ResultView
    participant PP as PopupPresenter
    participant PV as PopupView

    alt Click Word Chip
        User->>WC: Click "conflict" chip
        WC->>HP: highlightWord("conflict")
        HP->>VD: getAllForms("conflict")
        VD-->>HP: ["conflict", "conflicts", "conflicted", "conflicting"]
        HP->>HV: highlight(allForms)
        HV->>HV: Regex from explicit word list
        HV->>HV: mark.js DOM pass
        HV-->>HP: matches[] populated
        HP->>HP: goToMatch(0)
        HP->>HP: Scroll to first match
        HP->>RV: showCount(N, presenter)
        RV->>RV: Display "◀ 1 of N ▶"
    end

    alt Click Highlighted Word (Pin Popup)
        User->>HP: Click on <mark> element
        HP->>PP: expandPopup(element, word)
        PP->>PV: expand()
        PV->>PV: Fixed center, 480px, close button visible
        Note over PV: Popup stays open (pinned)
    end

    alt Click Same Pinned Word (Toggle)
        User->>HP: Click same <mark> element
        HP->>PP: expandPopup(element, sameWord)
        PP->>PV: collapse()
        PV->>PV: Hide popup, unpin
    end
```

## Match Navigation

```mermaid
graph LR
    A["◀ Prev"] -->|prevMatch| B["goToMatch(i-1)"]
    C["▶ Next"] -->|nextMatch| B2["goToMatch(i+1)"]

    B --> D["Remove 'current-match' from old"]
    B2 --> D
    D --> E["Add 'current-match' to new"]
    E --> F["Smooth scroll to match"]
    F --> G["Update ResultView: '2 of 5'"]
    G -->|wraps around| B
```

## Data Pipeline (Build Phase)

```mermaid
flowchart LR
    A["ASL-LEX CSV<br/>signdata-11-5-20.csv"] -->|build-asl-lex-glossary.js| B["asl-lex-glossary.json<br/>~2000 words + inflection map"]
    A -->|download-asl-lex-videos.js| C["MP4 video files<br/>via yt-dlp"]
    B --> D["VideoData.init()"]
    C --> E["PopupView.loadVideo()"]
    D --> F["Runtime App"]
    E --> F
```

## Key Design Decisions

- **Single DOM pass**: All ~2000 glossary words are combined into one regex and matched in a single `mark.js` traversal, avoiding per-word loops that would freeze the page.
- **Pre-computed inflection map**: The build script generates an `__inflectionMap` (inflected form → base word) embedded in the glossary JSON. At runtime, `findBaseWord()` is two hash lookups — no suffix stripping, no false positives. Handles regular inflections, consonant doubling, ie→ying, irregular forms (ran→run, children→child), and deliberately excludes agent nouns (-er/-ers) since those are different ASL signs.
- **Base word display**: Popup always shows the dictionary form (e.g., "accept" not "accepted") since ASL signs don't inflect for tense — the same sign covers all English forms.
- **Pinned popup state**: Click pins the popup open so users can read definitions while scrolling; hover alone is transient with a 200ms hide delay.

## Future Considerations

### Decouple Presenters

HighlightPresenter directly calls PopupPresenter (`showPopup`, `expandPopup`). Replace with an event-based approach so they communicate without knowing about each other. This makes each presenter independently testable and swappable (e.g., replace popup with a sidebar panel).

### ~~Pre-computed Stemming Map~~ (Done)

Implemented. The build script (`build-asl-lex-glossary.js`) now generates an `__inflectionMap` with ~5,600 entries covering regular inflections (noun plurals, verb conjugations, adjective forms), ~80 irregular forms, and consonant doubling. Agent nouns (-er/-ers) are excluded. `VideoData.findBaseWord()` is now a simple map lookup. `getWordsInText()` tokenizes and does O(1) lookups per word instead of scanning 2000+ regexes.

### Accessibility

- Add `role="button"` and `aria-label` on highlighted `<mark>` elements
- Add `aria-live` region for the popup so screen readers announce content changes
- Implement keyboard navigation: Tab into popup, Escape to close, arrow keys for match navigation

### Testing Strategy

#### Current State

Only `VideoData` has tests (45 assertions in `video-data.test.js`, custom runner, runs in Node.js). All presenters and views are untested. That's roughly 4% coverage by module count.

#### Testing Layers

The MVP architecture naturally maps to three testing layers, each serving a different purpose:

**1. Unit Tests — Model Layer (Node.js, no DOM)**

Pure data logic. No browser needed. Fast to run, easy to write.

| Module | What to test | Priority |
|--------|-------------|----------|
| `VideoData` | `findBaseWord`, `getAllForms`, `getWordsInText`, inflection map lookup, collision handling | ✅ Done |
| `AppState` | Setter/getter correctness, `reset()` clears all fields, state never leaks between calls | Low — trivial setters, but useful as a regression guard |

**2. Integration Tests — Presenter Layer (Node.js with mocked Views)**

This is the highest-value untested layer. Presenters contain all the coordination logic — state transitions, event sequencing, error handling — but they don't touch the DOM directly. Mock the views and test the presenter logic in isolation.

| Module | Critical logic to test |
|--------|----------------------|
| `HighlightPresenter` | Match navigation wraps around correctly (index 0 → N-1 → 0). `highlightWord()` resets previous matches before starting new ones. `highlightAllGlossaryWords()` passes both base words and inflected forms. `clearHighlights()` resets state and delegates to view. |
| `PopupPresenter` | Pin/unpin toggle: click same word twice collapses. Hover while pinned does not override pinned popup. 200ms hide delay cancels if mouse re-enters. Video load error updates state to `hasVideo: false`. `showPopup` resolves base word before loading entry. |
| `AppPresenter` | Init sequence: VideoData → PopupPresenter → loadArticle → highlight → word chips. `handleClear()` delegates to HighlightPresenter. |

**How to mock**: Each view is a plain object with methods. Create stub objects that record calls:

```js
const mockHighlightView = {
    highlightAllCalls: [],
    highlightAll(words, onEach) {
        this.highlightAllCalls.push({ words });
        // simulate matches by calling onEach with fake elements
    },
    clear(cb) { cb(); }
};
```

This layer catches the bugs that matter most — wrong navigation state, popup stuck open, events firing in the wrong order — without needing a browser.

**3. E2E Tests — Full Browser (Playwright)**

Real browser, real DOM, real mark.js. This is where you verify that the pieces actually work together and is essential for browser extension readiness since extensions run on unpredictable third-party pages.

| Flow | What to verify |
|------|---------------|
| **Page load** | Article loads, `<mark>` elements appear in DOM, sidebar populates with word chips |
| **Hover → popup** | Hover on highlighted word → popup appears with video, correct base word displayed (not inflected form), popup disappears after mouse leaves |
| **Click → pin** | Click highlighted word → popup pins in center, click again → popup collapses |
| **Word chip → navigate** | Click chip → matches highlighted, "1 of N" counter shown, prev/next buttons cycle through matches, scroll position changes |
| **Search** | Type in search box → chips filter, clear search → all chips return |
| **Inflections** | Hover on "accepted" → popup shows "accept", hover on "running" → popup shows "run" |
| **Edge cases** | Short words don't false-match inside longer words ("art" doesn't match inside "article"). Words at start/end of sentences still highlight. |

**Why Playwright over Cypress**: Playwright supports browser extension testing natively via `chromium.launchPersistentContext()` with the `--load-extension` flag. When this becomes an extension, the same E2E suite tests it on real web pages.

#### What NOT to Unit Test

**Views** (`HighlightView`, `PopupView`, `ResultView`, `WordChipsView`) are thin DOM wrappers. Testing them in isolation requires JSDOM or a real browser, and the tests end up mirroring the implementation ("did you call `classList.add`?"). They get covered naturally by E2E tests. The exception is `PopupView.position()` — the positioning math (above/below target, minimum margins) could be extracted into a pure function and unit tested.

#### Test Pyramid for This Project

```
        /  E2E  \          ← 5-10 tests, Playwright, slow but high confidence
       /----------\
      / Integration \       ← 20-30 tests, mocked views, catches coordination bugs
     /----------------\
    /    Unit (Models)   \  ← 50+ assertions, Node.js, fast, catches data bugs
   /----------------------\
```

#### Tooling Recommendations

| Tool | Purpose | Why |
|------|---------|-----|
| **Vitest** | Test runner + assertions | Fast, ES module native (matches current codebase), built-in mocking. Jest works too but requires more config for ES modules. |
| **Playwright** | E2E browser tests | Extension testing support, multi-browser, good async handling |
| **c8 / v8 coverage** | Code coverage | Built into Vitest, shows which presenter branches are untested |

#### Priority Order

1. **Presenter integration tests** — highest value, catches the most dangerous bugs (stuck states, wrong navigation, popup not closing)
2. **E2E happy paths** — verifies the full stack works in a real browser
3. **AppState unit tests** — quick to write, low risk
4. **E2E edge cases** — inflections, short words, rapid hover
5. **Build script tests** — verify inflection generation rules produce expected output

### Video Loading

Every hover triggers a video load. Quick hovers across multiple words start and abort loads repeatedly. An LRU cache (5-10 entries) for loaded video blobs would make re-hovers instant and reduce network churn.

### Production-Site Highlight Testing

When the extension runs on arbitrary web pages (news sites, blogs), the highlighter will encounter hostile DOM conditions that don't exist in our controlled article. Test with fixture HTML files that simulate each scenario:

**1. Scoping — don't highlight outside the article**

Pages have nav bars, footers, cookie banners, comment sections all containing text. Verify that only the article body is highlighted, not "Sign up for our newsletter" in a banner.

**2. Late-injected DOM — popups that arrive after highlighting**

Subscription modals and paywalls often inject themselves into the article container seconds after page load. This can displace existing `<mark>` elements. Verify that highlights and their event listeners survive DOM insertion by siblings. Requires a `MutationObserver` to detect and handle new content.

**3. DOM removal — paywalls that delete content**

Some paywalls replace article `innerHTML` with a truncated version, destroying all `<mark>` elements. Verify the highlighter detects content removal, re-highlights remaining text, updates match counts, and doesn't leak orphaned event listeners from removed marks.

**4. Z-index conflicts — our popup vs their popup**

Cookie banners and modals fight for z-index. Verify that site overlays render above our video popup, and that hover events on `<mark>` elements don't fire through an overlay (no phantom popup behind a modal).

**5. CSS conflicts — site styles overriding ours**

News sites may have global `mark { background: none; }` resets or `* { cursor: default !important; }`. Verify highlights remain visible. Options: higher specificity selectors, `!important`, or shadow DOM isolation for the popup.

**6. Dynamic content — "read more" / infinite scroll**

Articles that load more paragraphs on scroll or click. Verify newly loaded content gets highlighted, word chips update, and match navigation includes new matches. Requires `MutationObserver` on added child nodes.

**Test fixture approach:**

```
test/fixtures/
  ├── clean-article.html          ← baseline, no interference
  ├── late-injected-modal.html    ← script injects popup after 500ms
  ├── paywall-truncation.html     ← script replaces article after 1s
  ├── split-text-nodes.html       ← words broken across <span>s
  ├── aggressive-css-reset.html   ← mark { background: none } etc.
  └── infinite-scroll.html        ← loads more paragraphs on scroll
```

Each fixture is a self-contained HTML page with a script simulating the hostile behavior on a timer. The test suite loads each fixture, runs the highlighter, triggers the hostile behavior, and asserts the highlighter either handles it or degrades gracefully.

### Hover-to-Video Chain — Known Downsides

The full hover path (`showPopup → getNearbyContext → disambiguate → getVideo → loadVideo`) has several structural issues worth addressing as the project matures:

**1. Disambiguation is paragraph-scoped and silent-fallback**

`getNearbyContext` only looks at other `<mark>` elements in the same `<p>`. Context in the previous paragraph, a heading, or a subheading is invisible. If there are no nearby glossary words, every variant scores 0 and index 0 wins silently — the user gets whichever variant was listed first in the dataset with no indication that the system guessed.

**2. Metadata display blocks on video fetch**

`AppState.setCurrentEntry()` is called before the fetch starts, but `PopupView.render()` only runs inside the `onReady` callback. The word's definition and metadata could be shown immediately while the video loads, rather than waiting behind the spinner.

**3. Cache key is per-word, `currentIndex` is mutable shared state**

The LRU cache keys on the base word. If "bat" is disambiguated to variant 0 in one paragraph and variant 2 in another, the second hover mutates `cached.currentIndex` on the same cache entry. Clicking "next variant" on the first instance then cycles from the wrong starting point.

**4. Background prefetch is unthrottled and fire-and-forget**

`_fetchRemainingVariants` fires fetches for all other variants with no concurrency limit. Rapidly hovering across 10 multi-variant words can launch 30+ parallel fetches, competing with the primary fetch the user is waiting on. Failed background fetches set `blobUrls[i] = null` silently — the "next variant" button skips them with no user feedback.

**5. Race guard is word-level, not request-level**

`_loadingWord` tracks a single string. It correctly discards stale responses when the user moves to a different word, but doesn't distinguish between two overlapping fetches for the same word. An `AbortController` per request would be more precise and would also free network resources when a fetch is no longer needed.

**6. Synchronous coupling across four modules**

`PopupPresenter → HighlightPresenter → VideoData → VideoService` — four modules deep in one synchronous call stack. If disambiguation ever needs to be async (e.g., calling an NLP API or LLM for better word sense disambiguation), the change would ripple through the entire chain. An event-based or async-first design (related to "Decouple Presenters" above) would isolate that change.

### Browser Extension Readiness

- Content script entry point that highlights existing page content instead of fetching/injecting an article
- CSP handling for mark.js injection and inline styles
- Scoped highlighting that doesn't conflict with site markup
