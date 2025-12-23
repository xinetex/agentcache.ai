import { describe, it, expect } from 'vitest';
import { decideStreamComponent } from '../../src/integral/StreamInterface.jsx';

describe('StreamInterface Logic', () => {
    it('should select StatsWidget for memory intent', () => {
        const result = decideStreamComponent('Show me memory usage');
        expect(result.type).toBe('StatsWidget');
        expect(result.response).toContain('Visualizing system vitality');
    });

    it('should select LogViewer for trace intent', () => {
        const result = decideStreamComponent('Show logs');
        expect(result.type).toBe('LogViewer');
        expect(result.response).toContain('Streaming live logs');
    });

    it('should default to None for unknown intent', () => {
        const result = decideStreamComponent('Make me a sandwich');
        expect(result.type).toBe('None');
    });
});
