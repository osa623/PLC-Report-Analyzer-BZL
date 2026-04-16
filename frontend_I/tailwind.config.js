/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', 'sans-serif'],
      },
      colors: {
        primary: '#000000',
        secondary: '#ffffff',
        gray: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
        }
      },
      boxShadow: {
        'apple-sm': '0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)',
        'apple': '0 2px 8px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)',
        'apple-md': '0 4px 12px rgba(0,0,0,0.05), 0 8px 32px rgba(0,0,0,0.08)',
        'apple-lg': '0 8px 24px rgba(0,0,0,0.06), 0 16px 48px rgba(0,0,0,0.1)',
        'apple-xl': '0 12px 40px rgba(0,0,0,0.08), 0 24px 64px rgba(0,0,0,0.12)',
      },
      letterSpacing: {
        'refined': '-0.01em',
        'heading': '-0.025em',
        'display': '-0.035em',
      },
      lineHeight: {
        'rhythm': '1.65',
        'heading': '1.2',
        'display': '1.08',
      },
      borderRadius: {
        'apple': '12px',
        'apple-lg': '16px',
        'apple-xl': '20px',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'blur-in': {
          '0%': { opacity: '0', filter: 'blur(4px)' },
          '100%': { opacity: '1', filter: 'blur(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out both',
        'slide-up': 'slide-up 0.6s cubic-bezier(0.16,1,0.3,1) both',
        'slide-up-delay-1': 'slide-up 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s both',
        'slide-up-delay-2': 'slide-up 0.6s cubic-bezier(0.16,1,0.3,1) 0.2s both',
        'slide-up-delay-3': 'slide-up 0.6s cubic-bezier(0.16,1,0.3,1) 0.3s both',
        'slide-down': 'slide-down 0.3s ease-out both',
        'scale-in': 'scale-in 0.3s ease-out both',
        'blur-in': 'blur-in 0.4s ease-out both',
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
