export const wordResolver = {
  inflectionMap: {}, // inflected form → base word
  reverseMap: {}, // base word → [inflected forms]
  _glossary: null, // reference to VideoData.wordToVideos (set via init)

  // Phrase support: glossary keys with underscores → space-separated forms
  _phraseMap: {}, // "high school" → "high_school"
  _phrases: [], // ["high school", "i love you", ...]

  // Suppress patterns: collocations that indicate a word is NOT being used
  // in the sign's sense. Checked against the text node surrounding a match.
  //
  // Why pattern-based instead of Lesk?
  //   Lesk requires positive evidence (meaning-token overlap with context).
  //   For single-variant words like "degree" (only the diploma sign exists),
  //   Lesk would suppress valid uses too ("she earned her degree" has no
  //   overlap with "diploma, education, major"). Collocations are more
  //   precise: "degree of" is almost always abstract, while "her degree"
  //   is almost always the diploma.
  _suppressPatterns: {
    degree: [
      /\bdegrees?\s+of\b/i,     // "degree of X", "degrees of borrowing"
      /\b\w+ing\s+degrees?\b/i, // "varying degree", "increasing degrees"
    ],
  },

  // Called by VideoData.init() after loading the glossary
  init(glossary) {
    this._glossary = glossary;

    // Build phrase lookup from underscore-keyed glossary entries
    this._phraseMap = {};
    this._phrases = [];
    for (const key of Object.keys(glossary)) {
      if (key.includes("_")) {
        const spaced = key.replace(/_/g, " ");
        this._phraseMap[spaced] = key;
        this._phrases.push(spaced);
      }
    }
  },

  // Find the base/stem word in glossary via inflection map lookup
  findBaseWord(word) {
    const normalized = word.toLowerCase();

    // Exact match in glossary
    if (this._glossary[normalized]) {
      return normalized;
    }

    // Inflection map lookup
    const base = this.inflectionMap[normalized];
    if (base && this._glossary[base]) {
      return base;
    }

    // Phrase lookup: "high school" → "high_school"
    const underscored = normalized.replace(/ /g, "_");
    if (underscored !== normalized && this._glossary[underscored]) {
      return underscored;
    }

    return null;
  },

  // Get all forms (base + inflections) for a word
  getAllForms(word) {
    const baseWord = this.findBaseWord(word);
    if (!baseWord) return [];

    // Phrases: return space-separated form for regex matching
    // "high_school" → ["high school"] (matches page text, not underscore key)
    if (baseWord.includes("_")) {
      return [baseWord.replace(/_/g, " ")];
    }

    const forms = [baseWord];
    if (this.reverseMap[baseWord]) {
      forms.push(...this.reverseMap[baseWord]);
    }
    return forms;
  },

  // Find all glossary words that appear in a text string.
  //
  // HOW: tokenizes with /\b[a-z]+\b/g, then deduplicates into a Set so
  // repeated words (e.g. "for" appearing 50x) become a single O(1) lookup.
  // Each unique token is checked against the glossary and inflectionMap.
  //
  // A 20,000-word article has far fewer unique words, so the Set shrinks
  // the work dramatically. The result can't exceed the glossary size (~2,350).
  getWordsInText(text) {
    const lowerText = text.toLowerCase();
    const textWords = new Set(lowerText.match(/\b[a-z]+\b/g) || []);
    const matchedBaseWords = new Set();

    // Single-word matching (existing logic)
    for (const textWord of textWords) {
      // Direct glossary match
      if (this._glossary[textWord]) {
        matchedBaseWords.add(textWord);
        continue;
      }
      // Inflection map match
      const base = this.inflectionMap[textWord];
      if (base && this._glossary[base]) {
        matchedBaseWords.add(base);
      }
    }

    // Phrase scanning: check if any known phrase appears in the text.
    // With ~255 phrases this is a simple substring search — under 1ms
    // even on long articles. False positives are harmless because the
    // regex's \b boundaries filter them out during the highlight pass.
    for (const phrase of this._phrases) {
      if (lowerText.includes(phrase)) {
        matchedBaseWords.add(this._phraseMap[phrase]);
      }
    }

    return [...matchedBaseWords];
  },

  // Find all glossary matches in a text string, expanded to include inflections.
  // Combines getWordsInText (find base words) + getAllForms (expand each).
  // Returns a deduplicated array ready for the highlighter's regex builder.
  //
  // Phrases (base words with underscores) are output with spaces instead of
  // underscores so the regex matches the actual page text ("high school",
  // not "high_school"). Single words are expanded to all inflected forms.
  getMatchingFormsInText(text) {
    const baseWords = this.getWordsInText(text);
    const allForms = new Set();
    for (const base of baseWords) {
      if (base.includes("_")) {
        // Phrases: add space-separated form for regex matching
        allForms.add(base.replace(/_/g, " "));
      } else {
        // Single words: expand to all inflections
        for (const form of this.getAllForms(base)) {
          allForms.add(form);
        }
      }
    }
    return [...allForms];
  },

  // Check whether a highlight match should be suppressed based on
  // surrounding text. Returns true if the word appears in a collocation
  // that indicates a different sense than the glossary sign.
  //
  // Called per-match during highlighting. We test a ±30-char window
  // around the match so patterns like "varying degrees of" are caught
  // even when the matched text is just "degrees".
  shouldSuppressMatch(baseWord, textContent, matchIndex, matchLength) {
    const patterns = this._suppressPatterns[baseWord];
    if (!patterns) return false;

    const windowStart = Math.max(0, matchIndex - 30);
    const windowEnd = Math.min(textContent.length, matchIndex + matchLength + 30);
    const window = textContent.substring(windowStart, windowEnd);

    return patterns.some(p => p.test(window));
  },

  // Check if word exists in glossary (with inflection map)
  hasWord(word) {
    return this.findBaseWord(word) !== null;
  },
};
