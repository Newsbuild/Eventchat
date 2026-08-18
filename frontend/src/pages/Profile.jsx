import { useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Camera, Trash2 } from "lucide-react";
import { Avatar } from "@/components/app/Avatar";

export default function Profile() {
    const { user, setUser, refresh } = useAuth();
    const navigate = useNavigate();
    const [name, setName] = useState(user?.name || "");
    const [password, setPassword] = useState("");
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef(null);

    const save = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const body = { name };
            if (password) body.password = password;
            const { data } = await api.patch("/me/profile", body);
            setUser(data);
            setPassword("");
            toast.success("Profil aktualisiert");
        } catch (err) {
            toast.error(formatApiErrorDetail(err.response?.data?.detail));
        } finally { setSaving(false); }
    };

    const uploadAvatar = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) { toast.error("Bitte ein Bild wählen"); return; }
        if (file.size > 5 * 1024 * 1024) { toast.error("Maximal 5 MB"); return; }
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            await api.post("/me/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } });
            await refresh();
            toast.success("Profilbild aktualisiert");
        } catch (err) {
            toast.error(formatApiErrorDetail(err.response?.data?.detail));
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    const removeAvatar = async () => {
        if (!user?.avatar_upload_id) return;
        try {
            await api.delete("/me/avatar");
            await refresh();
            toast.success("Profilbild entfernt");
        } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100">
            <div className="max-w-xl mx-auto p-8">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-1 text-zinc-400 hover:text-cyan-400 mb-6 text-sm"
                    data-testid="back-button"
                >
                    <ArrowLeft className="w-4 h-4" /> Zurück
                </button>
                <div className="flex items-center gap-4 mb-8">
                    <div className="relative">
                        <Avatar user={user} size="xl" data-testid="profile-avatar" />
                        <button
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading}
                            data-testid="upload-avatar-button"
                            className="absolute -bottom-1 -right-1 p-2 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 rounded-full border-2 border-zinc-950 disabled:opacity-50"
                            title="Profilbild ändern"
                        >
                            <Camera className="w-3.5 h-3.5" />
                        </button>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} data-testid="avatar-file-input" />
                    </div>
                    <div>
                        <div className="font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">/ Profil</div>
                        <h1 className="text-2xl font-semibold tracking-tight">{user?.name}</h1>
                        <div className="font-mono text-xs text-zinc-500">{user?.email}</div>
                        {user?.avatar_upload_id && (
                            <button
                                onClick={removeAvatar}
                                data-testid="remove-avatar-button"
                                className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-red-400"
                            >
                                <Trash2 className="w-3 h-3" /> Bild entfernen
                            </button>
                        )}
                    </div>
                </div>

                <form onSubmit={save} className="space-y-5 bg-zinc-900/50 border border-zinc-800 p-6 rounded-sm">
                    <div>
                        <label className="block font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-2">Anzeigename</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            data-testid="profile-name-input"
                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 focus:border-cyan-500 outline-none rounded-sm text-sm"
                        />
                    </div>
                    <div>
                        <label className="block font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-2">Neues Passwort (optional)</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            data-testid="profile-password-input"
                            placeholder="••••••••"
                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 focus:border-cyan-500 outline-none rounded-sm text-sm"
                        />
                    </div>
                    <div>
                        <div className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-2">Rolle</div>
                        <div className="flex flex-wrap gap-2">
                            <span className="font-mono text-xs border border-zinc-800 bg-zinc-900 px-2 py-1 rounded-sm text-zinc-300">{user?.role?.toUpperCase()}</span>
                            {user?.is_customer && <span className="font-mono text-xs border border-amber-500/30 bg-amber-500/10 text-amber-400 px-2 py-1 rounded-sm">KUNDE</span>}
                            {(user?.custom_roles || []).map((r) => (
                                <span key={r} className="font-mono text-xs border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 px-2 py-1 rounded-sm">{r}</span>
                            ))}
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={saving}
                        data-testid="save-profile-button"
                        className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-medium rounded-sm text-sm"
                    >
                        {saving ? "Speichert…" : "Speichern"}
                    </button>
                </form>
            </div>
        </div>
    );
}
