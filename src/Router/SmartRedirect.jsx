import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const SmartRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const userPermissions = JSON.parse(localStorage.getItem("permissions") || "[]");

    // If user has admin permission, redirect to default sales page (/)
    if (userPermissions.includes("admin")) {
      navigate("/", { replace: true }); // This goes to Sales page
      return;
    }

    // Define route priority based on your app structure
    const routePriority = [
      { path: "/", permission: "invoice" }, // Sales page requires "invoice" permission
      { path: "/dashboard", permission: "dashboard" },
      { path: "/customer", permission: "customer" },
      { path: "/items", permission: "products" },
      { path: "/vendor", permission: "vendor" },
      { path: "/purchase-order", permission: "purchase" },
      { path: "/grn", permission: "grn" },
      { path: "/bom", permission: "bom" },
      { path: "/inventory", permission: "inventory" },
      { path: "/work-order", permission: "workorder" },
      { path: "/defective", permission: "defective" },
      { path: "/admin", permission: "admin" }
    ];

    // Find the first route that user has permission for
    const allowedRoute = routePriority.find(route =>
      userPermissions.includes(route.permission)
    );

    // Redirect to the first allowed route
    if (allowedRoute) {
      navigate(allowedRoute.path, { replace: true });
    } else {
      navigate("/", { replace: true }); // Fallback to sales page
    }
  }, [navigate]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh'
    }}>
      <div>Redirecting to your authorized page...</div>
    </div>
  );
};

export default SmartRedirect;