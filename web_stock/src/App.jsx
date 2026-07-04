import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LoginPage from "./LoginPage.jsx";
import { readSession, clearSession, getIdToken } from "./auth.js";

// URL de base de l'API admin protégée par Cognito (injectée au build, voir .env.example).
const ADMIN_API_URL = (import.meta.env.VITE_ADMIN_API_URL || "").replace(/\/$/, "");
const PAGE_SIZE = 10;
// Statuts alignés sur le backend (updateOrder.ts) : preparation, expedie, livre, annule.
const statusFlow = ["preparation", "expedie", "livre"];
const statusLabels = {
  preparation: "Préparation",
  expedie: "Expédiée",
  livre: "Livrée",
  annule: "Annulée"
};
const statusDescriptions = {
  preparation: "Commande validée et colis en préparation.",
  expedie: "Colis transmis au transporteur.",
  livre: "Colis remis au destinataire.",
  annule: "Commande annulée."
};

export default function App() {
  const route = useHashRoute();
  const [session, setSession] = useState(readSession);
  const [orders, setOrders] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const handleLogout = useCallback(() => {
    clearSession();
    setSession(null);
    setOrders({});
  }, []);

  const reloadOrders = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const items = await fetchOrders();
      setOrders(indexOrders(items));
    } catch (error) {
      if (error.status === 401) {
        handleLogout();
        return;
      }
      setLoadError(error.message || "Impossible de charger les commandes.");
    } finally {
      setLoading(false);
    }
  }, [handleLogout]);

  useEffect(() => {
    if (session) {
      reloadOrders();
    }
  }, [session, reloadOrders]);

  function showToast(title, message) {
    window.clearTimeout(toastTimer.current);
    setToast({ title, message });
    toastTimer.current = window.setTimeout(() => setToast(null), 3300);
  }

  if (!session) {
    return <LoginPage onSuccess={setSession} />;
  }

  const pageProps = { orders, loading, loadError, reloadOrders, session, onLogout: handleLogout };

  return (
    <>
      {route.page === "orders" ? (
        <OrdersPage {...pageProps} />
      ) : (
        <AdminPage
          {...pageProps}
          routeOrderNumber={route.query.get("order")}
          setOrders={setOrders}
          showToast={showToast}
        />
      )}
      <Toast toast={toast} />
    </>
  );
}

function AdminPage({ orders, loading, loadError, reloadOrders, routeOrderNumber, setOrders, showToast, session, onLogout }) {
  const [currentOrderNumber, setCurrentOrderNumber] = useState(() => normalizeOrderNumber(routeOrderNumber || ""));
  const [orderInput, setOrderInput] = useState(currentOrderNumber);
  const [selectedStatus, setSelectedStatus] = useState("preparation");
  const [note, setNote] = useState("");
  const [lastEvent, setLastEvent] = useState(null);
  const [saving, setSaving] = useState(false);

  const currentOrder = currentOrderNumber ? orders[currentOrderNumber] : null;

  function applySelection(order, eventType = "ORDER_SELECTED", previousStatus = null) {
    setCurrentOrderNumber(order.orderNumber);
    setOrderInput(order.orderNumber);
    setSelectedStatus(order.status || "preparation");
    setNote(order.note || "");
    setLastEvent(buildEvent(order, eventType, previousStatus));
  }

  // Résout la commande à afficher quand les données arrivent ou que la route change.
  useEffect(() => {
    const requested = normalizeOrderNumber(routeOrderNumber || "");
    if (requested) {
      if (orders[requested]) {
        applySelection(orders[requested]);
      } else if (!loading && Object.keys(orders).length) {
        showToast("Commande introuvable", `${requested} n'existe pas dans la liste.`);
      }
      return;
    }
    if ((!currentOrderNumber || !orders[currentOrderNumber]) && Object.keys(orders).length) {
      const fallback = getDefaultOrderNumber(orders);
      if (fallback) {
        applySelection(orders[fallback]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, routeOrderNumber, loading]);

  function handleSearch() {
    const orderNumber = normalizeOrderNumber(orderInput);
    if (!orderNumber) {
      return;
    }
    if (!orders[orderNumber]) {
      showToast("Commande introuvable", `${orderNumber} n'existe pas dans la liste.`);
      return;
    }
    applySelection(orders[orderNumber]);
    showToast("Commande chargée", `${orderNumber} est prête à être modifiée.`);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const orderNumber = normalizeOrderNumber(orderInput);
    const existingOrder = orders[orderNumber];
    if (!existingOrder) {
      showToast("Commande introuvable", `${orderNumber} n'existe pas dans la liste.`);
      return;
    }

    const previousStatus = existingOrder.status || "preparation";
    setSaving(true);
    try {
      const attributes = await updateOrderStatus(existingOrder.orderId, selectedStatus);
      const savedOrder = mergeOrder(existingOrder, attributes, selectedStatus, note.trim(), previousStatus);
      setOrders((currentOrders) => ({
        ...currentOrders,
        [savedOrder.orderNumber]: savedOrder
      }));
      applySelection(savedOrder, "ORDER_STATUS_UPDATED", previousStatus);
      showToast(
        "Statut mis à jour",
        `${savedOrder.orderNumber} est maintenant ${statusLabels[savedOrder.status].toLowerCase()}.`
      );
    } catch (error) {
      if (error.status === 401) {
        onLogout();
        return;
      }
      showToast("Mise à jour refusée", error.message || "Le service n'a pas répondu.");
    } finally {
      setSaving(false);
    }
  }

  function handleRefresh() {
    reloadOrders();
    showToast("Actualisation", "Rechargement des commandes depuis l'API.");
  }

  async function copyEvent() {
    if (!lastEvent) {
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(lastEvent, null, 2));
      showToast("Événement copié", "Le message JSON est dans le presse-papiers.");
    } catch {
      showToast("Copie indisponible", "Sélectionnez le bloc JSON manuellement.");
    }
  }

  return (
    <main className="app">
      <Header
        title="Administration des livraisons"
        subtitle="Suivi des commandes et mise à jour du statut"
        icon="truck"
        actions={
          <>
            <a className="secondary-button" href="#/orders">
              <Icon name="list" />
              Liste des commandes
            </a>
            <div className="status-pill">
              <span className="status-dot" aria-hidden="true" />
              <span>{ADMIN_API_URL ? "Connecté à API Gateway" : "API non configurée"}</span>
            </div>
            <UserMenu session={session} onLogout={onLogout} />
          </>
        }
      />

      <section className="layout" aria-label="Console administrateur">
        <section className="panel" aria-labelledby="editTitle">
          <div className="panel-header">
            <div>
              <h2 id="editTitle">Modifier une commande</h2>
              <p>Recherche par numéro puis publication du nouveau statut.</p>
            </div>
            <div className="panel-actions">
              <button className="secondary-button" type="button" onClick={handleRefresh} disabled={loading}>
                <Icon name="refresh" />
                {loading ? "Chargement…" : "Actualiser"}
              </button>
            </div>
          </div>

          <div className="panel-body">
            {loadError && (
              <div className="empty-state" role="alert">
                Erreur de chargement : {loadError}
              </div>
            )}

            <form className="form-grid" onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="orderNumber">Numéro de commande</label>
                <div className="input-row">
                  <input
                    className="uppercase-input"
                    id="orderNumber"
                    name="orderNumber"
                    autoComplete="off"
                    placeholder="CMD-1001"
                    required
                    value={orderInput}
                    onChange={(event) => setOrderInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleSearch();
                      }
                    }}
                  />
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Rechercher la commande"
                    title="Rechercher"
                    onClick={handleSearch}
                  >
                    <Icon name="search" />
                  </button>
                </div>
              </div>

              <div className="field">
                <span className="group-label">Statut</span>
                <div className="status-options" role="radiogroup" aria-label="Statut de la commande">
                  {statusFlow.concat("annule").map((status) => (
                    <StatusOption
                      key={status}
                      status={status}
                      checked={selectedStatus === status}
                      onChange={setSelectedStatus}
                    />
                  ))}
                </div>
              </div>

              <div className="field">
                <label htmlFor="operatorNote">Note interne (locale)</label>
                <textarea
                  id="operatorNote"
                  name="operatorNote"
                  placeholder="Colis remis au transporteur"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>

              <button className="primary-button" type="submit" disabled={saving || !currentOrder}>
                <Icon name="save" />
                {saving ? "Enregistrement…" : "Mettre à jour le statut"}
              </button>
            </form>

            <div className="summary-grid" aria-label="Synthèse">
              <Metric label="Client" value={currentOrder ? formatCustomerName(currentOrder) : "—"} />
              <Metric label="Date de commande" value={currentOrder ? formatDateOnly(currentOrder.orderDate) : "—"} />
              <Metric label="Transporteur" value={currentOrder?.carrier || "—"} />
              <Metric label="Destination" value={currentOrder?.destination || "—"} />
              <Metric label="Dernière mise à jour" value={currentOrder ? formatDate(currentOrder.updatedAt) : "—"} />
            </div>
          </div>
        </section>

        <aside className="side-stack" aria-label="Détails de la commande">
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Commande</h2>
                <p>État courant et étapes de livraison.</p>
              </div>
            </div>
            <div className="panel-body">
              {currentOrder ? (
                <>
                  <div className="order-head">
                    <div className="order-number">
                      <span>Numéro</span>
                      <strong>{currentOrder.orderNumber}</strong>
                    </div>
                    <StatusBadge status={currentOrder.status} />
                  </div>
                  <Timeline order={currentOrder} />
                </>
              ) : (
                <div className="empty-state">
                  {loading ? "Chargement des commandes…" : "Aucune commande sélectionnée."}
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Événement</h2>
                <p>Message envoyé au flux serverless.</p>
              </div>
            </div>
            <div className="panel-body">
              {lastEvent ? (
                <pre className="event-preview" aria-label="Événement publié">
                  {JSON.stringify(lastEvent, null, 2)}
                </pre>
              ) : (
                <div className="empty-state">Sélectionnez une commande pour prévisualiser l'événement.</div>
              )}
              <div className="action-row">
                <span className="muted">Statut publié par la Lambda après écriture DynamoDB.</span>
                <button className="secondary-button" type="button" onClick={copyEvent} disabled={!lastEvent}>
                  <Icon name="copy" />
                  Copier
                </button>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function OrdersPage({ orders, loading, loadError, reloadOrders, session, onLogout }) {
  const [currentPage, setCurrentPage] = useState(1);
  const sortedOrders = useMemo(() => Object.values(orders).sort(compareOrders), [orders]);
  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const pageOrders = sortedOrders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    if (currentPage !== safePage) {
      setCurrentPage(safePage);
    }
  }, [currentPage, safePage]);

  return (
    <main className="app">
      <Header
        title="Commandes"
        subtitle="Liste des commandes enregistrées"
        icon="list"
        actions={
          <>
            <a className="secondary-button" href="#/admin">
              <Icon name="back" />
              Administration
            </a>
            <button className="secondary-button" type="button" onClick={reloadOrders} disabled={loading}>
              <Icon name="refresh" />
              {loading ? "Chargement…" : "Actualiser"}
            </button>
            <UserMenu session={session} onLogout={onLogout} />
          </>
        }
      />

      <section className="panel orders-panel" aria-labelledby="ordersTitle">
        <div className="panel-header">
          <div>
            <h2 id="ordersTitle">Commandes existantes</h2>
            <p>
              {sortedOrders.length} commande{sortedOrders.length > 1 ? "s" : ""}
            </p>
          </div>
          <p className="page-indicator">10 par page</p>
        </div>

        {loadError && (
          <div className="empty-state" role="alert">
            Erreur de chargement : {loadError}
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Prénom</th>
                <th>Nom</th>
                <th>Date de commande</th>
                <th>Statut</th>
                <th>Destination</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pageOrders.map((order) => (
                <tr key={order.orderNumber}>
                  <td>
                    <OrderLink order={order} />
                  </td>
                  <td>{order.firstName || "Client"}</td>
                  <td>{order.lastName || "—"}</td>
                  <td>{formatDateOnly(order.orderDate)}</td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td>{order.destination || "—"}</td>
                  <td>
                    <a className="secondary-button compact-button" href={`#/admin?order=${encodeURIComponent(order.orderNumber)}`}>
                      Modifier
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="cards" aria-label="Commandes">
          {pageOrders.map((order) => (
            <article className="order-card" key={order.orderNumber}>
              <div className="order-card-head">
                <div>
                  <OrderLink order={order} />
                  <span>{formatCustomerName(order)}</span>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <div className="card-grid">
                <CardField label="Date de commande" value={formatDateOnly(order.orderDate)} />
                <CardField label="Destination" value={order.destination || "—"} />
              </div>
              <a className="secondary-button" href={`#/admin?order=${encodeURIComponent(order.orderNumber)}`}>
                Modifier
              </a>
            </article>
          ))}
        </div>

        {!sortedOrders.length && !loadError && (
          <div className="empty-state">{loading ? "Chargement des commandes…" : "Aucune commande enregistrée."}</div>
        )}

        <div className="panel-footer">
          <p className="page-indicator">
            Page {safePage} / {totalPages}
          </p>
          <div className="pagination" aria-label="Pagination">
            <button
              className="secondary-button"
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              <Icon name="back" />
              Précédent
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            >
              Suivant
              <Icon name="next" />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function UserMenu({ session, onLogout }) {
  return (
    <div className="user-menu">
      <span className="user-email" title={session?.email}>
        {session?.email}
      </span>
      <button className="secondary-button compact-button" type="button" onClick={onLogout}>
        <Icon name="logout" />
        Déconnexion
      </button>
    </div>
  );
}

function Header({ title, subtitle, icon, actions }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <Icon name={icon} />
        </span>
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="top-actions">{actions}</div>
    </header>
  );
}

function StatusOption({ status, checked, onChange }) {
  return (
    <label>
      <input
        type="radio"
        name="status"
        value={status}
        checked={checked}
        onChange={() => onChange(status)}
      />
      <span className="status-option">
        <Icon name={statusIcon(status)} />
        <span>{statusLabels[status]}</span>
      </span>
    </label>
  );
}

function Timeline({ order }) {
  const status = order.status || "preparation";
  const referenceStatus = status === "annule" ? order.previousStatus : status;
  const activeIndex = Math.max(statusFlow.indexOf(referenceStatus), 0);
  const items = status === "annule" ? [...statusFlow.slice(0, activeIndex + 1), "annule"] : statusFlow;

  return (
    <ol className="timeline">
      {items.map((key, index) => {
        const isDone = status === "annule" ? key !== "annule" : index < activeIndex;
        const isCurrent = key === status;
        return (
          <li className={`${isDone ? "is-done" : ""} ${isCurrent ? "is-current" : ""}`} key={key}>
            <span className="timeline-dot" />
            <div>
              <strong>{statusLabels[key]}</strong>
              <span>
                {isCurrent
                  ? `${statusDescriptions[key]} ${formatDate(order.updatedAt)}.`
                  : statusDescriptions[key]}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CardField({ label, value }) {
  return (
    <div>
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}

function OrderLink({ order }) {
  return (
    <a className="order-link" href={`#/admin?order=${encodeURIComponent(order.orderNumber)}`}>
      {order.orderNumber}
    </a>
  );
}

function StatusBadge({ status }) {
  return (
    <span className="badge" data-tone={getStatusTone(status)}>
      {statusLabels[status] || status || "Préparation"}
    </span>
  );
}

function Toast({ toast }) {
  return (
    <div className={`toast ${toast ? "is-visible" : ""}`} role="status" aria-live="polite">
      <strong>{toast?.title || "Statut mis à jour"}</strong>
      <span>{toast?.message || "L'événement a été préparé."}</span>
    </div>
  );
}

function Icon({ name }) {
  const common = {
    className: "icon",
    viewBox: "0 0 24 24",
    "aria-hidden": "true"
  };

  if (name === "truck") {
    return (
      <svg {...common}>
        <path d="M3 7h11v10H3z" />
        <path d="M14 10h4l3 3v4h-7z" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="18" cy="17" r="2" />
      </svg>
    );
  }
  if (name === "list") {
    return (
      <svg {...common}>
        <path d="M8 6h13" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <path d="M3 6h.01" />
        <path d="M3 12h.01" />
        <path d="M3 18h.01" />
      </svg>
    );
  }
  if (name === "search") {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    );
  }
  if (name === "package") {
    return (
      <svg {...common}>
        <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    );
  }
  if (name === "arrow") {
    return (
      <svg {...common}>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </svg>
    );
  }
  if (name === "delivery") {
    return (
      <svg {...common}>
        <path d="M10 17h4V5H2v12h3" />
        <path d="M14 8h4l4 4v5h-3" />
        <circle cx="7.5" cy="17.5" r="2.5" />
        <circle cx="16.5" cy="17.5" r="2.5" />
      </svg>
    );
  }
  if (name === "check") {
    return (
      <svg {...common}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  if (name === "warning") {
    return (
      <svg {...common}>
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    );
  }
  if (name === "save") {
    return (
      <svg {...common}>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
        <path d="M17 21v-8H7v8" />
        <path d="M7 3v5h8" />
      </svg>
    );
  }
  if (name === "refresh") {
    return (
      <svg {...common}>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v6h6" />
      </svg>
    );
  }
  if (name === "copy") {
    return (
      <svg {...common}>
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    );
  }
  if (name === "back") {
    return (
      <svg {...common}>
        <path d="M15 18 9 12l6-6" />
      </svg>
    );
  }
  if (name === "logout") {
    return (
      <svg {...common}>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function statusIcon(status) {
  return {
    preparation: "package",
    expedie: "arrow",
    livre: "check",
    annule: "warning"
  }[status];
}

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || "#/admin");

  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = "#/admin";
    }
    const handleHashChange = () => setHash(window.location.hash || "#/admin");
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const normalizedHash = hash.replace(/^#/, "") || "/admin";
  const [path, queryString = ""] = normalizedHash.split("?");

  return {
    page: path === "/orders" ? "orders" : "admin",
    query: new URLSearchParams(queryString)
  };
}

// --- Accès à l'API admin (protégée par Cognito) --------------------------

async function apiRequest(path, options = {}) {
  const token = getIdToken();
  if (!token) {
    const error = new Error("Session expirée. Reconnectez-vous.");
    error.status = 401;
    throw error;
  }

  let response;
  try {
    response = await fetch(`${ADMIN_API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
        ...(options.headers || {})
      }
    });
  } catch {
    throw new Error("API injoignable. Vérifiez votre connexion.");
  }

  if (response.status === 401 || response.status === 403) {
    const error = new Error("Session expirée. Reconnectez-vous.");
    error.status = 401;
    throw error;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `Erreur API ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function fetchOrders() {
  const data = await apiRequest("/list/orders");
  return Array.isArray(data.orders) ? data.orders : [];
}

async function updateOrderStatus(orderId, status) {
  return apiRequest(`/update/${encodeURIComponent(orderId)}`, {
    method: "PUT",
    body: JSON.stringify({ status })
  });
}

function indexOrders(items) {
  const result = {};
  items.forEach((item) => {
    const order = normalizeApiOrder(item);
    if (order.orderNumber) {
      result[order.orderNumber] = order;
    }
  });
  return result;
}

// Adapte un item DynamoDB { orderId, status, createdAt, updatedAt } au modèle de l'UI.
// Les champs absents côté backend (client, destination, transporteur) reçoivent un repli.
function normalizeApiOrder(item) {
  const orderId = String(item.orderId || item.orderNumber || "").trim();
  const orderNumber = normalizeOrderNumber(orderId);
  const status = statusLabels[item.status] ? item.status : "preparation";
  return {
    orderId,
    orderNumber,
    firstName: item.firstName || "Client",
    lastName: item.lastName || "",
    orderDate: item.orderDate || (item.createdAt ? String(item.createdAt).slice(0, 10) : ""),
    status,
    previousStatus: item.previousStatus || null,
    carrier: item.carrier || "",
    destination: item.destination || "",
    updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
    note: item.note || ""
  };
}

// Fusionne la réponse de l'API (Attributes renvoyés par UpdateItem) avec la commande locale.
function mergeOrder(existing, attributes, status, note, previousStatus) {
  const attrs = attributes || {};
  const nextStatus = attrs.status || status;
  return {
    ...existing,
    status: nextStatus,
    previousStatus: nextStatus === "annule" ? previousStatus : existing.previousStatus || null,
    updatedAt: attrs.updatedAt || new Date().toISOString(),
    note
  };
}

function getDefaultOrderNumber(orders, preferredOrderNumber = "") {
  const normalized = normalizeOrderNumber(preferredOrderNumber);
  if (normalized && orders[normalized]) {
    return normalized;
  }
  return Object.keys(orders)[0] || "";
}

function buildEvent(order, type = "ORDER_STATUS_UPDATED", previousStatus = null) {
  return {
    id: createEventId(),
    type,
    source: "delivery.admin",
    time: new Date().toISOString(),
    detail: {
      orderNumber: order.orderNumber || "Commande",
      previousStatus,
      firstName: order.firstName || "Client",
      lastName: order.lastName || "",
      orderDate: order.orderDate || "",
      status: order.status || "preparation",
      label: statusLabels[order.status] || order.status || "Préparation",
      carrier: order.carrier || "",
      destination: order.destination || "",
      updatedAt: order.updatedAt || new Date().toISOString()
    }
  };
}

function createEventId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function compareOrders(first, second) {
  const firstDate = new Date(`${first.orderDate || "1970-01-01"}T00:00:00`).getTime();
  const secondDate = new Date(`${second.orderDate || "1970-01-01"}T00:00:00`).getTime();
  if (firstDate !== secondDate) {
    return secondDate - firstDate;
  }
  return second.orderNumber.localeCompare(first.orderNumber, "fr-FR", { numeric: true });
}

function normalizeOrderNumber(value) {
  return String(value || "").trim().replace(/\s+/g, "").toUpperCase();
}

function formatCustomerName(order) {
  return `${order.firstName || "Client"} ${order.lastName || ""}`.trim();
}

function formatDateOnly(value) {
  if (!value) {
    return "—";
  }
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium"
  }).format(date);
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return "À l'instant";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function getStatusTone(status) {
  if (status === "livre") {
    return "success";
  }
  if (status === "annule") {
    return "danger";
  }
  if (status === "preparation") {
    return "neutral";
  }
  return "warning";
}
