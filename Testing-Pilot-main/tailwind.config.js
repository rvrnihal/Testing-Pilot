/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      animation: {
        aurora: "aurora 60s linear infinite",
      },
      keyframes: {
        aurora: {
          from: {
            backgroundPosition: "50% 50%, 50% 50%",
          },
          to: {
            backgroundPosition: "350% 50%, 350% 50%",
          },
        },
      },
    },
  },
  plugins: [addVariablesForColors],
};

function addVariablesForColors({ addBase, theme }) {
  const allColors = flattenColorPalette(theme("colors"));
  const newVars = Object.fromEntries(
    Object.entries(allColors).map(([key, val]) => [`--${key}`, val]),
  );

  addBase({
    ":root": newVars,
  });
}

function flattenColorPalette(colors, prefix = "") {
  return Object.entries(colors).reduce((acc, [key, value]) => {
    const cssVarKey = key === "DEFAULT" ? prefix : prefix ? `${prefix}-${key}` : key;

    if (typeof value === "string") {
      acc[cssVarKey] = value;
      return acc;
    }

    Object.assign(acc, flattenColorPalette(value, cssVarKey));
    return acc;
  }, {});
}
