import { useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Terminal, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await api.post("/auth/forgot-password", { email });
            setSent(true);
        } catch (err) {
            setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-8">
            <div className="w-full max-w-sm">
                <Link to="/login" className="flex items-center gap-1 text-zinc-400 hover:text-cyan-400 text-sm mb-8" data-testid="back-to-login">
                    <ArrowLeft className="w-4 h-4" /> Zurück zum Login
                </Link>
                <div className="flex items-center gap-2 mb-6">
                    <Terminal className="w-5 h-5 text-cyan-400" />
                    <span className="font-mono text-xs tracking-[0.3em] text-cyan-400 uppercase">/ Passwort zurücksetzen</span>
                </div>
                <h2 className="text-3xl tracking-tight font-semibold mb-3 text-zinc-50">Passwort vergessen</h2>
                <p className="text-sm text-zinc-500 mb-6">
                    Geben Sie Ihre E-Mail-Adresse ein. Wir schicken Ihnen einen Link zum Zurücksetzen (1 Stunde gültig).
                </p>

                {sent ? (
                    <div className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 p-4 rounded-sm text-sm space-y-2" data-testid="forgot-sent">
                        <div className="flex items-center gap-2 font-medium">
                            <CheckCircle2 className="w-4 h-4" /> E-Mail versandt
                        </div>
                        <p className="text-emerald-200/80">
                            Falls diese E-Mail bei uns registriert ist, wurde ein Link versandt. Prüfen Sie auch den Spam-Ordner.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-4">
                        <div>
                            <label className="block font-mono text-xs tracking-widest text-zinc-500 uppercase mb-2">E-Mail</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input
                                    type="email" required
                                    data-testid="forgot-email-input"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="ihre@email.local"
                                    className="w-full pl-10 pr-3 py-2.5 bg-zinc-900 border border-zinc-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none rounded-sm text-zinc-100 text-sm"
                                />
                            </div>
                        </div>
                        {error && (
                            <div data-testid="forgot-error" className="border border-red-500/30 bg-red-500/10 text-red-400 text-sm px-3 py-2 rounded-sm font-mono">
                                {error}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={loading}
                            data-testid="forgot-submit-button"
                            className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-zinc-950 font-medium py-2.5 rounded-sm transition-colors tracking-tight"
                        >
                            {loading ? "Sende…" : "Link anfordern →"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
