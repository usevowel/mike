"use client";

import { useEffect } from "react";
import type { MikeDocument, MikeMessage } from "@/app/components/shared/types";
import {
    clearVowelChatSession,
    registerVowelChatSession,
    toVowelDocumentSummaries,
    type VowelChatSession,
} from "@/lib/vowel.chatBridge";

export interface UseVowelChatSessionOptions {
    kind: VowelChatSession["kind"];
    chatId: string | null;
    projectId?: string | null;
    chatTitle?: string | null;
    projectName?: string | null;
    messages: MikeMessage[];
    documents?: MikeDocument[];
    isResponseLoading: boolean;
}

/**
 * Registers the current assistant chat with the Vowel bridge while the page is mounted.
 * Enables voice discussion of history/documents; a live draft in ChatInput updates during discussion, then Send on approval.
 */
export function useVowelChatSession({
    kind,
    chatId,
    projectId,
    chatTitle,
    projectName,
    messages,
    documents = [],
    isResponseLoading,
}: UseVowelChatSessionOptions): void {
    useEffect(() => {
        registerVowelChatSession({
            kind,
            chatId,
            projectId: projectId ?? null,
            chatTitle: chatTitle ?? null,
            projectName: projectName ?? null,
            messages,
            documents: toVowelDocumentSummaries(documents),
            isResponseLoading,
        });

        return () => {
            clearVowelChatSession();
        };
    }, [
        kind,
        chatId,
        projectId,
        chatTitle,
        projectName,
        messages,
        documents,
        isResponseLoading,
    ]);
}
