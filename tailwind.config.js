/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gold: { 300: '#f5d78e', 400: '#e8c56a', 500: '#d4a84b', 600: '#b8892e', 700: '#9a6e1a' },
        surface: { 800: '#1a1a2e', 850: '#16213e', 900: '#0f0f23', 950: '#0a0a1a' },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
