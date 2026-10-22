/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class', // Enable dark mode support
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                // SF Pro on Apple devices, Inter everywhere else
                display: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Inter Variable"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
                text: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Inter Variable"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
            },
            colors: {
                ink: '#1d1d1f',
                graphite: '#6e6e73',
                silver: '#86868b',
                hairline: '#d2d2d7',
                mist: '#f5f5f7',
                action: { DEFAULT: '#0071e3', hover: '#0077ed', link: '#0066cc' },
            },
            letterSpacing: {
                display: '-0.015em',
                tighter2: '-0.028em',
            },
            transitionTimingFunction: {
                apple: 'cubic-bezier(0.28, 0.11, 0.32, 1)',
            },
        },
    },
    plugins: [],
}
