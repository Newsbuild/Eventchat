import { useEffect, useRef, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Upload, Trash2, Download } from "lucide-react";

function fmtSize(bytes) {
    if (!bytes && bytes !== 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
    return `${(bytes/1024/1024).toFixed(1)} MB`;
}

export default function AdminFiles() {
    const [items, setItems] = useState([]);
    const [users, setUsers] = useState([]);
    const [chats, setChats] = useState([]);
    const fileRef = useRef(null);

    const load = async () => {
        const [f, u, c] = await Promise.all([
            api.get("/admin/uploads"),
            api.get("/users"),
            api.get("/admin/chats"),
        ]);
        setItems(f.data);
        setUsers(u.data);
        setChats(c.data);
    };
    useEffect(() => { load(); }, []);

    const userName = (id) => users.find((u) => u.id === id)?.name || id;
    const chatName = (id) => {
        if (!id) return "—";
        const c = chats.find((x) => x.id === id);
        if (!c) return id.slice(0, 8);
        return c.name || `${c.type}:${id.slice(0, 6)}`;
    };

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const fd = new FormData();
        fd.append("file", file);
        fd.append("note", "Admin-Upload");
        try {
            await api.post("/admin/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
            toast.success("Datei hochgeladen");
            load();
        } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
        e.target.value = "";
    };

    const del = async (id) => {
        if (!window.confirm("Datei löschen?")) return;
        await api.delete(`/admin/uploads/${id}`);
        toast.success("Datei gelöscht");
        load();
    };

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <div className="font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">/ Verwaltung</div>
                    <h1 className="text-3xl tracking-tighter font-semibold mt-1">Dateien</h1>
                </div>
                <>
                    <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} data-testid="admin-upload-input" />
                    <button
                        onClick={() => fileRef.current?.click()}
                        data-testid="admin-upload-button"
                        className="flex items-center gap-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-medium rounded-sm text-sm"
                    >
                        <Upload className="w-4 h-4" /> Datei hinzufügen
                    </button>
                </>
            </div>

            <div className="bg-zinc-900 border border-zinc-800">
                <table className="w-full text-sm" data-testid="files-table">
                    <thead>
                        <tr className="text-left font-mono text-[10px] tracking-widest text-zinc-500 uppercase border-b border-zinc-800">
                            <th className="px-5 py-3">Dateiname</th>
                            <th className="px-5 py-3">Hochgeladen von</th>
                            <th className="px-5 py-3">Chat</th>
                            <th className="px-5 py-3 text-right">Größe</th>
                            <th className="px-5 py-3">Datum</th>
                            <th className="px-5 py-3 text-right">Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((f) => (
                            <tr key={f.id} className={`border-b border-zinc-800 hover:bg-zinc-900/50 ${f.deleted ? "opacity-50" : ""}`} data-testid={`file-row-${f.id}`}>
                                <td className="px-5 py-3 text-zinc-100">
                                    {f.filename}
                                    {f.deleted && <span className="ml-2 font-mono text-[10px] text-red-400">[GELÖSCHT]</span>}
                                </td>
                                <td className="px-5 py-3 text-zinc-300">{userName(f.uploaded_by)}</td>
                                <td className="px-5 py-3 font-mono text-xs text-zinc-400">{chatName(f.chat_id)}</td>
                                <td className="px-5 py-3 text-right font-mono text-xs text-zinc-400">{fmtSize(f.size)}</td>
                                <td className="px-5 py-3 font-mono text-xs text-zinc-500">{new Date(f.created_at).toLocaleString("de-DE")}</td>
                                <td className="px-5 py-3 text-right">
                                    {!f.deleted && (
                                        <>
                                            <a
                                                href={`${process.env.REACT_APP_BACKEND_URL}/api/uploads/${f.id}/download`}
                                                target="_blank" rel="noreferrer"
                                                data-testid={`download-${f.id}`}
                                                className="inline-block p-1.5 text-zinc-400 hover:text-cyan-400"
                                            ><Download className="w-3.5 h-3.5" /></a>
                                            <button
                                                onClick={() => del(f.id)}
                                                data-testid={`delete-file-${f.id}`}
                                                className="p-1.5 text-zinc-400 hover:text-red-400"
                                            ><Trash2 className="w-3.5 h-3.5" /></button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr><td colSpan={6} className="p-6 text-center text-zinc-500 text-sm">Keine Dateien</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
