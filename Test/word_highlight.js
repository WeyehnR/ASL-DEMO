/**
 * SKELETAL MARK.JS IMPLEMENTATION
 * Fill in the TODO sections to learn how text highlighting works
 *
 * Key Concepts:
 * - DOM has Element nodes (<p>, <div>) and Text nodes (actual text content)
 * - We only search TEXT nodes, not elements
 * - TreeWalker lets us traverse only specific node types
 * - Range API lets us select a portion of text
 * - surroundContents() wraps selected text in a new element
 */

class TextHighlighter {
  constructor(context) {
    // The element to search within (e.g., document.body or a specific div)
    this.context = context || document.body;
  }

  /**
   * STEP 1: Get all text nodes within the context
   *
   * Use: document.createTreeWalker()
   * Docs: https://developer.mozilla.org/en-US/docs/Web/API/Document/createTreeWalker
   *
   * Parameters:
   *   - root: starting element (this.context)
   *   - whatToShow: NodeFilter.SHOW_TEXT (only text nodes)
   *   - filter: null (accept all text nodes)
   */
  getTextNodes() {
    const textNodes = [];

    // TODO: Create a TreeWalker that finds only TEXT nodes
    const walker = document.createTreeWalker(
      this.context,
      NodeFilter.SHOW_TEXT,
      (node) => {
        const parent = node.parentNode;
        const parentName = parent.nodeName;

        // Filter STYLE and SCRIPT
        if (parentName === "STYLE" || parentName === "SCRIPT")
          return NodeFilter.FILTER_REJECT;

        // Filter empty/whitespace
        if (node.textContent.trim() === "") return NodeFilter.FILTER_REJECT;

        // Filter punctuation-only content
        if (/^[\s.,!?;:'"()\-\[\]]+$/.test(node.textContent))
          return NodeFilter.FILTER_REJECT;

        // Filter hidden elements (display:none)
        if (parent.closest('[style*="display:none"], [style*="display: none"]'))
          return NodeFilter.FILTER_REJECT;

        return NodeFilter.FILTER_ACCEPT;
      },
    );

    // TODO: Loop through all nodes and push to textNodes array
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    return textNodes;

    // return textNodes.filter(node => {
    //     const parent = node.parentNode.nodeName;
    //     return parent !== 'STYLE' && parent !== 'SCRIPT' && node.textContent.trim() !== '';
    // }); Is readable but you add more work in two pass
  }

  /**
   * STEP 2: Check if a text node contains the search word
   *
   * @param {Text} textNode - A text node from the DOM
   * @param {string} word - The word to search for
   * @returns {number} - Index where word starts, or -1 if not found
   */
  findWordInNode(textNode, word) {
    // TODO: Get the text content and find the word
    // Hint: use textNode.textContent and indexOf()
    // For case-insensitive: convert both to lowercase

    const text = textNode.textContent;

    // TODO: Return the index of the word in the text

    return text.toLowerCase().indexOf(word.toLowerCase()); // placeholder
  }

  /**
   * STEP 3: Wrap the found word in a <mark> element
   *
   * Use: document.createRange() and range.surroundContents()
   * Docs: https://developer.mozilla.org/en-US/docs/Web/API/Range
   *
   * @param {Text} textNode - The text node containing the word
   * @param {number} startIndex - Where the word starts
   * @param {number} wordLength - Length of the word
   */
  wrapWord(textNode, startIndex, wordLength) {
    // TODO: Create a Range object
    const range = document.createRange();
    // TODO: Set the start and end of the range
    range.setStart(textNode, startIndex);
    range.setEnd(textNode, startIndex + wordLength);
    // TODO: Create a <mark> element
    const mark = document.createElement("mark");
    // TODO: Wrap the range contents with the mark element
    range.surroundContents(mark);
    // TODO: Return the mark element (useful for styling/counting)
    return mark;
  }

  /**
   * MAIN METHOD: Highlight all occurrences of a word
   *
   * @param {string} word - The word to highlight
   * @returns {number} - Count of matches found
   */
  highlight(word) {
    if (!word) return 0;

    let count = 0;

    // STEP 1: Get all text nodes
    const textNodes = this.getTextNodes();
    console.log(`Found ${textNodes.length} text nodes to search`);

    // STEP 2 & 3: Search each text node and highlight matches
    //
    // IMPORTANT: We iterate backwards because wrapping text
    // modifies the DOM and can mess up our node list
    //
    // TODO: Loop through textNodes (try backwards: for (let i = textNodes.length - 1; i >= 0; i--))
    // TODO: For each node, find the word
    // TODO: If found, wrap it and increment count

    // YOUR CODE HERE:
    for (let i = textNodes.length - 1; i >= 0; i--) {
      const textNode = textNodes[i];
      const index = this.findWordInNode(textNode, word);

      if (index !== -1) {
        this.wrapWord(textNode, index, word.length);
        count++;
      }
    }

    return count;
  }

  /**
   * Remove all highlights
   *
   * Strategy: Find all <mark> elements, replace them with their text content
   */
  unhighlight() {
    // TODO: Find all <mark> elements in the context
    const marks = this.context.querySelectorAll('mark');
    // TODO: For each mark, replace it with its text content
    marks.forEach(mark => {
        const text = document.createTextNode(mark.textContent);
        mark.parentNode.replaceChild(text, mark);
    });
  }
}

// ============================================
// TEST FUNCTIONS (these work once you implement above)
// ============================================

let highlighter = null;

function high_light_word(word) {
  const container =
    document.getElementById("article-container") || document.body;
  highlighter = new TextHighlighter(container);
  return highlighter.highlight(word);
}

function clearHighlight() {
  if (highlighter) {
    highlighter.unhighlight();
  }
  const result = document.getElementById("result");
  if (result) result.textContent = "Cleared";
}

function testHighlight() {
  const word = document.getElementById("word-input").value;
  if (word) {
    const count = high_light_word(word);
    document.getElementById("result").textContent = `Found: ${count} matches`;
  }
}

// ============================================
// PAGE SETUP (loads test article)
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  // Load Wikipedia article for testing
  fetch("asl_article.html")
    .then((response) => response.text())
    .then((html) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      document.getElementById("article-container").innerHTML =
        doc.body.innerHTML;
    })
    .catch((err) => {
      document.getElementById("article-container").innerHTML =
        '<p style="color:red;">Error loading article. Make sure asl_article.html exists.</p>';
      console.error(err);
    });

  // Enter key triggers highlight
  const input = document.getElementById("word-input");
  if (input) {
    input.addEventListener("keypress", function (e) {
      if (e.key === "Enter") testHighlight();
    });
  }
});
