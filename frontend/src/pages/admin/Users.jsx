import { useCallback, useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, X, Edit2 } from "lucide-react";
import { Avatar } from "@/components/app/Avatar";

export default function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [customRoles, setCustomRoles] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [editUser, setEditUser] = useState(null);

    const load = useCallback(async () => {
        const [u, r] = await Promise.all([api.get("/users"), api.get("/admin/custom-roles")]);
        setUsers(u.data);
        setCustomRoles(r.data);
    }, []);
    useEffect(() => { load(); }, [load]);

    const roleColor = (name) => customRoles.find((r) => r.name === name)?.color || "#06b6d4";

    const removeUser = async (id) => {
        if (!window.confirm("Nutzer wirklich löschen?")) return;
        try {
            await api.delete(`/users/${id}`);
            toast.success("Nutzer gelöscht");
            load();
        } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    };

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <div className="font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">/ Verwaltung</div>
                    <h1 className="text-3xl tracking-tighter font-semibold mt-1">Nutzer</h1>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    data-testid="create-user-button"
                    className="flex items-center gap-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-medium rounded-sm text-sm"
                >
                    <Plus className="w-4 h-4" /> Neuer Nutzer
                </button>
            </div>

            <div className="bg-zinc-900 border border-zinc-800">
                <table className="w-full text-sm" data-testid="users-table">
                    <thead>
                        <tr className="text-left font-mono text-[10px] tracking-widest text-zinc-500 uppercase border-b border-zinc-800">
                            <th className="px-5 py-3"></th>
                            <th className="px-5 py-3">Name</th>
                            <th className="px-5 py-3">Email</th>
                            <th className="px-5 py-3">System-Rolle</th>
                            <th className="px-5 py-3">Eigene Rollen</th>
                            <th className="px-5 py-3">Typ</th>
                            <th className="px-5 py-3 text-right">Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u.id} className="border-b border-zinc-800 hover:bg-zinc-900/50" data-testid={`user-row-${u.id}`}>
                                <td className="px-5 py-3"><Avatar user={u} size="sm" /></td>
                                <td className="px-5 py-3 text-zinc-100">{u.name}</td>
                                <td className="px-5 py-3 font-mono text-xs text-zinc-400">{u.email}</td>
                                <td className="px-5 py-3">
                                    <span className={`font-mono text-xs px-2 py-0.5 rounded-sm border ${u.role === "admin" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-zinc-700 bg-zinc-800 text-zinc-300"}`}>
                                        {u.role.toUpperCase()}
                                    </span>
                                </td>
                                <td className="px-5 py-3">
                                    <div className="flex flex-wrap gap-1">
                                        {(u.custom_roles || []).map((r) => (
                                            <span
                                                key={r}
                                                className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm border"
                                                style={{ color: roleColor(r), borderColor: `${roleColor(r)}66`, backgroundColor: `${roleColor(r)}15` }}
                                            >
                                                {r}
                                            </span>
                                        ))}
                                        {!u.custom_roles?.length && <span className="text-zinc-600 text-xs">—</span>}
                                    </div>
                                </td>
                                <td className="px-5 py-3">
                                    <span className="font-mono text-xs text-zinc-400">{u.is_customer ? "KUNDE" : "INTERN"}</span>
                                </td>
                                <td className="px-5 py-3 text-right">
                                    <button
                                        onClick={() => setEditUser(u)}
                                        data-testid={`edit-user-${u.id}`}
                                        className="p-1.5 text-zinc-400 hover:text-cyan-400"
                                    ><Edit2 className="w-3.5 h-3.5" /></button>
                                    <button
                                        onClick={() => removeUser(u.id)}
                                        data-testid={`delete-user-${u.id}`}
                                        className="p-1.5 text-zinc-400 hover:text-red-400"
                                    ><Trash2 className="w-3.5 h-3.5" /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showCreate && <UserModal onClose={() => setShowCreate(false)} onSaved={load} mode="create" customRoles={customRoles} />}
            {editUser && <UserModal onClose={() => setEditUser(null)} onSaved={load} mode="edit" user={editUser} customRoles={customRoles} />}
        </div>
    );
}

function UserModal({ mode, user, onClose, onSaved, customRoles }) {
    const [form, setForm] = useState({
        email: user?.email || "",
        name: user?.name || "",
        role: user?.role || "user",
        is_customer: user?.is_customer || false,
        password: "",
        custom_roles: user?.custom_roles || [],
    });
    const [saving, setSaving] = useState(false);

    const toggleRole = (name) => {
        setForm((f) => ({
            ...f,
            custom_roles: f.custom_roles.includes(name)
                ? f.custom_roles.filter((r) => r !== name)
                : [...f.custom_roles, name],
        }));
    };

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (mode === "create") {
                const { data } = await api.post("/users", form);
                // After create, assign custom_roles if any
                if (form.custom_roles.length > 0) {
                    await api.patch(`/users/${data.id}`, { custom_roles: form.custom_roles });
                }
                toast.success("Nutzer erstellt");
            } else {
                const body = {
                    name: form.name, role: form.role, is_customer: form.is_customer,
                    custom_roles: form.custom_roles,
                };
                if (form.password) body.password = form.password;
                await api.patch(`/users/${user.id}`, body);
                toast.success("Nutzer aktualisiert");
            }
            onSaved();
            onClose();
        } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" data-testid="user-modal">
            <form onSubmit={submit} className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-sm max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <h3 className="font-medium">{mode === "create" ? "Nutzer erstellen" : "Nutzer bearbeiten"}</h3>
                    <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-4 space-y-3 overflow-y-auto">
                    <input
                        type="email" required
                        disabled={mode === "edit"}
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        data-testid="user-email-input"
                        placeholder="email@event.local"
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 focus:border-cyan-500 outline-none rounded-sm text-sm disabled:opacity-60"
                    />
                    <input
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        data-testid="user-name-input"
                        placeholder="Name"
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 focus:border-cyan-500 outline-none rounded-sm text-sm"
                    />
                    <input
                        type="password"
                        required={mode === "create"}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        data-testid="user-password-input"
                        placeholder={mode === "edit" ? "Passwort (leer lassen = unverändert)" : "Passwort"}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 focus:border-cyan-500 outline-none rounded-sm text-sm"
                    />
                    <div>
                        <label className="block font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-1">System-Rolle</label>
                        <select
                            value={form.role}
                            onChange={(e) => setForm({ ...form, role: e.target.value })}
                            data-testid="user-role-select"
                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 focus:border-cyan-500 outline-none rounded-sm text-sm"
                        >
                            <option value="user">Nutzer</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-zinc-300">
                        <input type="checkbox" checked={form.is_customer} onChange={(e) => setForm({ ...form, is_customer: e.target.checked })} className="accent-cyan-500" />
                        Kunde (extern)
                    </label>
                    {customRoles.length > 0 && (
                        <div>
                            <label className="block font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-2">Eigene Rollen</label>
                            <div className="flex flex-wrap gap-1">
                                {customRoles.map((r) => {
                                    const active = form.custom_roles.includes(r.name);
                                    return (
                                        <button
                                            key={r.id}
                                            type="button"
                                            onClick={() => toggleRole(r.name)}
                                            data-testid={`toggle-role-${r.name}`}
                                            className="font-mono text-xs px-2 py-1 rounded-sm border transition-all"
                                            style={{
                                                color: r.color,
                                                borderColor: active ? r.color : `${r.color}44`,
                                                backgroundColor: active ? `${r.color}25` : "transparent",
                                            }}
                                        >
                                            {active ? "✓ " : ""}{r.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-4 flex justify-end gap-2 border-t border-zinc-800">
                    <button type="button" onClick={onClose} className="px-4 py-2 border border-zinc-700 text-zinc-300 rounded-sm text-sm">Abbrechen</button>
                    <button
                        type="submit" disabled={saving}
                        data-testid="save-user-button"
                        className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-medium rounded-sm text-sm"
                    >
                        {saving ? "Speichert…" : "Speichern"}
                    </button>
                </div>
            </form>
        </div>
    );
}
