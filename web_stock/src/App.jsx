import React, { useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL = "";
const STORAGE_KEY = "delivery-admin-orders";
const PAGE_SIZE = 10;
const statusFlow = ["preparation", "expedie", "en_livraison", "livree"];
const statusLabels = {
  preparation: "Préparation",
  expedie: "Expédiée",
  en_livraison: "En livraison",
  livree: "Livrée",
  incident: "Incident"
};
const statusDescriptions = {
  preparation: "Commande validée et colis en préparation.",
  expedie: "Colis transmis au transporteur.",
  en_livraison: "Livreur en route vers le destinataire.",
  livree: "Colis remis au destinataire.",
  incident: "Traitement manuel requis."
};
const seedOrders = createSeedOrders();

export default function App() {
  const route = useHashRoute();
  const [orders, setOrders] = useState(loadOrders);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    saveOrders(orders);
  }, [orders]);

  function showToast(title, message) {
    window.clearTimeout(toastTimer.current);
    setToast({ title, message });
    toastTimer.current = window.setTimeout(() => setToast(null), 3300);
  }

  return (
    <>
      {route.page === "orders" ? (
        <OrdersPage orders={orders} />
      ) : (
        <AdminPage
          orders={orders}
          routeOrderNumber={route.query.get("order")}
          setOrders={setOrders}
          showToast={showToast}
        />
      )}
      <Toast toast={toast} />
    </>
  );
}

function AdminPage({ orders, routeOrderNumber, setOrders, showToast }) {
  const initialOrderNumber = getDefaultOrderNumber(orders, routeOrderNumber);
  const [orderInput, setOrderInput] = useState(initialOrderNumber);
  const [currentOrderNumber, setCurrentOrderNumber] = useState(initialOrderNumber);
  const currentOrder = orders[currentOrderNumber] || orders[getDefaultOrderNumber(orders)];
  const [selectedStatus, setSelectedStatus] = useState(currentOrder.status || "preparation");
  const [note, setNote] = useState(currentOrder.note || "");
  const [lastEvent, setLastEvent] = useState(() => buildEvent(currentOrder));

  useEffect(() => {
    const requestedOrder = normalizeOrderNumber(routeOrderNumber || "");
    if (!requestedOrder) {
      return;
    }
    if (!orders[requestedOrder]) {
      showToast("Commande introuvable", `${requestedOrder} n'existe pas dans la liste.`);
      return;
    }
    setCurrentOrderNumber(requestedOrder);
    setOrderInput(requestedOrder);
    setSelectedStatus(orders[requestedOrder].status || "preparation");
    setNote(orders[requestedOrder].note || "");
    setLastEvent(buildEvent(orders[requestedOrder], "ORDER_SELECTED"));
  }, [routeOrderNumber]);

  useEffect(() => {
    if (!currentOrder) {
      return;
    }
    setSelectedStatus(currentOrder.status || "preparation");
    setNote(currentOrder.note || "");
  }, [currentOrderNumber]);

  function handleSearch() {
    const orderNumber = normalizeOrderNumber(orderInput);
    if (!orderNumber) {
      return;
    }
    if (!orders[orderNumber]) {
      showToast("Commande introuvable", `${orderNumber} n'existe pas dans la liste.`);
      return;
    }
    setCurrentOrderNumber(orderNumber);
    setOrderInput(orderNumber);
    setSelectedStatus(orders[orderNumber].status || "preparation");
    setNote(orders[orderNumber].note || "");
    setLastEvent(buildEvent(orders[orderNumber], "ORDER_SELECTED"));
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
    const payload = {
      orderNumber,
      previousStatus,
      status: selectedStatus,
      note: note.trim(),
      source: "admin-ui",
      updatedAt: new Date().toISOString()
    };

    try {
      const savedOrder = await persistStatus(payload, orders);
      setOrders((currentOrders) => ({
        ...currentOrders,
        [savedOrder.orderNumber]: savedOrder
      }));
      setCurrentOrderNumber(savedOrder.orderNumber);
      setOrderInput(savedOrder.orderNumber);
      setLastEvent(buildEvent(savedOrder, "ORDER_STATUS_UPDATED", previousStatus));
      showToast(
        "Statut mis à jour",
        `${savedOrder.orderNumber} est maintenant ${statusLabels[savedOrder.status].toLowerCase()}.`
      );
    } catch (error) {
      showToast("Mise à jour refusée", error.message || "Le service n'a pas répondu.");
    }
  }

  function resetDemo() {
    const nextOrders = createSeedOrders();
    const nextOrder = nextOrders["CMD-1001"];
    setOrders(nextOrders);
    setCurrentOrderNumber(nextOrder.orderNumber);
    setOrderInput(nextOrder.orderNumber);
    setSelectedStatus(nextOrder.status);
    setNote(nextOrder.note);
    setLastEvent(buildEvent(nextOrder, "ORDER_SELECTED"));
    showToast("Données réinitialisées", "Les commandes de démonstration sont restaurées.");
  }

  async function copyEvent() {
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
              <span>{API_BASE_URL ? "Connecté à API Gateway" : "Mode démo local"}</span>
            </div>
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
              <button className="secondary-button" type="button" onClick={resetDemo}>
                <Icon name="refresh" />
                Réinitialiser
              </button>
            </div>
          </div>

          <div className="panel-body">
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
                  {statusFlow.concat("incident").map((status) => (
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
                <label htmlFor="operatorNote">Note interne</label>
                <textarea
                  id="operatorNote"
                  name="operatorNote"
                  placeholder="Colis remis au transporteur"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>

              <button className="primary-button" type="submit">
                <Icon name="save" />
                Mettre à jour le statut
              </button>
            </form>

            <div className="summary-grid" aria-label="Synthèse">
              <Metric label="Client" value={formatCustomerName(currentOrder)} />
              <Metric label="Date de commande" value={formatDateOnly(currentOrder.orderDate)} />
              <Metric label="Transporteur" value={currentOrder.carrier || "À affecter"} />
              <Metric label="Destination" value={currentOrder.destination || "Non renseignée"} />
              <Metric label="Dernière mise à jour" value={formatDate(currentOrder.updatedAt)} />
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
              <div className="order-head">
                <div className="order-number">
                  <span>Numéro</span>
                  <strong>{currentOrder.orderNumber}</strong>
                </div>
                <StatusBadge status={currentOrder.status} />
              </div>
              <Timeline order={currentOrder} />
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
              <pre className="event-preview" aria-label="Événement publié">
                {JSON.stringify(lastEvent, null, 2)}
              </pre>
              <div className="action-row">
                <span className="muted">
                  {API_BASE_URL
                    ? "Événement publié par la Lambda après écriture DynamoDB."
                    : "Topic SNS / bus EventBridge après déploiement."}
                </span>
                <button className="secondary-button" type="button" onClick={copyEvent}>
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

function OrdersPage({ orders }) {
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
          <a className="secondary-button" href="#/admin">
            <Icon name="back" />
            Administration
          </a>
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
                  <td>{order.lastName || "Démonstration"}</td>
                  <td>{formatDateOnly(order.orderDate)}</td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td>{order.destination || "Non renseignée"}</td>
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
                <CardField label="Destination" value={order.destination || "Non renseignée"} />
              </div>
              <a className="secondary-button" href={`#/admin?order=${encodeURIComponent(order.orderNumber)}`}>
                Modifier
              </a>
            </article>
          ))}
        </div>

        {!sortedOrders.length && <div className="empty-state">Aucune commande enregistrée.</div>}

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
  const referenceStatus = status === "incident" ? order.previousStatus : status;
  const activeIndex = Math.max(statusFlow.indexOf(referenceStatus), 0);
  const items = status === "incident" ? [...statusFlow.slice(0, activeIndex + 1), "incident"] : statusFlow;

  return (
    <ol className="timeline">
      {items.map((key, index) => {
        const isDone = status === "incident" ? key !== "incident" : index < activeIndex;
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
    en_livraison: "delivery",
    livree: "check",
    incident: "warning"
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

async function persistStatus(payload, orders) {
  if (!API_BASE_URL) {
    return {
      ...(orders[payload.orderNumber] || createDraftOrder(payload.orderNumber)),
      status: payload.status,
      previousStatus: payload.previousStatus,
      note: payload.note,
      updatedAt: payload.updatedAt
    };
  }

  const response = await fetch(`${API_BASE_URL.replace(/\/$/, "")}/orders/${encodeURIComponent(payload.orderNumber)}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Erreur API ${response.status}`);
  }

  const remoteOrder = await response.json();
  return {
    ...(orders[payload.orderNumber] || createDraftOrder(payload.orderNumber)),
    ...remoteOrder,
    orderNumber: remoteOrder.orderNumber || payload.orderNumber,
    status: remoteOrder.status || payload.status,
    previousStatus: remoteOrder.previousStatus || payload.previousStatus,
    updatedAt: remoteOrder.updatedAt || payload.updatedAt,
    note: remoteOrder.note ?? payload.note
  };
}

function loadOrders() {
  const saved = readStorage(STORAGE_KEY);
  if (!saved) {
    return { ...seedOrders };
  }

  try {
    return migrateOrders(JSON.parse(saved));
  } catch {
    return { ...seedOrders };
  }
}

function saveOrders(orders) {
  writeStorage(STORAGE_KEY, JSON.stringify(orders));
}

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The demo remains usable even if browser storage is disabled.
  }
}

function migrateOrders(savedOrders) {
  if (!savedOrders || typeof savedOrders !== "object" || Array.isArray(savedOrders)) {
    return { ...seedOrders };
  }

  const migrated = { ...seedOrders };
  Object.entries(savedOrders).forEach(([key, order]) => {
    const orderNumber = normalizeOrderNumber(order.orderNumber || key);
    migrated[orderNumber] = {
      ...createDraftOrder(orderNumber),
      ...seedOrders[orderNumber],
      ...order,
      orderNumber,
      firstName: order.firstName || seedOrders[orderNumber]?.firstName || "Client",
      lastName: order.lastName || seedOrders[orderNumber]?.lastName || "Démonstration",
      orderDate: order.orderDate || seedOrders[orderNumber]?.orderDate || toDateInputValue(new Date())
    };
  });
  return migrated;
}

function createSeedOrders() {
  const rows = [
    ["CMD-1001", "Camille", "Martin", "2026-07-01", "en_livraison", "ChronoShip", "Paris 11e", "Livreur affecté à la tournée du soir."],
    ["CMD-1002", "Nina", "Bernard", "2026-06-30", "preparation", "ParcelNow", "Lyon 3e", "Étiquette créée."],
    ["CMD-1003", "Hugo", "Petit", "2026-06-30", "livree", "ChronoShip", "Nantes Centre", "Remis contre signature."],
    ["CMD-1004", "Lina", "Robert", "2026-06-29", "expedie", "FastColis", "Bordeaux", "Départ de l'entrepôt."],
    ["CMD-1005", "Noah", "Richard", "2026-06-29", "incident", "ChronoShip", "Marseille 6e", "Adresse à vérifier."],
    ["CMD-1006", "Emma", "Durand", "2026-06-28", "en_livraison", "ParcelNow", "Toulouse", "Créneau confirmé."],
    ["CMD-1007", "Lucas", "Moreau", "2026-06-28", "preparation", "ChronoShip", "Lille", "Commande prioritaire."],
    ["CMD-1008", "Chloé", "Simon", "2026-06-27", "livree", "FastColis", "Rennes", "Remis au gardien."],
    ["CMD-1009", "Adam", "Laurent", "2026-06-27", "expedie", "ParcelNow", "Nice", "Tri régional terminé."],
    ["CMD-1010", "Manon", "Lefebvre", "2026-06-26", "en_livraison", "ChronoShip", "Grenoble", "Livreur en approche."],
    ["CMD-1011", "Jules", "Michel", "2026-06-26", "preparation", "FastColis", "Dijon", "En attente de collecte."],
    ["CMD-1012", "Sarah", "Garcia", "2026-06-25", "livree", "ParcelNow", "Montpellier", "Livraison validée."],
    ["CMD-1013", "Louis", "David", "2026-06-25", "expedie", "ChronoShip", "Strasbourg", "Colis transmis au transporteur."],
    ["CMD-1014", "Inès", "Bertrand", "2026-06-24", "en_livraison", "FastColis", "Angers", "Tournée du matin."]
  ];

  return rows.reduce((accumulator, row, index) => {
    const [orderNumber, firstName, lastName, orderDate, status, carrier, destination, note] = row;
    accumulator[orderNumber] = {
      orderNumber,
      firstName,
      lastName,
      orderDate,
      status,
      previousStatus: status === "incident" ? "en_livraison" : null,
      carrier,
      destination,
      updatedAt: new Date(Date.now() - index * 3600000).toISOString(),
      note
    };
    return accumulator;
  }, {});
}

function createDraftOrder(orderNumber) {
  return {
    orderNumber,
    firstName: "Client",
    lastName: "Démonstration",
    orderDate: toDateInputValue(new Date()),
    status: "preparation",
    previousStatus: null,
    carrier: "À affecter",
    destination: "Non renseignée",
    updatedAt: new Date().toISOString(),
    note: ""
  };
}

function getDefaultOrderNumber(orders, preferredOrderNumber = "") {
  const normalized = normalizeOrderNumber(preferredOrderNumber);
  if (normalized && orders[normalized]) {
    return normalized;
  }
  if (orders["CMD-1001"]) {
    return "CMD-1001";
  }
  return Object.keys(orders)[0];
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
      lastName: order.lastName || "Démonstration",
      orderDate: order.orderDate || toDateInputValue(new Date()),
      status: order.status || "preparation",
      label: statusLabels[order.status] || order.status || "Préparation",
      carrier: order.carrier || "À affecter",
      destination: order.destination || "Non renseignée",
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
  return `${order.firstName || "Client"} ${order.lastName || "Démonstration"}`.trim();
}

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function formatDateOnly(value) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) {
    return "Non renseignée";
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
