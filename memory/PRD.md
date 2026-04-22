# PRD — Lokaler Event-Chat

## Original Problem Statement
Ein webbasiertes Chat-System für eine einzelne Veranstaltung, lokal auf einem Event-Server gehostet, erreichbar über das lokale WLAN. Admins dürfen Nutzer/Gruppen verwalten, aber keine Chatinhalte mitlesen (nur Metadaten). Keine native App, keine E2E-Verschlüsselung, keine Sprachmemos, keine Lesebestätigungen. Löschen = nur Ausblenden.

## Stack
- Backend: FastAPI + Motor (MongoDB) + JWT + bcrypt + local filesystem uploads
- Frontend: React (CRA), TailwindCSS, Shadcn UI primitives, Sonner toasts, lucide-react icons
- Auth: JWT in httpOnly cookies (access 12h, refresh 7d)
- Realtime: HTTP-Polling every 3s (user choice)

## Implemented (Feb 2026)
- JWT Auth (login/logout/me), admin seeding, demo-user seeding
- Users CRUD (admin only)
- Chats: direct + group creation, listing with last-message metadata, hide chat
- Messages: send, list with pagination stub, system messages
- Groups: add/remove members, set/revoke group admin, rename
- Uploads: local FS storage, download via `/api/uploads/{id}/download`
- Reports + moderation: report message, admin resolve (delete or keep), moderation log
- Admin dashboard: system stats (users, active users, chats, messages, reports, uploads)
- Admin: users management, groups overview, files management, reports queue, system status
- Design: dark Swiss/Tech aesthetic (IBM Plex Sans + JetBrains Mono, cyan accent)
- Privacy guardrails: Admin-UI shows `[NUR METADATEN]` badges; message bodies only visible for REPORTED messages in moderation view

## User Personas
- **System-Admin** — verwaltet Nutzer, Gruppen, Dateien, Moderation; KEIN Einblick in Chats
- **Normaler Nutzer (intern oder Kunde)** — chattet direkt oder in Gruppen, kann Gruppen gründen, Mitglieder einladen (als Gruppenadmin), Nachrichten melden

## Backlog (Next)
- P1: Passwort-Reset Flow (E-Mail) — derzeit nur via Admin
- P1: Nutzer-Avatar / Farbindikatoren pro Nutzer
- P1: Nachrichten-Pagination (älter laden)
- P2: Nachrichten-Suche innerhalb eines Chats
- P2: Export der Moderations-Logs (CSV)
- P2: Reaktionen / Emojis
- P2: Datei-Vorschau (Bilder inline)
