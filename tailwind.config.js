/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./lib/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#d9ff00',
                    hover: '#c4e600',
                },
                'app-bg': '#050505',
                'panel-bg': '#0a0a0a',
                'card-bg': '#141414',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            },
            boxShadow: {
                glow: '0 0 20px rgba(217, 255, 0, 0.4)',
                '3xl': '0 35px 60px -15px rgba(0, 0, 0, 0.8)',
            },
        },
    },
    plugins: [],
};
