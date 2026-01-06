import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import PrivateRoute from "./PrivateRoute";
import AdminRoute from "./AdminRoute";
import Login from "../pages/Login";
import Register from "../pages/Register";
import Docs from "../pages/Docs";
import PendingReview from "../pages/PendingReview";
import Dashboard from "../pages/Dashboard";
import MainLayout from "../layouts/MainLayout";
import Devices from "../pages/Devices";
import CreateDevice from "../pages/CreateDevice";
import DeviceBooking from "../pages/DeviceBooking";
import MyReservations from "../pages/MyReservations";
import Messages from "../pages/Messages";
import Settings from "../pages/Settings";
import Inventory from "../pages/Inventory";
import Users from "../pages/Users";
import Leaderboard from "../pages/Leaderboard";
import DeviceAnalysis from "../pages/DeviceAnalysis";
import LiteratureResearch from "../pages/LiteratureResearch";
import { useAuth } from "../hooks/useAuth";

const AppRoutes = () => {
  const location = useLocation();
  const { user, loading } = useAuth();
  return (
    <div className="min-h-screen bg-bg-page">
      <Routes location={location}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/pending-review" element={<PendingReview />} />

        <Route
          element={
            <PrivateRoute>
              <MainLayout />
            </PrivateRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route
            path="/devices/create"
            element={
              <AdminRoute>
                <CreateDevice />
              </AdminRoute>
            }
          />
          <Route path="/devices/:id" element={<DeviceBooking />} />
          <Route path="/reservations" element={<MyReservations />} />
          <Route path="/messages" element={<Messages />} />
          <Route
            path="/users"
            element={
              <AdminRoute>
                <Users />
              </AdminRoute>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <AdminRoute>
                <Leaderboard />
              </AdminRoute>
            }
          />
          <Route path="/device-analysis" element={<DeviceAnalysis />} />
          <Route
            path="/literature-research"
            element={<LiteratureResearch />}
          />
        </Route>

        <Route
          path="/"
          element={
            loading ? (
              <div>Loading...</div>
            ) : user ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </div>
  );
};

export default AppRoutes;
