/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1C2430',
        paper: '#F3F0E7',
        card: '#FFFDF8',
        line: '#E3DACA',
        teal: {
          50: '#E6F4F2',
          100: '#C5E6E1',
          700: '#0F5E59',
          800: '#0C4A46',
          900: '#083532',
        },
        marigold: '#E09A12',
        clay: '#C4472D',
        plum: '#62486F',
        moss: '#2F6B3A',
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 24px 50px -28px rgba(28, 36, 48, 0.45)',
      },
    },
  },
  plugins: [],
}
