/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#152033',
        paper: '#F4F6F8',
        card: '#FFFFFF',
        line: '#D5DEE8',
        teal: {
          50: '#E7EEF6',
          100: '#D0DDEC',
          700: '#1E4E89',
          800: '#163A66',
          900: '#102844',
        },
        marigold: '#8A5A00',
        clay: '#B42318',
        plum: '#5C4D7A',
        moss: '#1B7F4E',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        display: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 10px 28px -18px rgba(16, 40, 68, 0.45)',
      },
    },
  },
  plugins: [],
}
