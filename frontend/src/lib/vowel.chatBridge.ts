import type { MikeDocument, MikeMessage } from "@/app/components/shared/types";
import { ALLOWED_MODEL_IDS, DEFAULT_MODEL_ID } from "@/app/components/assistant/ModelToggle";

const MODEL_STORAGE_KEY = "mike.selectedModel";

/** Summary of a document exposed to the Vowel voice agent. */
export interface VowelDocumentSummary {
    id: string;
    filename: string;
    file_type?: string | null;
    status?: string;
}

/** Truncated message line for voice context (not full thread storage). */
export interface VowelMessageSummary {
    role: "user" | "assistant";
    contentPreview: string;
    attachedFiles?: string[];
}

/** Active assistant chat session registered from a chat page. */
export interface VowelChatSession {
    kind: "assistant" | "project_assistant";
    chatId: string | null;
    projectId?: string | null;
    chatTitle?: string | null;
    projectName?: string | null;
    messages: MikeMessage[];
    documents: VowelDocumentSummary[];
    isResponseLoading: boolean;
}

/** Imperative control of the visible chat input (registered by ChatInput). */
export interface VowelChatInputControl {
    /** Replaces the live running draft in the chat textarea. */
    setDraft: (text: string, documentIds?: string[]) => void;
    /** Presses Send — same as the user clicking the submit button. */
    sendDraft: () => { success: boolean; error?: string };
    /** Current textarea contents (for context sync). */
    getDraft: () => { text: string; hasContent: boolean };
}

/** Slice synced to Vowel context on each session update. */
export interface VowelAssistantContextSlice {
    active: boolean;
    kind?: VowelChatSession["kind"];
    chatId?: string | null;
    chatTitle?: string | null;
    projectId?: string | null;
    projectName?: string | null;
    messageCount: number;
    recentMessages: VowelMessageSummary[];
    documents: VowelDocumentSummary[];
    isResponseLoading: boolean;
    /** True when the chat input has text ready for the user to review. */
    hasDraftInInput: boolean;
    /** Draft preview for context (truncated). */
    draftPreview: string | null;
    canUpdateDraft: boolean;
    canSendDraft: boolean;
}

type SessionListener = () => void;

let activeSession: VowelChatSession | null = null;
let chatInputControl: VowelChatInputControl | null = null;
const sessionListeners = new Set<SessionListener>();

/**
 * Notifies React subscribers (e.g. VowelStateSync) that the active chat session changed.
 */
export function notifyVowelChatSessionChanged(): void {
    sessionListeners.forEach((listener) => listener());
}

/**
 * Subscribes to active chat session updates.
 */
export function subscribeVowelChatSession(
    listener: SessionListener,
): () => void {
    sessionListeners.add(listener);
    return () => {
        sessionListeners.delete(listener);
    };
}

/** Returns the currently registered chat session, if any. */
export function getVowelChatSession(): VowelChatSession | null {
    return activeSession;
}

/** Registers the active chat page for Vowel context and actions. */
export function registerVowelChatSession(session: VowelChatSession): void {
    activeSession = session;
    notifyVowelChatSessionChanged();
}

/** Clears the active session when leaving a chat page. */
export function clearVowelChatSession(): void {
    if (!activeSession) return;
    activeSession = null;
    notifyVowelChatSessionChanged();
}

/** Registers the mounted ChatInput so Vowel can type drafts and press Send. */
export function registerVowelChatInput(control: VowelChatInputControl): void {
    chatInputControl = control;
    notifyVowelChatSessionChanged();
}

/** Clears chat input control when ChatInput unmounts. */
export function clearVowelChatInput(): void {
    if (!chatInputControl) return;
    chatInputControl = null;
    notifyVowelChatSessionChanged();
}

/** Returns the live chat input control, if a chat page is open. */
export function getVowelChatInput(): VowelChatInputControl | null {
    return chatInputControl;
}

/** Maps project/standalone documents to Vowel summaries. */
export function toVowelDocumentSummaries(
    docs: MikeDocument[],
): VowelDocumentSummary[] {
    return docs.map((d) => ({
        id: d.id,
        filename: d.filename,
        file_type: d.file_type,
        status: d.status,
    }));
}

/**
 * Extracts display text from a message (user plain text or assistant content events).
 */
export function extractMessageText(message: MikeMessage, maxLen = 600): string {
    if (message.role === "user") {
        return message.content.trim().slice(0, maxLen);
    }

    const parts: string[] = [];
    if (message.content?.trim()) parts.push(message.content.trim());
    for (const ev of message.events ?? []) {
        if (ev.type === "content" && "text" in ev && ev.text?.trim()) {
            parts.push(ev.text.trim());
        }
    }
    const joined = parts.join("\n").trim();
    return joined.slice(0, maxLen);
}

/**
 * Builds recent message summaries for voice context (last N turns).
 */
export function summarizeMessagesForVowel(
    messages: MikeMessage[],
    maxMessages = 12,
): VowelMessageSummary[] {
    const slice = messages.slice(-maxMessages);
    return slice.map((m) => ({
        role: m.role,
        contentPreview: extractMessageText(m, 400),
        attachedFiles:
            m.files && m.files.length > 0
                ? m.files.map((f) => f.filename)
                : undefined,
    }));
}

/** Builds the assistant slice for Vowel context sync from the active session. */
export function buildVowelAssistantContextSlice(): VowelAssistantContextSlice {
    const session = activeSession;
    const draft = chatInputControl?.getDraft();
    const hasDraft = !!draft?.hasContent;
    const ready =
        !!session && !session.isResponseLoading && !!session.chatId;

    if (!session) {
        return {
            active: false,
            messageCount: 0,
            recentMessages: [],
            documents: [],
            isResponseLoading: false,
            hasDraftInInput: hasDraft,
            draftPreview: draft?.text
                ? draft.text.slice(0, 200)
                : null,
            canUpdateDraft: !!chatInputControl,
            canSendDraft: hasDraft && !!chatInputControl,
        };
    }

    return {
        active: true,
        kind: session.kind,
        chatId: session.chatId,
        chatTitle: session.chatTitle ?? null,
        projectId: session.projectId ?? null,
        projectName: session.projectName ?? null,
        messageCount: session.messages.length,
        recentMessages: summarizeMessagesForVowel(session.messages),
        documents: session.documents,
        isResponseLoading: session.isResponseLoading,
        hasDraftInInput: hasDraft,
        draftPreview: draft?.text ? draft.text.slice(0, 200) : null,
        canUpdateDraft: ready && !!chatInputControl,
        canSendDraft: ready && hasDraft && !!chatInputControl,
    };
}

/** Reads the user's selected model from localStorage (same key as ChatInput). */
export function getStoredSelectedModel(): string {
    if (typeof window === "undefined") return DEFAULT_MODEL_ID;
    const raw = window.localStorage.getItem(MODEL_STORAGE_KEY);
    if (raw && ALLOWED_MODEL_IDS.has(raw)) return raw;
    return DEFAULT_MODEL_ID;
}

/**
 * Document IDs mentioned in the thread (attachments + doc tool events).
 */
export function documentIdsFromMessages(messages: MikeMessage[]): string[] {
    const ids = new Set<string>();
    for (const m of messages) {
        for (const f of m.files ?? []) {
            if (f.document_id) ids.add(f.document_id);
        }
        for (const ev of m.events ?? []) {
            if (
                (ev.type === "doc_created" ||
                    ev.type === "doc_edited" ||
                    ev.type === "doc_read") &&
                "document_id" in ev &&
                typeof ev.document_id === "string"
            ) {
                ids.add(ev.document_id);
            }
        }
    }
    return [...ids];
}
