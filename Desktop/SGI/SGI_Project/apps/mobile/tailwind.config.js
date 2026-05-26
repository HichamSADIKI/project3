/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: "#B8924F",
          deep: "#8A6B30",
          light: "#D4AF70",
          ghost: "rgba(184,146,79,0.12)",
        },
        ink: {
          DEFAULT: "#E2E8F0",
          2: "#CBD5E1",
          3: "#94A3B8",
          4: "#64748B",
        },
        bg: {
          base: "#161B22",
          paper: "#1F2937",
          cream: "#1A2233",
          ivory: "#253346",
        },
        emerald: "#10B981",
        azure: "#3B82F6",
        rose: "#EF4444",
        amber: "#F59E0B",
      },
      fontFamily: {
        sans: ["Geist-Regular"],
        display: ["Geist-SemiBold"],
        arabic: ["NotoSansArabic-Regular"],
      },
    },
  },
  plugins: [],
};
