/**
 * Result View
 * Handles the result display DOM operations with navigation
 */

export const ResultView = {
    element: null,
    presenter: null,

    /**
     * Set the result element
     */
    setElement(element) {
        this.element = element;
    },

    /**
     * Display match count with navigation if multiple matches
     */
    showCount(count, presenter) {
        if (!this.element) {
            this.element = document.getElementById('result');
        }
        if (!this.element) return;

        this.presenter = presenter;

        if (count === 0) {
            this.element.innerHTML = `<span class="result-text">Found: 0 matches</span>`;
        } else if (count === 1) {
            this.element.innerHTML = `<span class="result-text">Found: 1 match (hover to see ASL)</span>`;
        } else {
            // Multiple matches - show navigation
            this.element.innerHTML = `
                <div class="result-nav">
                    <button class="nav-btn prev-btn" title="Previous match">◀</button>
                    <span class="result-position">1 of ${count}</span>
                    <button class="nav-btn next-btn" title="Next match">▶</button>
                </div>
            `;

            // Bind navigation buttons
            const prevBtn = this.element.querySelector('.prev-btn');
            const nextBtn = this.element.querySelector('.next-btn');

            prevBtn.addEventListener('click', () => {
                if (this.presenter) this.presenter.prevMatch();
            });

            nextBtn.addEventListener('click', () => {
                if (this.presenter) this.presenter.nextMatch();
            });
        }
    },

    /**
     * Update the position indicator
     */
    updatePosition(current, total) {
        const positionEl = this.element?.querySelector('.result-position');
        if (positionEl) {
            positionEl.textContent = `${current} of ${total}`;
        }
    },

    /**
     * Display cleared state
     */
    showCleared() {
        if (!this.element) {
            this.element = document.getElementById('result');
        }
        if (this.element) {
            this.element.innerHTML = '<span class="result-text">Cleared</span>';
        }
        this.presenter = null;
    },

    /**
     * Clear the result display
     */
    clear() {
        if (this.element) {
            this.element.innerHTML = '';
        }
        this.presenter = null;
    }
};
