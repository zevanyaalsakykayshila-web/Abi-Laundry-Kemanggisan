import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import LacakStatus from "./LacakStatus.jsx";
import Profile from "./Profile.jsx";

const path = window.location.pathname.replace(/\/$/, "") || "/";
const isLacak = path === "/lacak" || new URLSearchParams(window.location.search).get("lacak") === "1";
const isAdmin = path === "/admin" || new URLSearchParams(window.location.search).get("admin") === "1";

let PageComponent = Profile; // "/" = halaman profil perusahaan (publik)
if (isLacak) PageComponent = LacakStatus;
else if (isAdmin) PageComponent = App; // "/admin" = aplikasi transaksi (login)

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PageComponent />
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
