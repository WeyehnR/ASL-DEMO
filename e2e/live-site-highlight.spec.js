// @ts-check
import { test, expect } from "@playwright/test";
import { readFile } from "fs/promises";
import { resolve } from "path";

/**
 * Quick smoke test: inject our CSS Highlight API code onto a real website
 * and verify it highlights glossary words without breaking the page.
 *
 * This simulates what the extension would do when injected into a live page.
 * No popup or video — just highlighting, to prove the core mechanic works
 * outside the test harness.
 */

// Helper: load glossary and build word list
async function loadGlossaryWords() {
  const glossaryPath = resolve("archive/asl-lex-glossary.json");
  const glossaryRaw = await readFile(glossaryPath, "utf-8");
  const glossary = JSON.parse(glossaryRaw);

  const inflectionMap = glossary.__inflectionMap || {};
  delete glossary.__inflectionMap;
  return Object.keys(glossary).concat(Object.keys(inflectionMap));
}

// Helper: inject CSS Highlight API into the page
// Processes words in chunks to avoid regex stack overflow on large word lists
function injectHighlighting({ words, containerSelector }) {
  const container = containerSelector
    ? document.querySelector(containerSelector) || document.body
    : document.body;

  // Collect all text nodes once
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  const ranges = [];
  const CHUNK_SIZE = 500;

  // Process words in chunks to keep regex size manageable
  for (let i = 0; i < words.length; i += CHUNK_SIZE) {
    const chunk = words.slice(i, i + CHUNK_SIZE);
    const escaped = chunk
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .sort((a, b) => b.length - a.length);
    const regex = new RegExp(`\\b(?:${escaped.join("|")})\\b`, "gi");

    for (const textNode of textNodes) {
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(textNode.textContent || "")) !== null) {
        const range = new Range();
        range.setStart(textNode, match.index);
        range.setEnd(textNode, match.index + match[0].length);
        ranges.push(range);
      }
    }
  }

  if (ranges.length > 0 && "Highlight" in window) {
    const highlight = new Highlight();
    for (const r of ranges) highlight.add(r);
    CSS.highlights.set("asl-words", highlight);

    const style = document.createElement("style");
    style.textContent = `
      ::highlight(asl-words) {
        background-color: rgba(255, 255, 0, 0.4);
      }
    `;
    document.head.appendChild(style);
  }

  return ranges.length;
}

test("highlights glossary words on Wikipedia (scoped to article)", async ({
  page,
}) => {
  const allWords = await loadGlossaryWords();

  await page.goto(
    "https://en.wikipedia.org/wiki/American_Sign_Language",
    { waitUntil: "domcontentloaded" }
  );

  const count = await page.evaluate(injectHighlighting, {
    words: allWords,
    containerSelector: "#mw-content-text",
  });
  console.log(`Wikipedia (scoped): ${count} highlights`);
  expect(count).toBeGreaterThan(0);

  await page.screenshot({
    path: "e2e/screenshots/wikipedia-scoped.png",
    fullPage: false,
  });
});

test("highlights on CNN — document.body shows nav/sidebar noise", async ({
  page,
}) => {
  const allWords = await loadGlossaryWords();

  // Go directly to CNN homepage — lots of nav, sidebars, trending bars
  await page.goto("https://www.cnn.com", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  // Highlight on document.body — this is the "no Readability" case
  // Words in nav, footer, sidebar, trending bar all get highlighted
  const count = await page.evaluate(injectHighlighting, {
    words: allWords,
    containerSelector: null,
  });
  console.log(`CNN homepage (document.body): ${count} highlights`);
  expect(count).toBeGreaterThan(0);

  await page.screenshot({
    path: "e2e/screenshots/cnn-no-readability.png",
    fullPage: false,
  });
});
