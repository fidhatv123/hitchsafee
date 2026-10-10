/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        safety: {
          emerald: '#10b981',
          amber: '#f59e0b',
          rose: '#f43f5e',
          navy: '#0f172a',
          indigo: '#6366f1'
        }
      }
    },
  },
  plugins: [],
}
