import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initTheme } from "./lib/theme";
import { showToast } from "./lib/toast";
import "./index.css";

initTheme(); // before render, so dark mode never flashes light

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Surface failures that slip past a local catch (e.g. a write awaited
// somewhere without one) instead of failing silently.
window.addEventListener("unhandledrejection", (e) => {
  console.error("[unhandled]", e.reason);
  showToast("Something didn't save — check your connection");
});

// Register the service worker for offline app-shell (production builds only —
// avoids interfering with Vite's dev HMR).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // A new SW installing while one controls the page = an update is ready.
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          sw?.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              showToast("Update ready", {
                action: { label: "Reload", run: () => window.location.reload() },
                duration: 0,
              });
            }
          });
        });
        // Re-check whenever the PWA comes back to the foreground.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") void reg.update();
        });
      })
      .catch(() => {
        /* offline shell is a progressive enhancement; ignore registration failures */
      });
  });
}
