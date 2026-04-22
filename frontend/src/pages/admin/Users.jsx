import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, X, Edit2 } from "lucide-react";

export default function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [editUser, setEditUser] = useState(null);

    const load = async () => {
        const { data } = await api.get("/users");
        setUsers(data);
    };
    useEffect(() => { load(); }, []);

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
                            <th className="px-5 py-3">Name</th>
                            <th className="px-5 py-3">Email</th>
                            <th className="px-5 py-3">Rolle</th>
                            <th className="px-5 py-3">Typ</th>
                            <th className="px-5 py-3 font-mono">Letzte Aktivität</th>
                            <th className="px-5 py-3 text-right">Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u.id} className="border-b border-zinc-800 hover:bg-zinc-900/50" data-testid={`user-row-${u.id}`}>
                                <td className="px-5 py-3 text-zinc-100">{u.name}</td>
                                <td className="px-5 py-3 font-mono text-xs text-zinc-400">{u.email}</td>
                                <td className="px-5 py-3">
                                    <span className={`font-mono text-xs px-2 py-0.5 rounded-sm border ${u.role === "admin" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-zinc-700 bg-zinc-800 text-zinc-300"}`}>
                                        {u.role.toUpperCase()}
                                    </span>
                                </td>
                                <td className="px-5 py-3">
                                    <span className="font-mono text-xs text-zinc-400">{u.is_customer ? "KUNDE" : "INTERN"}</span>
                                </td>
                                <td className="px-5 py-3 font-mono text-xs text-zinc-500">{u.last_seen ? new Date(u.last_seen).toLocaleString("de-DE") : "—"}</td>
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

            {showCreate && <UserModal onClose={() => setShowCreate(false)} onSaved={load} mode="create" />}
            {editUser && <UserModal onClose={() => setEditUser(null)} onSaved={load} mode="edit" user={editUser} />}
        </div>
    );
}

function UserModal({ mode, user, onClose, onSaved }) {
    const [form, setForm] = useState({
        email: user?.email || "",
        name: user?.name || "",
        role: user?.role || "user",
        is_customer: user?.is_customer || false,
        password: "",
    });
    const [saving, setSaving] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (mode === "create") {
                await api.post("/users", form);
                toast.success("Nutzer erstellt");
            } else {
                const body = { name: form.name, role: form.role, is_customer: form.is_customer };
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
            <form onSubmit={submit} className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-sm">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <h3 className="font-medium">{mode === "create" ? "Nutzer erstellen" : "Nutzer bearbeiten"}</h3>
                    <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-4 space-y-3">
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
                    <select
                        value={form.role}
                        onChange={(e) => setForm({ ...form, role: e.target.value })}
                        data-testid="user-role-select"
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 focus:border-cyan-500 outline-none rounded-sm text-sm"
                    >
                        <option value="user">Nutzer</option>
                        <option value="admin">Admin</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm text-zinc-300">
                        <input type="checkbox" checked={form.is_customer} onChange={(e) => setForm({ ...form, is_customer: e.target.checked })} className="accent-cyan-500" />
                        Kunde (extern)
                    </label>
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
