import { useCallback, useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Plus, X, Shield, Edit2, Archive, ArchiveRestore } from "lucide-react";

export default function AdminGroups() {
    const [groups, setGroups] = useState([]);
    const [users, setUsers] = useState([]);
    const [expanded, setExpanded] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const [editGroup, setEditGroup] = useState(null);

    const load = useCallback(async () => {
        const [g, u] = await Promise.all([api.get("/admin/groups"), api.get("/users")]);
        setGroups(g.data);
        setUsers(u.data.filter((x) => x.role !== "admin"));
    }, []);

    useEffect(() => { load(); }, [load]);

    const userById = (id) => users.find((u) => u.id === id);

    const archive = async (g) => {
        if (!window.confirm(`Gruppe "${g.name}" archivieren? Nutzer sehen die Gruppe nicht mehr — Nachrichten bleiben auf dem Server.`)) return;
        try {
            await api.post(`/admin/groups/${g.id}/archive`);
            toast.success("Gruppe archiviert");
            load();
        } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    };

    const unarchive = async (g) => {
        try {
            await api.post(`/admin/groups/${g.id}/unarchive`);
            toast.success("Gruppe reaktiviert");
            load();
        } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    };

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <div className="font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">/ Verwaltung</div>
                    <h1 className="text-3xl tracking-tighter font-semibold mt-1">Gruppen &amp; Zuordnungen</h1>
                    <p className="text-sm text-zinc-500 mt-1">Erstellen, bearbeiten und archivieren. Nur Metadaten — keine Nachrichten.</p>
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
                    <div key={g.id} className={`bg-zinc-900 border ${g.archived ? "border-zinc-800 opacity-60" : "border-zinc-800"}`}>
                        <div
                            className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-zinc-900/60"
                            onClick={() => setExpanded(expanded === g.id ? null : g.id)}
                            data-testid={`group-${g.id}`}
                        >
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className="font-mono text-xs text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-sm">GRUPPE</span>
                                <span className={`font-medium ${g.archived ? "text-zinc-400 line-through" : "text-zinc-100"}`}>{g.name}</span>
                                {g.created_by_admin && (
                                    <span className="font-mono text-[10px] text-amber-400 border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 rounded-sm uppercase tracking-widest">
                                        Admin-erstellt
                                    </span>
                                )}
                                {g.archived && (
                                    <span className="font-mono text-[10px] text-red-400 border border-red-500/30 bg-red-500/10 px-2 py-0.5 rounded-sm uppercase tracking-widest">
                                        Archiviert
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-xs font-mono text-zinc-500 mr-3">{g.member_ids.length} Mitgl.</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setEditGroup(g); }}
                                    data-testid={`edit-group-${g.id}`}
                                    title="Bearbeiten"
                                    disabled={g.archived}
                                    className="p-2 hover:bg-zinc-800 rounded-sm text-zinc-400 hover:text-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                {g.archived ? (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); unarchive(g); }}
                                        data-testid={`unarchive-group-${g.id}`}
                                        title="Reaktivieren"
                                        className="p-2 hover:bg-zinc-800 rounded-sm text-zinc-400 hover:text-emerald-400 transition-colors"
                                    >
                                        <ArchiveRestore className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); archive(g); }}
                                        data-testid={`archive-group-${g.id}`}
                                        title="Archivieren (Nutzer sehen Gruppe nicht mehr)"
                                        className="p-2 hover:bg-zinc-800 rounded-sm text-zinc-400 hover:text-red-400 transition-colors"
                                    >
                                        <Archive className="w-4 h-4" />
                                    </button>
                                )}
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
                <GroupFormModal
                    mode="create"
                    users={users}
                    onClose={() => setShowCreate(false)}
                    onSaved={() => { setShowCreate(false); load(); }}
                />
            )}
            {editGroup && (
                <GroupFormModal
                    mode="edit"
                    group={editGroup}
                    users={users}
                    onClose={() => setEditGroup(null)}
                    onSaved={() => { setEditGroup(null); load(); }}
                />
            )}
        </div>
    );
}

function GroupFormModal({ mode, group, users, onClose, onSaved }) {
    const [name, setName] = useState(group?.name || "");
    const [memberIds, setMemberIds] = useState(group?.member_ids || []);
    const [adminIds, setAdminIds] = useState(group?.admin_ids || []);
    const [saving, setSaving] = useState(false);

    const toggleMember = (id) => {
        setMemberIds((s) => {
            const next = s.includes(id) ? s.filter((x) => x !== id) : [...s, id];
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
            if (mode === "create") {
                await api.post("/admin/groups", { name, member_ids: memberIds, admin_ids: adminIds });
                toast.success("Gruppe erstellt");
            } else {
                await api.patch(`/admin/groups/${group.id}`, {
                    name, member_ids: memberIds, admin_ids: adminIds,
                });
                toast.success("Gruppe aktualisiert");
            }
            onSaved();
        } catch (err) {
            toast.error(formatApiErrorDetail(err.response?.data?.detail));
        } finally {
            setSaving(false);
        }
    };

    const isEdit = mode === "edit";
    const title = isEdit ? "Gruppe bearbeiten" : "Neue Gruppe erstellen";

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" data-testid="group-form-modal">
            <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-sm max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <div>
                        <div className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">/ Admin-Aktion</div>
                        <h3 className="font-medium text-zinc-100 mt-0.5">{title}</h3>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200" data-testid="close-group-form"><X className="w-4 h-4" /></button>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto">
                    <div>
                        <label className="block font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-2">Gruppenname</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            data-testid="group-form-name-input"
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
                                        data-testid={`group-form-user-row-${u.id}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isMember}
                                            onChange={() => toggleMember(u.id)}
                                            data-testid={`group-form-member-${u.id}`}
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
                                            data-testid={`group-form-admin-${u.id}`}
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
                        {isEdit
                            ? "Hinweis: Änderungen werden im Chat als System-Nachrichten protokolliert (Mitglied hinzugefügt/entfernt, umbenannt)."
                            : "Hinweis: Sie selbst werden nicht Mitglied dieser Gruppe."}
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
                        data-testid="group-form-submit"
                        className="flex items-center gap-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-zinc-950 font-medium rounded-sm text-sm transition-colors"
                    >
                        {saving ? "Speichert…" : (isEdit ? "Speichern" : "Erstellen")}
                    </button>
                </div>
            </div>
        </div>
    );
}
