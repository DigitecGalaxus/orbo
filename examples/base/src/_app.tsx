import React from "react";
import ReactDOM from "react-dom/client";
import { GlobalStateProvider } from "orbo";
import Page from "./page";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GlobalStateProvider initialValues={{}}>
      <Page />
    </GlobalStateProvider>
  </React.StrictMode>,
);
