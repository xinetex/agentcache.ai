
/**
 * EntityMatcher: High-Precision Semantic Extraction
 * 
 * Hardens the semantic bus by implementing robust matching strategies:
 * - Word Boundary Regex (\b): Prevents "brisk" -> "risk" false hits.
 * - Normalization: Collapses whitespace and standardizes casing.
 * - Tokenization: Ensures matches aligned with semantic units.
 */
export class EntityMatcher {

    /**
     * Finds matches for a vocabulary of terms within a given text.
     * Implements Regex Word Boundaries (Idea 1) and Normalization (Idea 2).
     */
    static findMatches(text: string, vocabulary: readonly string[]): string[] {
        if (!text || vocabulary.length === 0) return [];

        // 1. Pre-processing: Normalize text (Idea 2)
        const normalizedText = text
            .toLowerCase()
            .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ") // Strip punctuation
            .replace(/\s+/g, " "); // Collapse whitespace

        const found: string[] = [];

        for (const term of vocabulary) {
            const normalizedTerm = term.toLowerCase();
            
            // 2. Word Boundary Regex (Idea 1)
            // Using \b ensures we don't match substrings inside larger words
            const regex = new RegExp(`\\b${this.escapeRegExp(normalizedTerm)}\\b`, 'g');
            
            if (regex.test(normalizedText)) {
                found.push(term);
            }
        }

        return found;
    }

    /**
     * Escape special characters for regex safety
     */
    private static escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
