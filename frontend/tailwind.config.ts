import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1E40AF', foreground: '#ffffff', light: '#EFF6FF', dark: '#1e3a8a' },
        accent: { DEFAULT: '#F59E0B', foreground: '#ffffff' },
        success: { DEFAULT: '#10B981', foreground: '#ffffff' },
        danger: { DEFAULT: '#EF4444', foreground: '#ffffff' },
        sidebar: { DEFAULT: '#0F172A', foreground: '#94a3b8', active: '#1E40AF' },
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
