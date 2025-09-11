import { createGlobalState, globalStateMemo } from "orbo";
import "./types";

// Create the global state for dark mode
export const [useIsDarkMode, useSetDarkMode] = createGlobalState({
  initialState: (appContextValues) => {
    console.log("call 5 times");
    isDarkMode(appContextValues);
    isDarkMode(appContextValues);
    isDarkMode(appContextValues);
    isDarkMode(appContextValues);
    return isDarkMode(appContextValues);
  },
});

const isDarkMode = globalStateMemo((appContextValues) => {
  console.log(
    "🚀 Initializing dark mode state with app context:",
    appContextValues,
  );
  return appContextValues.cookies.darkMode === "true" || false;
});
