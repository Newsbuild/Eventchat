// Lightweight notifications: desktop + sound + tab title

let audioCtx = null;
function getCtx() {
    if (audioCtx) return audioCtx;
    try {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        audioCtx = new Ctor();
        return audioCtx;
    } catch {
        return null;
    }
}

export function playMessageBeep() {
    const ctx = getCtx();
    if (!ctx) return;
    try {
        // resume if suspended (autoplay policy)
        if (ctx.state === "suspended") ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain).connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
        osc.start();
        osc.stop(ctx.currentTime + 0.32);
    } catch (err) {
        // Sound is best-effort; surface unexpected failures in dev only.
        if (process.env.NODE_ENV !== "production") {
            console.warn("playMessageBeep failed:", err);
        }
    }
}

export async function ensureNotificationPermission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    try {
        const result = await Notification.requestPermission();
        return result === "granted";
    } catch (err) {
        if (process.env.NODE_ENV !== "production") {
            console.warn("Notification permission request failed:", err);
        }
        return false;
    }
}

export function showDesktopNotification(title, body, onClick) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try {
        const n = new Notification(title, {
            body,
            icon: "/favicon.ico",
            tag: "event-chat",
            silent: true, // we play our own sound
        });
        if (onClick) {
            n.onclick = () => {
                window.focus();
                onClick();
                n.close();
            };
        }
        setTimeout(() => n.close(), 6000);
    } catch (err) {
        if (process.env.NODE_ENV !== "production") {
            console.warn("showDesktopNotification failed:", err);
        }
    }
}

export function setTabUnreadCount(count) {
    const base = "Lokaler Event-Chat";
    document.title = count > 0 ? `(${count > 99 ? "99+" : count}) ${base}` : base;
}
