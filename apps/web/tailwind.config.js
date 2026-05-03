/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0f0f1a',
        'bg-surface': '#1a1a2e',
        'bg-elevated': '#16213e',
        'accent-primary': '#00d4aa',
        'accent-secondary': '#e94560',
        'accent-tertiary': '#f5a623',
        'text-primary': '#e8eaf0',
        'text-muted': '#8892a4',
      },
      fontFamily: {
        'display': ['Orbitron', 'monospace'],
        'body': ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'default': '8px',
      },
      boxShadow: {
        'glow': '0 4px 24px rgba(0,212,170,0.12)',
      }
    },
  },
  plugins: [],
}
