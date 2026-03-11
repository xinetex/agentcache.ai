
import { RelationStrategy, RelationResult } from './RelationStrategy.js';

/**
 * CoOccurrenceStrategy: Proximity-based relation extraction.
 * 
 * Ported and hardened version of the original co-occurrence logic.
 * Adds confidence scores based on character distance:
 * - 0-10 chars: 0.95 confidence
 * - 10-50 chars: 0.70 confidence
 * - 50-100 chars: 0.40 confidence
 */
export class CoOccurrenceStrategy implements RelationStrategy {
    name = 'co-occurrence';

    async extract(text: string, entities: string[]): Promise<RelationResult[]> {
        if (entities.length < 2) return [];

        const relations: RelationResult[] = [];
        const lowerText = text.toLowerCase();

        for (let i = 0; i < entities.length; i++) {
            for (let j = i + 1; j < entities.length; j++) {
                const sub = entities[i];
                const obj = entities[j];

                const subIdx = lowerText.indexOf(sub.toLowerCase());
                const objIdx = lowerText.indexOf(obj.toLowerCase());

                if (subIdx !== -1 && objIdx !== -1) {
                    const distance = Math.abs(subIdx - objIdx);
                    
                    if (distance < 100) {
                        const score = distance < 10 ? 0.95 : distance < 50 ? 0.70 : 0.40;
                        
                        relations.push({
                            subject: sub,
                            predicate: 'ASSOCIATED_WITH',
                            object: obj,
                            confidence: score,
                            source: this.name
                        });
                    }
                }
            }
        }

        return relations;
    }
}
