import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ChatPage from "./pages/ChatPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import ReportEditPage from "./pages/ReportEditPage";
import ReportViewerPage from "./pages/ReportViewerPage";
import MyReportsPage from "./pages/MyReportsPage";
import TeamMemberReportsPage from "./pages/TeamMemberReportsPage";
import { useAuth } from "./contexts/AuthContext"; // useAuth 훅 import

function PrivateRoute({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" />;
}

// function AdminRoute({ children }) {
//   const { currentUser } = useAuth();
//   return currentUser && currentUser.role === "관리자" ? (
//     children
//   ) : (
//     <Navigate to="/" />
//   );
// }

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* PrivateRoute 적용 */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <DashboardPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/chat/:roomId"
        element={
          <PrivateRoute>
            <ChatPage />
          </PrivateRoute>
        }
      />
      <Route path="/chat" element={<Navigate to="/" />} />{" "}
      {/* Add a redirect for the base /chat path */}
      <Route
        path="/report/view/:reportId"
        element={
          <PrivateRoute>
            <ReportViewerPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/report/edit/:reportId"
        element={
          <PrivateRoute>
            <ReportEditPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/my-reports"
        element={
          <PrivateRoute>
            <MyReportsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <PrivateRoute>
            <AdminSettingsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/team-member/:userId/reports"
        element={
          <PrivateRoute>
            <TeamMemberReportsPage />
          </PrivateRoute>
        }
      />
      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
