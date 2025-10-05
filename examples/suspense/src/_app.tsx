import { hydrateRoot } from "react-dom/client";
import { GlobalStateProvider } from "orbo";
import Page from "./page";
import { StrictMode } from "react";

function App() {
  return (
    <StrictMode>
      <GlobalStateProvider initialValues={{}}>
        <Page />
      </GlobalStateProvider>
      </StrictMode>
  );
}

// For SSR template
export default App;

// For client-side hydration
if (typeof window !== "undefined") {
  hydrateRoot(document.getElementById("root")!, <App />);
}
