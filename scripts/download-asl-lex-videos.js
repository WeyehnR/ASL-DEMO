/**
 * Download ASL-LEX videos for offline use
 * Tries YouTube first, then Vimeo with referer
 *
 * Prerequisites:
 *   1. Install yt-dlp: pip install yt-dlp
 *      Or download from: https://github.com/yt-dlp/yt-dlp/releases
 *   2. Run: node scripts/download-asl-lex-videos.js
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const CSV_PATH = path.join(__dirname, '../archive/asl_lex/data-analysis/scripts/data/signdata-11-5-20.csv');
const OUTPUT_DIR = path.join(__dirname, '../archive/asl_lex_videos');
const PROGRESS_FILE = path.join(OUTPUT_DIR, 'download-progress.json');

// Extract YouTube URL from iframe HTML
function extractYouTubeUrl(rawValue) {
    if (!rawValue) return null;

    // Extract video ID from iframe: <iframe...src="https://www.youtube.com/embed/VIDEO_ID...
    const match = rawValue.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
    if (match) {
        return `https://www.youtube.com/watch?v=${match[1]}`;
    }

    // Direct YouTube URL
    if (rawValue.includes('youtube.com/watch')) {
        return rawValue.split('?')[0] + '?' + rawValue.split('?')[1]?.split('&')[0];
    }

    return null;
}

// Extract Vimeo URL from iframe HTML or direct URL
function extractVimeoUrl(rawValue) {
    if (!rawValue) return null;

    // Extract from iframe HTML or direct URL
    const match = rawValue.match(/vimeo\.com\/video\/(\d+)/);
    if (match) {
        return `https://vimeo.com/${match[1]}`;
    }

    // Player URL
    const playerMatch = rawValue.match(/player\.vimeo\.com\/video\/(\d+)/);
    if (playerMatch) {
        return `https://vimeo.com/${playerMatch[1]}`;
    }

    return null;
}

// Parse a single CSV line handling quoted fields
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

// Parse CSV
function parseCSV(content) {
    const lines = content.split('\n');
    const headers = lines[0].split(',');

    // Find column indices
    const cols = {
        entryId: headers.findIndex(h => h.includes('EntryID')),
        youtube: headers.findIndex(h => h.includes('YouTube')),
        vimeo: headers.findIndex(h => h.includes('VimeoVideo'))
    };

    console.log(`Found columns: EntryID=${cols.entryId}, YouTube=${cols.youtube}, Vimeo=${cols.vimeo}`);

    const entries = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const fields = parseCSVLine(line);
        const entryId = fields[cols.entryId]?.trim();

        if (!entryId) continue;

        const youtubeUrl = extractYouTubeUrl(fields[cols.youtube]);
        const vimeoUrl = extractVimeoUrl(fields[cols.vimeo]);

        if (youtubeUrl || vimeoUrl) {
            entries.push({
                entryId,
                youtubeUrl,
                vimeoUrl
            });
        }
    }

    return entries;
}

// Load/save progress
function loadProgress() {
    if (fs.existsSync(PROGRESS_FILE)) {
        return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
    return { completed: [], failed: [] };
}

function saveProgress(progress) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Download a single video
function downloadVideo(entryId, youtubeUrl, vimeoUrl, outputDir) {
    const outputPath = path.join(outputDir, `${entryId}.mp4`);

    // Skip if already exists
    if (fs.existsSync(outputPath)) {
        return { success: true, skipped: true };
    }

    // Try YouTube first (usually works)
    if (youtubeUrl) {
        try {
            const cmd = `yt-dlp -f "best[ext=mp4]/best" -o "${outputPath}" "${youtubeUrl}" --no-warnings --quiet`;
            execSync(cmd, { stdio: 'pipe', timeout: 120000 });
            return { success: true, skipped: false, source: 'youtube' };
        } catch (e) {
            // YouTube failed, try Vimeo
        }
    }

    // Try Vimeo with referer (for embed-only videos)
    if (vimeoUrl) {
        try {
            const cmd = `yt-dlp -f "best[ext=mp4]/best" -o "${outputPath}" "${vimeoUrl}" --referer "https://asl-lex.org/" --no-warnings --quiet`;
            execSync(cmd, { stdio: 'pipe', timeout: 120000 });
            return { success: true, skipped: false, source: 'vimeo' };
        } catch (e) {
            return { success: false, error: 'Both YouTube and Vimeo failed' };
        }
    }

    return { success: false, error: 'No valid URL' };
}

// Main
async function main() {
    console.log('=== ASL-LEX Video Downloader ===\n');

    // Check yt-dlp
    try {
        execSync('yt-dlp --version', { stdio: 'pipe' });
        console.log('yt-dlp found!\n');
    } catch {
        console.error('ERROR: yt-dlp not installed.\n');
        console.log('Install: pip install yt-dlp');
        process.exit(1);
    }

    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Parse CSV
    console.log('Reading ASL-LEX data...');
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const entries = parseCSV(csvContent);
    console.log(`Found ${entries.length} entries\n`);

    // Load progress
    const progress = loadProgress();
    const toDownload = entries.filter(e =>
        !progress.completed.includes(e.entryId) &&
        !progress.failed.includes(e.entryId)
    );

    console.log(`Completed: ${progress.completed.length}`);
    console.log(`Failed: ${progress.failed.length}`);
    console.log(`Remaining: ${toDownload.length}\n`);

    if (toDownload.length === 0) {
        console.log('All done!');
        return;
    }

    // Download
    let success = 0, skip = 0, fail = 0;

    for (let i = 0; i < toDownload.length; i++) {
        const entry = toDownload[i];
        const pct = ((i + 1) / toDownload.length * 100).toFixed(1);

        process.stdout.write(`[${pct}%] ${entry.entryId}... `);

        const result = downloadVideo(entry.entryId, entry.youtubeUrl, entry.vimeoUrl, OUTPUT_DIR);

        if (result.success) {
            if (result.skipped) {
                console.log('skipped');
                skip++;
            } else {
                console.log(`done (${result.source})`);
                success++;
            }
            progress.completed.push(entry.entryId);
        } else {
            console.log(`FAILED`);
            progress.failed.push(entry.entryId);
            fail++;
        }

        if ((i + 1) % 10 === 0) saveProgress(progress);
    }

    saveProgress(progress);

    console.log('\n=== Complete ===');
    console.log(`Success: ${success}`);
    console.log(`Skipped: ${skip}`);
    console.log(`Failed: ${fail}`);
    console.log(`\nVideos: ${OUTPUT_DIR}`);
}

main().catch(console.error);
