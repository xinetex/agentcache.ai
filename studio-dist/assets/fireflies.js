// Firefly Animation System for AgentCache
(function () {
    'use strict';

    // Configuration
    const config = {
        count: 30,
        container: null
    };

    function init() {
        // Create or find container
        let container = document.getElementById('fireflies-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'fireflies-container';
            container.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;';
            document.body.insertBefore(container, document.body.firstChild);
        }
        config.container = container;

        // Generate fireflies
        for (let i = 0; i < config.count; i++) {
            createFirefly();
        }
    }

    function createFirefly() {
        const firefly = document.createElement('div');
        firefly.className = 'firefly';

        // Random starting position
        firefly.style.left = Math.random() * 100 + 'vw';
        firefly.style.top = Math.random() * 100 + 'vh';

        // Random movement distance
        firefly.style.setProperty('--tx', (Math.random() - 0.5) * 400 + 'px');
        firefly.style.setProperty('--ty', (Math.random() - 0.5) * 400 + 'px');

        // Random animation delay and duration
        firefly.style.animationDelay = Math.random() * 20 + 's';
        firefly.style.animationDuration = (15 + Math.random() * 10) + 's';

        config.container.appendChild(firefly);
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
