"use client";

import { useEffect, useRef } from "react";
import { useVowel } from "@vowel.to/client/react";

/**
 * Logs full Vowel session errors to the console (includes raw WebSocket details).
 */
export function VowelSessionErrorLogger() {
    const { state } = useVowel();
    const lastErrorRef = useRef<string | null>(null);

    useEffect(() => {
        if (!state.error) return;
        const key = `${state.error.message}:${state.error.timestamp ?? ""}`;
        if (lastErrorRef.current === key) return;
        lastErrorRef.current = key;

        console.error("[Vowel] Session error:", state.error.message);
        if (state.error.details) {
            console.error("[Vowel] Error details:", state.error.details);
        }
        if (state.error.message.includes("Invalid event")) {
            const provider = process.env.NEXT_PUBLIC_VOWEL_PROVIDER?.trim();
            console.error(
                "[Vowel] Voice realtime event mismatch — common causes:",
                "1) NEXT_PUBLIC_VOWEL_PROVIDER does not match the provider configured for this app on vowel.to;",
                "2) grok/xAI API key missing or invalid in the vowel.to app settings;",
                "3) try removing NEXT_PUBLIC_VOWEL_PROVIDER to use the dashboard provider, or set openai if that is what the app uses.",
                provider ? `(current override: ${provider})` : "(no provider override — using dashboard)",
            );
        }
    }, [state.error]);

    return null;
}
