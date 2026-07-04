// Le backend (POST /create/{orderId}) ne relie pas une commande à un produit : il ne stocke
// qu'un orderId et un statut. Cette association orderId -> produit n'existe donc que côté
// client, pour pouvoir réafficher le produit sur la page de suivi et sur la home.
const STORAGE_KEY = "web-suivi:orders";

function loadStore() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveStore(store) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Le suivi reste utilisable même si le stockage local est indisponible.
  }
}

export function rememberOrder(orderId, productId) {
  const store = loadStore();
  store[orderId] = { productId, createdAt: new Date().toISOString() };
  saveStore(store);
}

export function getProductIdForOrder(orderId) {
  return loadStore()[orderId]?.productId ?? null;
}

export function getActiveOrderIdForProduct(productId) {
  const store = loadStore();
  const entry = Object.entries(store).find(([, value]) => value.productId === productId);
  return entry ? entry[0] : null;
}

export function getAllRememberedOrders() {
  return loadStore();
}
