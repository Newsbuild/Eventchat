import { useCallback, useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Mail, Send, Save } from "lucide-react";

export default function AdminSettings() {
    const [cfg, setCfg] = useState({
        host: "", port: 587, username: "", password: "", from_email: "",
        from_name: "Event-Chat", use_tls: true, use_ssl: false,
    });
    const [passwordSet, setPasswordSet] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testEmail, setTestEmail] = useState("");
    const [testing, setTesting] = useState(false);

    const load = useCallback(async () => {
        try {
            const { data } = await api.get("/admin/settings/smtp");
            if (data && data.host) {
                setCfg((c) => ({ ...c, ...data, password: "" }));
                setPasswordSet(!!data.password_set);
            }
        } catch (err) {
            console.error("Failed to load SMTP settings", err);
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    const save = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put("/admin/settings/smtp", {
                host: cfg.host.trim(),
                port: Number(cfg.port) || 587,
                username: cfg.username || null,
                password: cfg.password || "",
                from_email: cfg.from_email.trim(),
                from_name: cfg.from_name || "Event-Chat",
                use_tls: !!cfg.use_tls,
                use_ssl: !!cfg.use_ssl,
            });
            toast.success("SMTP gespeichert");
            setCfg((c) => ({ ...c, password: "" }));
            setPasswordSet(true);
        } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
        finally { setSaving(false); }
    };

    const sendTest = async () => {
        if (!testEmail) { toast.error("Test-E-Mail-Adresse angeben"); return; }
        setTesting(true);
        try {
            await api.post("/admin/settings/smtp/test", { to: testEmail });
            toast.success("Test-Mail versandt");
        } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
        finally { setTesting(false); }
    };

    return (
        <div className="p-8">
            <div className="mb-8">
                <div className="font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">/ Einstellungen</div>
                <h1 className="text-3xl tracking-tighter font-semibold mt-1">E-Mail (SMTP)</h1>
                <p className="text-sm text-zinc-500 mt-1">Wird für Passwort-Reset-Mails und System-Benachrichtigungen verwendet.</p>
            </div>

            <form onSubmit={save} className="max-w-2xl bg-zinc-900 border border-zinc-800 p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-2">SMTP-Host</label>
                        <input
                            required
                            value={cfg.host}
                            onChange={(e) => setCfg({ ...cfg, host: e.target.value })}
                            data-testid="smtp-host-input"
                            placeholder="smtp.example.com"
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-cyan-500 outline-none rounded-sm text-sm text-zinc-100"
                        />
                    </div>
                    <div>
                        <label className="block font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-2">Port</label>
                        <input
                            type="number" required
                            value={cfg.port}
                            onChange={(e) => setCfg({ ...cfg, port: e.target.value })}
                            data-testid="smtp-port-input"
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-cyan-500 outline-none rounded-sm text-sm text-zinc-100 font-mono"
                        />
                    </div>
                    <div className="flex items-end gap-3">
                        <label className="flex items-center gap-2 text-sm text-zinc-300">
                            <input type="checkbox" checked={cfg.use_tls} onChange={(e) => setCfg({ ...cfg, use_tls: e.target.checked, use_ssl: false })} data-testid="smtp-tls-check" className="accent-cyan-500" />
                            STARTTLS
                        </label>
                        <label className="flex items-center gap-2 text-sm text-zinc-300">
                            <input type="checkbox" checked={cfg.use_ssl} onChange={(e) => setCfg({ ...cfg, use_ssl: e.target.checked, use_tls: false })} data-testid="smtp-ssl-check" className="accent-cyan-500" />
                            SSL (465)
                        </label>
                    </div>
                    <div>
                        <label className="block font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-2">Benutzername</label>
                        <input
                            value={cfg.username || ""}
                            onChange={(e) => setCfg({ ...cfg, username: e.target.value })}
                            data-testid="smtp-user-input"
                            placeholder="postmaster@example.com"
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-cyan-500 outline-none rounded-sm text-sm text-zinc-100"
                        />
                    </div>
                    <div>
                        <label className="block font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-2">
                            Passwort {passwordSet && <span className="text-emerald-400">(gesetzt)</span>}
                        </label>
                        <input
                            type="password"
                            value={cfg.password}
                            onChange={(e) => setCfg({ ...cfg, password: e.target.value })}
                            data-testid="smtp-password-input"
                            placeholder={passwordSet ? "•••••• (leer lassen = unverändert)" : "Passwort"}
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-cyan-500 outline-none rounded-sm text-sm text-zinc-100"
                        />
                    </div>
                    <div>
                        <label className="block font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-2">Absender-E-Mail</label>
                        <input
                            type="email" required
                            value={cfg.from_email}
                            onChange={(e) => setCfg({ ...cfg, from_email: e.target.value })}
                            data-testid="smtp-from-email-input"
                            placeholder="noreply@example.com"
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-cyan-500 outline-none rounded-sm text-sm text-zinc-100"
                        />
                    </div>
                    <div>
                        <label className="block font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-2">Absender-Name</label>
                        <input
                            value={cfg.from_name || ""}
                            onChange={(e) => setCfg({ ...cfg, from_name: e.target.value })}
                            data-testid="smtp-from-name-input"
                            placeholder="Event-Chat"
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-cyan-500 outline-none rounded-sm text-sm text-zinc-100"
                        />
                    </div>
                </div>

                <button
                    type="submit" disabled={saving}
                    data-testid="save-smtp-button"
                    className="flex items-center gap-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-medium rounded-sm text-sm"
                >
                    <Save className="w-4 h-4" /> {saving ? "Speichert…" : "Speichern"}
                </button>
            </form>

            <div className="mt-6 max-w-2xl bg-zinc-900 border border-zinc-800 p-6">
                <div className="flex items-center gap-2 mb-3">
                    <Mail className="w-4 h-4 text-cyan-400" />
                    <h2 className="font-medium">Test-Mail versenden</h2>
                </div>
                <div className="flex gap-2">
                    <input
                        type="email"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        data-testid="smtp-test-email-input"
                        placeholder="ihre@email.local"
                        className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-cyan-500 outline-none rounded-sm text-sm text-zinc-100"
                    />
                    <button
                        onClick={sendTest}
                        disabled={testing}
                        data-testid="send-test-mail-button"
                        className="flex items-center gap-1 px-4 py-2 border border-cyan-500/40 hover:bg-cyan-500/10 text-cyan-400 rounded-sm text-sm"
                    >
                        <Send className="w-4 h-4" /> {testing ? "Sende…" : "Test-Mail senden"}
                    </button>
                </div>
            </div>
        </div>
    );
}
