/**
 * Unit Tests for TextHighlighter.getTextNodes()
 *
 * Run these in the browser console or include in test.html
 */

function runTests() {
    const results = [];

    function test(name, fn) {
        try {
            fn();
            results.push({ name, passed: true });
            console.log(`✓ ${name}`);
        } catch (error) {
            results.push({ name, passed: false, error: error.message });
            console.error(`✗ ${name}: ${error.message}`);
        }
    }

    function assertEqual(actual, expected, message = '') {
        if (actual !== expected) {
            throw new Error(`${message} Expected ${expected}, got ${actual}`);
        }
    }

    function assertTrue(value, message = '') {
        if (!value) {
            throw new Error(`${message} Expected true, got ${value}`);
        }
    }

    // Helper: Create a test container with HTML
    function createTestContainer(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div;
    }

    // ==========================================
    // TEST CASES
    // ==========================================

    test('should find basic text nodes', () => {
        const container = createTestContainer('<p>Hello World</p>');
        const highlighter = new TextHighlighter(container);
        const nodes = highlighter.getTextNodes();

        assertEqual(nodes.length, 1, 'Node count:');
        assertEqual(nodes[0].textContent, 'Hello World', 'Content:');
    });

    test('should find text in nested elements', () => {
        const container = createTestContainer('<p>Hello <b>Bold</b> World</p>');
        const highlighter = new TextHighlighter(container);
        const nodes = highlighter.getTextNodes();

        assertEqual(nodes.length, 3, 'Node count:');
        assertEqual(nodes[0].textContent, 'Hello ', 'First node:');
        assertEqual(nodes[1].textContent, 'Bold', 'Second node:');
        assertEqual(nodes[2].textContent, ' World', 'Third node:');
    });

    test('should filter out STYLE content', () => {
        const container = createTestContainer(`
            <style>.test { color: red; }</style>
            <p>Visible text</p>
        `);
        const highlighter = new TextHighlighter(container);
        const nodes = highlighter.getTextNodes();

        assertEqual(nodes.length, 1, 'Node count:');
        assertEqual(nodes[0].textContent, 'Visible text', 'Content:');
    });

    test('should filter out SCRIPT content', () => {
        const container = createTestContainer(`
            <script>const x = 1;</script>
            <p>Visible text</p>
        `);
        const highlighter = new TextHighlighter(container);
        const nodes = highlighter.getTextNodes();

        assertEqual(nodes.length, 1, 'Node count:');
        assertEqual(nodes[0].textContent, 'Visible text', 'Content:');
    });

    test('should filter out empty text nodes', () => {
        const container = createTestContainer('<p>   </p><p>Real content</p>');
        const highlighter = new TextHighlighter(container);
        const nodes = highlighter.getTextNodes();

        assertEqual(nodes.length, 1, 'Node count:');
        assertEqual(nodes[0].textContent, 'Real content', 'Content:');
    });

    test('should filter out whitespace-only nodes', () => {
        const container = createTestContainer(`
            <div>
                <p>Text</p>
            </div>
        `);
        const highlighter = new TextHighlighter(container);
        const nodes = highlighter.getTextNodes();

        assertEqual(nodes.length, 1, 'Node count:');
        assertEqual(nodes[0].textContent, 'Text', 'Content:');
    });

    test('should filter out punctuation-only nodes', () => {
        // Punctuation-only nodes are filtered out
        const container = createTestContainer('<p>Hello</p><span>.</span>');
        const highlighter = new TextHighlighter(container);
        const nodes = highlighter.getTextNodes();

        assertEqual(nodes.length, 1, 'Node count:');
        assertEqual(nodes[0].textContent, 'Hello', 'Content:');
    });

    test('should handle links inside paragraphs', () => {
        const container = createTestContainer('<p>Visit <a href="#">this link</a> now</p>');
        const highlighter = new TextHighlighter(container);
        const nodes = highlighter.getTextNodes();

        assertEqual(nodes.length, 3, 'Node count:');
        assertEqual(nodes[0].textContent, 'Visit ', 'First:');
        assertEqual(nodes[1].textContent, 'this link', 'Second:');
        assertEqual(nodes[2].textContent, ' now', 'Third:');
    });

    test('should handle multiple paragraphs', () => {
        const container = createTestContainer(`
            <p>First paragraph</p>
            <p>Second paragraph</p>
            <p>Third paragraph</p>
        `);
        const highlighter = new TextHighlighter(container);
        const nodes = highlighter.getTextNodes();

        assertEqual(nodes.length, 3, 'Node count:');
    });

    test('should handle empty container', () => {
        const container = createTestContainer('');
        const highlighter = new TextHighlighter(container);
        const nodes = highlighter.getTextNodes();

        assertEqual(nodes.length, 0, 'Node count:');
    });

    test('should handle container with only style/script', () => {
        const container = createTestContainer(`
            <style>.x{}</style>
            <script>var y;</script>
        `);
        const highlighter = new TextHighlighter(container);
        const nodes = highlighter.getTextNodes();

        assertEqual(nodes.length, 0, 'Node count:');
    });

    // ==========================================
    // EDGE CASES YOU MIGHT WANT TO HANDLE
    // ==========================================

    test('EDGE CASE: single character punctuation filtered', () => {
        const container = createTestContainer('<span>.</span><span>,</span><span>!</span>');
        const highlighter = new TextHighlighter(container);
        const nodes = highlighter.getTextNodes();

        // Punctuation-only nodes are now filtered
        assertEqual(nodes.length, 0, 'Node count:');
    });

    test('EDGE CASE: numbers only', () => {
        const container = createTestContainer('<span>123</span>');
        const highlighter = new TextHighlighter(container);
        const nodes = highlighter.getTextNodes();

        assertEqual(nodes.length, 1, 'Node count:');
        // Numbers should be kept (years, statistics, etc.)
    });

    test('EDGE CASE: hidden elements filtered', () => {
        const container = createTestContainer(`
            <p style="display:none">Hidden text</p>
            <p>Visible text</p>
        `);
        const highlighter = new TextHighlighter(container);
        const nodes = highlighter.getTextNodes();

        // Hidden elements are now filtered
        assertEqual(nodes.length, 1, 'Node count:');
        assertEqual(nodes[0].textContent, 'Visible text', 'Content:');
    });

    // ==========================================
    // SUMMARY
    // ==========================================

    console.log('\n--- TEST SUMMARY ---');
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    console.log(`Passed: ${passed}/${results.length}`);
    console.log(`Failed: ${failed}/${results.length}`);

    if (failed > 0) {
        console.log('\nFailed tests:');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`  - ${r.name}: ${r.error}`);
        });
    }

    return results;
}

// Run tests automatically if loaded
if (typeof TextHighlighter !== 'undefined') {
    console.log('Running getTextNodes() tests...\n');
    runTests();
} else {
    console.log('Load word_highlight.js first, then run: runTests()');
}
