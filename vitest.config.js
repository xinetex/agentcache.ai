import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: [
            'tests/unit/**/*.test.js',
            'tests/unit/**/*.test.ts',
            'tests/claims/**/*.test.ts',
            'tests/contracts/**/*.test.ts',
            'tests/integration/**/*.test.ts',
        ],
        coverage: {
            reporter: ['text', 'json', 'html'],
        },
    },
});
