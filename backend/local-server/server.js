import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSeedProducts } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data.json");
const PORT = process.env.PORT || 4000;

const STATUS_FLOW = ["preparation", "expedie", "en_livraison", "livree"];
const VALID_STATUSES = new Set([...STATUS_FLOW, "incident"]);

function createOrderId() {
  return `ORD-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

function findProductByOrderId(orderId) {
  return Object.values(products).find((product) => product.order && product.order.id === orderId);
}

function toOrderResponse(product) {
  return {
    orderId: product.order.id,
    status: product.order.status,
    previousStatus: product.order.previousStatus,
    createdAt: product.order.createdAt,
    updatedAt: product.order.updatedAt,
    product: {
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      price: product.price,
      icon: product.icon
    }
  };
}

function backfillOrderIds(loadedProducts) {
  Object.values(loadedProducts).forEach((product) => {
    if (product.order && !product.order.id) {
      product.order.id = createOrderId();
    }
  });
  return loadedProducts;
}

function loadProducts() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      return backfillOrderIds(JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")));
    } catch {
      return createSeedProducts();
    }
  }
  return createSeedProducts();
}

function saveProducts(products) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2));
}

let products = loadProducts();
saveProducts(products);

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/products", (req, res) => {
  res.json(Object.values(products));
});

app.get("/api/products/:id", (req, res) => {
  const product = products[req.params.id];
  if (!product) {
    return res.status(404).json({ error: "Produit introuvable" });
  }
  res.json(product);
});

app.post("/api/products/:id/order", (req, res) => {
  const product = products[req.params.id];
  if (!product) {
    return res.status(404).json({ error: "Produit introuvable" });
  }
  if (product.order) {
    return res.status(409).json({ error: "Une commande est deja en cours pour ce produit" });
  }
  if (product.stock <= 0) {
    return res.status(409).json({ error: "Produit en rupture de stock" });
  }

  product.stock -= 1;
  product.order = {
    id: createOrderId(),
    status: "preparation",
    previousStatus: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  saveProducts(products);
  res.status(201).json(product);
});

app.get("/api/orders/:orderId", (req, res) => {
  const product = findProductByOrderId(req.params.orderId);
  if (!product) {
    return res.status(404).json({ error: "Commande introuvable" });
  }
  res.json(toOrderResponse(product));
});

app.patch("/api/products/:id/order/status", (req, res) => {
  const product = products[req.params.id];
  if (!product) {
    return res.status(404).json({ error: "Produit introuvable" });
  }
  if (!product.order) {
    return res.status(409).json({ error: "Aucune commande en cours pour ce produit" });
  }
  const { status } = req.body || {};
  if (!VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: "Statut invalide" });
  }

  product.order.previousStatus = product.order.status;
  product.order.status = status;
  product.order.updatedAt = new Date().toISOString();
  saveProducts(products);
  res.json(product);
});

app.post("/api/products/:id/order/reset", (req, res) => {
  const product = products[req.params.id];
  if (!product) {
    return res.status(404).json({ error: "Produit introuvable" });
  }
  if (product.order) {
    product.stock += 1;
    product.order = null;
    saveProducts(products);
  }
  res.json(product);
});

app.post("/api/reset-demo", (req, res) => {
  products = createSeedProducts();
  saveProducts(products);
  res.json(Object.values(products));
});

app.listen(PORT, () => {
  console.log(`API locale demarree sur http://127.0.0.1:${PORT}`);
});
