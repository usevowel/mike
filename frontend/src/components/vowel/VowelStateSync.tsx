"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSyncContext } from "@vowel.to/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { subscribeVowelChatSession } from "@/lib/vowel.chatBridge";
import {
    buildVowelContext,
    getPathnameLabel,
    setVowelContextGetter,
    type VowelMikeContext,
} from "@/lib/vowel.client";

/**
 * Keeps the Vowel agent context in sync with route, auth, and profile state.
 * Must render inside VowelProvider.
 */
export function VowelStateSync() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { user, isAuthenticated } = useAuth();
    const { profile } = useUserProfile();
    const [chatSessionVersion, setChatSessionVersion] = useState(0);

    useEffect(() => {
        return subscribeVowelChatSession(() => {
            setChatSessionVersion((v) => v + 1);
        });
    }, []);

    const context = useMemo((): VowelMikeContext => {
        const search = searchParams.toString();
        return buildVowelContext({
            route: {
                pathname,
                pathnameLabel: getPathnameLabel(pathname),
                search: search ? `?${search}` : "",
            },
            user: {
                isAuthenticated,
                email: user?.email ?? null,
                displayName: profile?.displayName ?? null,
                organisation: profile?.organisation ?? null,
                tier: profile?.tier ?? null,
            },
        });
    }, [
        pathname,
        searchParams,
        isAuthenticated,
        user?.email,
        profile?.displayName,
        profile?.organisation,
        profile?.tier,
        chatSessionVersion,
    ]);

    useEffect(() => {
        setVowelContextGetter(() => context);
    }, [context]);

    useSyncContext(context as unknown as Record<string, unknown>);
    return null;
}
