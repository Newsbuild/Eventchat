import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
    Activity, Users, Hash, FileText, Flag, Server, LogOut, MessageSquare, Terminal, Ticket
} from "lucide-react";

const items = [
    { to: "/admin", end: true, icon: Activity, label: "Dashboard" },
    { to: "/admin/nutzer", icon: Users, label: "Nutzer" },
    { to: "/admin/gruppen", icon: Hash, label: "Gruppen" },
    { to: "/admin/einladungen", icon: Ticket, label: "Einladungen" },
    { to: "/admin/dateien", icon: FileText, label: "Dateien" },
    { to: "/admin/meldungen", icon: Flag, label: "Meldungen" },
    { to: "/admin/system", icon: Server, label: "System" },
];

export default function AdminLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="h-screen grid grid-cols-1 md:grid-cols-[260px_1fr] bg-zinc-950 text-zinc-100 overflow-hidden">
            <aside className="border-r border-zinc-800 flex flex-col h-screen">
                <div className="p-5 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-amber-400" />
                        <span className="font-mono text-[10px] tracking-[0.3em] text-amber-400 uppercase">/ ADMIN CONSOLE</span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-2 font-mono">user: {user?.email}</div>
                </div>

                <nav className="flex-1 p-3 space-y-1">
                    {items.map(({ to, end, icon: Icon, label }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            data-testid={`nav-${label.toLowerCase()}`}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2 text-sm rounded-sm transition-colors ${
                                    isActive
                                        ? "bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-500"
                                        : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border-l-2 border-transparent"
                                }`
                            }
                        >
                            <Icon className="w-4 h-4" />
                            {label}
                        </NavLink>
                    ))}
                </nav>

                <div className="p-3 border-t border-zinc-800 space-y-1">
                    <button
                        onClick={() => navigate("/chat")}
                        data-testid="back-to-chat"
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:text-cyan-400 hover:bg-zinc-900 rounded-sm transition-colors"
                    >
                        <MessageSquare className="w-4 h-4" /> Zum Chat
                    </button>
                    <button
                        onClick={logout}
                        data-testid="admin-logout"
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:text-red-400 hover:bg-zinc-900 rounded-sm transition-colors"
                    >
                        <LogOut className="w-4 h-4" /> Abmelden
                    </button>
                </div>

                <div className="p-4 border-t border-zinc-800">
                    <div className="inline-flex items-center gap-1 font-mono text-[10px] tracking-widest uppercase text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-sm">
                        <Flag className="w-3 h-3" /> NUR METADATEN
                    </div>
                    <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                        Admins sehen Nachrichteninhalte ausschließlich im Moderationskontext bei gemeldeten Nachrichten.
                    </p>
                </div>
            </aside>

            <main className="overflow-y-auto">
                <Outlet />
            </main>
        </div>
    );
}
