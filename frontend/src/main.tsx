import React from "react";
import ReactDOM from "react-dom/client";
import bridge from "@vkontakte/vk-bridge";
import { AppRoot, ConfigProvider } from "@vkontakte/vkui";
import "@vkontakte/vkui/dist/vkui.css";
import "./index.css";
import App from "./app/App";

function applyAppearance(appearance?: string) {
  const isDark = appearance !== "light";
  document.body.classList.toggle("dark-theme", isDark);
  document.body.classList.toggle("light-theme", !isDark);
  document.documentElement.setAttribute("scheme", isDark ? "space_gray" : "bright_light");
  document.body.setAttribute("scheme", isDark ? "space_gray" : "bright_light");
}

const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
applyAppearance(prefersDark ? "dark" : "light");

bridge.subscribe((e) => {
  if (e.detail.type !== "VKWebAppUpdateConfig") return;
  applyAppearance(e.detail.data?.appearance);
});

void bridge
  .send("VKWebAppGetConfig")
  .then((config) => applyAppearance((config as { appearance?: string })?.appearance))
  .catch(() => {
    // Keep media-query fallback when VK config is unavailable.
  });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider>
      <AppRoot>
        <App />
      </AppRoot>
    </ConfigProvider>
  </React.StrictMode>
);
