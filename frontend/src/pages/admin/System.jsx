import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Cpu, Database, Globe, HardDrive } from "lucide-react";

const HEALTH_POLL_MS = 3000;

function formatUptime(seconds) {
    if (seconds == null) return "—";
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function formatBytes(bytes) {
    if (bytes == null) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function StatusBadge({ status }) {
    const map = {
        ok: { color: "bg-emerald-400", label: "ONLINE", text: "text-emerald-400" },
        down: { color: "bg-red-400", label: "OFFLINE", text: "text-red-400" },
        degraded: { color: "bg-amber-400", label: "DEGRADIERT", text: "text-amber-400" },
    };
    const s = map[status] || map.down;
    return (
        <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${s.color} pulse-dot`} />
            <span className={`font-mono text-xs tracking-widest uppercase ${s.text}`}>{s.label}</span>
        </div>
    );
}

function Card({ icon: Icon, title, status, children, testId }) {
    return (
        <div className="bg-zinc-900 border border-zinc-800 p-5" data-testid={testId}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-zinc-500" />
                    <span className="font-mono text-xs tracking-widest uppercase text-zinc-400">{title}</span>
                </div>
                {status && <StatusBadge status={status} />}
            </div>
            <div className="space-y-1.5 font-mono text-xs">{children}</div>
        </div>
    );
}

function Row({ label, value, valueClass = "text-zinc-200" }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500">{label}</span>
            <span className={valueClass}>{value ?? "—"}</span>
        </div>
    );
}

export default function AdminSystem() {
    const [health, setHealth] = useState(null);
    const [frontendStatus, setFrontendStatus] = useState("ok");
    const [publicPingMs, setPublicPingMs] = useState(null);
    const [tick, setTick] = useState(0);

    const load = useCallback(async () => {
        try {
            const t0 = performance.now();
            const { data } = await api.get("/admin/health");
            setHealth(data);
            setPublicPingMs(performance.now() - t0);
            setFrontendStatus("ok");
        } catch {
            setHealth((h) => (h ? { ...h, backend: { ...h.backend, status: "down" } } : {
                backend: { status: "down" }, database: { status: "down" },
            }));
        }
    }, []);

    useEffect(() => {
        load();
        const iv = setInterval(() => { load(); setTick((t) => t + 1); }, HEALTH_POLL_MS);
        return () => clearInterval(iv);
    }, [load]);

    return (
        <div className="p-8">
            <div className="mb-8">
                <div className="font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">/ Infrastruktur</div>
                <h1 className="text-3xl tracking-tighter font-semibold mt-1">Systemstatus</h1>
                <p className="text-sm text-zinc-500 mt-1">Live-Gesundheitscheck aller Komponenten (Aktualisierung alle 3 Sekunden).</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card icon={Globe} title="Frontend" status={frontendStatus} testId="status-frontend">
                    <Row label="Status" value="Live" valueClass="text-emerald-400" />
                    <Row label="URL" value={window.location.origin} valueClass="text-zinc-400 truncate" />
                    <Row label="User-Agent" value={navigator.userAgent.split(" ").slice(-2).join(" ").slice(0, 30)} valueClass="text-zinc-400" />
                </Card>

                <Card icon={Cpu} title="Backend" status={health?.backend?.status || "down"} testId="status-backend">
                    <Row label="Uptime" value={formatUptime(health?.backend?.uptime_seconds)} />
                    <Row label="Ping" value={publicPingMs != null ? `${publicPingMs.toFixed(0)} ms` : "—"} valueClass="text-cyan-400" />
                    <Row label="Check-Dauer" value={health?.check_duration_ms != null ? `${health.check_duration_ms} ms` : "—"} />
                </Card>

                <Card icon={Database} title="Datenbank" status={health?.database?.status || "down"} testId="status-database">
                    <Row label="Engine" value="MongoDB" />
                    <Row label="Latenz" value={health?.database?.latency_ms != null ? `${health.database.latency_ms} ms` : "—"} valueClass="text-cyan-400" />
                    <Row label="Zustand" value={health?.database?.status === "ok" ? "erreichbar" : "nicht erreichbar"} valueClass={health?.database?.status === "ok" ? "text-emerald-400" : "text-red-400"} />
                </Card>

                <Card icon={HardDrive} title="Speicher" testId="status-storage">
                    <Row label="Uploads" value={health?.storage?.upload_files ?? "—"} />
                    <Row label="Größe" value={formatBytes(health?.storage?.upload_bytes)} />
                    <Row label="Pfad" value="/app/backend/uploads" valueClass="text-zinc-500 truncate" />
                </Card>
            </div>

            <div className="mt-8 bg-zinc-900 border border-zinc-800 p-5 font-mono text-xs" data-testid="status-log">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-cyan-400 rounded-full pulse-dot" />
                        <span className="text-cyan-400 tracking-widest uppercase">Live-Log</span>
                    </div>
                    <span className="text-zinc-600">Tick #{tick}</span>
                </div>
                <div className="space-y-1 text-zinc-500">
                    <div>[{health?.checked_at || "—"}] health check ok=<span className="text-emerald-400">{health?.backend?.status === "ok" ? "true" : "false"}</span> db=<span className="text-emerald-400">{health?.database?.status === "ok" ? "true" : "false"}</span></div>
                    <div>[browser] navigator.online = <span className={navigator.onLine ? "text-emerald-400" : "text-red-400"}>{String(navigator.onLine)}</span></div>
                </div>
            </div>
        </div>
    );
}
