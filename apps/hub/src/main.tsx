import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AppHealthProvider } from "./context/AppHealthContext";
import { SaveStatusProvider } from "./context/SaveStatusContext";
import { ToastProvider } from "./hooks/useToast";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AppHealthProvider>
          <SaveStatusProvider>
            <App />
          </SaveStatusProvider>
        </AppHealthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
