import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* MAS brand colors — from Logo.png */
        primary: { DEFAULT: '#1565C0', foreground: '#ffffff', light: '#E3F2FD', dark: '#0D47A1' },
        'mas-blue':  { DEFAULT: '#1565C0', light: '#E3F2FD', dark: '#0D47A1' },
        'mas-green': { DEFAULT: '#43A832', light: '#E8F5E9', dark: '#2E7D32' },
        'mas-red':   { DEFAULT: '#D32F2F', light: '#FFEBEE', dark: '#B71C1C' },
        accent: { DEFAULT: '#43A832', foreground: '#ffffff' },
        success: { DEFAULT: '#43A832', foreground: '#ffffff' },
        danger: { DEFAULT: '#D32F2F', foreground: '#ffffff' },
        sidebar: { DEFAULT: '#0F172A', foreground: '#94a3b8', active: '#1565C0' },
      },
      fontFamily: {
        sans: ['"Fira Sans"', 'Inter', 'sans-serif'],
        mono: ['"Fira Code"', 'monospace'],
      },
      borderRadius: { lg: '0.625rem', md: '0.5rem', sm: '0.375rem' },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'count-up': 'countUp 0.6s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        countUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};

export default config;
