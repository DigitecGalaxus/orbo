import { Suspense, lazy } from "react";
import { useDarkMode, useToggleDarkMode } from "./useDarkMode";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const clientSideDelay = () =>
  typeof window !== "undefined" ? sleep(3000) : Promise.resolve();

const LazyChild = lazy(() =>
  clientSideDelay().then(() =>
    import("./LazyChild").then((module) => ({
      default: module.LazyChild,
    }))
  )
);

export default function Page() {
  return (
    <div style={{ padding: "20px", fontFamily: "system-ui" }}>
      <h1>Orbo Suspense Example</h1>
      <p>
        Demonstrates optimized hydration with Suspense - no hydration errors
        even with client-side state.
      </p>

      <EagerComponent />

      <Suspense
        fallback={
          <div
            style={{
              padding: "20px",
              marginTop: "20px",
              border: "2px dashed #ccc",
              borderRadius: "8px",
            }}
          >
            Loading lazy component...
          </div>
        }
      >
        <LazyChild />
      <EagerComponent />
      </Suspense>
    </div>
  );
}

function EagerComponent() {
  const darkMode = useDarkMode();
  const toggleDarkMode = useToggleDarkMode();

  return (
    <div
      style={{
        padding: "20px",
        marginTop: "20px",
        border: "2px solid #2196F3",
        borderRadius: "8px",
        backgroundColor: darkMode ? "#1a1a1a" : "#f5f5f5",
        color: darkMode ? "#ffffff" : "#000000",
      }}
      data-testid="eager-component"
    >
      <h3>Eager Component</h3>
      <p>This component loads immediately, but shares state with the lazy component.</p>
      <p>
        Dark Mode: <strong>{darkMode ? "ON" : "OFF"}</strong>
      </p>
      <button onClick={toggleDarkMode}>Toggle Dark Mode</button>
      <small style={{ display: "block", marginTop: "10px", opacity: 0.7 }}>
        Notice: onSubscribe only fires once, after ALL components (including
        suspended ones) have hydrated.
      </small>
    </div>
  );
}
