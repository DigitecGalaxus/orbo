import { createGlobalState } from "orbo";

const DARK_MODE_KEY = "darkMode";

export const [useDarkMode, useSetDarkMode] = createGlobalState({
  // During SSR and initial hydration, use false to avoid hydration mismatches
  initialState: () => false,

  onSubscribe: (setDarkMode, initialValue) => {
    // Read from localStorage after hydration
    const darkModeFromStorage = localStorage.getItem(DARK_MODE_KEY) === "true";

    if (darkModeFromStorage !== initialValue) {
      setDarkMode(darkModeFromStorage);
    }

    const handleStorageUpdate = (event: StorageEvent) => {
      if (event.key === DARK_MODE_KEY && event.newValue !== null) {
        setDarkMode(event.newValue === "true");
      }
    };

    // Listen for changes in other tabs
    window.addEventListener("storage", handleStorageUpdate);
    return () => window.removeEventListener("storage", handleStorageUpdate);
  },
});

export function useToggleDarkMode() {
  const setDarkMode = useSetDarkMode();
  return () => {
    setDarkMode((prev) => {
      const updatedValue = !prev;
      localStorage.setItem(DARK_MODE_KEY, String(updatedValue));
      return updatedValue;
    });
  };
}
