import React from "react";
import ReactDOM from "react-dom/client";
import { AppRoot, ConfigProvider } from "@vkontakte/vkui";
import "@vkontakte/vkui/dist/vkui.css";
import App from "./app/App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider appearance="dark">
      <AppRoot>
        <App />
      </AppRoot>
    </ConfigProvider>
  </React.StrictMode>
);
