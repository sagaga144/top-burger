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
          base: '#0F0F0F',
          card: '#1C1C1E',
        },
        text: {
          primary: '#F5F5F5',
          secondary: '#8E8E93',
          inverse: '#111111',
        },
        border: {
          subtle: '#2C2C2E',
        },
        rank: {
          gold: '#F59E0B',
          silver: '#9CA3AF',
          bronze: '#CD7F32',
          default: '#3A3A3C',
        },
        score: {
          high: '#22C55E',
          mid: '#F59E0B',
          low: '#E63946',
        },
        error: {
          bg: 'rgba(239,68,68,0.15)',
          border: 'rgba(239,68,68,0.35)',
          text: '#F87171',
        },
        success: {
          bg: 'rgba(34,197,94,0.15)',
          border: 'rgba(34,197,94,0.3)',
          text: '#4ADE80',
        },
      },
      spacing: {
        13: '3.25rem',
      },
    },
  },
  plugins: [],
};
