import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Flag, Check, Trash2 } from "lucide-react";

export default function AdminReports() {
    const [reports, setReports] = useState([]);
    const [filter, setFilter] = useState("pending");
    const [log, setLog] = useState([]);

    const load = async () => {
        const [r, l] = await Promise.all([
            api.get(`/admin/reports${filter ? `?status=${filter}` : ""}`),
            api.get("/admin/moderation-log"),
        ]);
        setReports(r.data);
        setLog(l.data);
    };
    useEffect(() => { load(); }, [filter]);

    const resolve = async (id, action) => {
        await api.post(`/admin/reports/${id}/resolve?action=${action}`);
        toast.success(action === "delete" ? "Nachricht gelöscht" : "Meldung verworfen");
        load();
    };

    return (
        <div className="p-8">
            <div className="mb-8">
                <div className="font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">/ Moderation</div>
                <h1 className="text-3xl tracking-tighter font-semibold mt-1">Meldungen</h1>
                <p className="text-sm text-zinc-500 mt-1">Nur gemeldete Nachrichten sind sichtbar — Inhalt erscheint ausschließlich bei Meldung.</p>
            </div>

            <div className="flex items-center gap-2 mb-5">
                {["pending", "resolved_kept", "resolved_deleted", ""].map((s) => (
                    <button
                        key={s || "all"}
                        onClick={() => setFilter(s)}
                        data-testid={`filter-${s || "all"}`}
                        className={`px-3 py-1.5 font-mono text-xs rounded-sm border transition-colors ${filter === s ? "border-cyan-500 text-cyan-400 bg-cyan-500/10" : "border-zinc-800 text-zinc-400 hover:border-zinc-600"}`}
                    >
                        {s === "" ? "ALLE" : s === "pending" ? "OFFEN" : s === "resolved_kept" ? "BEHALTEN" : "GELÖSCHT"}
                    </button>
                ))}
            </div>

            <div className="space-y-3 mb-10" data-testid="reports-list">
                {reports.length === 0 && <div className="text-sm text-zinc-500 p-6 bg-zinc-900 border border-zinc-800">Keine Meldungen</div>}
                {reports.map((r) => (
                    <div key={r.id} className="bg-zinc-900 border border-zinc-800 p-5" data-testid={`report-${r.id}`}>
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Flag className="w-4 h-4 text-amber-400" />
                                    <span className="font-mono text-xs text-amber-400 uppercase tracking-widest">Meldung</span>
                                    <span className={`font-mono text-[10px] px-2 py-0.5 rounded-sm border ${
                                        r.status === "pending" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" :
                                        r.status === "resolved_deleted" ? "border-red-500/30 bg-red-500/10 text-red-400" :
                                        "border-zinc-700 bg-zinc-800 text-zinc-400"
                                    }`}>{r.status.toUpperCase()}</span>
                                </div>
                                <div className="text-sm text-zinc-200 mb-2">
                                    <strong>Grund:</strong> {r.reason}
                                </div>
                                <div className="font-mono text-xs text-zinc-500 space-x-3">
                                    <span>Reporter: {r.reporter?.name}</span>
                                    <span>Absender: {r.sender?.name || "System"}</span>
                                    <span>Chat: {r.chat?.name || r.chat?.type}</span>
                                    <span>{new Date(r.created_at).toLocaleString("de-DE")}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-zinc-950 border border-zinc-800 p-3 mb-3">
                            <div className="font-mono text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/20 inline-block px-2 py-0.5 mb-2 rounded-sm uppercase tracking-widest">
                                Freigegebener Inhalt durch Meldung
                            </div>
                            {r.message?.deleted ? (
                                <em className="text-zinc-500 text-sm">Nachricht wurde bereits gelöscht.</em>
                            ) : (
                                <div className="text-sm text-zinc-200 whitespace-pre-wrap">{r.message?.text || <em>(kein Text)</em>}</div>
                            )}
                        </div>

                        {r.status === "pending" && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => resolve(r.id, "delete")}
                                    data-testid={`delete-report-${r.id}`}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 border border-red-500/30 hover:bg-red-500 hover:text-white text-red-400 text-sm rounded-sm transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> Nachricht löschen
                                </button>
                                <button
                                    onClick={() => resolve(r.id, "keep")}
                                    data-testid={`keep-report-${r.id}`}
                                    className="flex items-center gap-1 px-3 py-1.5 border border-zinc-700 hover:border-cyan-500 text-zinc-300 text-sm rounded-sm transition-colors"
                                >
                                    <Check className="w-3.5 h-3.5" /> Behalten
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div>
                <h2 className="text-lg font-medium mb-3">Moderationsprotokoll</h2>
                <div className="bg-zinc-900 border border-zinc-800 divide-y divide-zinc-800" data-testid="moderation-log">
                    {log.length === 0 && <div className="p-4 text-sm text-zinc-500">Keine Einträge</div>}
                    {log.map((l) => (
                        <div key={l.id} className="px-5 py-2 flex items-center justify-between font-mono text-xs">
                            <span className={`${l.action === "delete" ? "text-red-400" : l.action === "keep" ? "text-zinc-300" : "text-cyan-400"}`}>
                                {l.action.toUpperCase()}
                            </span>
                            <span className="text-zinc-500 flex-1 mx-4 truncate">{l.note}</span>
                            <span className="text-zinc-600">{new Date(l.created_at).toLocaleString("de-DE")}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
