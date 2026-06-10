//this file has been inspected and certified
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background:   "#111118",
            color:        "#f0f0f5",
            border:       "1px solid rgba(255,255,255,0.08)",
            borderRadius: "14px",
            fontFamily:   "var(--font-sans)",
            fontSize:     "0.85rem",
            fontWeight:   "500",
            letterSpacing: "0.01em",
            boxShadow:    "0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(200,160,224,0.06)",
            padding:      "12px 16px",
          },
          success: {
            iconTheme: {
              primary:    "#c8a0e0",
              secondary:  "#111118",
            },
          },
          error: {
            iconTheme: {
              primary:    "#f87171",
              secondary:  "#111118",
            },
          },
        }}
      />
    </BrowserRouter>
  </StrictMode>
);