import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        background: '#f4f6f8',
        foreground: '#0f172a',
        card: '#ffffff',
        border: '#dbe2ea',
        primary: '#11bfae',
        secondary: '#e8edf3',
        muted: {
          foreground: '#64748b'
        },
        section: {
          light: {
            DEFAULT: '#e8ecef',
            foreground: '#334155'
          }
        },
        stat: '#1f2937'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(15, 23, 42, 0.2), 0 20px 50px rgba(8, 47, 73, 0.35)'
      }
    }
  },
  plugins: [tailwindcssAnimate]
};
