/**
 * Word Chips View
 * Displays clickable word chips organized by letter with search filter
 */

export const WordChipsView = {
    container: null,
    allWords: [],
    onChipClick: null,

    setContainer(element) {
        this.container = element;
    },

    render(words, onChipClick) {
        if (!this.container) return;

        this.allWords = words;
        this.onChipClick = onChipClick;

        this.container.innerHTML = '';

        // Create search input
        const searchContainer = document.createElement('div');
        searchContainer.className = 'word-search-container';
        searchContainer.innerHTML = `
            <input type="text" class="word-search-input" placeholder="Search words..." />
            <span class="word-count">${words.length} words</span>
        `;
        this.container.appendChild(searchContainer);

        // Create sections container
        const sectionsContainer = document.createElement('div');
        sectionsContainer.className = 'word-sections';
        this.container.appendChild(sectionsContainer);

        // Bind search
        const searchInput = searchContainer.querySelector('.word-search-input');
        searchInput.addEventListener('input', (e) => this.filterWords(e.target.value));

        // Render all sections
        this.renderSections(words, sectionsContainer);
    },

    renderSections(words, container) {
        container.innerHTML = '';

        // Group words by first letter
        const grouped = this.groupByLetter(words);

        // Create section for each letter
        Object.keys(grouped).sort().forEach(letter => {
            const section = this.createSection(letter, grouped[letter]);
            container.appendChild(section);
        });
    },

    groupByLetter(words) {
        const grouped = {};
        words.forEach(word => {
            const firstChar = word[0].toUpperCase();
            // Group numbers and special chars under '#'
            const letter = /[A-Z]/.test(firstChar) ? firstChar : '#';
            if (!grouped[letter]) {
                grouped[letter] = [];
            }
            grouped[letter].push(word);
        });
        return grouped;
    },

    createSection(letter, words) {
        const section = document.createElement('div');
        section.className = 'word-section collapsed';

        // Header
        const header = document.createElement('button');
        header.className = 'word-section-header';
        header.innerHTML = `
            <span class="word-section-arrow">▶</span>
            <span class="word-section-letter">${letter}</span>
            <span class="word-section-count">(${words.length})</span>
        `;
        header.addEventListener('click', () => {
            section.classList.toggle('collapsed');
        });

        // Content
        const content = document.createElement('div');
        content.className = 'word-section-content';

        words.forEach(word => {
            const chip = document.createElement('button');
            chip.className = 'word-chip';
            chip.textContent = word;
            chip.addEventListener('click', () => this.onChipClick(word));
            content.appendChild(chip);
        });

        section.appendChild(header);
        section.appendChild(content);

        return section;
    },

    filterWords(query) {
        const sectionsContainer = this.container.querySelector('.word-sections');
        const countSpan = this.container.querySelector('.word-count');
        const queryLower = query.toLowerCase().trim();

        if (!queryLower) {
            // Show all words in sections
            this.renderSections(this.allWords, sectionsContainer);
            countSpan.textContent = `${this.allWords.length} words`;
            return;
        }

        // Filter words that start with or contain the query
        const filtered = this.allWords.filter(word =>
            word.toLowerCase().includes(queryLower)
        );

        // Sort: words starting with query first, then alphabetically
        filtered.sort((a, b) => {
            const aStarts = a.toLowerCase().startsWith(queryLower);
            const bStarts = b.toLowerCase().startsWith(queryLower);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return a.localeCompare(b);
        });

        // Render filtered results (flat, no sections for search results)
        sectionsContainer.innerHTML = '';

        if (filtered.length === 0) {
            sectionsContainer.innerHTML = '<div class="no-results">No words found</div>';
        } else {
            const flatContainer = document.createElement('div');
            flatContainer.className = 'word-chips-flat';

            filtered.forEach(word => {
                const chip = document.createElement('button');
                chip.className = 'word-chip';
                chip.textContent = word;
                chip.addEventListener('click', () => this.onChipClick(word));
                flatContainer.appendChild(chip);
            });

            sectionsContainer.appendChild(flatContainer);
        }

        countSpan.textContent = `${filtered.length} of ${this.allWords.length}`;
    },

    clear() {
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.allWords = [];
        this.onChipClick = null;
    }
};
