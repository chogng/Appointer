/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      scale: {
        102: '1.02',
        103: '1.03',
      },
      transitionDuration: {
        1250: '1250ms',
      },
      colors: {
        bg: {
          page: '#F5F4EF',
          surface: '#FFFFFF',
          'surface-hover': '#FAF9F5',
          ghost: '#FAF9F5',
          primary: '#222222',
          subtle: '#F0F0F0',
          0: '#FAF9F5',
          100: '#F0EEE6',
          200: '#E3DFD2',
          300: '#D6D1C2',
          400: '#C7C1AF',
          500: '#BDB6A2',
        },
        border: {
          DEFAULT: '#E5E5E5',
          subtle: '#E5E5E5',
          100: '#E5E5E5',
          200: '#D1D1D1',
          300: '#30302E',
          400: '#999999',
        },
        text: {
          primary: '#222222',
          secondary: '#666666',
          tertiary: '#999999',
          danger: '#EF4444', // Tailwind red-500
          0: '#222222', // Claude text-000 (approx main text)
          100: '#333333', // Claude text-100
          200: '#555555', // Claude text-200
          300: '#777777', // Claude text-300
          400: '#73726C', // Claude text-400
          500: '#B0B0B0', // Claude text-500
        },
        accent: {
          DEFAULT: '#222222', // Using dark grey/black as accent for buttons
          hover: '#000000',
          focus: '#2C84DB',
          terracotta: '#D97757',
        },
        status: {
          approved: 'rgb(var(--status-approved-rgb) / <alpha-value>)',
          pending: 'rgb(var(--status-pending-rgb) / <alpha-value>)',
          rejected: 'rgb(var(--status-rejected-rgb) / <alpha-value>)',
        },
        
      },
      fontFamily: {
        sans: ['Inter', 'Arial', 'sans-serif'],
        serif: ['ui-serif', 'Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
        response: ['Inter', 'Georgia', 'sans-serif'],
        ui: ['Inter', 'Arial', 'sans-serif'], // controls use
        display: ['ui-serif', 'Georgia', 'serif'],
      },
      animation: {
        'slide-up': 'slideUpFade 0.3s ease-out forwards',
        'slide-down': 'slideDownFade 0.3s ease-in forwards',
        'slide-in-right': 'slideInRight 0.1s ease-out forwards',
        'slide-in-left': 'slideInLeft 0.1s ease-out forwards',
      },
      keyframes: {
        slideUpFade: {
          '0%': {
            transform: 'translateX(-50%) translateY(100%)',
            opacity: '0',
          },
          '100%': {
            transform: 'translateX(-50%) translateY(0)',
            opacity: '1',
          },
        },
        slideDownFade: {
          '0%': {
            transform: 'translateX(-50%) translateY(0)',
            opacity: '1',
          },
          '100%': {
            transform: 'translateX(-50%) translateY(100%)',
            opacity: '0',
          },
        },
        slideInRight: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
