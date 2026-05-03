/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Orbitron', 'monospace'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      keyframes: {
        particleFloat: {
          '0%': { transform: 'translateY(0px) scale(1)', opacity: '0.2' },
          '100%': { transform: 'translateY(-30px) scale(1.5)', opacity: '0.6' },
        },
      },
      animation: {
        particleFloat: 'particleFloat 6s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
}
