import React from "react";
import ReactDOM from "react-dom/client";
import bridge from "@vkontakte/vk-bridge";
import { AppRoot, ConfigProvider } from "@vkontakte/vkui";
import "@vkontakte/vkui/dist/vkui.css";
import "./index.css";
import App from "./app/App";

// Force dark VK scheme in host environments that still provide light appearance.
document.documentElement.setAttribute("scheme", "space_gray");
document.body.setAttribute("scheme", "space_gray");

bridge.subscribe((e) => {
  if (e.detail.type !== "VKWebAppUpdateConfig") return;
  // Product requirement: theme must stay dark regardless of device/system appearance.
  document.documentElement.setAttribute("scheme", "space_gray");
  document.body.setAttribute("scheme", "space_gray");
  document.body.classList.add("dark-theme");
});

document.body.classList.add("dark-theme");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider appearance="dark">
      <AppRoot appearance="dark">
        <App />
      </AppRoot>
    </ConfigProvider>
  </React.StrictMode>
);
