/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class', // Lock to dark mode
    content: [
        "./index.html",
        "./public/**/*.html",
        "./*.html", // Include root HTML files
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
                display: ['Rajdhani', 'sans-serif'],
                data: ['Courier New', 'monospace'],
            },
            colors: {
                brand: {
                    50: '#f0f9ff',
                    500: '#0ea5e9',
                    900: '#0c4a6e',
                },
                hud: {
                    bg: '#030508',
                    panel: 'rgba(6, 11, 20, 0.85)',
                    border: 'rgba(0, 243, 255, 0.3)',
                    accent: '#00f3ff',
                    text: '#e0f7fa',
                }
            },
            animation: {
                'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
                'slide-in': 'slide-in 300ms cubic-bezier(0.4, 0, 0.2, 1) ease-out',
                'fade-in': 'fade-in 300ms cubic-bezier(0.4, 0, 0.2, 1) ease-out',
            },
            keyframes: {
                'pulse-glow': {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.6' },
                },
                'slide-in': {
                    'from': { opacity: '0', transform: 'translateY(10px)' },
                    'to': { opacity: '1', transform: 'translateY(0)' },
                },
                'fade-in': {
                    'from': { opacity: '0' },
                    'to': { opacity: '1' },
                },
            },
        },
    },
    plugins: [],
}
