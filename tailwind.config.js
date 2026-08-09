/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#F0F4FA',
          100: '#D9E3F3',
          200: '#B3C8E8',
          700: '#1E3A6D',
          800: '#15284F',
          900: '#0F1F3D',
          950: '#0A152B',
        },
        teal: {
          DEFAULT: '#0B7B6B',
          50: '#E6F6F4',
          100: '#CCEBE7',
          500: '#0B7B6B',
          600: '#086356',
          700: '#064B41',
        },
        mint: {
          DEFAULT: '#02C39A',
          100: '#D4F7EE',
          400: '#2BD9B4',
          500: '#02C39A',
          600: '#029E7D',
        }
      }
    },
  },
  plugins: [],
}

