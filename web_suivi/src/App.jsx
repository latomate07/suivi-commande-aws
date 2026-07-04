import React from "react";
import { useHashRoute } from "@/hooks/useHashRoute.js";
import { HomePage } from "@/pages/HomePage.jsx";
import OrderTrackingPage from "@/pages/OrderTrackingPage.jsx";

export default function App() {
  const route = useHashRoute();

  if (route.page === "order") {
    return <OrderTrackingPage orderId={route.orderId} />;
  }
  return <HomePage />;
}
