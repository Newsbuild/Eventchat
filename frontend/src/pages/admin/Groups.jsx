import { useCallback, useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Plus, X, Shield } from "lucide-react";

export default function AdminGroups() {
    const [groups, setGroups] = useState([]);
    const [users, setUsers] = useState([]);
    const [expanded, setExpanded] = useState(null);
    const [showCreate, setShowCreate] = useState(false);

    const load = useCallback(async () => {
        const [g, u] = await Promise.all([api.get("/admin/groups"), api.get("/users")]);
        setGroups(g.data);
        setUsers(u.data.filter((x) => x.role !== "admin"));
    }, []);

    useEffect(() => { load(); }, [load]);

    const userById = (id) => users.find((u) => u.id === id);

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <div className="font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">/ Verwaltung</div>
                    <h1 className="text-3xl tracking-tighter font-semibold mt-1">Gruppen &amp; Zuordnungen</h1>
                    <p className="text-sm text-zinc-500 mt-1">Wer ist in welcher Gruppe. Nur Metadaten — keine Nachrichten.</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    data-testid="admin-create-group-button"
                    className="flex items-center gap-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-medium rounded-sm text-sm transition-colors"
                >
                    <Plus className="w-4 h-4" /> Neue Gruppe
                </button>
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
                                {g.created_by_admin && (
                                    <span className="font-mono text-[10px] text-amber-400 border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 rounded-sm uppercase tracking-widest">
                                        Admin-erstellt
                                    </span>
                                )}
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
                                            {isAdmin && (
                                                <span className="flex items-center gap-1 font-mono text-[10px] text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-sm">
                                                    <Shield className="w-3 h-3" /> GRUPPEN-ADMIN
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
                {groups.length === 0 && <div className="text-sm text-zinc-500">Keine Gruppen</div>}
            </div>

            {showCreate && (
                <AdminCreateGroupModal
                    users={users}
                    onClose={() => setShowCreate(false)}
                    onCreated={() => { setShowCreate(false); load(); }}
                />
            )}
        </div>
    );
}

function AdminCreateGroupModal({ users, onClose, onCreated }) {
    const [name, setName] = useState("");
    const [memberIds, setMemberIds] = useState([]);
    const [adminIds, setAdminIds] = useState([]);
    const [saving, setSaving] = useState(false);

    const toggleMember = (id) => {
        setMemberIds((s) => {
            const next = s.includes(id) ? s.filter((x) => x !== id) : [...s, id];
            // if user was group-admin but removed as member, also remove as group-admin
            setAdminIds((a) => a.filter((x) => next.includes(x)));
            return next;
        });
    };

    const toggleAdmin = (id) => {
        setAdminIds((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
    };

    const submit = async () => {
        if (!name.trim()) { toast.error("Gruppenname erforderlich"); return; }
        if (memberIds.length === 0) { toast.error("Mindestens ein Mitglied auswählen"); return; }
        setSaving(true);
        try {
            await api.post("/admin/groups", { name, member_ids: memberIds, admin_ids: adminIds });
            toast.success("Gruppe erstellt");
            onCreated();
        } catch (err) {
            toast.error(formatApiErrorDetail(err.response?.data?.detail));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" data-testid="admin-create-group-modal">
            <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-sm max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <div>
                        <div className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">/ Admin-Aktion</div>
                        <h3 className="font-medium text-zinc-100 mt-0.5">Neue Gruppe erstellen</h3>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200" data-testid="close-admin-create-group"><X className="w-4 h-4" /></button>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto">
                    <div>
                        <label className="block font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-2">Gruppenname</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            data-testid="admin-group-name-input"
                            placeholder="z.B. Crew, VIP-Gäste, Team-Event"
                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 focus:border-cyan-500 outline-none rounded-sm text-sm text-zinc-100"
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">Mitglieder ({memberIds.length})</label>
                            <span className="font-mono text-[10px] text-zinc-600">Haken = Mitglied · Schild = Gruppen-Admin</span>
                        </div>
                        <div className="border border-zinc-800 rounded-sm max-h-64 overflow-y-auto">
                            {users.length === 0 && <div className="p-3 text-xs text-zinc-500">Keine Nutzer verfügbar</div>}
                            {users.map((u) => {
                                const isMember = memberIds.includes(u.id);
                                const isGroupAdmin = adminIds.includes(u.id);
                                return (
                                    <div
                                        key={u.id}
                                        className="flex items-center gap-3 p-2 border-b border-zinc-900 last:border-0 hover:bg-zinc-900/60"
                                        data-testid={`admin-group-user-row-${u.id}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isMember}
                                            onChange={() => toggleMember(u.id)}
                                            data-testid={`admin-group-member-${u.id}`}
                                            className="accent-cyan-500"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-zinc-100">{u.name}</div>
                                            <div className="font-mono text-xs text-zinc-500 truncate">{u.email}</div>
                                        </div>
                                        {u.is_customer && (
                                            <span className="font-mono text-[10px] text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-sm">KUNDE</span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => isMember && toggleAdmin(u.id)}
                                            disabled={!isMember}
                                            data-testid={`admin-group-admin-${u.id}`}
                                            title={isMember ? "Als Gruppen-Admin setzen" : "Erst als Mitglied hinzufügen"}
                                            className={`flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded-sm border transition-colors ${
                                                isGroupAdmin
                                                    ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400"
                                                    : "border-zinc-800 text-zinc-500 hover:border-zinc-600"
                                            } ${!isMember ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
                                        >
                                            <Shield className="w-3 h-3" /> Admin
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs p-3 rounded-sm font-mono leading-relaxed">
                        Hinweis: Sie selbst werden <strong>nicht</strong> Mitglied dieser Gruppe. Gruppen-Admins können anschließend Mitglieder hinzufügen/entfernen und den Namen ändern.
                    </div>
                </div>

                <div className="p-4 flex justify-end gap-2 border-t border-zinc-800">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-zinc-700 text-zinc-300 hover:border-zinc-500 rounded-sm text-sm transition-colors"
                    >
                        Abbrechen
                    </button>
                    <button
                        onClick={submit}
                        disabled={saving || !name.trim() || memberIds.length === 0}
                        data-testid="admin-submit-create-group"
                        className="flex items-center gap-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-zinc-950 font-medium rounded-sm text-sm transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        {saving ? "Erstellt…" : "Gruppe erstellen"}
                    </button>
                </div>
            </div>
        </div>
    );
}
