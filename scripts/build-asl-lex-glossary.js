/**
 * Build glossary from ASL-LEX data with definitions
 *
 * Output structure:
 * {
 *   "word": [
 *     {
 *       "entryId": "word_1",
 *       "meanings": "definition1, definition2",
 *       "lexicalClass": "Verb",
 *       "videoFile": "word_1.mp4"
 *     }
 *   ],
 *   "__inflectionMap": {
 *     "running": "run",
 *     "books": "book"
 *   }
 * }
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const CSV_PATH = path.join(__dirname, '../archive/asl_lex/data-analysis/scripts/data/signdata-11-5-20.csv');
const VIDEO_DIR = path.join(__dirname, '../archive/asl_lex_videos');
const OUTPUT_PATH = path.join(__dirname, '../archive/asl-lex-glossary.json');

// Parse CSV line handling quoted fields
function parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            fields.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    fields.push(current);

    return fields;
}

// Parse the CSV file
function parseCSV(content) {
    const lines = content.split('\n');
    const headers = lines[0].split(',');

    // Find column indices we need
    const cols = {
        entryId: headers.findIndex(h => h.includes('EntryID')),
        lemmaId: headers.findIndex(h => h.includes('LemmaID')),
        vimeoUrl: headers.findIndex(h => h.includes('VimeoVideo')),
        dominantTrans: headers.findIndex(h => h.includes('DominantTranslation')),
        nondominantTrans: headers.findIndex(h => h.includes('NondominantTranslation')),
        lexicalClass: headers.findIndex(h => h.includes('LexicalClass')),
        signBankTrans: headers.findIndex(h => h.includes('SignBankEnglishTranslations')),
        semanticField: headers.findIndex(h => h.includes('SignBankSemanticField'))
    };

    console.log('Column indices:', cols);

    const entries = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const fields = parseCSVLine(line);

        const entryId = fields[cols.entryId]?.trim();
        const vimeoUrl = fields[cols.vimeoUrl]?.trim();

        if (!entryId || !vimeoUrl || !vimeoUrl.includes('vimeo.com')) {
            continue;
        }

        // Get meanings - prefer SignBank translations, fallback to dominant + nondominant
        let meanings = fields[cols.signBankTrans]?.trim() || '';
        if (!meanings) {
            const dominant = fields[cols.dominantTrans]?.trim() || '';
            const nondominant = fields[cols.nondominantTrans]?.trim() || '';
            meanings = [dominant, nondominant].filter(Boolean).join(', ');
        }

        entries.push({
            entryId,
            lemmaId: fields[cols.lemmaId]?.trim() || entryId,
            meanings: meanings || entryId.replace(/_/g, ' '),
            lexicalClass: fields[cols.lexicalClass]?.trim() || '',
            semanticField: fields[cols.semanticField]?.trim() || '',
            videoFile: `${entryId}.mp4`
        });
    }

    return entries;
}

// Build glossary grouped by lemma (base word)
function buildGlossary(entries, checkVideoExists = false) {
    const glossary = {};
    let withVideo = 0;
    let withoutVideo = 0;

    for (const entry of entries) {
        // Use lemmaId as the lookup key (lowercase for matching)
        const word = entry.lemmaId.toLowerCase().replace(/_\d+$/, '');

        // Optionally check if video file exists
        if (checkVideoExists) {
            const videoPath = path.join(VIDEO_DIR, entry.videoFile);
            if (!fs.existsSync(videoPath)) {
                withoutVideo++;
                continue;
            }
            withVideo++;
        }

        if (!glossary[word]) {
            glossary[word] = [];
        }

        glossary[word].push({
            entryId: entry.entryId,
            meanings: entry.meanings,
            lexicalClass: entry.lexicalClass,
            semanticField: entry.semanticField,
            videoFile: entry.videoFile
        });
    }

    if (checkVideoExists) {
        console.log(`Entries with video: ${withVideo}`);
        console.log(`Entries without video: ${withoutVideo}`);
    }

    return glossary;
}

// ============================================================
// Inflection Map Generation
// ============================================================

const VOWELS = new Set('aeiou');

function isVowel(ch) { return VOWELS.has(ch); }
function isConsonant(ch) { return /[a-z]/.test(ch) && !VOWELS.has(ch); }

// CVC pattern check for consonant doubling (run → running, stop → stopped)
// Only double for short words (≤4 chars) or known longer words
const DOUBLE_ALLOWLIST = new Set([
    'begin', 'forget', 'permit', 'refer', 'occur', 'prefer',
    'admit', 'commit', 'submit', 'regret', 'omit', 'control', 'patrol'
]);

function shouldDouble(word) {
    if (word.length < 3) return false;
    const last = word[word.length - 1];
    if ('wxy'.includes(last)) return false;
    const secondLast = word[word.length - 2];
    const thirdLast = word[word.length - 3];
    if (!isConsonant(last) || !isVowel(secondLast) || !isConsonant(thirdLast)) return false;
    if (word.length <= 4) return true;
    return DOUBLE_ALLOWLIST.has(word);
}

// "make", "drive", "hope" — ends in consonant + e
function endsInSilentE(word) {
    if (word.length < 3) return false;
    return word.endsWith('e') && isConsonant(word[word.length - 2]);
}

// "die", "tie", "lie" — ends in -ie (special case: ie → ying)
function endsInIE(word) {
    return word.length >= 3 && word.endsWith('ie');
}

// "carry", "happy", "try" — ends in consonant + y
function endsInConsonantY(word) {
    if (word.length < 3) return false;
    return word.endsWith('y') && isConsonant(word[word.length - 2]);
}

// "watch", "bus", "box" — needs -es not -s
function endsInSibilant(word) {
    return word.endsWith('s') || word.endsWith('x') || word.endsWith('z') ||
           word.endsWith('sh') || word.endsWith('ch');
}

function generateVerbInflections(word) {
    const forms = new Set();

    // -s / -es (3rd person singular)
    if (endsInSibilant(word)) {
        forms.add(word + 'es');
    } else if (endsInConsonantY(word)) {
        forms.add(word.slice(0, -1) + 'ies');
    } else {
        forms.add(word + 's');
    }

    // -ed (past tense)
    if (endsInIE(word)) {
        forms.add(word + 'd');              // "die" → "died"
    } else if (endsInSilentE(word)) {
        forms.add(word + 'd');              // "make" → "maked" (regular only)
    } else if (endsInConsonantY(word)) {
        forms.add(word.slice(0, -1) + 'ied'); // "carry" → "carried"
    } else if (shouldDouble(word)) {
        forms.add(word + word[word.length - 1] + 'ed'); // "stop" → "stopped"
    } else {
        forms.add(word + 'ed');             // "walk" → "walked"
    }

    // -ing (present participle)
    if (endsInIE(word)) {
        forms.add(word.slice(0, -2) + 'ying'); // "die" → "dying"
    } else if (endsInSilentE(word)) {
        forms.add(word.slice(0, -1) + 'ing');  // "make" → "making"
    } else if (shouldDouble(word)) {
        forms.add(word + word[word.length - 1] + 'ing'); // "run" → "running"
    } else {
        forms.add(word + 'ing');            // "walk" → "walking"
    }

    // NOTE: -er/-ers deliberately excluded (agent nouns = different ASL sign)
    return forms;
}

function generateNounInflections(word) {
    const forms = new Set();

    if (endsInSibilant(word)) {
        forms.add(word + 'es');             // "bus" → "buses"
    } else if (endsInConsonantY(word)) {
        forms.add(word.slice(0, -1) + 'ies'); // "city" → "cities"
    } else if (word.endsWith('fe')) {
        forms.add(word.slice(0, -2) + 'ves'); // "knife" → "knives"
        forms.add(word + 's');
    } else if (word.endsWith('f') && !word.endsWith('ff')) {
        forms.add(word.slice(0, -1) + 'ves'); // "leaf" → "leaves"
        forms.add(word + 's');
    } else {
        forms.add(word + 's');              // "book" → "books"
    }

    return forms;
}

function generateAdjectiveInflections(word) {
    const forms = new Set();

    // -er (comparative)
    if (endsInSilentE(word)) {
        forms.add(word + 'r');
    } else if (endsInConsonantY(word)) {
        forms.add(word.slice(0, -1) + 'ier');
    } else if (shouldDouble(word)) {
        forms.add(word + word[word.length - 1] + 'er');
    } else {
        forms.add(word + 'er');
    }

    // -est (superlative)
    if (endsInSilentE(word)) {
        forms.add(word + 'st');
    } else if (endsInConsonantY(word)) {
        forms.add(word.slice(0, -1) + 'iest');
    } else if (shouldDouble(word)) {
        forms.add(word + word[word.length - 1] + 'est');
    } else {
        forms.add(word + 'est');
    }

    // -ly (adverb form)
    if (endsInConsonantY(word)) {
        forms.add(word.slice(0, -1) + 'ily');
    } else if (word.endsWith('le')) {
        forms.add(word.slice(0, -1) + 'y');
    } else {
        forms.add(word + 'ly');
    }

    // -ness (noun form)
    if (endsInConsonantY(word)) {
        forms.add(word.slice(0, -1) + 'iness');
    } else {
        forms.add(word + 'ness');
    }

    return forms;
}

// Irregular forms — only applied if base word exists in glossary
const IRREGULAR_INFLECTIONS = {
    // Irregular verbs (past tense / past participle)
    'ran': 'run', 'went': 'go', 'gone': 'go',
    'came': 'come', 'coming': 'come',
    'gave': 'give', 'given': 'give',
    'took': 'take', 'taken': 'take',
    'told': 'tell', 'said': 'say',
    'made': 'make', 'done': 'do', 'did': 'do',
    'seen': 'see', 'knew': 'know', 'known': 'know',
    'thought': 'think', 'felt': 'feel',
    'left': 'leave', 'kept': 'keep',
    'found': 'find', 'sat': 'sit',
    'stood': 'stand', 'lost': 'lose',
    'paid': 'pay', 'met': 'meet',
    'brought': 'bring', 'bought': 'buy',
    'taught': 'teach', 'caught': 'catch',
    'built': 'build', 'sent': 'send',
    'spent': 'spend', 'won': 'win',
    'wrote': 'write', 'written': 'write',
    'drove': 'drive', 'driven': 'drive',
    'ate': 'eat', 'eaten': 'eat',
    'fell': 'fall', 'fallen': 'fall',
    'broke': 'break', 'broken': 'break',
    'chose': 'choose', 'chosen': 'choose',
    'spoke': 'speak', 'spoken': 'speak',
    'woke': 'wake', 'woken': 'wake',
    'forgot': 'forget', 'forgotten': 'forget',
    'began': 'begin', 'begun': 'begin',
    'sang': 'sing', 'sung': 'sing',
    'swam': 'swim', 'swum': 'swim',
    'threw': 'throw', 'thrown': 'throw',
    'grew': 'grow', 'grown': 'grow',
    'drew': 'draw', 'drawn': 'draw',
    'flew': 'fly', 'flown': 'fly',
    'wore': 'wear', 'worn': 'wear',
    'hid': 'hide', 'hidden': 'hide',
    'bit': 'bite', 'bitten': 'bite',
    'blew': 'blow', 'blown': 'blow',
    'drank': 'drink', 'drunk': 'drink',
    'rode': 'ride', 'ridden': 'ride',
    'shook': 'shake', 'shaken': 'shake',
    'fought': 'fight', 'held': 'hold',
    'hung': 'hang', 'led': 'lead',
    'shot': 'shoot', 'slept': 'sleep',
    // Irregular plurals
    'children': 'child', 'people': 'person',
    'men': 'man', 'women': 'woman',
    'teeth': 'tooth', 'feet': 'foot',
    'mice': 'mouse', 'geese': 'goose',
    'knives': 'knife', 'wives': 'wife',
    'lives': 'life', 'wolves': 'wolf',
    'leaves': 'leaf', 'halves': 'half',
    // Derivational adjectives (material → adjective)
    'wooden': 'wood', 'golden': 'gold',
    // Derivational nouns (championship is same ASL sign as champion)
    'championship': 'champion',
    // Singular form of plural-base glossary entry
    'player': 'players',
};

function generateInflectionMap(glossary) {
    const inflectionMap = {};
    const glossaryKeys = new Set(Object.keys(glossary));
    let generated = 0;
    let skippedCollisions = 0;
    let skippedMultiWord = 0;

    for (const [word, entries] of Object.entries(glossary)) {
        // Skip multi-word entries (underscored phrases)
        if (word.includes('_')) {
            skippedMultiWord++;
            continue;
        }

        // Collect all lexical classes for this word
        const classes = new Set(entries.map(e => e.lexicalClass));
        const allForms = new Set();

        // ASL-LEX classifies by ASL properties, not English parts of speech.
        // Many English words function as both noun and verb (book, sign, walk),
        // so generate both noun and verb inflections for either class.
        // The key safety rule (no -er/-ers agent nouns) is preserved in both.
        const isNounOrVerb = classes.has('Noun') || classes.has('Verb');
        const isAdjective = classes.has('Adjective');

        if (isNounOrVerb) {
            for (const f of generateNounInflections(word)) allForms.add(f);
            for (const f of generateVerbInflections(word)) allForms.add(f);
        }
        if (isAdjective) {
            for (const f of generateAdjectiveInflections(word)) allForms.add(f);
        }

        for (const form of allForms) {
            // Never override an existing glossary entry
            if (glossaryKeys.has(form)) {
                skippedCollisions++;
                continue;
            }
            // Handle conflicts between base words
            if (inflectionMap[form] && inflectionMap[form] !== word) {
                continue;
            }
            inflectionMap[form] = word;
            generated++;
        }
    }

    // Merge irregular forms (only if base word exists in glossary)
    let irregularCount = 0;
    for (const [inflected, base] of Object.entries(IRREGULAR_INFLECTIONS)) {
        if (!glossaryKeys.has(base)) continue;
        if (glossaryKeys.has(inflected)) continue;
        if (inflectionMap[inflected]) continue;
        inflectionMap[inflected] = base;
        irregularCount++;
    }

    console.log(`\nInflection map statistics:`);
    console.log(`  Rule-based inflections: ${generated}`);
    console.log(`  Irregular forms added: ${irregularCount}`);
    console.log(`  Skipped (collision with glossary key): ${skippedCollisions}`);
    console.log(`  Skipped (multi-word entries): ${skippedMultiWord}`);
    console.log(`  Total inflection entries: ${Object.keys(inflectionMap).length}`);

    return inflectionMap;
}

function verifyInflectionMap(inflectionMap, glossary) {
    const glossaryKeys = new Set(Object.keys(glossary));

    // Spot-check known positive cases
    const positives = [
        ['running', 'run'], ['books', 'book'], ['conflicting', 'conflict'],
        ['signed', 'sign'], ['walked', 'walk'], ['dying', 'die'],
    ];
    for (const [inflected, expected] of positives) {
        if (glossaryKeys.has(expected) && inflectionMap[inflected] !== expected) {
            console.warn(`  SPOT CHECK: "${inflected}" → expected "${expected}", got "${inflectionMap[inflected] || '(missing)'}"`);
        }
    }

    // Negative checks — these should NOT be in the map
    const negatives = ['signer', 'signers', 'runner', 'runners'];
    for (const word of negatives) {
        if (inflectionMap[word]) {
            console.warn(`  NEGATIVE CHECK: "${word}" should NOT be in map, maps to "${inflectionMap[word]}"`);
        }
    }

    // Sample output for manual review
    console.log('\nSample inflections:');
    const sampleWords = ['book', 'run', 'sign', 'happy', 'die', 'carry', 'make', 'big', 'child', 'knife'];
    for (const word of sampleWords) {
        if (glossary[word]) {
            const classes = [...new Set(glossary[word].map(e => e.lexicalClass))].join('/');
            const forms = Object.entries(inflectionMap)
                .filter(([_, base]) => base === word)
                .map(([inflected]) => inflected);
            console.log(`  ${word} [${classes}]: ${forms.join(', ') || '(none)'}`);
        }
    }
}

// Main
function main() {
    console.log('=== ASL-LEX Glossary Builder ===\n');

    // Check if video directory exists
    const checkVideos = fs.existsSync(VIDEO_DIR);
    if (checkVideos) {
        console.log(`Video directory found: ${VIDEO_DIR}`);
        console.log('Will only include entries with downloaded videos.\n');
    } else {
        console.log('Video directory not found - building full glossary.');
        console.log('Run download-asl-lex-videos.js first to download videos.\n');
    }

    // Read and parse CSV
    console.log('Reading ASL-LEX data...');
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const entries = parseCSV(csvContent);
    console.log(`Parsed ${entries.length} entries\n`);

    // Build glossary
    console.log('Building glossary...');
    const glossary = buildGlossary(entries, checkVideos);

    const wordCount = Object.keys(glossary).length;
    const variantCount = Object.values(glossary).reduce((sum, arr) => sum + arr.length, 0);

    console.log(`\nGlossary statistics:`);
    console.log(`  Words: ${wordCount}`);
    console.log(`  Total variants: ${variantCount}`);

    // Show some examples
    console.log('\nSample entries:');
    const samples = ['have', 'about', 'fine', 'book', 'help'];
    for (const word of samples) {
        if (glossary[word]) {
            console.log(`\n  "${word}" (${glossary[word].length} variants):`);
            for (const variant of glossary[word].slice(0, 2)) {
                console.log(`    - ${variant.entryId}: "${variant.meanings}" [${variant.lexicalClass}]`);
            }
        }
    }

    // Generate inflection map
    console.log('\nGenerating inflection map...');
    const inflectionMap = generateInflectionMap(glossary);
    verifyInflectionMap(inflectionMap, glossary);

    // Embed inflection map in glossary output
    glossary.__inflectionMap = inflectionMap;

    // Save glossary
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(glossary, null, 2));
    console.log(`\nGlossary saved to: ${OUTPUT_PATH}`);
}

main();
