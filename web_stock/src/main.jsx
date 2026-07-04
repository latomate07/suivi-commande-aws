import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app">
          <section className="panel runtime-error">
            <div className="panel-header">
              <div>
                <h1>Erreur de chargement React</h1>
                <p>{this.state.error.message}</p>
              </div>
            </div>
            <div className="panel-body">
              <p>Recharge la page avec Cmd + Shift + R. Si l'erreur reste affichée, copie ce message.</p>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
