import React, { useEffect, useRef, useState } from "react";
import { ProductCard } from "@/components/ProductCard.jsx";
import { fetchProducts, orderProduct } from "@/lib/api.js";
import { PackageSearch, RefreshCcw } from "lucide-react";

const POLL_INTERVAL_MS = 3000;

export default function App() {
  const [products, setProducts] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [orderingId, setOrderingId] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchProducts();
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

  async function handleOrder(productId) {
    setOrderingId(productId);
    try {
      const updated = await orderProduct(productId);
      setProducts((current) => current.map((product) => (product.id === updated.id ? updated : product)));
      showToast("Commande envoyée", `${updated.name} est en préparation.`);
    } catch (error) {
      showToast("Commande refusée", error.message || "Le service n'a pas répondu.");
    } finally {
      setOrderingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex flex-col gap-2 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-md border bg-secondary text-primary">
              <PackageSearch className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Suivi des produits</h1>
              <p className="text-sm text-muted-foreground">Catalogue synchronisé avec la gestion de stock.</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-xs text-muted-foreground sm:self-auto">
            <span className={`h-2 w-2 rounded-full ${loadError ? "bg-destructive" : "bg-emerald-500"}`} />
            {loadError ? "API locale injoignable" : "Connecté à l'API locale"}
          </div>
        </div>
      </header>

      <main className="container py-8">
        {loadError && (
          <div className="mb-6 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <RefreshCcw className="h-4 w-4" />
            {loadError} — lance <code className="mx-1">npm run dev</code> dans{" "}
            <code className="mx-1">backend/local-server</code>.
          </div>
        )}

        {!products.length && !loadError && (
          <p className="text-sm text-muted-foreground">Chargement du catalogue…</p>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onOrder={handleOrder}
              isOrdering={orderingId === product.id}
            />
          ))}
        </div>
      </main>

      <div
        className={`fixed bottom-5 right-5 w-[min(360px,calc(100%-2.5rem))] rounded-md border bg-card p-4 shadow-lg transition-all duration-200 ${
          toast ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
        }`}
        role="status"
        aria-live="polite"
      >
        <p className="text-sm font-semibold">{toast?.title}</p>
        <p className="text-sm text-muted-foreground">{toast?.message}</p>
      </div>
    </div>
  );
}
