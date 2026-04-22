import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
    MessageSquare, Users, Plus, LogOut, Send, Paperclip, Flag,
    EyeOff, Settings, UserCircle2, Shield, Search, X, Hash, User2
} from "lucide-react";

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;
const POLL_INTERVAL_MS = 3000;

function renderLastMessagePreview(last) {
    if (!last) return "Keine Nachrichten";
    if (last.deleted) return <em className="text-zinc-600">(gelöscht)</em>;
    if (last.type === "system") return <em className="text-zinc-600">{last.text}</em>;
    return last.text || "Keine Nachrichten";
}

function relTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < SECONDS_PER_MINUTE) return "gerade eben";
    if (diff < SECONDS_PER_HOUR) return `${Math.floor(diff / SECONDS_PER_MINUTE)} Min.`;
    if (diff < SECONDS_PER_DAY) return `${Math.floor(diff / SECONDS_PER_HOUR)} Std.`;
    return d.toLocaleDateString("de-DE");
}

function clockTime(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPage() {
    const { chatId } = useParams();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [chats, setChats] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [draft, setDraft] = useState("");
    const [polling, setPolling] = useState(false);
    const [search, setSearch] = useState("");
    const [showNewGroup, setShowNewGroup] = useState(false);
    const [showNewDirect, setShowNewDirect] = useState(false);
    const [showMembers, setShowMembers] = useState(false);
    const fileInputRef = useRef(null);
    const messagesEndRef = useRef(null);
    const listRef = useRef(null);

    const loadChats = useCallback(async () => {
        setPolling(true);
        try {
            const [chatsRes, usersRes] = await Promise.all([api.get("/chats"), api.get("/users")]);
            setChats(chatsRes.data);
            setAllUsers(usersRes.data);
        } catch (err) {
            console.error("Failed to load chats:", err);
        }
        finally { setTimeout(() => setPolling(false), 300); }
    }, []);

    const loadChat = useCallback(async (id) => {
        if (!id) return;
        try {
            const [chatRes, msgRes] = await Promise.all([
                api.get(`/chats/${id}`),
                api.get(`/chats/${id}/messages?limit=100`),
            ]);
            setSelectedChat(chatRes.data);
            setMessages(msgRes.data);
        } catch (err) {
            console.error("Failed to load chat:", err);
            toast.error("Chat konnte nicht geladen werden");
        }
    }, []);

    useEffect(() => { loadChats(); }, [loadChats]);
    useEffect(() => { if (chatId) loadChat(chatId); else setSelectedChat(null); }, [chatId, loadChat]);

    // polling
    useEffect(() => {
        const iv = setInterval(() => {
            loadChats();
            if (chatId) loadChat(chatId);
        }, POLL_INTERVAL_MS);
        return () => clearInterval(iv);
    }, [chatId, loadChats, loadChat]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length, chatId]);

    const sendMessage = async (e) => {
        e?.preventDefault();
        if (!draft.trim() || !chatId) return;
        const text = draft;
        setDraft("");
        try {
            await api.post(`/chats/${chatId}/messages`, { text });
            loadChat(chatId);
        } catch { toast.error("Nachricht konnte nicht gesendet werden"); setDraft(text); }
    };

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !chatId) return;
        const fd = new FormData();
        fd.append("chat_id", chatId);
        fd.append("file", file);
        try {
            const up = await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
            await api.post(`/chats/${chatId}/messages`, { upload_id: up.data.id, text: `📎 ${file.name}` });
            loadChat(chatId);
            toast.success("Datei hochgeladen");
        } catch { toast.error("Upload fehlgeschlagen"); }
        e.target.value = "";
    };

    const hideChat = async (id) => {
        await api.post(`/chats/${id}/hide`);
        toast.success("Chat ausgeblendet");
        if (chatId === id) navigate("/chat");
        loadChats();
    };

    const reportMessage = async (msgId) => {
        const reason = window.prompt("Meldungsgrund eingeben:");
        if (!reason) return;
        try {
            await api.post(`/messages/${msgId}/report`, { reason });
            toast.success("Nachricht gemeldet");
        } catch { toast.error("Meldung fehlgeschlagen"); }
    };

    const startDirect = async (otherId) => {
        const { data } = await api.post("/chats/direct", { user_id: otherId });
        setShowNewDirect(false);
        navigate(`/chat/${data.id}`);
        loadChats();
    };

    const createGroup = async (name, memberIds) => {
        if (!name.trim()) return;
        const { data } = await api.post("/chats/group", { name, member_ids: memberIds });
        setShowNewGroup(false);
        navigate(`/chat/${data.id}`);
        loadChats();
    };

    const filteredChats = chats.filter((c) =>
        (c.display_name || "").toLowerCase().includes(search.toLowerCase())
    );

    const isGroupAdmin = selectedChat?.type === "group" && selectedChat?.admin_ids?.includes(user.id);

    return (
        <div className="h-screen grid grid-cols-1 md:grid-cols-[320px_1fr] lg:grid-cols-[360px_1fr] bg-zinc-950 text-zinc-100 overflow-hidden">
            {/* Sidebar */}
            <aside className="border-r border-zinc-800 flex flex-col h-screen overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
                    <div>
                        <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-400 uppercase">/ Event.Chat</div>
                        <div className="text-sm font-medium mt-0.5 flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${polling ? "bg-cyan-400 pulse-dot" : "bg-cyan-500/40"}`} />
                            <span className="text-zinc-300">{user?.name}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {user?.role === "admin" && (
                            <button
                                onClick={() => navigate("/admin")}
                                data-testid="go-admin-button"
                                title="Admin"
                                className="p-2 hover:bg-zinc-900 rounded-sm text-zinc-400 hover:text-amber-400 transition-colors"
                            >
                                <Shield className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={() => navigate("/profil")}
                            data-testid="go-profile-button"
                            title="Profil"
                            className="p-2 hover:bg-zinc-900 rounded-sm text-zinc-400 hover:text-cyan-400 transition-colors"
                        >
                            <UserCircle2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={logout}
                            data-testid="logout-button"
                            title="Abmelden"
                            className="p-2 hover:bg-zinc-900 rounded-sm text-zinc-400 hover:text-red-400 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Search + Actions */}
                <div className="p-4 border-b border-zinc-800 space-y-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                        <input
                            data-testid="chat-search-input"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Suchen..."
                            className="w-full pl-8 pr-3 py-2 bg-zinc-900 border border-zinc-800 focus:border-cyan-500 outline-none rounded-sm text-xs text-zinc-200"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setShowNewDirect(true)}
                            data-testid="new-direct-button"
                            className="flex items-center justify-center gap-1 px-2 py-2 border border-zinc-800 hover:border-cyan-500 hover:text-cyan-400 rounded-sm text-xs text-zinc-300 transition-colors"
                        >
                            <User2 className="w-3.5 h-3.5" /> Direkt
                        </button>
                        <button
                            onClick={() => setShowNewGroup(true)}
                            data-testid="new-group-button"
                            className="flex items-center justify-center gap-1 px-2 py-2 border border-zinc-800 hover:border-cyan-500 hover:text-cyan-400 rounded-sm text-xs text-zinc-300 transition-colors"
                        >
                            <Users className="w-3.5 h-3.5" /> Gruppe
                        </button>
                    </div>
                </div>

                {/* Chat list */}
                <div className="flex-1 overflow-y-auto" ref={listRef} data-testid="chat-list">
                    {filteredChats.length === 0 && (
                        <div className="p-6 text-center text-zinc-600 text-xs font-mono uppercase tracking-widest">
                            Keine Chats
                        </div>
                    )}
                    {filteredChats.map((c) => (
                        <div
                            key={c.id}
                            onClick={() => navigate(`/chat/${c.id}`)}
                            data-testid={`chat-item-${c.id}`}
                            className={`group cursor-pointer border-b border-zinc-900 px-4 py-3 hover:bg-zinc-900/60 transition-colors ${chatId === c.id ? "bg-zinc-900 border-l-2 border-l-cyan-500" : ""}`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    {c.type === "group"
                                        ? <Hash className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                                        : <User2 className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />}
                                    <span className="text-sm font-medium text-zinc-100 truncate">{c.display_name}</span>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); hideChat(c.id); }}
                                    data-testid={`hide-chat-${c.id}`}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition-opacity"
                                    title="Ausblenden"
                                >
                                    <EyeOff className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <div className="mt-1 flex items-center justify-between">
                                <span className="text-xs text-zinc-500 truncate max-w-[220px]">
                                    {c.last_message?.deleted ? <em className="text-zinc-600">(gelöscht)</em> :
                                        c.last_message?.type === "system" ? <em className="text-zinc-600">{c.last_message.text}</em> :
                                        (c.last_message?.text || "Keine Nachrichten")}
                                </span>
                                <span className="font-mono text-[10px] text-zinc-600 flex-shrink-0">
                                    {relTime(c.last_message?.created_at || c.created_at)}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main chat panel */}
            <main className="h-screen flex flex-col overflow-hidden relative">
                {!selectedChat && (
                    <div className="flex-1 flex items-center justify-center p-12">
                        <div className="text-center max-w-sm">
                            <MessageSquare className="w-10 h-10 mx-auto text-zinc-700 mb-4" />
                            <div className="font-mono text-[10px] tracking-[0.3em] text-zinc-600 uppercase mb-2">
                                / Kein Chat ausgewählt
                            </div>
                            <h3 className="text-xl text-zinc-300 mb-2">Wählen Sie einen Chat</h3>
                            <p className="text-sm text-zinc-500">
                                Oder starten Sie eine neue Unterhaltung über die Schaltflächen links.
                            </p>
                        </div>
                    </div>
                )}

                {selectedChat && (
                    <>
                        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                            <div>
                                <div className="font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">
                                    / {selectedChat.type === "group" ? "Gruppenchat" : "Direktchat"}
                                </div>
                                <h2 className="text-lg font-medium text-zinc-100 flex items-center gap-2">
                                    {selectedChat.type === "group" ? <Hash className="w-4 h-4 text-cyan-400" /> : <User2 className="w-4 h-4 text-zinc-400" />}
                                    {selectedChat.display_name}
                                </h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">
                                    {selectedChat.members?.length ?? selectedChat.member_ids?.length} MITGL.
                                </span>
                                {selectedChat.type === "group" && (
                                    <button
                                        onClick={() => setShowMembers(true)}
                                        data-testid="manage-members-button"
                                        className="p-2 hover:bg-zinc-900 rounded-sm text-zinc-400 hover:text-cyan-400 transition-colors"
                                        title="Mitglieder"
                                    >
                                        <Settings className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-3" data-testid="messages-container">
                            {messages.length === 0 && (
                                <div className="text-center text-zinc-600 text-xs font-mono uppercase tracking-widest py-12">
                                    Noch keine Nachrichten
                                </div>
                            )}
                            {messages.map((m) => {
                                if (m.type === "system") {
                                    return (
                                        <div key={m.id} className="text-center">
                                            <span className="inline-block font-mono text-[10px] tracking-widest uppercase text-zinc-600 border border-zinc-800 bg-zinc-900/50 px-2 py-1 rounded-sm">
                                                {m.text}
                                            </span>
                                        </div>
                                    );
                                }
                                const mine = m.sender_id === user.id;
                                const sender = selectedChat.members?.find((u) => u.id === m.sender_id);
                                return (
                                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} group fade-up`} data-testid={`message-${m.id}`}>
                                        <div className={`max-w-[70%] ${mine ? "order-2" : "order-1"}`}>
                                            {!mine && selectedChat.type === "group" && (
                                                <div className="text-xs text-zinc-500 mb-1 px-1">{sender?.name || "Unbekannt"}</div>
                                            )}
                                            <div className={`relative px-4 py-2.5 border ${mine
                                                ? "bg-cyan-500/10 border-cyan-500/30 text-zinc-100 rounded-l-lg rounded-tr-lg rounded-br-sm"
                                                : "bg-zinc-900 border-zinc-800 text-zinc-200 rounded-r-lg rounded-tl-lg rounded-bl-sm"
                                            }`}>
                                                {m.deleted ? (
                                                    <em className="text-zinc-500 text-sm">Nachricht entfernt durch Moderation</em>
                                                ) : (
                                                    <>
                                                        <div className="text-sm whitespace-pre-wrap break-words">{m.text}</div>
                                                        {m.upload_id && (
                                                            <a
                                                                href={`${process.env.REACT_APP_BACKEND_URL}/api/uploads/${m.upload_id}/download`}
                                                                target="_blank" rel="noreferrer"
                                                                className="mt-1 inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline"
                                                            >
                                                                <Paperclip className="w-3 h-3" /> Anhang öffnen
                                                            </a>
                                                        )}
                                                    </>
                                                )}
                                                <div className="flex items-center justify-between gap-3 mt-1">
                                                    <span className="font-mono text-[10px] text-zinc-500">{clockTime(m.created_at)}</span>
                                                    {!mine && !m.deleted && (
                                                        <button
                                                            onClick={() => reportMessage(m.id)}
                                                            data-testid={`report-${m.id}`}
                                                            className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-amber-400 transition-opacity"
                                                            title="Melden"
                                                        >
                                                            <Flag className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={sendMessage} className="p-4 border-t border-zinc-800 flex items-center gap-2">
                            <input type="file" ref={fileInputRef} onChange={handleFile} className="hidden" data-testid="file-input" />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                data-testid="attach-file-button"
                                className="p-2.5 border border-zinc-800 hover:border-cyan-500 hover:text-cyan-400 text-zinc-400 rounded-sm transition-colors"
                            >
                                <Paperclip className="w-4 h-4" />
                            </button>
                            <input
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                data-testid="message-input"
                                placeholder="Nachricht eingeben..."
                                className="flex-1 px-3 py-2.5 bg-zinc-900 border border-zinc-800 focus:border-cyan-500 outline-none rounded-sm text-sm text-zinc-100"
                            />
                            <button
                                type="submit"
                                data-testid="send-message-button"
                                disabled={!draft.trim()}
                                className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-zinc-950 font-medium rounded-sm flex items-center gap-1 transition-colors"
                            >
                                <Send className="w-4 h-4" /> Senden
                            </button>
                        </form>
                    </>
                )}

                {showNewDirect && (
                    <PickerModal
                        title="Neuer Direktchat"
                        users={allUsers.filter((u) => u.id !== user.id)}
                        multiple={false}
                        onClose={() => setShowNewDirect(false)}
                        onConfirm={(ids) => startDirect(ids[0])}
                    />
                )}
                {showNewGroup && (
                    <NewGroupModal
                        users={allUsers.filter((u) => u.id !== user.id)}
                        onClose={() => setShowNewGroup(false)}
                        onCreate={createGroup}
                    />
                )}
                {showMembers && selectedChat && (
                    <ManageMembersModal
                        chat={selectedChat}
                        allUsers={allUsers}
                        canAdmin={isGroupAdmin}
                        onClose={() => { setShowMembers(false); loadChat(chatId); }}
                    />
                )}
            </main>
        </div>
    );
}

function PickerModal({ title, users, multiple, onClose, onConfirm }) {
    const [selected, setSelected] = useState([]);
    const toggle = (id) => {
        if (multiple) setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
        else setSelected([id]);
    };
    return (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" data-testid="picker-modal">
            <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-sm">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <h3 className="font-medium text-zinc-100">{title}</h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200" data-testid="picker-close"><X className="w-4 h-4" /></button>
                </div>
                <div className="max-h-72 overflow-y-auto">
                    {users.map((u) => (
                        <label key={u.id} className="flex items-center gap-3 p-3 border-b border-zinc-900 hover:bg-zinc-900 cursor-pointer">
                            <input
                                type={multiple ? "checkbox" : "radio"}
                                checked={selected.includes(u.id)}
                                onChange={() => toggle(u.id)}
                                data-testid={`pick-${u.id}`}
                                className="accent-cyan-500"
                            />
                            <div className="flex-1">
                                <div className="text-sm text-zinc-100">{u.name}</div>
                                <div className="font-mono text-xs text-zinc-500">{u.email}</div>
                            </div>
                            {u.is_customer && <span className="font-mono text-[10px] text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-sm">KUNDE</span>}
                        </label>
                    ))}
                </div>
                <div className="p-4 flex justify-end gap-2 border-t border-zinc-800">
                    <button onClick={onClose} className="px-4 py-2 border border-zinc-700 text-zinc-300 rounded-sm hover:border-zinc-500 text-sm">Abbrechen</button>
                    <button
                        onClick={() => selected.length && onConfirm(selected)}
                        disabled={selected.length === 0}
                        data-testid="picker-confirm"
                        className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-zinc-950 font-medium rounded-sm text-sm"
                    >
                        Bestätigen
                    </button>
                </div>
            </div>
        </div>
    );
}

function NewGroupModal({ users, onClose, onCreate }) {
    const [name, setName] = useState("");
    const [selected, setSelected] = useState([]);
    const toggle = (id) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
    return (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" data-testid="new-group-modal">
            <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-sm">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <h3 className="font-medium text-zinc-100">Neue Gruppe</h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-4 space-y-3">
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        data-testid="group-name-input"
                        placeholder="Gruppenname"
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 focus:border-cyan-500 outline-none rounded-sm text-sm text-zinc-100"
                    />
                    <div className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">Mitglieder auswählen</div>
                    <div className="max-h-48 overflow-y-auto border border-zinc-800 rounded-sm">
                        {users.map((u) => (
                            <label key={u.id} className="flex items-center gap-3 p-2 border-b border-zinc-900 hover:bg-zinc-900 cursor-pointer last:border-0">
                                <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} data-testid={`group-pick-${u.id}`} className="accent-cyan-500" />
                                <span className="text-sm text-zinc-100">{u.name}</span>
                                <span className="font-mono text-xs text-zinc-500 ml-auto">{u.email}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div className="p-4 flex justify-end gap-2 border-t border-zinc-800">
                    <button onClick={onClose} className="px-4 py-2 border border-zinc-700 text-zinc-300 rounded-sm text-sm">Abbrechen</button>
                    <button
                        onClick={() => onCreate(name, selected)}
                        disabled={!name.trim()}
                        data-testid="create-group-button"
                        className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-zinc-950 font-medium rounded-sm text-sm flex items-center gap-1"
                    >
                        <Plus className="w-3.5 h-3.5" /> Erstellen
                    </button>
                </div>
            </div>
        </div>
    );
}

function ManageMembersModal({ chat, allUsers, canAdmin, onClose }) {
    const [adding, setAdding] = useState([]);
    const memberIds = new Set(chat.member_ids || []);
    const adminIds = new Set(chat.admin_ids || []);
    const nonMembers = allUsers.filter((u) => !memberIds.has(u.id));
    const [name, setName] = useState(chat.name || "");

    const rename = async () => {
        await api.patch(`/groups/${chat.id}`, { name });
        toast.success("Gruppe umbenannt");
        onClose();
    };
    const addMembers = async () => {
        if (!adding.length) return;
        await api.post(`/groups/${chat.id}/members`, { user_ids: adding });
        toast.success("Hinzugefügt");
        setAdding([]);
        onClose();
    };
    const remove = async (uid) => {
        await api.delete(`/groups/${chat.id}/members/${uid}`);
        toast.success("Entfernt");
        onClose();
    };
    const setAdmin = async (uid, makeAdmin) => {
        await api.post(`/groups/${chat.id}/admin`, { user_id: uid, is_admin: makeAdmin });
        toast.success(makeAdmin ? "Zum Admin ernannt" : "Admin entfernt");
        onClose();
    };

    return (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" data-testid="manage-members-modal">
            <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-sm">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <h3 className="font-medium text-zinc-100">Mitglieder verwalten</h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                    {canAdmin && (
                        <div className="space-y-2">
                            <div className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">Gruppenname</div>
                            <div className="flex gap-2">
                                <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 focus:border-cyan-500 outline-none rounded-sm text-sm" />
                                <button onClick={rename} className="px-3 py-2 border border-zinc-700 hover:border-cyan-500 text-zinc-300 rounded-sm text-xs">Umbenennen</button>
                            </div>
                        </div>
                    )}
                    <div>
                        <div className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-2">Mitglieder ({chat.members?.length})</div>
                        <div className="border border-zinc-800 rounded-sm">
                            {chat.members?.map((m) => (
                                <div key={m.id} className="flex items-center gap-2 p-2 border-b border-zinc-900 last:border-0">
                                    <span className="text-sm text-zinc-100 flex-1">{m.name}</span>
                                    {adminIds.has(m.id) && <span className="font-mono text-[10px] text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded-sm">ADMIN</span>}
                                    {canAdmin && (
                                        <>
                                            <button
                                                onClick={() => setAdmin(m.id, !adminIds.has(m.id))}
                                                className="text-xs text-zinc-400 hover:text-cyan-400 px-2"
                                            >
                                                {adminIds.has(m.id) ? "Entziehen" : "Admin"}
                                            </button>
                                            <button onClick={() => remove(m.id)} className="text-xs text-red-400 hover:text-red-300 px-2">Entfernen</button>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    {canAdmin && nonMembers.length > 0 && (
                        <div>
                            <div className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-2">Hinzufügen</div>
                            <div className="border border-zinc-800 rounded-sm max-h-40 overflow-y-auto">
                                {nonMembers.map((u) => (
                                    <label key={u.id} className="flex items-center gap-2 p-2 border-b border-zinc-900 last:border-0 hover:bg-zinc-900 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={adding.includes(u.id)}
                                            onChange={() => setAdding((s) => s.includes(u.id) ? s.filter((x) => x !== u.id) : [...s, u.id])}
                                            className="accent-cyan-500"
                                        />
                                        <span className="text-sm text-zinc-100">{u.name}</span>
                                        <span className="font-mono text-xs text-zinc-500 ml-auto">{u.email}</span>
                                    </label>
                                ))}
                            </div>
                            <button onClick={addMembers} disabled={!adding.length} className="mt-2 px-3 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-zinc-950 text-xs rounded-sm">
                                Ausgewählte hinzufügen
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
