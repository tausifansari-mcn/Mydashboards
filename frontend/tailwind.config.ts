import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* MAS brand colors */
        primary: { DEFAULT: '#1565C0', foreground: '#ffffff', light: '#EFF6FF', dark: '#0D47A1' },
        'mas-blue':  { DEFAULT: '#1565C0', light: '#EFF6FF', dark: '#0D47A1' },
        'mas-green': { DEFAULT: '#43A832', light: '#F0FDF4', dark: '#2E7D32' },
        'mas-red':   { DEFAULT: '#D32F2F', light: '#FEF2F2', dark: '#B71C1C' },
        accent:  { DEFAULT: '#43A832', foreground: '#ffffff' },
        success: { DEFAULT: '#43A832', foreground: '#ffffff' },
        danger:  { DEFAULT: '#D32F2F', foreground: '#ffffff' },
        sidebar: { DEFAULT: '#0F172A', foreground: '#94a3b8', active: '#1565C0' },
        /* Design system neutrals */
        surface: { DEFAULT: '#FFFFFF', muted: '#F8FAFC' },
        border:  { DEFAULT: '#E2E8F0', strong: '#CBD5E1' },
      },
      fontFamily: {
        sans: ['"Fira Sans"', 'Inter', 'sans-serif'],
        mono: ['"Fira Code"', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        xs:    ['11px', { lineHeight: '16px' }],
        sm:    ['13px', { lineHeight: '20px' }],
        base:  ['14px', { lineHeight: '22px' }],
      },
      borderRadius: {
        lg:  '0.75rem',
        xl:  '1rem',
        '2xl': '1.25rem',
        md:  '0.5rem',
        sm:  '0.375rem',
      },
      boxShadow: {
        sm:  '0 1px 4px 0 rgba(21,101,192,0.10), 0 1px 2px -1px rgba(21,101,192,0.06)',
        DEFAULT: '0 2px 8px 0 rgba(21,101,192,0.12)',
        md:  '0 4px 16px 0 rgba(21,101,192,0.16)',
        lg:  '0 8px 24px 0 rgba(21,101,192,0.20)',
      },
      animation: {
        'fade-in':  'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'count-up': 'countUp 0.5s ease-out',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' },                                          to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(12px)' },           to: { opacity: '1', transform: 'translateY(0)' } },
        countUp: { from: { opacity: '0', transform: 'translateY(6px)' },            to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};

export default config;
