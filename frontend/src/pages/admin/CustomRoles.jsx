import { useCallback, useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, X, Tag } from "lucide-react";

export default function AdminCustomRoles() {
    const [roles, setRoles] = useState([]);
    const [showCreate, setShowCreate] = useState(false);

    const load = useCallback(async () => {
        const { data } = await api.get("/admin/custom-roles");
        setRoles(data);
    }, []);
    useEffect(() => { load(); }, [load]);

    const remove = async (r) => {
        const msg = r.assigned_count > 0
            ? `Rolle "${r.name}" wird bei ${r.assigned_count} Nutzer(n) entfernt. Fortfahren?`
            : `Rolle "${r.name}" löschen?`;
        if (!window.confirm(msg)) return;
        try {
            await api.delete(`/admin/custom-roles/${r.id}`);
            toast.success("Gelöscht");
            load();
        } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    };

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <div className="font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">/ Verwaltung</div>
                    <h1 className="text-3xl tracking-tighter font-semibold mt-1">Eigene Rollen</h1>
                    <p className="text-sm text-zinc-500 mt-1">Eigene Bezeichnungen zur Kategorisierung von Nutzern (z.B. VIP, Crew, Speaker).</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    data-testid="create-role-button"
                    className="flex items-center gap-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-medium rounded-sm text-sm"
                >
                    <Plus className="w-4 h-4" /> Neue Rolle
                </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2" data-testid="roles-list">
                {roles.length === 0 && (
                    <div className="col-span-full text-center py-12 bg-zinc-900 border border-zinc-800 rounded-sm">
                        <Tag className="w-8 h-8 mx-auto text-zinc-700 mb-2" />
                        <div className="text-sm text-zinc-500">Noch keine eigenen Rollen</div>
                    </div>
                )}
                {roles.map((r) => (
                    <div key={r.id} className="bg-zinc-900 border border-zinc-800 p-4 flex items-start gap-3" data-testid={`role-card-${r.id}`}>
                        <div
                            className="w-10 h-10 rounded-sm flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${r.color}20`, borderColor: r.color, borderWidth: 1 }}
                        >
                            <Tag className="w-4 h-4" style={{ color: r.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="font-medium text-zinc-100">{r.name}</h3>
                                <span className="font-mono text-[10px] text-zinc-500">{r.assigned_count} Nutzer</span>
                            </div>
                            {r.description && <p className="text-xs text-zinc-500 mt-1">{r.description}</p>}
                        </div>
                        <button
                            onClick={() => remove(r)}
                            data-testid={`delete-role-${r.id}`}
                            className="p-1.5 text-zinc-400 hover:text-red-400 transition-colors"
                            title="Löschen"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ))}
            </div>

            {showCreate && (
                <CreateRoleModal
                    onClose={() => setShowCreate(false)}
                    onCreated={() => { setShowCreate(false); load(); }}
                />
            )}
        </div>
    );
}

const PRESET_COLORS = ["#06b6d4", "#f59e0b", "#8b5cf6", "#ec4899", "#10b981", "#f43f5e", "#22d3ee", "#84cc16"];

function CreateRoleModal({ onClose, onCreated }) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [color, setColor] = useState(PRESET_COLORS[0]);
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (!name.trim()) { toast.error("Name erforderlich"); return; }
        setSaving(true);
        try {
            await api.post("/admin/custom-roles", { name: name.trim(), color, description: description.trim() });
            toast.success("Rolle erstellt");
            onCreated();
        } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" data-testid="create-role-modal">
            <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-sm">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <h3 className="font-medium">Neue Rolle</h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-4 space-y-4">
                    <div>
                        <label className="block font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-2">Name</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            data-testid="role-name-input"
                            placeholder="z.B. VIP, Crew, Speaker"
                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 focus:border-cyan-500 outline-none rounded-sm text-sm text-zinc-100"
                        />
                    </div>
                    <div>
                        <label className="block font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-2">Farbe</label>
                        <div className="flex gap-2">
                            {PRESET_COLORS.map((c) => (
                                <button
                                    key={c}
                                    onClick={() => setColor(c)}
                                    data-testid={`role-color-${c.slice(1)}`}
                                    className={`w-8 h-8 rounded-sm border-2 transition-transform ${color === c ? "scale-110 border-white" : "border-transparent"}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-2">Beschreibung (optional)</label>
                        <input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            data-testid="role-desc-input"
                            placeholder="Wozu ist diese Rolle?"
                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 focus:border-cyan-500 outline-none rounded-sm text-sm text-zinc-100"
                        />
                    </div>
                </div>
                <div className="p-4 flex justify-end gap-2 border-t border-zinc-800">
                    <button onClick={onClose} className="px-4 py-2 border border-zinc-700 text-zinc-300 rounded-sm text-sm">Abbrechen</button>
                    <button
                        onClick={submit}
                        disabled={saving}
                        data-testid="submit-role-button"
                        className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-medium rounded-sm text-sm"
                    >
                        {saving ? "Erstellt…" : "Erstellen"}
                    </button>
                </div>
            </div>
        </div>
    );
}
