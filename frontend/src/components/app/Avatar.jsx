import { UserCircle2 } from "lucide-react";

// Deterministic color from a string
function colorFromString(str) {
    let hash = 0;
    for (let i = 0; i < (str || "").length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    const palette = [
        "#06b6d4", "#0ea5e9", "#8b5cf6", "#ec4899",
        "#f59e0b", "#10b981", "#f43f5e", "#a855f7",
        "#22d3ee", "#84cc16",
    ];
    return palette[Math.abs(hash) % palette.length];
}

function initials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

const SIZE_CLASSES = {
    xs: "w-6 h-6 text-[10px]",
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-16 h-16 text-lg",
    xl: "w-24 h-24 text-2xl",
};

export function Avatar({ user, size = "md", className = "", showTooltip = false }) {
    const sizeCls = SIZE_CLASSES[size] || SIZE_CLASSES.md;
    const url = user?.avatar_upload_id
        ? `${process.env.REACT_APP_BACKEND_URL}/api/avatars/${user.avatar_upload_id}`
        : null;

    if (url) {
        return (
            <img
                src={url}
                alt={user?.name || ""}
                title={showTooltip ? user?.name : undefined}
                className={`${sizeCls} rounded-full object-cover border border-zinc-800 ${className}`}
            />
        );
    }
    if (!user?.name) {
        return (
            <div className={`${sizeCls} rounded-full bg-zinc-800 border border-zinc-700 text-zinc-500 flex items-center justify-center ${className}`}>
                <UserCircle2 className="w-1/2 h-1/2" />
            </div>
        );
    }
    return (
        <div
            title={showTooltip ? user.name : undefined}
            style={{ backgroundColor: colorFromString(user.name) }}
            className={`${sizeCls} rounded-full border border-zinc-800 text-zinc-950 font-semibold flex items-center justify-center ${className}`}
        >
            {initials(user.name)}
        </div>
    );
}

export default Avatar;
