/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class', // the site is light-only; no `dark` class is ever applied
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
                // Apple system colours. `DEFAULT` for fills and accents,
                // `ink` for text on white (meets contrast), `soft` for tinted backgrounds.
                red: { DEFAULT: '#ff3b30', ink: '#d70015', soft: '#fff1f0' },
                orange: { DEFAULT: '#ff9500', ink: '#c93400', soft: '#fff4e5' },
                yellow: { DEFAULT: '#ffcc00', ink: '#a05a00', soft: '#fff9db' },
                green: { DEFAULT: '#34c759', ink: '#248a3d', soft: '#ebf9ee' },
                teal: { DEFAULT: '#30b0c7', ink: '#0071a4', soft: '#e8f6f9' },
                blue: { DEFAULT: '#007aff', ink: '#0066cc', soft: '#eaf3ff' },
                indigo: { DEFAULT: '#5856d6', ink: '#3634a3', soft: '#eeeefc' },
                purple: { DEFAULT: '#af52de', ink: '#8944ab', soft: '#f6edfb' },
                pink: { DEFAULT: '#ff2d55', ink: '#d30f45', soft: '#ffedf1' },
            },
            letterSpacing: {
                display: '-0.015em',
                tighter2: '-0.028em',
            },
            transitionTimingFunction: {
                apple: 'cubic-bezier(0.28, 0.11, 0.32, 1)',
            },
            keyframes: {
                shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
            },
            animation: {
                shimmer: 'shimmer 1.4s linear infinite',
            },
        },
    },
    plugins: [],
}
