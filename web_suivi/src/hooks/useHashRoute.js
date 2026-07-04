import { useEffect, useState } from "react";

export function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || "#/");

  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const path = hash.replace(/^#/, "") || "/";
  const orderMatch = path.match(/^\/orders\/([^/]+)$/);

  if (orderMatch) {
    return { page: "order", orderId: decodeURIComponent(orderMatch[1]) };
  }
  return { page: "home", orderId: null };
}
