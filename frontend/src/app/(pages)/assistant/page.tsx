"use client";

import { useRouter } from "next/navigation";
import { useAssistantChat } from "@/app/hooks/useAssistantChat";
import { useVowelChatSession } from "@/app/hooks/useVowelChatSession";
import { InitialView } from "@/app/components/assistant/InitialView";
import { ChatView } from "@/app/components/assistant/ChatView";
import type { MikeMessage } from "@/app/components/shared/types";

export default function AssistantPage() {
    const router = useRouter();
    const {
        messages,
        isResponseLoading,
        handleChat,
        handleNewChat,
        cancel,
        chatId,
    } = useAssistantChat();

    useVowelChatSession({
        kind: "assistant",
        chatId: chatId ?? null,
        messages,
        documents: [],
        isResponseLoading,
    });

    async function handleInitialSubmit(message: MikeMessage) {
        const chatId = await handleNewChat(message);
        if (chatId) router.push(`/assistant/chat/${chatId}`);
    }

    if (messages.length === 0) {
        return (
            <InitialView
                onSubmit={(message) => void handleInitialSubmit(message)}
            />
        );
    }

    return (
        <ChatView
            messages={messages}
            isResponseLoading={isResponseLoading}
            handleChat={handleChat}
            cancel={cancel}
        />
    );
}
