export const API_BASE_URL = "http://127.0.0.1:4000/api";

export const STATUS_FLOW = ["preparation", "expedie", "en_livraison", "livree"];

export const STATUS_LABELS = {
  preparation: "Préparation",
  expedie: "Expédiée",
  en_livraison: "En livraison",
  livree: "Livrée",
  incident: "Incident"
};

export const STATUS_PROGRESS = {
  preparation: 25,
  expedie: 50,
  en_livraison: 75,
  livree: 100,
  incident: 100
};

export function statusBadgeVariant(status) {
  if (status === "livree") return "success";
  if (status === "incident") return "destructive";
  if (status === "preparation") return "secondary";
  return "warning";
}

export async function fetchProducts() {
  const response = await fetch(`${API_BASE_URL}/products`);
  if (!response.ok) {
    throw new Error(`Erreur API ${response.status}`);
  }
  return response.json();
}

export async function orderProduct(productId) {
  const response = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(productId)}/order`, {
    method: "POST"
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Erreur API ${response.status}`);
  }
  return response.json();
}
