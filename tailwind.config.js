/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        stage: {
          DEFAULT: '#4A4B2A',
          light: '#525630',
        },
        'navy-nma': '#0C2230',
        'teal-nma': {
          DEFAULT: '#1B8A87',
          bright: '#2EB6B0',
        },
        'red-nma': '#E2231A',
        'rail-nma': '#CBD5E1',
        panel: '#FAFAF7',
      },
      fontFamily: {
        sans: ['"Public Sans"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
