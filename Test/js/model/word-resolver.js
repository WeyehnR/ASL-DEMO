export const wordResolver = {
  inflectionMap: {}, // inflected form → base word
  reverseMap: {}, // base word → [inflected forms]
  _glossary: null, // reference to VideoData.wordToVideos (set via init)

  // Called by VideoData.init() after loading the glossary
  init(glossary) {
    this._glossary = glossary;
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

    return null;
  },

  // Get all forms (base + inflections) for a word
  getAllForms(word) {
    const baseWord = this.findBaseWord(word);
    if (!baseWord) return [];

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
    const textWords = new Set(text.toLowerCase().match(/\b[a-z]+\b/g) || []);
    const matchedBaseWords = new Set();

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

    return [...matchedBaseWords];
  },

  // Find all glossary matches in a text string, expanded to include inflections.
  // Combines getWordsInText (find base words) + getAllForms (expand each).
  // Returns a deduplicated array ready for the highlighter's regex builder.
  getMatchingFormsInText(text) {
    const baseWords = this.getWordsInText(text);
    const allForms = new Set();
    for (const base of baseWords) {
      for (const form of this.getAllForms(base)) {
        allForms.add(form);
      }
    }
    return [...allForms];
  },

  // Check if word exists in glossary (with inflection map)
  hasWord(word) {
    return this.findBaseWord(word) !== null;
  },
};
