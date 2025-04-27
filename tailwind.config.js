/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FDB813', // Yellow color for KodNest logo and buttons
        secondary: '#8B5CF6', // Purple color for Help and Earn button
        'status-yellow': '#F59E0B', // Color for Not Started status
        'progress-yellow': '#FDB813', // Color for progress bars
        'menu-gray': '#6B7280', // Color for inactive menu items
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
} 