import React from "react";
import ReactDOM from "react-dom/client";
import { GlobalContextProvider } from "orbo";
import Page from "./page";

const cookies = { darkMode: "false" };

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GlobalContextProvider initialValues={{ cookies }}>
      <Page />
    </GlobalContextProvider>
  </React.StrictMode>,
);
