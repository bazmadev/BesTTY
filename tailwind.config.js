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
        fluent: {
          bg: '#181818',
          card: '#202020',
          subtle: '#272727',
          hover: '#2d2d2d',
          border: '#383838',
          primary: '#0078d4',
          'primary-hover': '#106ebe',
          accent: '#60cdff',
          text: '#ffffff',
          'text-secondary': '#cccccc',
          'text-muted': '#888888',
        }
      },
      fontFamily: {
        sans: ['Segoe UI Variable Text', 'Segoe UI', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Cascadia Code', 'JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
