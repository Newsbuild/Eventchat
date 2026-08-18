import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiErrorDetail } from "@/lib/api";
import { Terminal, Lock, Mail, Ticket } from "lucide-react";

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const u = await login(email, password);
            navigate(u.role === "admin" ? "/admin" : "/chat");
        } catch (err) {
            setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-zinc-950 relative overflow-hidden">
            {/* Left panel: brand */}
            <div className="hidden lg:flex w-5/12 relative items-end p-12 border-r border-zinc-800">
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: "url(https://images.pexels.com/photos/17323801/pexels-photo-17323801.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940)" }}
                />
                <div className="absolute inset-0 bg-zinc-950/85" />
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-8">
                        <Terminal className="w-5 h-5 text-cyan-400" />
                        <span className="font-mono text-xs tracking-[0.3em] text-cyan-400 uppercase">Event.Chat / Local</span>
                    </div>
                    <h1 className="text-5xl font-semibold tracking-tighter text-zinc-50 leading-none mb-4">
                        Lokaler<br />Event-Chat.
                    </h1>
                    <p className="text-zinc-400 max-w-md leading-relaxed">
                        Geschlossenes Chat-System für Ihre Veranstaltung — nur im lokalen Netzwerk. Direkt, privat, sofort einsatzbereit.
                    </p>
                    <div className="mt-12 font-mono text-xs tracking-widest text-zinc-600 uppercase">
                        // Stand-Alone · WLAN-only · No Cloud
                    </div>
                </div>
            </div>

            {/* Right panel: login form */}
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-sm fade-up">
                    <div className="flex items-center gap-2 mb-10 lg:hidden">
                        <Terminal className="w-5 h-5 text-cyan-400" />
                        <span className="font-mono text-xs tracking-[0.3em] text-cyan-400 uppercase">Event.Chat</span>
                    </div>
                    <div className="font-mono text-xs tracking-widest text-zinc-500 uppercase mb-2">
                        / Authentifizierung
                    </div>
                    <h2 className="text-3xl tracking-tight font-semibold mb-8 text-zinc-50">Anmelden</h2>

                    <form onSubmit={submit} className="space-y-5">
                        <div>
                            <label className="block font-mono text-xs tracking-widest text-zinc-500 uppercase mb-2">E-Mail</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input
                                    type="email"
                                    required
                                    data-testid="login-email-input"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@event.local"
                                    className="w-full pl-10 pr-3 py-2.5 bg-zinc-900 border border-zinc-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none rounded-sm text-zinc-100 text-sm transition-colors"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block font-mono text-xs tracking-widest text-zinc-500 uppercase mb-2">Passwort</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input
                                    type="password"
                                    required
                                    data-testid="login-password-input"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-10 pr-3 py-2.5 bg-zinc-900 border border-zinc-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none rounded-sm text-zinc-100 text-sm transition-colors"
                                />
                            </div>
                        </div>

                        {error && (
                            <div data-testid="login-error" className="border border-red-500/30 bg-red-500/10 text-red-400 text-sm px-3 py-2 rounded-sm font-mono">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            data-testid="login-submit-button"
                            className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-zinc-950 font-medium py-2.5 rounded-sm transition-colors tracking-tight"
                        >
                            {loading ? "Verbinde…" : "Anmelden →"}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-zinc-800">
                        <Link
                            to="/register"
                            data-testid="go-register-link"
                            className="flex items-center justify-center gap-2 px-4 py-2 border border-zinc-700 hover:border-cyan-500 hover:text-cyan-400 text-zinc-300 rounded-sm text-sm font-mono transition-colors"
                        >
                            <Ticket className="w-4 h-4" /> Mit Einladungscode registrieren
                        </Link>
                    </div>

                    <div className="mt-10 pt-6 border-t border-zinc-800">
                        <div className="font-mono text-xs tracking-widest text-zinc-500 uppercase mb-2">Demo-Zugänge</div>
                        <div className="font-mono text-xs text-zinc-400 space-y-1">
                            <div>admin@event.local / admin123</div>
                            <div>anna@event.local / demo123</div>
                            <div>ben@event.local / demo123</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
