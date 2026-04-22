import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function AdminSystem() {
    const [stats, setStats] = useState(null);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const load = async () => {
            const { data } = await api.get("/admin/stats");
            setStats(data);
        };
        load();
        const iv = setInterval(() => { load(); setTick((t) => t + 1); }, 3000);
        return () => clearInterval(iv);
    }, []);

    return (
        <div className="p-8">
            <div className="mb-8">
                <div className="font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">/ Infrastruktur</div>
                <h1 className="text-3xl tracking-tighter font-semibold mt-1">Systemstatus</h1>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-6 font-mono text-sm space-y-2">
                <div className="flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full pulse-dot" />
                    <span className="text-emerald-400 tracking-widest uppercase text-xs">ONLINE</span>
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-xs">
                    <div className="text-zinc-500">Server-Zeit</div>
                    <div className="text-zinc-200">{stats?.server_time ? new Date(stats.server_time).toLocaleString("de-DE") : "—"}</div>
                    <div className="text-zinc-500">Gesamt-Nutzer</div>
                    <div className="text-zinc-200">{stats?.users ?? "—"}</div>
                    <div className="text-zinc-500">Aktive Nutzer (5 Min.)</div>
                    <div className="text-emerald-400">{stats?.active_users ?? "—"}</div>
                    <div className="text-zinc-500">Direktchats</div>
                    <div className="text-zinc-200">{stats?.direct_chats ?? "—"}</div>
                    <div className="text-zinc-500">Gruppenchats</div>
                    <div className="text-zinc-200">{stats?.group_chats ?? "—"}</div>
                    <div className="text-zinc-500">Nachrichten gesamt</div>
                    <div className="text-zinc-200">{stats?.messages ?? "—"}</div>
                    <div className="text-zinc-500">Offene Meldungen</div>
                    <div className={stats?.reports_pending > 0 ? "text-amber-400" : "text-zinc-200"}>{stats?.reports_pending ?? "—"}</div>
                    <div className="text-zinc-500">Dateien</div>
                    <div className="text-zinc-200">{stats?.uploads ?? "—"}</div>
                    <div className="text-zinc-500">Polling-Tick</div>
                    <div className="text-cyan-400">{tick}</div>
                </div>
            </div>
        </div>
    );
}
