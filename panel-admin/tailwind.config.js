/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: "#111827", // Sombre classe pour Admin
        accent: "#F97316", // Orange pour les touches dynamiques
        wave: "#1E88E5", // Bleu Wave
        om: "#FF5E00", // Orange OM
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
