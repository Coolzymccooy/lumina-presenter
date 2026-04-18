/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./App.tsx",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            colors: {
                zinc: {
                    850: '#202023',
                    900: '#18181b',
                    950: '#09090b',
                }
            },
            keyframes: {
                liveGlow: {
                    '0%, 100%': {
                        boxShadow: 'inset 3px 0 0 0 rgb(239 68 68), 0 0 0 1px rgba(239,68,68,0.2), 0 0 18px -2px rgba(239,68,68,0.35)',
                    },
                    '50%': {
                        boxShadow: 'inset 3px 0 0 0 rgb(248 113 113), 0 0 0 1px rgba(248,113,113,0.45), 0 0 28px 0px rgba(239,68,68,0.65)',
                    },
                },
                liveRing: {
                    '0%': { transform: 'scale(0.8)', opacity: '0.7' },
                    '100%': { transform: 'scale(2.2)', opacity: '0' },
                },
            },
            animation: {
                liveGlow: 'liveGlow 1.8s ease-in-out infinite',
                liveRing: 'liveRing 1.5s ease-out infinite',
            },
        },
    },
    plugins: [],
}
