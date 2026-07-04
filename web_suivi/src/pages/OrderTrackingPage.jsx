import React, { useEffect, useState } from "react";
import { Check, ArrowLeft, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card.jsx";
import { STATUS_FLOW, STATUS_LABELS, PRODUCTS_CATALOG, trackOrder } from "@/lib/api.js";
import { getProductIdForOrder } from "@/lib/orderStore.js";

const STEP_DESCRIPTIONS = {
  preparation: "Votre commande est validée et en cours de préparation.",
  expedie: "Le colis a été transmis au transporteur.",
  livre: "Le colis vous a été remis."
};

const POLL_INTERVAL_MS = 3000;

export default function OrderTrackingPage({ orderId }) {
  const [order, setOrder] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await trackOrder(orderId);
        if (!cancelled) {
          setOrder(data);
          setLoadError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error.message || "Impossible de contacter l'API.");
        }
      }
    }

    load();
    const timer = window.setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [orderId]);

  const product = PRODUCTS_CATALOG.find((item) => item.id === getProductIdForOrder(orderId));
  const statusIndex = order ? STATUS_FLOW.indexOf(order.status) : -1;
  const currentStep = order?.status === "livre" ? STATUS_FLOW.length + 1 : statusIndex + 1;

  const steps = STATUS_FLOW.map((status, index) => ({
    id: index + 1,
    title: STATUS_LABELS[status],
    description: STEP_DESCRIPTIONS[status]
  }));

  return (
    <div className="min-h-screen bg-secondary/40 p-6 font-sans">
      <div className="mx-auto mb-6 flex max-w-[500px] items-center justify-between">
        <a href="#/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Retour au catalogue
        </a>
        <span className="text-xs text-muted-foreground">{orderId}</span>
      </div>

      <div className="flex flex-col items-center justify-center">
        {loadError && (
          <div className="w-full max-w-[500px] rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {loadError}
          </div>
        )}

        {!order && !loadError && <p className="text-sm text-muted-foreground">Chargement de la commande…</p>}

        {order && (
          <Card className="w-full max-w-[500px] overflow-hidden rounded-2xl border-0 bg-card px-8 pb-4 pt-8 shadow-xl">
            <CardContent className="p-0">
              <div className="mb-6 flex items-center gap-3">
                <span className="text-3xl" aria-hidden="true">
                  {product?.icon || "📦"}
                </span>
                <div>
                  <h2 className="text-base font-semibold">{product?.name || "Produit"}</h2>
                  {product && <p className="text-sm text-muted-foreground">{product.price.toFixed(2)} €</p>}
                  {!product && (
                    <p className="text-xs text-muted-foreground">
                      Produit associé introuvable sur cet appareil.
                    </p>
                  )}
                </div>
              </div>

              {order.status === "annule" ? (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  Cette commande a été annulée.
                </div>
              ) : (
                <div className="flex flex-col">
                  {steps.map((step, index) => {
                    const isCompleted = step.id < currentStep;
                    const isActive = step.id === currentStep;
                    const isLast = index === steps.length - 1;

                    return (
                      <div key={step.id} className="group relative flex items-start">
                        {!isLast && (
                          <div
                            className={`absolute left-[15px] top-8 h-[calc(100%-12px)] w-[2px] transition-colors duration-300 ${
                              isCompleted ? "bg-primary" : "bg-secondary"
                            }`}
                          />
                        )}

                        <div className="relative z-10 mr-5 flex h-8 w-8 shrink-0 items-center justify-center">
                          {isCompleted ? (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-4 w-4" strokeWidth={3} />
                            </div>
                          ) : isActive ? (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border-[4px] border-secondary bg-card">
                              <div className="h-3 w-3 rounded-full bg-primary" />
                            </div>
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border-[4px] border-secondary bg-card">
                              <div className="h-3 w-3 rounded-full bg-secondary" />
                            </div>
                          )}
                        </div>

                        <div className={`pb-8 ${isLast ? "pb-2" : ""}`}>
                          <h3
                            className={`text-[17px] font-medium tracking-tight ${
                              isActive || isCompleted ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {step.title}
                          </h3>
                          <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{step.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
