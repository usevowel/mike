"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { UserProfileProvider } from "@/contexts/UserProfileContext";
import { VowelIntegration } from "@/components/vowel/VowelIntegration";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <UserProfileProvider>
                <VowelIntegration>{children}</VowelIntegration>
            </UserProfileProvider>
        </AuthProvider>
    );
}
