const THEME_STORAGE_KEY = "nelpac-theme-preference";

function readStoredThemePreference() {
  if (typeof window === "undefined") return false;
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return Boolean(parsed?.darkMode);
    }
    for (const legacyKey of [
      "nelpac-admin-preferences",
      "nelpac-user-preferences",
    ]) {
      const legacy = window.localStorage.getItem(legacyKey);
      if (!legacy) continue;
      const parsed = JSON.parse(legacy);
      if (typeof parsed?.darkMode === "boolean") return parsed.darkMode;
    }
    return false;
  } catch {
    return false;
  }
}

function persistThemePreference(darkMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ darkMode }));
}

function applyThemePreference(darkMode) {
  if (typeof document === "undefined") return darkMode;
  const isDark = Boolean(darkMode);
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  document.body?.setAttribute("data-theme", isDark ? "dark" : "light");
  return isDark;
}

function syncThemePreference(darkMode) {
  persistThemePreference(darkMode);
  return applyThemePreference(darkMode);
}

function getThemePreference() {
  return readStoredThemePreference();
}

export { applyThemePreference, getThemePreference, syncThemePreference };
