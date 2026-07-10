export const THEME_STORAGE_KEY = "theme";

export const THEME_INIT_SCRIPT = `
(() => {
  const storageKey = "${THEME_STORAGE_KEY}";
  const root = document.documentElement;
  const saved = localStorage.getItem(storageKey);
  const systemPrefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  const theme = saved === "light" || saved === "dark" ? saved : (systemPrefersLight ? "light" : "dark");
  root.classList.remove("dark", "light");
  root.classList.add(theme);
  root.style.colorScheme = theme;
})();
`;
