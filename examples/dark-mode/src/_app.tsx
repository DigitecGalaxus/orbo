import React from "react";
import ReactDOM from "react-dom/client";
import { AppContextProvider } from "orbo";
import Page from "./page";

const cookies = { darkMode: "false" };

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppContextProvider values={{ cookies }}>
      <Page />
    </AppContextProvider>
  </React.StrictMode>,
);
