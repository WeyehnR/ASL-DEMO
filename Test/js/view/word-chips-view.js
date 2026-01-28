/**
 * Word Chips View
 * Displays clickable word chips for available glossary words
 */

export const WordChipsView = {
    container: null,

    setContainer(element) {
        this.container = element;
    },

    render(words, onChipClick) {
        if (!this.container) return;

        this.container.innerHTML = '';

        words.forEach(word => {
            const chip = document.createElement('button');
            chip.className = 'word-chip';
            chip.textContent = word;
            chip.addEventListener('click', () => onChipClick(word));
            this.container.appendChild(chip);
        });
    },

    clear() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
};
