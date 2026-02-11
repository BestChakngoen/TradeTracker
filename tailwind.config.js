/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./TrackerView.html",
    "./index.html",
    "./main.js",
    "./UIManager.js",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Kanit', 'sans-serif'],
        mono: ['Rajdhani', 'monospace'],
      },
      colors: {
        game: {
          bg: '#0f172a',
          card: '#1e293b',
          success: '#22c55e',
          danger: '#ef4444',
        }
      },
      animation: {
        'scan': 'scan 2s linear infinite',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        }
      }
    }
  },
  plugins: [],
}
