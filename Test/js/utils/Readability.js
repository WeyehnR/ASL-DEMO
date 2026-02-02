/**
 * Simplified Readability
 * Extracts the main article container from an arbitrary web page.
 *
 * Based on Mozilla's Readability.js algorithm:
 * https://github.com/mozilla/readability
 *
 * Usage:
 *   const reader = new Readability(document.cloneNode(true));
 *   const article = reader.parse();
 *   // article.content  = cleaned HTML string
 *   // article.title    = best-guess page title
 *   // article.element  = the winning container element
 */

// Words that suggest an element IS article content
const POSITIVE_NAMES = [
  // TODO: add class/id substrings that signal article content
  // e.g. "article", "body", "content", "entry", "post", "text", "story"
];

// Words that suggest an element is NOT article content
const NEGATIVE_NAMES = [
  // TODO: add class/id substrings that signal non-article content
  // e.g. "sidebar", "comment", "footer", "nav", "banner", "ad", "widget"
];

// Tags to remove entirely during preprocessing
const STRIP_TAGS = [
  // TODO: list tag names that never contain article text
  // e.g. "script", "style", "nav", "footer", "aside", "iframe"
];

// Minimum text length (chars) for a paragraph to be worth scoring
const MIN_PARAGRAPH_LENGTH = 25;

export class Readability {
  /**
   * @param {Document} doc - a CLONED document (this algorithm modifies the DOM)
   *
   * Why cloned? The preprocessing step removes elements. If you pass the live
   * document, you'd destroy the actual page. document.cloneNode(true) gives
   * you a full deep copy to work with safely.
   */
  constructor(doc) {
    this._doc = doc;
    // Map of element → score. We use a Map instead of expando properties
    // to avoid polluting DOM elements with custom fields.
    this._scores = new Map();
  }

  /**
   * Main entry point. Returns { title, content, element } or null.
   */
  parse() {
    const title = this._getTitle();

    this._preprocess();

    const candidates = this._scoreCandidates();

    if (candidates.length === 0) return null;

    const winner = this._pickWinner(candidates);

    this._postProcess(winner);

    return {
      title,
      content: winner.innerHTML,
      element: winner,
    };
  }

  // ── Step 1: Title extraction ──────────────────────────────────────────

  /**
   * Best-effort title extraction.
   * Try <title> tag, clean it up, fall back to first <h1>.
   *
   * Readability.js does something clever: if the <title> contains a separator
   * like " | " or " - " (common in "Article Title - Site Name"), it takes
   * the longer half as the real title.
   */
  _getTitle() {
    // TODO:
    // 1. Get text from <title> tag
    // 2. If it contains " | " or " - ", split and take the longer piece
    // 3. If result is too short (< 3 words), fall back to first <h1>
    // 4. Return the title string (or empty string if nothing found)
    return "";
  }

  // ── Step 2: Preprocessing ─────────────────────────────────────────────

  /**
   * Remove elements that can never be article content.
   * This reduces noise before scoring.
   *
   * Walk the DOM and remove:
   * - Elements with tags in STRIP_TAGS
   * - Hidden elements (display:none, visibility:hidden, aria-hidden="true")
   * - Elements with zero dimensions (common for tracking pixels)
   */
  _preprocess() {
    // TODO:
    // 1. For each tag in STRIP_TAGS, querySelectorAll and remove all matches
    // 2. Walk remaining elements, remove any that are hidden
    //    Hint: element.offsetHeight === 0 catches display:none
    //    Hint: getComputedStyle(el).visibility === "hidden"
    //    Hint: el.getAttribute("aria-hidden") === "true"
    //
    // Note: remove from bottom-up (convert NodeList to array first),
    // otherwise removing a parent also removes children you haven't
    // checked yet, which is fine but wastes iteration.
  }

  // ── Step 3: Score candidates ──────────────────────────────────────────

  /**
   * Find all <p> elements, score each one, and bubble scores up to
   * parent and grandparent containers. Returns array of scored elements.
   *
   * Scoring a paragraph:
   * - Base score from text length (longer = better)
   * - Bonus for commas (commas appear in substantial prose, not in nav links)
   * - Bonus/penalty from parent's class and id names
   *
   * Score bubbling:
   * - Parent gets the full paragraph score added
   * - Grandparent gets half the paragraph score added
   * - This naturally makes article containers (which hold many <p>s) score highest
   */
  _scoreCandidates() {
    const paragraphs = this._doc.querySelectorAll("p");
    const candidates = new Set();

    for (const p of paragraphs) {
      const text = p.textContent.trim();
      if (text.length < MIN_PARAGRAPH_LENGTH) continue;

      const parent = p.parentElement;
      const grandparent = parent ? parent.parentElement : null;

      // Initialize scores for containers we haven't seen yet
      if (parent && !this._scores.has(parent)) {
        this._scores.set(parent, this._getInitialScore(parent));
        candidates.add(parent);
      }
      if (grandparent && !this._scores.has(grandparent)) {
        this._scores.set(grandparent, this._getInitialScore(grandparent));
        candidates.add(grandparent);
      }

      const paragraphScore = this._scoreParagraph(text);

      // TODO: Bubble the score up
      // 1. Add full paragraphScore to parent's score
      // 2. Add half paragraphScore to grandparent's score
      // Hint: this._scores.get(el) and this._scores.set(el, newScore)
    }

    return [...candidates];
  }

  /**
   * Initial score for a container element, based on its tag and class/id.
   *
   * Tag scores (from Readability.js):
   *   <article> = +8   (strong signal)
   *   <section> = +8
   *   <div>     = +5   (neutral, most content lives in divs)
   *   <pre>, <blockquote> = +3
   *   <td>      = +3
   *   <form>    = -3   (usually not article content)
   *   <address> = -3
   *
   * Then adjust by class/id name:
   *   +25 if class or id contains a POSITIVE_NAMES word
   *   -25 if class or id contains a NEGATIVE_NAMES word
   */
  _getInitialScore(element) {
    let score = 0;

    // TODO: Score by tag name
    // Hint: element.tagName.toLowerCase()

    // TODO: Adjust by class and id name
    // Hint: use this._getNameScore(element) helper below

    return score;
  }

  /**
   * Check element's class and id against POSITIVE_NAMES and NEGATIVE_NAMES.
   * Returns a score adjustment (+25, -25, or 0).
   *
   * Combine class and id into one string, lowercase it, then check if any
   * positive/negative name appears as a substring.
   */
  _getNameScore(element) {
    const names = (
      (element.className || "") +
      " " +
      (element.id || "")
    ).toLowerCase();

    // TODO:
    // 1. Check if any POSITIVE_NAMES word is a substring of `names` → +25
    // 2. Check if any NEGATIVE_NAMES word is a substring of `names` → -25
    // 3. If both match, they cancel out (net 0)
    // 4. Return the total adjustment

    return 0;
  }

  /**
   * Score a paragraph's text content.
   *
   * Readability.js formula:
   * - Start at 1 (base point for being a paragraph at all)
   * - +1 for every comma (commas = real sentences, not link lists)
   * - +1 for every 100 characters of text length (diminishing returns)
   * - Cap the length bonus at 3 (so a 10,000-char paragraph doesn't dominate)
   */
  _scoreParagraph(text) {
    // TODO: Implement the scoring formula above
    return 0;
  }

  // ── Step 4: Pick the winner ───────────────────────────────────────────

  /**
   * From scored candidates, return the element with the highest score.
   *
   * Readability.js also checks: if the top candidate is very small,
   * try its parent instead (the article might be one level up).
   * For the boilerplate, just return the highest scorer.
   */
  _pickWinner(candidates) {
    // TODO:
    // 1. Sort candidates by score (highest first)
    //    Hint: candidates.sort((a, b) => this._scores.get(b) - this._scores.get(a))
    // 2. Return the first element
    //
    // Stretch: if winner has very few direct <p> children (say < 3),
    //          check if its parent scores within 80% — if so, prefer parent.
    return candidates[0];
  }

  // ── Step 5: Post-processing ───────────────────────────────────────────

  /**
   * Clean up the winning container. Remove elements that snuck in
   * but aren't article content.
   *
   * Things to remove:
   * - Empty elements (no text, no images)
   * - Elements where link text is > 50% of total text (nav-like)
   * - Remaining <aside>, <footer>, <header> inside the winner
   * - <table> elements used for layout (< 5 rows, or mostly links)
   *
   * Be conservative — it's better to leave a stray element than to
   * accidentally remove a paragraph of the article.
   */
  _postProcess(element) {
    // TODO:
    // 1. Remove empty elements (walk bottom-up)
    // 2. Remove link-heavy elements
    //    Hint: compare total textContent.length vs
    //    combined textContent.length of all <a> descendants
    // 3. Remove remaining non-content tags (aside, footer, header)
  }

  // ── Utilities ─────────────────────────────────────────────────────────

  /**
   * Helper: get total text length of an element, excluding nested links.
   * Useful for checking if an element is "link-heavy" (navigation, not prose).
   */
  _getNonLinkTextLength(element) {
    const totalText = element.textContent.length;
    const links = element.querySelectorAll("a");
    let linkText = 0;
    for (const a of links) {
      linkText += a.textContent.length;
    }
    return totalText - linkText;
  }

  /**
   * Helper: check if an element is probably visible.
   * Used during preprocessing to remove hidden tracking elements.
   */
  _isVisible(element) {
    // TODO:
    // Return false if element has:
    //   - display: none
    //   - visibility: hidden
    //   - aria-hidden="true"
    //   - zero offsetHeight and offsetWidth
    // Return true otherwise
    return true;
  }
}
