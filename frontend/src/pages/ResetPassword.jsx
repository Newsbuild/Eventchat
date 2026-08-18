import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Terminal, Lock, ArrowLeft } from "lucide-react";

export default function ResetPassword() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const token = params.get("token") || "";
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        if (password.length < 6) { setError("Mindestens 6 Zeichen"); return; }
        if (password !== confirm) { setError("Passwörter stimmen nicht überein"); return; }
        setLoading(true);
        try {
            await api.post("/auth/reset-password", { token, password });
            alert("Passwort aktualisiert. Bitte melden Sie sich neu an.");
            navigate("/login");
        } catch (err) {
            setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-8 text-zinc-400">
                Kein Token vorhanden. <Link to="/login" className="text-cyan-400 ml-2">Zum Login</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-8">
            <div className="w-full max-w-sm">
                <Link to="/login" className="flex items-center gap-1 text-zinc-400 hover:text-cyan-400 text-sm mb-8">
                    <ArrowLeft className="w-4 h-4" /> Zurück zum Login
                </Link>
                <div className="flex items-center gap-2 mb-6">
                    <Terminal className="w-5 h-5 text-cyan-400" />
                    <span className="font-mono text-xs tracking-[0.3em] text-cyan-400 uppercase">/ Neues Passwort</span>
                </div>
                <h2 className="text-3xl tracking-tight font-semibold mb-6 text-zinc-50">Neues Passwort setzen</h2>

                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <label className="block font-mono text-xs tracking-widest text-zinc-500 uppercase mb-2">Neues Passwort</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input
                                type="password" required minLength={6}
                                data-testid="reset-password-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full pl-10 pr-3 py-2.5 bg-zinc-900 border border-zinc-700 focus:border-cyan-500 outline-none rounded-sm text-zinc-100 text-sm"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block font-mono text-xs tracking-widest text-zinc-500 uppercase mb-2">Bestätigen</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input
                                type="password" required
                                data-testid="reset-confirm-input"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                placeholder="••••••••"
                                className="w-full pl-10 pr-3 py-2.5 bg-zinc-900 border border-zinc-700 focus:border-cyan-500 outline-none rounded-sm text-zinc-100 text-sm"
                            />
                        </div>
                    </div>
                    {error && (
                        <div data-testid="reset-error" className="border border-red-500/30 bg-red-500/10 text-red-400 text-sm px-3 py-2 rounded-sm font-mono">
                            {error}
                        </div>
                    )}
                    <button
                        type="submit" disabled={loading}
                        data-testid="reset-submit-button"
                        className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-zinc-950 font-medium py-2.5 rounded-sm tracking-tight"
                    >
                        {loading ? "Speichert…" : "Passwort ändern →"}
                    </button>
                </form>

                <p className="mt-6 text-xs text-zinc-500 font-mono">
                    Hinweis: Bei aktiver E2E-Verschlüsselung wird Ihr Nachrichten-Verlauf durch das neue Passwort nicht automatisch wiederhergestellt.
                </p>
            </div>
        </div>
    );
}
