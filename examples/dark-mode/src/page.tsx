import { useIsDarkMode, useSetDarkMode } from "./useDarkMode";

export default function Page() {
  return (
    <div>
      <DarkModeToggle />
      <AnotherComponent />
    </div>
  );
}

function DarkModeToggle() {
  const isDarkMode = useIsDarkMode();
  const setDarkMode = useSetDarkMode();

  return (
    <div
      style={{
        padding: "20px",
        backgroundColor: isDarkMode ? "#2d3748" : "#f7fafc",
        color: isDarkMode ? "#e2e8f0" : "#2d3748",
        minHeight: "200px",
        transition: "all 0.3s ease",
      }}
    >
      <h1>Dark Mode Example</h1>
      <p>Current mode: {isDarkMode ? "Dark" : "Light"}</p>
      <button
        onClick={() => setDarkMode(!isDarkMode)}
        style={{
          padding: "10px 20px",
          backgroundColor: isDarkMode ? "#4a5568" : "#e2e8f0",
          color: isDarkMode ? "#e2e8f0" : "#2d3748",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        Toggle to {isDarkMode ? "Light" : "Dark"} Mode
      </button>
    </div>
  );
}

function AnotherComponent() {
  const isDarkMode = useIsDarkMode();

  return (
    <div
      style={{
        padding: "20px",
        backgroundColor: isDarkMode ? "#4a5568" : "#e2e8f0",
        color: isDarkMode ? "#e2e8f0" : "#2d3748",
        margin: "10px 0",
      }}
    >
      <p>This component also reacts to dark mode: {isDarkMode ? "🌙" : "☀️"}</p>
    </div>
  );
}
