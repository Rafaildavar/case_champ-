import React from "react";
import ReactDOM from "react-dom/client";
import { AppRoot, ConfigProvider } from "@vkontakte/vkui";
import "@vkontakte/vkui/dist/vkui.css";
import App from "./app/App";

// Force dark VK scheme in host environments that still provide light appearance.
document.documentElement.setAttribute("scheme", "space_gray");
document.body.setAttribute("scheme", "space_gray");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider appearance="dark">
      <AppRoot appearance="dark">
        <App />
      </AppRoot>
    </ConfigProvider>
  </React.StrictMode>
);
