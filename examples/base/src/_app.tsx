import React from "react";
import { hydrateRoot } from "react-dom/client";
import { GlobalStateProvider } from "orbo";
import Page from "./page";

function App() {
  return (
    <React.StrictMode>
      <GlobalStateProvider initialValues={{}}>
        <Page />
      </GlobalStateProvider>
    </React.StrictMode>
  );
}

// For SSR template
export default App;

// For client-side hydration
if (typeof window !== "undefined") {
  hydrateRoot(document.getElementById("root")!, <App />);
}
