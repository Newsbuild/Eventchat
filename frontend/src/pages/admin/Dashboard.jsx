import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Activity, Users, Hash, MessageSquare, Flag, FileText } from "lucide-react";

function StatCard({ label, value, icon: Icon, accent }) {
    return (
        <div className="bg-zinc-900 border border-zinc-800 p-5" data-testid={`stat-${label.toLowerCase().replace(/\s/g,"-")}`}>
            <div className="flex items-center justify-between mb-3">
                <Icon className={`w-4 h-4 ${accent || "text-zinc-500"}`} />
                <span className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">METADATA</span>
            </div>
            <div className="font-mono text-3xl font-semibold tracking-tight text-zinc-100">{value ?? "—"}</div>
            <div className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase mt-1">{label}</div>
        </div>
    );
}

const DASHBOARD_POLL_MS = 5000;

export default function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [chats, setChats] = useState([]);

    const load = useCallback(async () => {
        const [s, c] = await Promise.all([api.get("/admin/stats"), api.get("/admin/chats")]);
        setStats(s.data);
        setChats(c.data);
    }, []);

    useEffect(() => {
        load();
        const iv = setInterval(load, DASHBOARD_POLL_MS);
        return () => clearInterval(iv);
    }, [load]);

    return (
        <div className="p-8">
            <div className="mb-8">
                <div className="font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">/ Übersicht</div>
                <h1 className="text-3xl tracking-tighter font-semibold mt-1">Dashboard</h1>
                <p className="text-sm text-zinc-500 mt-1">Echtzeit-Metriken, aktualisiert alle 5 Sekunden.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
                <StatCard label="Nutzer" value={stats?.users} icon={Users} accent="text-cyan-400" />
                <StatCard label="Aktiv (5 Min.)" value={stats?.active_users} icon={Activity} accent="text-emerald-400" />
                <StatCard label="Gruppen" value={stats?.group_chats} icon={Hash} />
                <StatCard label="Direktchats" value={stats?.direct_chats} icon={MessageSquare} />
                <StatCard label="Meldungen offen" value={stats?.reports_pending} icon={Flag} accent="text-amber-400" />
                <StatCard label="Dateien" value={stats?.uploads} icon={FileText} />
            </div>

            <div className="bg-zinc-900 border border-zinc-800">
                <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
                    <h2 className="text-base font-medium">Aktive Chats</h2>
                    <span className="font-mono text-[10px] tracking-widest text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-sm uppercase">
                        Nur Metadaten
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="admin-chats-table">
                        <thead>
                            <tr className="text-left font-mono text-[10px] tracking-widest text-zinc-500 uppercase border-b border-zinc-800">
                                <th className="px-5 py-2">Typ</th>
                                <th className="px-5 py-2">Name</th>
                                <th className="px-5 py-2 text-right">Mitgl.</th>
                                <th className="px-5 py-2 text-right">Nachr.</th>
                                <th className="px-5 py-2 font-mono">Letzte Aktivität</th>
                            </tr>
                        </thead>
                        <tbody>
                            {chats.map((c) => (
                                <tr key={c.id} className="border-b border-zinc-800 hover:bg-zinc-900/50">
                                    <td className="px-5 py-2">
                                        <span className={`font-mono text-xs ${c.type === "group" ? "text-cyan-400" : "text-zinc-400"}`}>
                                            {c.type.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-5 py-2 text-zinc-200">{c.name || <em className="text-zinc-600">(Direktchat)</em>}</td>
                                    <td className="px-5 py-2 text-right font-mono text-zinc-300">{c.member_count}</td>
                                    <td className="px-5 py-2 text-right font-mono text-zinc-300">{c.message_count}</td>
                                    <td className="px-5 py-2 font-mono text-xs text-zinc-500">{c.last_message_at ? new Date(c.last_message_at).toLocaleString("de-DE") : "—"}</td>
                                </tr>
                            ))}
                            {chats.length === 0 && (
                                <tr><td colSpan={5} className="p-6 text-center text-zinc-600 text-sm">Keine Chats</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
