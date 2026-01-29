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
 *   ]
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

    // Save glossary
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(glossary, null, 2));
    console.log(`\nGlossary saved to: ${OUTPUT_PATH}`);
}

main();
