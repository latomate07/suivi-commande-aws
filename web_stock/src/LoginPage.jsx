import React, { useState } from "react";
import { authenticate, completeNewPassword } from "./auth.js";

export default function LoginPage({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // Renseigné quand Cognito exige la définition d'un nouveau mot de passe.
  const [challenge, setChallenge] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await authenticate(email, password);
      if (result.challenge === "NEW_PASSWORD_REQUIRED") {
        setChallenge(result);
        setSubmitting(false);
        return;
      }
      finishLogin(result);
    } catch (err) {
      setError(err.message || "Échec de l'authentification.");
      setSubmitting(false);
    }
  }

  async function handleNewPassword(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const session = await completeNewPassword(challenge.email, newPassword, challenge.cognitoSession);
      finishLogin(session);
    } catch (err) {
      setError(err.message || "Impossible de définir le nouveau mot de passe.");
      setSubmitting(false);
    }
  }

  function finishLogin(session) {
    window.location.hash = "#/orders";
    onSuccess(session);
  }

  return (
    <main className="login">
      <section className="panel login-card" aria-labelledby="loginTitle">
        <div className="panel-header">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <LockIcon />
            </span>
            <div>
              <h1 id="loginTitle">Backoffice</h1>
              <p>Connexion réservée à l'administration des livraisons.</p>
            </div>
          </div>
        </div>

        <div className="panel-body">
          {challenge ? (
            <form className="form-grid" onSubmit={handleNewPassword}>
              <p className="muted">
                Premier accès pour <strong>{challenge.email}</strong> : définissez un mot de passe
                définitif (8 caractères minimum, avec majuscule, minuscule et chiffre).
              </p>

              <div className="field">
                <label htmlFor="newPassword">Nouveau mot de passe</label>
                <input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  required
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </div>

              {error && (
                <p className="login-error" role="alert">
                  {error}
                </p>
              )}

              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? "Validation…" : "Définir le mot de passe"}
              </button>
            </form>
          ) : (
            <form className="form-grid" onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="loginEmail">Adresse e-mail</label>
                <input
                  id="loginEmail"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="loginPassword">Mot de passe</label>
                <input
                  id="loginPassword"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              {error && (
                <p className="login-error" role="alert">
                  {error}
                </p>
              )}

              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? "Connexion…" : "Se connecter"}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

function LockIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
