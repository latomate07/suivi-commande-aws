import React, { useEffect, useRef, useState } from "react";
import { ProductCard } from "@/components/ProductCard.jsx";
import { API_BASE_URL, PRODUCTS_CATALOG, createOrder, createOrderId, trackOrder } from "@/lib/api.js";
import { getAllRememberedOrders, rememberOrder } from "@/lib/orderStore.js";
import { PackageSearch, RefreshCcw, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog.jsx";
import { Button } from "@/components/ui/button.jsx";

const POLL_INTERVAL_MS = 3000;

export function HomePage() {
  const [orders, setOrders] = useState({});
  const [connectionError, setConnectionError] = useState(null);
  const [orderingId, setOrderingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function refreshKnownOrders() {
      const remembered = getAllRememberedOrders();
      const entries = Object.entries(remembered);
      if (!entries.length) {
        return;
      }

      const results = await Promise.all(
        entries.map(async ([orderId, { productId }]) => {
          try {
            const data = await trackOrder(orderId);
            return [productId, { orderId, status: data.status, updatedAt: data.updatedAt, createdAt: data.createdAt }];
          } catch {
            return null;
          }
        })
      );

      if (cancelled) return;
      setOrders((current) => {
        const next = { ...current };
        results.forEach((entry) => {
          if (entry) next[entry[0]] = entry[1];
        });
        return next;
      });
    }

    async function checkConnection() {
      // GET /orders est un stub de test dont la réponse n'a pas les headers CORS : on
      // vérifie plutôt via /track, dont le handler renvoie toujours Access-Control-Allow-Origin
      // (200 ou 404 prouvent tous les deux que l'API répond, seule une erreur réseau/CORS compte).
      try {
        await fetch(`${API_BASE_URL}/track/__connectivity_check__`);
        if (!cancelled) {
          setConnectionError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setConnectionError(error.message || "API injoignable.");
        }
      }
    }

    checkConnection();
    refreshKnownOrders();
    const timer = window.setInterval(refreshKnownOrders, POLL_INTERVAL_MS);
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
    const product = PRODUCTS_CATALOG.find((item) => item.id === productId);
    const orderId = createOrderId();
    setOrderingId(productId);
    try {
      const created = await createOrder(orderId);
      rememberOrder(orderId, productId);
      setOrders((current) => ({
        ...current,
        [productId]: { orderId, status: created.status, updatedAt: created.updatedAt, createdAt: created.createdAt }
      }));
      setConfirmedOrder({ orderId, productName: product?.name || productId });
    } catch (error) {
      showToast("Commande refusée", error.message || "Le service n'a pas répondu.");
    } finally {
      setOrderingId(null);
    }
  }

  const products = PRODUCTS_CATALOG.map((product) => {
    const activeOrder = orders[product.id];
    return {
      ...product,
      stock: activeOrder ? Math.max(product.stock - 1, 0) : product.stock,
      order: activeOrder ? { status: activeOrder.status, updatedAt: activeOrder.updatedAt } : null
    };
  });

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
              <p className="text-sm text-muted-foreground">Catalogue et suivi de commande.</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-xs text-muted-foreground sm:self-auto">
            <span className={`h-2 w-2 rounded-full ${connectionError ? "bg-destructive" : "bg-emerald-500"}`} />
            {connectionError ? "API injoignable" : "Connecté à l'API"}
          </div>
        </div>
      </header>

      <main className="container py-8">
        {connectionError && (
          <div className="mb-6 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <RefreshCcw className="h-4 w-4" />
            {connectionError} — vérifie que l'API est accessible ({API_BASE_URL}).
          </div>
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

      <Dialog open={Boolean(confirmedOrder)} onOpenChange={(open) => !open && setConfirmedOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <DialogTitle>Commande enregistrée</DialogTitle>
            <DialogDescription>
              Votre commande pour « {confirmedOrder?.productName} » a bien été enregistrée. Vous pouvez suivre son
              avancement à tout moment.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmedOrder(null)}>
              Fermer
            </Button>
            <Button asChild>
              <a href={`#/orders/${confirmedOrder?.orderId}`}>Suivre la commande</a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
