import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import LacakStatus from "./LacakStatus.jsx";

const isLacak =
  window.location.pathname.replace(/\/$/, "") === "/lacak" ||
  new URLSearchParams(window.location.search).get("lacak") === "1";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>{isLacak ? <LacakStatus /> : <App />}</React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
