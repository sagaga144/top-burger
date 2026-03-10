/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#E63946',
          redDark: '#C1121F',
        },
        bg: {
          base: '#FAFAF8',
          card: '#FFFFFF',
        },
        text: {
          primary: '#1C1C1E',
          secondary: '#6B7280',
          inverse: '#FFFFFF',
        },
        border: {
          subtle: '#E5E7EB',
        },
        rank: {
          gold: '#F59E0B',
          silver: '#9CA3AF',
          bronze: '#CD7F32',
          default: '#E5E7EB',
        },
        score: {
          high: '#22C55E',
          mid: '#F59E0B',
          low: '#E63946',
        },
      },
      spacing: {
        13: '3.25rem',
      },
    },
  },
  plugins: [],
};
