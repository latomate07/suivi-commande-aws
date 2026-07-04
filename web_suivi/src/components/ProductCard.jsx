import React from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { Progress } from "@/components/ui/progress.jsx";
import { STATUS_LABELS, STATUS_PROGRESS, statusBadgeVariant } from "@/lib/api.js";

export function ProductCard({ product, onOrder, isOrdering }) {
  const order = product.order;
  const outOfStock = !order && product.stock <= 0;

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden="true">
            {product.icon}
          </span>
          <div>
            <CardTitle>{product.name}</CardTitle>
            <CardDescription>{product.category}</CardDescription>
          </div>
        </div>
        <span className="whitespace-nowrap text-sm font-semibold text-foreground">{product.price.toFixed(2)} €</span>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        <p className="text-sm text-muted-foreground">{product.description}</p>
        <p className="text-xs text-muted-foreground">
          {outOfStock ? "Rupture de stock" : `Stock disponible : ${product.stock}`}
        </p>

        {order && (
          <div className="space-y-2 rounded-md border bg-secondary/40 p-3">
            <div className="flex items-center justify-between">
              <Badge variant={statusBadgeVariant(order.status)}>{STATUS_LABELS[order.status]}</Badge>
              <span className="text-xs text-muted-foreground">
                {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(
                  new Date(order.updatedAt)
                )}
              </span>
            </div>
            <Progress value={STATUS_PROGRESS[order.status] ?? 0} />
          </div>
        )}
      </CardContent>

      <CardFooter>
        {order ? (
          <Button className="w-full" variant="secondary" disabled>
            Commande en cours
          </Button>
        ) : (
          <Button className="w-full" onClick={() => onOrder(product.id)} disabled={outOfStock || isOrdering}>
            {isOrdering ? "Commande en cours…" : outOfStock ? "Rupture de stock" : "Commander"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
