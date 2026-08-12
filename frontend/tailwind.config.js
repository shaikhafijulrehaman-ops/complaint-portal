/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0F4C81",
        secondary: "#1D70B8",
        dark: "#1E293B",
        background: "#F8FAFC",
      },
    },
  },
  plugins: [],
}
