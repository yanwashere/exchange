/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        gold:   '#FFD045',
        orange: '#F07A20',
        deep:   '#3D1F08',
        ink:    '#2A1200',
        muted:  '#7A5535',
      },
      fontFamily: {
        syne:  ['Syne', 'sans-serif'],
        onest: ['Onest', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
