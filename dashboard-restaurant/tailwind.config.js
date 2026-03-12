/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#4F46E5", // Indigo pour un look pro
        secondary: "#0F172A", // Slate dark
        success: "#10B981", // Emeraude pour les statuts validés
        warning: "#F59E0B", // Ambre pour En préparation
        danger: "#EF4444", // Rouge pour Rejet / Annulation
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
