import { useCallback, useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, X, Copy, Check, Ticket } from "lucide-react";

export default function AdminInvites() {
    const [invites, setInvites] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [copiedCode, setCopiedCode] = useState(null);

    const load = useCallback(async () => {
        const { data } = await api.get("/admin/invites");
        setInvites(data);
    }, []);
    useEffect(() => { load(); }, [load]);

    const remove = async (id) => {
        if (!window.confirm("Einladung wirklich zurückziehen?")) return;
        try {
            await api.delete(`/admin/invites/${id}`);
            toast.success("Zurückgezogen");
            load();
        } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    };

    const copyLink = async (code) => {
        const link = `${window.location.origin}/register?code=${code}`;
        try {
            await navigator.clipboard.writeText(link);
            setCopiedCode(code);
            toast.success("Registrierungs-Link kopiert");
            setTimeout(() => setCopiedCode(null), 2000);
        } catch {
            toast.error("Kopieren fehlgeschlagen");
        }
    };

    const isExpired = (inv) => {
        if (!inv.expires_at) return false;
        try { return new Date(inv.expires_at) < new Date(); } catch { return false; }
    };

    const statusOf = (inv) => {
        if (inv.used) return { label: "EINGELÖST", cls: "border-zinc-700 bg-zinc-800 text-zinc-400" };
        if (isExpired(inv)) return { label: "ABGELAUFEN", cls: "border-red-500/30 bg-red-500/10 text-red-400" };
        return { label: "OFFEN", cls: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400" };
    };

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <div className="font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">/ Verwaltung</div>
                    <h1 className="text-3xl tracking-tighter font-semibold mt-1">Einladungscodes</h1>
                    <p className="text-sm text-zinc-500 mt-1">Einmal-Codes für Selbst-Registrierung. Kein Zugriff ohne gültigen Code.</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    data-testid="create-invite-button"
                    className="flex items-center gap-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-medium rounded-sm text-sm"
                >
                    <Plus className="w-4 h-4" /> Neuer Code
                </button>
            </div>

            <div className="bg-zinc-900 border border-zinc-800">
                <table className="w-full text-sm" data-testid="invites-table">
                    <thead>
                        <tr className="text-left font-mono text-[10px] tracking-widest text-zinc-500 uppercase border-b border-zinc-800">
                            <th className="px-5 py-3">Code</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3">Rolle</th>
                            <th className="px-5 py-3">Typ</th>
                            <th className="px-5 py-3">Notiz</th>
                            <th className="px-5 py-3">Ablauf</th>
                            <th className="px-5 py-3">Eingelöst von</th>
                            <th className="px-5 py-3 text-right">Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invites.map((inv) => {
                            const s = statusOf(inv);
                            const disabledCopy = inv.used || isExpired(inv);
                            return (
                                <tr key={inv.id} className="border-b border-zinc-800 hover:bg-zinc-900/50" data-testid={`invite-row-${inv.id}`}>
                                    <td className="px-5 py-3">
                                        <span className="font-mono text-cyan-300 text-xs bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded-sm">{inv.code}</span>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className={`font-mono text-[10px] px-2 py-0.5 rounded-sm border ${s.cls}`}>{s.label}</span>
                                    </td>
                                    <td className="px-5 py-3 font-mono text-xs text-zinc-300">{inv.role.toUpperCase()}</td>
                                    <td className="px-5 py-3 font-mono text-xs text-zinc-400">{inv.is_customer ? "KUNDE" : "INTERN"}</td>
                                    <td className="px-5 py-3 text-xs text-zinc-400 truncate max-w-[180px]">{inv.note || "—"}</td>
                                    <td className="px-5 py-3 font-mono text-xs text-zinc-500">
                                        {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString("de-DE") : "—"}
                                    </td>
                                    <td className="px-5 py-3 text-xs">
                                        {inv.used ? (
                                            <div>
                                                <div className="text-zinc-200">{inv.used_by_name}</div>
                                                <div className="font-mono text-zinc-500">{inv.used_by_email}</div>
                                            </div>
                                        ) : <span className="text-zinc-600">—</span>}
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <button
                                            onClick={() => copyLink(inv.code)}
                                            disabled={disabledCopy}
                                            data-testid={`copy-invite-${inv.id}`}
                                            title="Registrierungs-Link kopieren"
                                            className="p-1.5 text-zinc-400 hover:text-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {copiedCode === inv.code ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                        {!inv.used && (
                                            <button
                                                onClick={() => remove(inv.id)}
                                                data-testid={`delete-invite-${inv.id}`}
                                                title="Zurückziehen"
                                                className="p-1.5 text-zinc-400 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {invites.length === 0 && (
                            <tr><td colSpan={8} className="p-6 text-center text-zinc-500 text-sm">
                                <Ticket className="w-8 h-8 mx-auto mb-2 text-zinc-700" />
                                Noch keine Einladungscodes
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showCreate && (
                <CreateInviteModal
                    onClose={() => setShowCreate(false)}
                    onCreated={() => { setShowCreate(false); load(); }}
                />
            )}
        </div>
    );
}

function CreateInviteModal({ onClose, onCreated }) {
    const [role, setRole] = useState("user");
    const [isCustomer, setIsCustomer] = useState(false);
    const [note, setNote] = useState("");
    const [expiresAt, setExpiresAt] = useState("");
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        setSaving(true);
        try {
            const body = { role, is_customer: isCustomer };
            if (note.trim()) body.note = note.trim();
            if (expiresAt) body.expires_at = new Date(expiresAt).toISOString();
            const { data } = await api.post("/admin/invites", body);
            toast.success(`Code erstellt: ${data.code}`);
            onCreated();
        } catch (err) {
            toast.error(formatApiErrorDetail(err.response?.data?.detail));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" data-testid="create-invite-modal">
            <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-sm">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <div>
                        <div className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">/ Admin-Aktion</div>
                        <h3 className="font-medium text-zinc-100 mt-0.5">Neuer Einladungscode</h3>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-4 space-y-4">
                    <div>
                        <label className="block font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-2">Rolle</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            data-testid="invite-role-select"
                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 focus:border-cyan-500 outline-none rounded-sm text-sm text-zinc-100"
                        >
                            <option value="user">Nutzer</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-zinc-300">
                        <input type="checkbox" checked={isCustomer} onChange={(e) => setIsCustomer(e.target.checked)} data-testid="invite-customer-check" className="accent-cyan-500" />
                        Kunde (extern)
                    </label>
                    <div>
                        <label className="block font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-2">Ablaufdatum (optional)</label>
                        <input
                            type="datetime-local"
                            value={expiresAt}
                            onChange={(e) => setExpiresAt(e.target.value)}
                            data-testid="invite-expires-input"
                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 focus:border-cyan-500 outline-none rounded-sm text-sm text-zinc-100"
                        />
                    </div>
                    <div>
                        <label className="block font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-2">Notiz (optional)</label>
                        <input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            data-testid="invite-note-input"
                            placeholder="z.B. Für Anna Müller"
                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 focus:border-cyan-500 outline-none rounded-sm text-sm text-zinc-100"
                        />
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs p-3 rounded-sm font-mono">
                        Einmal-Code: Der Code kann nur ein einziges Mal eingelöst werden.
                    </div>
                </div>
                <div className="p-4 flex justify-end gap-2 border-t border-zinc-800">
                    <button onClick={onClose} className="px-4 py-2 border border-zinc-700 text-zinc-300 rounded-sm text-sm">Abbrechen</button>
                    <button
                        onClick={submit}
                        disabled={saving}
                        data-testid="submit-create-invite"
                        className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-medium rounded-sm text-sm"
                    >
                        {saving ? "Erstellt…" : "Code generieren"}
                    </button>
                </div>
            </div>
        </div>
    );
}
