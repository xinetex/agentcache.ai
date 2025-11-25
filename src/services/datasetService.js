
/**
 * Service to manage the semantic dataset.
 * Loads data from public/data/dataset_sample.json
 */
export const DatasetService = {
    data: [],

    async loadDataset() {
        if (this.data.length > 0) return this.data;

        try {
            const response = await fetch('/data/dataset_sample.json');
            if (!response.ok) throw new Error('Failed to load dataset');

            this.data = await response.json();
            console.log(`Loaded ${this.data.length} items from dataset`);
            return this.data;
        } catch (error) {
            console.error('Error loading dataset:', error);
            return [];
        }
    },

    getData() {
        return this.data;
    },

    getStats() {
        if (this.data.length === 0) return null;

        const categories = {};
        let totalTokens = 0;

        this.data.forEach(item => {
            categories[item.category] = (categories[item.category] || 0) + 1;
            totalTokens += item.tokens;
        });

        return {
            totalItems: this.data.length,
            avgTokens: Math.round(totalTokens / this.data.length),
            categories
        };
    }
};
