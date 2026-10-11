/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        agnos: {
          dark: '#060612',
          surface: '#0d0d1a',
          card: '#121224',
          border: 'rgba(255, 255, 255, 0.08)',
          vermilion: '#ff6321',
          'vermilion-hover': '#cf4e17',
          'vermilion-light': 'rgba(255, 99, 33, 0.12)',
          muted: '#69686e',
          'stone-bg': '#f4f2f0',
          'stone-surface': '#faf9f8',
          'stone-border': '#e7e2dd',
          'stone-pill': '#eeecea',
        }
      },
      fontFamily: {
        sans: ['Geist', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        handwriting: ['Caveat', 'cursive'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      letterSpacing: {
        tightest: '-0.04em',
        tighter: '-0.03em',
      },
      boxShadow: {
        'agnos-subtle': '0 1px 2px rgba(6, 6, 18, 0.04), 0 4px 12px rgba(6, 6, 18, 0.03)',
        'agnos-hover': '0 4px 20px rgba(255, 99, 33, 0.15)',
        'agnos-dark': '0 8px 32px rgba(0, 0, 0, 0.4)',
      }
    },
  },
  plugins: [],
}
