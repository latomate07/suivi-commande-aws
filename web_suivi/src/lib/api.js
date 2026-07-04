export const API_BASE_URL = "https://qrrj372ee2.execute-api.eu-west-1.amazonaws.com/dev";

// Le catalogue produit n'est pas exposé publiquement par le backend (GET /list/products
// existe mais est protégé par Cognito sur l'API admin). En attendant une route publique,
// on reflète ici les mêmes produits que backend/src/handlers/listProducts.ts.
export const PRODUCTS_CATALOG = [
  {
    id: "PROD-001",
    name: "T-shirt Classique",
    description: "Coupe droite, coton peigné.",
    category: "vetements",
    price: 29.99,
    stock: 150,
    icon: "👕"
  },
  {
    id: "PROD-002",
    name: "Jean Slim",
    description: "Coupe ajustée, confort stretch.",
    category: "vetements",
    price: 59.99,
    stock: 80,
    icon: "👖"
  },
  {
    id: "PROD-003",
    name: "Veste en Cuir",
    description: "Cuir véritable, doublure intérieure.",
    category: "vetements",
    price: 149.99,
    stock: 30,
    icon: "🧥"
  },
  {
    id: "PROD-004",
    name: "Sneakers Blanches",
    description: "Semelle légère, tige respirante.",
    category: "chaussures",
    price: 89.99,
    stock: 60,
    icon: "👟"
  },
  {
    id: "PROD-005",
    name: "Casquette Logo",
    description: "Ajustable, broderie logo.",
    category: "accessoires",
    price: 19.99,
    stock: 200,
    icon: "🧢"
  }
];

// Vocabulaire réel de backend/src/handlers/updateOrder.ts (VALID_STATUSES).
export const STATUS_FLOW = ["preparation", "expedie", "livre"];

export const STATUS_LABELS = {
  preparation: "Préparation",
  expedie: "Expédiée",
  livre: "Livrée",
  annule: "Annulée"
};

export const STATUS_PROGRESS = {
  preparation: 33,
  expedie: 66,
  livre: 100,
  annule: 100
};

export function statusBadgeVariant(status) {
  if (status === "livre") return "success";
  if (status === "annule") return "destructive";
  if (status === "preparation") return "secondary";
  return "warning";
}

export function createOrderId() {
  const random = (window.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^a-z0-9]/gi, "");
  return `ORD-${random.slice(0, 12)}`.toUpperCase();
}

export async function createOrder(orderId) {
  const response = await fetch(`${API_BASE_URL}/create/${encodeURIComponent(orderId)}`, {
    method: "POST"
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Erreur API ${response.status}`);
  }
  return response.json();
}

export async function trackOrder(orderId) {
  const response = await fetch(`${API_BASE_URL}/track/${encodeURIComponent(orderId)}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Erreur API ${response.status}`);
  }
  return response.json();
}
