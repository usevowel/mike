"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { VowelProvider } from "@vowel.to/client/react";
import "@vowel.to/client/css";
import {
    getVowel,
    setAppId,
    subscribeToVowelChanges,
    type VowelClientType,
} from "@/lib/vowel.client";
import { VowelStateSync } from "@/components/vowel/VowelStateSync";
import { VowelAgentWidget } from "@/components/vowel/VowelAgentWidget";
import { VowelSessionErrorLogger } from "@/components/vowel/VowelSessionErrorLogger";

const VOWEL_APP_ID = process.env.NEXT_PUBLIC_VOWEL_APP_ID;

/** Routes where the floating voice agent should not appear. */
const VOWEL_HIDDEN_PATHS = new Set(["/", "/login", "/signup", "/support"]);

/**
 * Provides the Vowel client to the React tree and syncs app context to the agent.
 * Fails open when NEXT_PUBLIC_VOWEL_APP_ID is unset or init fails.
 */
export function VowelIntegration({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [vowel, setVowel] = useState<VowelClientType>(getVowel());

    useEffect(() => {
        const unsubscribe = subscribeToVowelChanges((client) => {
            setVowel(client);
        });
        if (VOWEL_APP_ID) {
            setAppId(VOWEL_APP_ID, router);
        }
        return unsubscribe;
    }, [router]);

    const showAgent =
        vowel !== null && !VOWEL_HIDDEN_PATHS.has(pathname);

    return (
        <VowelProvider client={vowel} floatingCursor={false}>
            {vowel ? (
                <Suspense fallback={null}>
                    <VowelStateSync />
                    <VowelSessionErrorLogger />
                </Suspense>
            ) : null}
            {children}
            {showAgent ? <VowelAgentWidget /> : null}
        </VowelProvider>
    );
}
