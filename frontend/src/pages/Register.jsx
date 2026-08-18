import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Terminal, Lock, Mail, Ticket, User2, ArrowLeft } from "lucide-react";

export default function Register() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { setUser } = useAuth();

    const [code, setCode] = useState(params.get("code") || "");
    const [inviteMeta, setInviteMeta] = useState(null);
    const [codeError, setCodeError] = useState("");
    const [checking, setChecking] = useState(false);

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const checkCode = async (c) => {
        setCodeError("");
        setInviteMeta(null);
        if (!c.trim()) return;
        setChecking(true);
        try {
            const { data } = await api.get(`/auth/invite/${encodeURIComponent(c.trim().toUpperCase())}`);
            setInviteMeta(data);
        } catch (err) {
            setCodeError(formatApiErrorDetail(err.response?.data?.detail) || "Code ungültig");
        } finally {
            setChecking(false);
        }
    };

    // auto-check code from URL param on mount
    useEffect(() => {
        if (params.get("code")) checkCode(params.get("code"));
    }, [params]);

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        if (!inviteMeta) { setError("Bitte zuerst gültigen Einladungscode prüfen"); return; }
        setLoading(true);
        try {
            const { data } = await api.post("/auth/register", {
                code: code.trim().toUpperCase(), email, name, password,
            });
            setUser(data);
            navigate(data.role === "admin" ? "/admin" : "/chat");
        } catch (err) {
            setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-zinc-950 relative overflow-hidden">
            <div className="hidden lg:flex w-5/12 relative items-end p-12 border-r border-zinc-800">
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: "url(https://images.pexels.com/photos/17323801/pexels-photo-17323801.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940)" }}
                />
                <div className="absolute inset-0 bg-zinc-950/85" />
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-8">
                        <Terminal className="w-5 h-5 text-cyan-400" />
                        <span className="font-mono text-xs tracking-[0.3em] text-cyan-400 uppercase">Event.Chat / Registrierung</span>
                    </div>
                    <h1 className="text-5xl font-semibold tracking-tighter text-zinc-50 leading-none mb-4">
                        Konto<br />anlegen.
                    </h1>
                    <p className="text-zinc-400 max-w-md leading-relaxed">
                        Mit einem gültigen Einladungscode registrieren Sie sich in Sekunden für den Event-Chat.
                    </p>
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-sm fade-up">
                    <Link to="/login" className="flex items-center gap-1 text-zinc-400 hover:text-cyan-400 text-sm mb-8" data-testid="back-to-login">
                        <ArrowLeft className="w-4 h-4" /> Zurück zum Login
                    </Link>

                    <div className="font-mono text-xs tracking-widest text-zinc-500 uppercase mb-2">
                        / Selbstregistrierung
                    </div>
                    <h2 className="text-3xl tracking-tight font-semibold mb-8 text-zinc-50">Registrieren</h2>

                    <form onSubmit={submit} className="space-y-5">
                        <div>
                            <label className="block font-mono text-xs tracking-widest text-zinc-500 uppercase mb-2">Einladungscode</label>
                            <div className="relative">
                                <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input
                                    type="text" required
                                    data-testid="register-code-input"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                                    onBlur={() => checkCode(code)}
                                    placeholder="EVT-XXXX-XXXX"
                                    className="w-full pl-10 pr-3 py-2.5 bg-zinc-900 border border-zinc-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none rounded-sm text-zinc-100 text-sm font-mono uppercase"
                                />
                            </div>
                            {checking && (
                                <div className="mt-2 font-mono text-[10px] text-zinc-500 uppercase tracking-widest">prüfe…</div>
                            )}
                            {codeError && (
                                <div className="mt-2 border border-red-500/30 bg-red-500/10 text-red-400 text-xs px-2 py-1 rounded-sm font-mono" data-testid="register-code-error">
                                    {codeError}
                                </div>
                            )}
                            {inviteMeta && (
                                <div className="mt-2 border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs px-2 py-1 rounded-sm font-mono flex items-center justify-between" data-testid="register-code-ok">
                                    <span>Code gültig · Rolle: {inviteMeta.role.toUpperCase()}</span>
                                    {inviteMeta.is_customer && <span className="text-amber-400">KUNDE</span>}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block font-mono text-xs tracking-widest text-zinc-500 uppercase mb-2">Name</label>
                            <div className="relative">
                                <User2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input
                                    required
                                    data-testid="register-name-input"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Vor- und Nachname"
                                    className="w-full pl-10 pr-3 py-2.5 bg-zinc-900 border border-zinc-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none rounded-sm text-zinc-100 text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block font-mono text-xs tracking-widest text-zinc-500 uppercase mb-2">E-Mail</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input
                                    type="email" required
                                    data-testid="register-email-input"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="ihre@email.local"
                                    className="w-full pl-10 pr-3 py-2.5 bg-zinc-900 border border-zinc-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none rounded-sm text-zinc-100 text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block font-mono text-xs tracking-widest text-zinc-500 uppercase mb-2">Passwort (min. 6 Zeichen)</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input
                                    type="password" required minLength={6}
                                    data-testid="register-password-input"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-10 pr-3 py-2.5 bg-zinc-900 border border-zinc-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none rounded-sm text-zinc-100 text-sm"
                                />
                            </div>
                        </div>

                        {error && (
                            <div data-testid="register-error" className="border border-red-500/30 bg-red-500/10 text-red-400 text-sm px-3 py-2 rounded-sm font-mono">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !inviteMeta}
                            data-testid="register-submit-button"
                            className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-zinc-950 font-medium py-2.5 rounded-sm transition-colors tracking-tight"
                        >
                            {loading ? "Registriere…" : "Konto anlegen →"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
