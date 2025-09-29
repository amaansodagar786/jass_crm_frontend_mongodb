import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "../Pages/Home/Home";
import Customer from "../Pages/Customer/Customer";
import Vendor from "../Pages/Vendor/Vendor";
import Items from "../Pages/Items/Items";
import PurchaseOrder from "../Pages/PurchaseOrder/PurchaseOrder";
import GRN from "../Pages/GRN/GRN";
import Bom from "../Pages/Bom/Bom";
import Sales from "../Pages/Sales/Sales";
import Inventory from "../Pages/Inventory/Inventory";
import Register from "../Pages/Authentication/Register/Register";
import Login from "../Pages/Authentication/Login/Login";
import ProtectedRoute from "../Components/Protected/ProtectedRoute";
import WorkOrder from "../Pages/WorkOrder/WorkOrder";
import ProductDisposal from "../Pages/Defective/ProductDisposal";
import AdminUsers from "../Pages/Authentication/Admin/AdminUsers";
import DiscountProduct from "../Pages/DiscountProduct/DiscountProduct";
import SmartRedirect from "./SmartRedirect"; // ADD THIS
import Footer from "../Components/Footer/Footer";

const Router = () => {
  return (
    <>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh'
      }}>
        <div style={{ flex: 1 }}>
          <Routes>
            {/* Public Routes */}
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />

            {/* Smart Root Route - Redirects based on permissions */}
            <Route path="/" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="invoice">  {/* Sales page requires invoice permission */}
                  <Sales />
                </PermissionRoute>
              </ProtectedRoute>
            } />

            {/* Individual Protected Routes with Permission Checks */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="dashboard">
                  <Home />
                </PermissionRoute>
              </ProtectedRoute>
            } />

            <Route path="/customer" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="customer">
                  <Customer />
                </PermissionRoute>
              </ProtectedRoute>
            } />

            <Route path="/vendor" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="vendor">
                  <Vendor />
                </PermissionRoute>
              </ProtectedRoute>
            } />

            <Route path="/items" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="products">
                  <Items />
                </PermissionRoute>
              </ProtectedRoute>
            } />

            <Route path="/purchase-order" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="purchase">
                  <PurchaseOrder />
                </PermissionRoute>
              </ProtectedRoute>
            } />

            <Route path="/grn" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="grn">
                  <GRN />
                </PermissionRoute>
              </ProtectedRoute>
            } />

            <Route path="/bom" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="bom">
                  <Bom />
                </PermissionRoute>
              </ProtectedRoute>
            } />

            <Route path="/sales" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="invoice">
                  <Sales />
                </PermissionRoute>
              </ProtectedRoute>
            } />

            <Route path="/inventory" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="inventory">
                  <Inventory />
                </PermissionRoute>
              </ProtectedRoute>
            } />

            <Route path="/work-order" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="workorder">
                  <WorkOrder />
                </PermissionRoute>
              </ProtectedRoute>
            } />

            <Route path="/defective" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="disposal">
                  <ProductDisposal />
                </PermissionRoute>
              </ProtectedRoute>
            } />

            <Route path="/admin" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="admin">
                  <AdminUsers />
                </PermissionRoute>
              </ProtectedRoute>
            } />

            <Route path="/productdiscount" element={
              <ProtectedRoute>
                <PermissionRoute requiredPermission="discount">
                  <DiscountProduct />
                </PermissionRoute>
              </ProtectedRoute>
            } />

          </Routes>
        </div>
        <Footer />
      </div>
    </>
  );
};

// PermissionRoute Component (Add this in the same file or separate)
const PermissionRoute = ({ children, requiredPermission }) => {
  const userPermissions = JSON.parse(localStorage.getItem("permissions") || "[]");

  // Admin can access everything
  if (userPermissions.includes("admin")) {
    return children;
  }

  // If `requiredPermission` is a string
  if (typeof requiredPermission === "string" && userPermissions.includes(requiredPermission)) {
    return children;
  }

  // If `requiredPermission` is an array (multiple options allowed)
  if (Array.isArray(requiredPermission) && requiredPermission.some(p => userPermissions.includes(p))) {
    return children;
  }

  // No access → redirect to SmartRedirect
  return <SmartRedirect />;
};

// TEMPORARY FIX - REMOVE AFTER CREATING ADMIN USER
// const PermissionRoute = ({ children, requiredPermission }) => {
//   // TEMPORARILY ALLOW ALL ACCESS - COMMENT THIS OUT AFTER CREATING ADMIN
//   return children;

//   // ORIGINAL CODE - UNCOMMENT AFTER CREATING ADMIN
//   // const userPermissions = JSON.parse(localStorage.getItem("permissions") || "[]");
//   // if (userPermissions.includes("admin") || userPermissions.includes(requiredPermission)) {
//   //   return children;
//   // }
//   // return <SmartRedirect />;
// };

export default Router;