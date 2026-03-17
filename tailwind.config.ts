import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'Cascadia Code', 'monospace'],
      },
      colors: {
        // Brand red — from DESIGN.md
        red: {
          50:  '#fff1f1',
          100: '#ffe1e1',
          200: '#ffc7c7',
          400: '#f15558',
          500: '#d92127',
          600: '#b81d22',
          700: '#96181c',
          900: '#5a0e11',
        },
        // Warm gray neutrals — harmonize with red
        gray: {
          50:  '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
        },
        // Semantic
        green: {
          50:  '#f0fdf4',
          600: '#16a34a',
          700: '#15803d',
        },
        amber: {
          50:  '#fffbeb',
          600: '#d97706',
        },
        blue: {
          50:  '#eff6ff',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0,0,0,0.05)',
        md: '0 2px 8px 0 rgba(0,0,0,0.08), 0 0 0 1px #e7e5e4',
      },
    },
  },
  plugins: [],
}

export default config
