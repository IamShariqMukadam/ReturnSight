/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        orange: '#FF5C1A',
        purple: '#7C3AED',
        pink: '#EC4899',
        bg: '#090A0E',
        surface: '#0F1017',
        card: '#13141C',
        text: '#E5E7EB',
        muted: '#6B7280',
        border: 'rgba(255,255,255,0.07)',
      },
      borderColor: { border: 'rgba(255,255,255,0.07)' },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
