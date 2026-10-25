/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand palette (all six swatches)
        night: '#111522',
        dusk: '#1E263B',
        steel: '#303D59',
        mist: '#536684',
        haze: '#98A9C4',
        frost: '#DCE3EF',
        // Alias kept for muted UI text (palette #536684)
        slate: {
          DEFAULT: '#536684',
        },
        // Semantic aliases used across the app
        ink: '#111522',
        paper: '#DCE3EF',
        card: '#FFFFFF',
        line: '#98A9C4',
        teal: {
          50: '#DCE3EF',
          100: '#98A9C4',
          700: '#303D59',
          800: '#1E263B',
          900: '#111522',
        },
        marigold: '#8A5A00',
        clay: '#B42318',
        plum: '#303D59',
        moss: '#1B7F4E',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        display: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 10px 28px -18px rgba(17, 21, 34, 0.45)',
      },
    },
  },
  plugins: [],
}
