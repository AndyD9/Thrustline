import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import { CompanyProvider } from "./contexts/CompanyContext.tsx";
import { SimProvider } from "./contexts/SimContext.tsx";
import { UnitsProvider } from "./contexts/UnitsContext.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CompanyProvider>
          <SimProvider>
            <UnitsProvider>
              <App />
            </UnitsProvider>
          </SimProvider>
        </CompanyProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
