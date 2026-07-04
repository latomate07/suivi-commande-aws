// Authentification du backoffice via Amazon Cognito (User Pool).
//
// La vérification des identifiants est déléguée au User Pool défini dans
// infra/auth.yml (flux ALLOW_USER_PASSWORD_AUTH). On appelle directement l'API
// Cognito Identity Provider (InitiateAuth / RespondToAuthChallenge) en fetch,
// sans SDK : le projet n'embarque volontairement que React.
//
// Configuration injectée au build par le workflow de déploiement (voir
// .github/workflows/deploy-web-stock.yml) :
//   VITE_COGNITO_USER_POOL_ID  ex. eu-west-1_ABC123456
//   VITE_COGNITO_CLIENT_ID     ex. 1h57kf5cpq17m0eml12abcdef  (client sans secret)
// En local, renseigner ces valeurs dans web_stock/.env.local (voir .env.example).

const SESSION_KEY = "delivery-admin-session";

const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID || "";
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || "";
// La région est contenue dans l'identifiant du pool : "eu-west-1_ABC123".
const REGION = USER_POOL_ID.includes("_") ? USER_POOL_ID.split("_")[0] : "";
const COGNITO_ENDPOINT = REGION ? `https://cognito-idp.${REGION}.amazonaws.com/` : "";

export function isCognitoConfigured() {
  return Boolean(CLIENT_ID && COGNITO_ENDPOINT);
}

// Authentifie l'utilisateur. Retourne soit une session (succès), soit un objet
// { challenge: "NEW_PASSWORD_REQUIRED", ... } quand le compte doit définir un
// nouveau mot de passe (cas typique d'un utilisateur créé côté console admin).
// Lève une Error avec un message lisible en cas d'échec.
export async function authenticate(email, password) {
  const username = normalizeEmail(email);
  const result = await cognitoCall("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: CLIENT_ID,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password
    }
  });

  if (result.ChallengeName === "NEW_PASSWORD_REQUIRED") {
    return {
      challenge: "NEW_PASSWORD_REQUIRED",
      email: username,
      cognitoSession: result.Session
    };
  }

  return persistFromAuthResult(username, result.AuthenticationResult);
}

// Répond au challenge NEW_PASSWORD_REQUIRED avec le mot de passe définitif.
export async function completeNewPassword(email, newPassword, cognitoSession) {
  const username = normalizeEmail(email);
  const result = await cognitoCall("RespondToAuthChallenge", {
    ChallengeName: "NEW_PASSWORD_REQUIRED",
    ClientId: CLIENT_ID,
    Session: cognitoSession,
    ChallengeResponses: {
      USERNAME: username,
      NEW_PASSWORD: newPassword
    }
  });

  return persistFromAuthResult(username, result.AuthenticationResult);
}

// Renvoie l'ID token si la session est encore valide, sinon null. À utiliser
// comme header Authorization pour appeler l'API admin protégée par Cognito.
export function getIdToken() {
  const session = readSession();
  return session ? session.idToken : null;
}

export function readSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    const session = JSON.parse(raw);
    if (!session || !session.email || !session.idToken || !session.expiresAt) {
      return null;
    }
    // Petite marge (30 s) pour éviter d'utiliser un token qui expire à l'instant.
    if (Date.now() >= session.expiresAt - 30_000) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

// Tente de renouveler la session via le refresh token. Retourne la nouvelle
// session ou null si le renouvellement échoue (l'appelant doit alors reloguer).
export async function refreshSession() {
  const current = readStoredSession();
  if (!current || !current.refreshToken) {
    return null;
  }

  try {
    const result = await cognitoCall("InitiateAuth", {
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: CLIENT_ID,
      AuthParameters: {
        REFRESH_TOKEN: current.refreshToken
      }
    });
    // Le flux refresh ne renvoie pas de nouveau refresh token : on conserve l'ancien.
    return persistFromAuthResult(current.email, result.AuthenticationResult, current.refreshToken);
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore : la déconnexion reste effective côté état React.
  }
}

// --- Interne -------------------------------------------------------------

async function cognitoCall(action, payload) {
  if (!isCognitoConfigured()) {
    throw new Error(
      "Cognito n'est pas configuré : renseignez VITE_COGNITO_USER_POOL_ID et VITE_COGNITO_CLIENT_ID."
    );
  }

  let response;
  try {
    response = await fetch(COGNITO_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": `AWSCognitoIdentityProviderService.${action}`
      },
      body: JSON.stringify(payload)
    });
  } catch {
    throw new Error("Service d'authentification injoignable. Vérifiez votre connexion.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(mapCognitoError(data.__type, data.message));
  }
  return data;
}

function persistFromAuthResult(email, authResult, fallbackRefreshToken) {
  if (!authResult || !authResult.IdToken) {
    throw new Error("Réponse d'authentification inattendue.");
  }

  const session = {
    email,
    idToken: authResult.IdToken,
    accessToken: authResult.AccessToken,
    refreshToken: authResult.RefreshToken || fallbackRefreshToken || null,
    expiresAt: Date.now() + (authResult.ExpiresIn || 3600) * 1000,
    loggedInAt: new Date().toISOString()
  };
  writeSession(session);
  return session;
}

function readStoredSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(session) {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // La session reste valable pour la durée de la page même sans stockage.
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// Traduit les codes d'erreur Cognito en messages lisibles côté opérateur.
function mapCognitoError(type = "", message = "") {
  const code = String(type).split("#").pop();
  switch (code) {
    case "NotAuthorizedException":
      return "Identifiants incorrects. Vérifiez l'e-mail et le mot de passe.";
    case "UserNotFoundException":
      return "Aucun compte ne correspond à cet e-mail.";
    case "UserNotConfirmedException":
      return "Ce compte n'est pas encore confirmé.";
    case "PasswordResetRequiredException":
      return "Une réinitialisation du mot de passe est requise.";
    case "TooManyRequestsException":
    case "LimitExceededException":
      return "Trop de tentatives. Réessayez dans quelques instants.";
    case "InvalidPasswordException":
      return message || "Le mot de passe ne respecte pas la politique de sécurité.";
    default:
      return message || "Échec de l'authentification.";
  }
}
