/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        discord: {
          sidebar: '#1e1f22',
          channelList: '#2b2d31',
          chat: '#313338',
          chatHover: '#2e3035',
          card: '#111214',
          accent: '#5865f2',
          accentHover: '#4752c4',
          green: '#23a55a',
          yellow: '#f0b232',
          red: '#f23f43',
          textMuted: '#949ba4',
          textNormal: '#dbdee1',
          textHeader: '#f2f3f5',
          border: '#3f4147'
        }
      },
      animation: {
        'pulse-speaking': 'speaking 1.2s infinite ease-in-out',
      },
      keyframes: {
        speaking: {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 0 2px #23a55a' },
          '50%': { transform: 'scale(1.03)', boxShadow: '0 0 0 4px #23a55a, 0 0 12px rgba(35, 165, 90, 0.6)' },
        }
      }
    },
  },
  plugins: [],
}
