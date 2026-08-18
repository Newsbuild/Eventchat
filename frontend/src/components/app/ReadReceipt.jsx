import { Check, CheckCheck } from "lucide-react";

// WhatsApp-style read receipt indicator
// Only render for OWN, non-system, non-deleted messages
export function ReadReceipt({ message, own }) {
    if (!own || message?.type === "system" || message?.deleted) return null;
    const total = message.total_recipients ?? 0;
    const read = message.read_by_count ?? 0;

    // No recipients (empty group?) — treat as delivered
    if (total === 0) return <Check className="w-3.5 h-3.5 text-zinc-500" data-testid="receipt-delivered" />;

    // All recipients have read
    if (read >= total) {
        return <CheckCheck className="w-3.5 h-3.5 text-cyan-400" data-testid="receipt-read-all" />;
    }
    // At least one, but not all
    if (read > 0) {
        return <CheckCheck className="w-3.5 h-3.5 text-zinc-400" data-testid="receipt-read-partial" />;
    }
    // Delivered but nobody read yet
    return <Check className="w-3.5 h-3.5 text-zinc-500" data-testid="receipt-delivered" />;
}

export default ReadReceipt;
