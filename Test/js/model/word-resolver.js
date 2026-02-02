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

  // Find all glossary words that appear in a text
  // Tokenizes text and does O(1) lookups against glossary + inflection map
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

  // Check if word exists in glossary (with inflection map)
  hasWord(word) {
    return this.findBaseWord(word) !== null;
  },
};
