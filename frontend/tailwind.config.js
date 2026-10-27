/** @type {import('tailwindcss').Config} */
module.exports = {
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
                green: { DEFAULT: '#34c759', ink: '#248a3d', soft: '#ebf9ee' },
                teal: { DEFAULT: '#30b0c7', ink: '#0071a4', soft: '#e8f6f9' },
                blue: { DEFAULT: '#007aff', ink: '#0066cc', soft: '#eaf3ff' },
                purple: { DEFAULT: '#af52de', ink: '#8944ab', soft: '#f6edfb' },
                pink: { DEFAULT: '#ff2d55', ink: '#d30f45', soft: '#ffedf1' },
            },
            letterSpacing: {
                tighter2: '-0.028em',
            },
            transitionTimingFunction: {
                apple: 'cubic-bezier(0.28, 0.11, 0.32, 1)',
            },
            keyframes: {
                shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
                drift: {
                    '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
                    '33%': { transform: 'translate3d(6%, -4%, 0) scale(1.08)' },
                    '66%': { transform: 'translate3d(-5%, 5%, 0) scale(0.96)' },
                },
                marquee: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
                ants: { to: { strokeDashoffset: '-48' } },
                pulsering: { '0%': { transform: 'scale(0.85)', opacity: '0.6' }, '100%': { transform: 'scale(1.6)', opacity: '0' } },
            },
            animation: {
                shimmer: 'shimmer 1.4s linear infinite',
                drift: 'drift 22s ease-in-out infinite',
                'drift-slow': 'drift 34s ease-in-out infinite reverse',
                marquee: 'marquee 38s linear infinite',
                ants: 'ants 1.6s linear infinite',
                pulsering: 'pulsering 2.4s cubic-bezier(0.28, 0.11, 0.32, 1) infinite',
                'spin-slow': 'spin 60s linear infinite',
            },
        },
    },
    plugins: [],
}
