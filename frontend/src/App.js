import { useEffect } from "react";
import "@/App.css";
import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Toaster } from "@/components/ui/sonner";

import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ChatPage from "@/pages/Chat";
import Profile from "@/pages/Profile";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminUsers from "@/pages/admin/Users";
import AdminGroups from "@/pages/admin/Groups";
import AdminFiles from "@/pages/admin/Files";
import AdminReports from "@/pages/admin/Reports";
import AdminSystem from "@/pages/admin/System";
import AdminInvites from "@/pages/admin/Invites";

function RootRedirect() {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (!user) return <Navigate to="/login" replace />;
    return <Navigate to={user.role === "admin" ? "/admin" : "/chat"} replace />;
}

function App() {
    useEffect(() => { document.documentElement.classList.add("dark"); }, []);

    return (
        <div className="App dark">
            <AuthProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/" element={<RootRedirect />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
                        <Route path="/chat/:chatId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
                        <Route path="/profil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                        <Route path="/admin" element={<ProtectedRoute adminOnly><AdminLayout /></ProtectedRoute>}>
                            <Route index element={<AdminDashboard />} />
                            <Route path="nutzer" element={<AdminUsers />} />
                            <Route path="gruppen" element={<AdminGroups />} />
                            <Route path="einladungen" element={<AdminInvites />} />
                            <Route path="dateien" element={<AdminFiles />} />
                            <Route path="meldungen" element={<AdminReports />} />
                            <Route path="system" element={<AdminSystem />} />
                        </Route>
                    </Routes>
                </BrowserRouter>
                <Toaster theme="dark" position="top-right" />
            </AuthProvider>
        </div>
    );
}

export default App;
