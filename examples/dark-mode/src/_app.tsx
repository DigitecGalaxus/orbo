import React from "react";
import ReactDOM from "react-dom/client";
import { GlobalStateProvider } from "orbo";
import Page from "./page";

const cookies = { darkMode: "false" };

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GlobalStateProvider initialValues={{ cookies }}>
      <Page />
    </GlobalStateProvider>
  </React.StrictMode>,
);
