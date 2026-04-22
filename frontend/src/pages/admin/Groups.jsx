import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function AdminGroups() {
    const [groups, setGroups] = useState([]);
    const [users, setUsers] = useState([]);
    const [expanded, setExpanded] = useState(null);

    useEffect(() => {
        (async () => {
            const [g, u] = await Promise.all([api.get("/admin/groups"), api.get("/users")]);
            setGroups(g.data);
            setUsers(u.data);
        })();
    }, []);

    const userById = (id) => users.find((u) => u.id === id);

    return (
        <div className="p-8">
            <div className="mb-8">
                <div className="font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">/ Verwaltung</div>
                <h1 className="text-3xl tracking-tighter font-semibold mt-1">Gruppen &amp; Zuordnungen</h1>
                <p className="text-sm text-zinc-500 mt-1">Wer ist in welcher Gruppe. Nur Metadaten — keine Nachrichten.</p>
            </div>

            <div className="space-y-3" data-testid="groups-list">
                {groups.map((g) => (
                    <div key={g.id} className="bg-zinc-900 border border-zinc-800">
                        <div
                            className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-zinc-900/60"
                            onClick={() => setExpanded(expanded === g.id ? null : g.id)}
                            data-testid={`group-${g.id}`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="font-mono text-xs text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-sm">GRUPPE</span>
                                <span className="font-medium text-zinc-100">{g.name}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-mono text-zinc-500">
                                <span>{g.member_ids.length} Mitgl.</span>
                                <span>{new Date(g.created_at).toLocaleDateString("de-DE")}</span>
                            </div>
                        </div>
                        {expanded === g.id && (
                            <div className="border-t border-zinc-800 p-5 space-y-2">
                                {g.member_ids.map((mid) => {
                                    const u = userById(mid);
                                    const isAdmin = g.admin_ids?.includes(mid);
                                    return (
                                        <div key={mid} className="flex items-center justify-between p-2 bg-zinc-950 border border-zinc-800 rounded-sm">
                                            <div>
                                                <div className="text-sm text-zinc-100">{u?.name || mid}</div>
                                                <div className="font-mono text-xs text-zinc-500">{u?.email}</div>
                                            </div>
                                            {isAdmin && <span className="font-mono text-[10px] text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-sm">GRUPPEN-ADMIN</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
                {groups.length === 0 && <div className="text-sm text-zinc-500">Keine Gruppen</div>}
            </div>
        </div>
    );
}
