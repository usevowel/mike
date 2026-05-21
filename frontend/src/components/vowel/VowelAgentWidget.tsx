"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { VowelAgent, useVowel } from "@vowel.to/client/react";

/**
 * Floating voice agent UI, portaled to document.body so parent overflow-hidden
 * layouts do not clip the fixed-position mic button.
 */
export function VowelAgentWidget() {
    const { client } = useVowel();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || !client) return null;

    return createPortal(
        <VowelAgent
            position="bottom-right"
            enableFloatingCursor={false}
        />,
        document.body,
    );
}
