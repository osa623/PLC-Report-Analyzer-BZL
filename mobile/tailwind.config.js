/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('nativewind/preset')],
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        royal: '#2B6FFF',
        gold: '#D4AF37',
        ink: '#071426',
        navy: '#081A33',
        mist: '#EEF5FF',
        success: '#16D38A',
        danger: '#FF4A55',
      },
      fontFamily: {
        display: ['Avenir Next', 'Helvetica Neue', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
