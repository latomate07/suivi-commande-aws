import React, { useEffect, useRef, useState } from "react";

export const PRODUCTS_API_URL = "http://127.0.0.1:4000/api";
const POLL_INTERVAL_MS = 4000;

const statusFlow = ["preparation", "expedie", "en_livraison", "livree"];
const statusLabels = {
  preparation: "Préparation",
  expedie: "Expédiée",
  en_livraison: "En livraison",
  livree: "Livrée",
  incident: "Incident"
};

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`${PRODUCTS_API_URL}/products`);
        if (!response.ok) {
          throw new Error(`Erreur API ${response.status}`);
        }
        const data = await response.json();
        if (!cancelled) {
          setProducts(data);
          setLoadError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error.message || "Impossible de contacter l'API locale.");
        }
      }
    }

    load();
    const timer = window.setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  function showToast(title, message) {
    window.clearTimeout(toastTimer.current);
    setToast({ title, message });
    toastTimer.current = window.setTimeout(() => setToast(null), 3300);
  }

  async function updateStatus(productId, status) {
    try {
      const response = await fetch(`${PRODUCTS_API_URL}/products/${encodeURIComponent(productId)}/order/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Erreur API ${response.status}`);
      }
      const updated = await response.json();
      setProducts((current) => current.map((product) => (product.id === updated.id ? updated : product)));
      showToast("Statut mis à jour", `${updated.name} est maintenant ${statusLabels[status].toLowerCase()}.`);
    } catch (error) {
      showToast("Mise à jour refusée", error.message || "Le service n'a pas répondu.");
    }
  }

  async function resetOrder(productId) {
    try {
      const response = await fetch(`${PRODUCTS_API_URL}/products/${encodeURIComponent(productId)}/order/reset`, {
        method: "POST"
      });
      if (!response.ok) {
        throw new Error(`Erreur API ${response.status}`);
      }
      const updated = await response.json();
      setProducts((current) => current.map((product) => (product.id === updated.id ? updated : product)));
      showToast("Commande annulée", `${updated.name} est de nouveau disponible.`);
    } catch (error) {
      showToast("Action refusée", error.message || "Le service n'a pas répondu.");
    }
  }

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            📦
          </span>
          <div>
            <h1>Produits</h1>
            <p>Stock et statut des commandes en cours, synchronisés avec web_suivi.</p>
          </div>
        </div>
        <div className="top-actions">
          <a className="secondary-button" href="#/admin">
            Suivi des commandes (démo)
          </a>
        </div>
      </header>

      <section className="panel orders-panel" aria-labelledby="productsTitle">
        <div className="panel-header">
          <div>
            <h2 id="productsTitle">Catalogue produits</h2>
            <p>{products.length} produit{products.length > 1 ? "s" : ""}</p>
          </div>
        </div>

        {loadError && (
          <div className="empty-state">
            API locale injoignable ({loadError}). Lance <code>npm run dev</code> dans <code>backend/local-server</code>.
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Catégorie</th>
                <th>Prix</th>
                <th>Stock</th>
                <th>Commande</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <strong>
                      {product.icon} {product.name}
                    </strong>
                  </td>
                  <td>{product.category}</td>
                  <td>{product.price.toFixed(2)} €</td>
                  <td>{product.stock}</td>
                  <td>
                    {product.order ? (
                      <span className="badge" data-tone={getStatusTone(product.order.status)}>
                        {statusLabels[product.order.status]}
                      </span>
                    ) : (
                      <span className="muted">Aucune commande</span>
                    )}
                  </td>
                  <td>
                    {product.order && (
                      <div className="product-order-actions">
                        <select
                          aria-label={`Statut de la commande pour ${product.name}`}
                          value={product.order.status}
                          onChange={(event) => updateStatus(product.id, event.target.value)}
                        >
                          {statusFlow.concat("incident").map((status) => (
                            <option key={status} value={status}>
                              {statusLabels[status]}
                            </option>
                          ))}
                        </select>
                        <button
                          className="secondary-button compact-button"
                          type="button"
                          onClick={() => resetOrder(product.id)}
                        >
                          Annuler
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!products.length && !loadError && <div className="empty-state">Chargement du catalogue…</div>}
      </section>

      <div className={`toast ${toast ? "is-visible" : ""}`} role="status" aria-live="polite">
        <strong>{toast?.title || "Statut mis à jour"}</strong>
        <span>{toast?.message || ""}</span>
      </div>
    </main>
  );
}

function getStatusTone(status) {
  if (status === "livree") {
    return "success";
  }
  if (status === "incident") {
    return "danger";
  }
  if (status === "preparation") {
    return "neutral";
  }
  return "warning";
}
