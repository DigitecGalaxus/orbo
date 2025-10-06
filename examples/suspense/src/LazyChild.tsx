import { useDarkMode, useToggleDarkMode } from "./useDarkMode";

export function LazyChild() {
  const darkMode = useDarkMode();
  const toggleDarkMode = useToggleDarkMode();

  return (
    <div
      style={{
        padding: "20px",
        marginTop: "20px",
        border: "2px solid #4CAF50",
        borderRadius: "8px",
        backgroundColor: darkMode ? "#1a1a1a" : "#f5f5f5",
        color: darkMode ? "#ffffff" : "#000000",
      }}
      data-testid="lazy-component"
    >
      <h3>Lazy Loaded Component</h3>
      <p>This component was loaded after a 3-second delay during hydration.</p>
      <p>
        Dark Mode: <strong>{darkMode ? "ON" : "OFF"}</strong>
      </p>
      <button onClick={toggleDarkMode}>Toggle Dark Mode</button>
      <small style={{ display: "block", marginTop: "10px", opacity: 0.7 }}>
        The state syncs with localStorage and updates across all components
        without hydration errors.
      </small>
    </div>
  );
}
