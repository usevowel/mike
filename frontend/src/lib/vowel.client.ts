import {
    Vowel,
    createNextJSAdapters,
    type ProviderType,
    type VowelRoute,
    type VowelVoiceConfig,
} from "@vowel.to/client";
/** Minimal Next.js App Router surface used for voice navigation. */
export interface VowelNextRouter {
    push(href: string, options?: { scroll?: boolean }): void;
}
import { MIKE_VOWEL_ROUTES } from "@/lib/vowel.routes";
import { listChats } from "@/app/lib/mikeApi";
import {
    buildVowelAssistantContextSlice,
    documentIdsFromMessages,
    getVowelChatInput,
    getVowelChatSession,
    summarizeMessagesForVowel,
    type VowelAssistantContextSlice,
    type VowelDocumentSummary,
    type VowelMessageSummary,
} from "@/lib/vowel.chatBridge";

const SUPPORTED_PROVIDERS = ["vowel-prime", "grok", "openai"] as const;

type MikeVowelProvider = (typeof SUPPORTED_PROVIDERS)[number];

const VOWEL_PRIME_ENVIRONMENTS = [
    "local",
    "testing",
    "dev",
    "staging",
    "production",
    "billing-test",
] as const;

type VowelPrimeEnvironment = (typeof VOWEL_PRIME_ENVIRONMENTS)[number];

/** Mike default voice stack: vowel-prime testing + Groq Whisper STT + Grok TTS. */
const MIKE_VOICE_PROVIDER: MikeVowelProvider = "vowel-prime";
const MIKE_VOICE_PRIME_ENV: VowelPrimeEnvironment = "testing";

/**
 * Resolves voice provider override from env, else Mike default (vowel-prime).
 * Set NEXT_PUBLIC_VOWEL_PROVIDER to override (grok | openai | vowel-prime).
 */
function resolveVowelProvider(): MikeVowelProvider {
    const fromEnv = process.env.NEXT_PUBLIC_VOWEL_PROVIDER?.trim();
    if (
        fromEnv &&
        SUPPORTED_PROVIDERS.includes(fromEnv as MikeVowelProvider)
    ) {
        return fromEnv as MikeVowelProvider;
    }
    return MIKE_VOICE_PROVIDER;
}

function resolveVowelPrimeEnvironment(): VowelPrimeEnvironment {
    const fromEnv = process.env.NEXT_PUBLIC_VOWEL_PRIME_ENV?.trim();
    if (VOWEL_PRIME_ENVIRONMENTS.includes(fromEnv as VowelPrimeEnvironment)) {
        return fromEnv as VowelPrimeEnvironment;
    }
    return MIKE_VOICE_PRIME_ENV;
}

/**
 * Builds hidden voice config for the token issuer.
 * vowel-prime uses testing prime, Groq Whisper STT, and Grok TTS (dev overrides on VowelVoiceConfig).
 */
function buildHiddenVoiceConfig(
    provider: MikeVowelProvider,
): VowelVoiceConfig {
    const config: VowelVoiceConfig = {
        provider: provider as ProviderType,
        turnDetection: {
            mode: "server_vad",
            serverVAD: {
                createResponse: true,
                interruptResponse: true,
            },
        },
    };

    if (provider === "vowel-prime") {
        config.vowelPrimeConfig = {
            environment: resolveVowelPrimeEnvironment(),
        };
        config.stt = { provider: "groq-whisper" };
        config.tts = { provider: "grok" };
    }

    return config;
}

/** Route slice included in Vowel context for the voice agent. */
export interface VowelRouteContext {
    pathname: string;
    pathnameLabel: string;
    search: string;
}

/** User/auth slice included in Vowel context. */
export interface VowelUserContext {
    isAuthenticated: boolean;
    email: string | null;
    displayName: string | null;
    organisation: string | null;
    tier: string | null;
}

/** Re-exported for consumers building extended context. */
export type {
    VowelAssistantContextSlice,
    VowelDocumentSummary,
    VowelMessageSummary,
};

/** Full application context synced to the Vowel agent. */
export interface VowelMikeContext {
    route: VowelRouteContext;
    user: VowelUserContext;
    assistant: VowelAssistantContextSlice;
}

let vowelInstance: Vowel | null = null;

type VowelChangeListener = (client: Vowel | null) => void;
const vowelChangeListeners = new Set<VowelChangeListener>();

/** Latest context builder — updated by VowelStateSync on each render. */
let contextGetter: () => VowelMikeContext = () => ({
    route: { pathname: "/", pathnameLabel: "Home", search: "" },
    user: {
        isAuthenticated: false,
        email: null,
        displayName: null,
        organisation: null,
        tier: null,
    },
    assistant: buildVowelAssistantContextSlice(),
});

/**
 * Registers the function used to read live app context for sync and getAppState.
 */
export function setVowelContextGetter(getter: () => VowelMikeContext): void {
    contextGetter = getter;
}

/**
 * Builds the Vowel context object from the current getter (or optional override).
 */
export function buildVowelContext(
    override?: Partial<VowelMikeContext>,
): VowelMikeContext {
    const base = contextGetter();
    return {
        route: override?.route ?? base.route,
        user: override?.user ?? base.user,
        assistant: override?.assistant ?? buildVowelAssistantContextSlice(),
    };
}

/**
 * Human-readable label for a pathname (used in voice context and greetings).
 */
export function getPathnameLabel(pathname: string): string {
    if (pathname === "/assistant") return "Assistant";
    if (pathname.startsWith("/assistant/chat/")) return "Assistant chat";
    if (pathname === "/projects") return "Projects";
    if (/^\/projects\/[^/]+$/.test(pathname)) return "Project";
    if (pathname.endsWith("/assistant") && pathname.includes("/projects/"))
        return "Project assistant";
    if (pathname.includes("/assistant/chat/")) return "Project assistant chat";
    if (pathname.endsWith("/tabular-reviews") && pathname.includes("/projects/"))
        return "Project tabular reviews";
    if (pathname.includes("/tabular-reviews/")) return "Tabular review";
    if (pathname === "/tabular-reviews") return "Tabular reviews";
    if (pathname === "/workflows") return "Workflows";
    if (pathname.startsWith("/workflows/")) return "Workflow";
    if (pathname === "/account") return "Account";
    if (pathname === "/account/models") return "Model settings";
    if (pathname === "/login") return "Login";
    if (pathname === "/signup") return "Sign up";
    return pathname || "Home";
}

function createVowelClient(
    appId: string,
    router: VowelNextRouter,
    routes: VowelRoute[] = MIKE_VOWEL_ROUTES,
): Vowel {
    const { navigationAdapter } = createNextJSAdapters(router, {
        routes,
        enableAutomation: false,
    });

    const provider = resolveVowelProvider();
    const voiceConfig = buildHiddenVoiceConfig(provider);
    const initialGreetingPrompt = `Welcome the user to Mike, the AI legal platform. Briefly personalize using their name and current page from getAppState(), then ask how you can help with documents, projects, tabular reviews, or workflows.`;

    const vowel = new Vowel({
        appId,
        language: "en-US",
        initialGreetingPrompt,
        _voiceConfig: voiceConfig,
        instructions: `You are Mike's voice assistant — an AI legal platform for document analysis, contract review, tabular reviews, and workflows.

## CRITICAL: Write to App Store, Not DOM
When performing actions, use registered actions that modify application state. Do NOT manipulate the DOM. The React UI updates from state changes.

## CRITICAL: Always Refer to Context for Information
Before answering or acting, check the <context> section for the current route, user, assistant chat state, and app state.

## CRITICAL: Initial Greeting (First Thing You Say)
When you first speak in a new session, call getAppState() FIRST. Context may not be synced yet — getAppState() returns the current route and user reliably.

## Assistant chat (voice + text)
When the user is on an assistant or project-assistant chat page:
- Use getChatContext for message history summaries and available documents.
- Keep a **running draft** in the chat input: call updateChatDraft whenever the proposed prompt changes, including early in the discussion. Update in real time as the user talks — do not wait until the end.
- Do NOT read the draft aloud. Do NOT announce chat-box updates (never say "I put it in the box", "take a look", etc.). The user watches the input change while you discuss normally.
- When they approve what they see ("send it", "go ahead", "looks good"), call sendChatPrompt with confirmed: true. That presses Send — same as the user clicking the button.
- If canUpdateDraft or canSendDraft is false, explain briefly and wait.

## Navigation
Use voice navigation ("go to projects", "open assistant") — the navigation adapter handles routing. Do not register custom navigation actions.

## Mike Application Areas
- **Assistant** (/assistant): General legal AI chat
- **Projects** (/projects): Matter workspaces with documents and reviews
- **Tabular Review** (/tabular-reviews): Spreadsheet-style contract analysis
- **Workflows** (/workflows): Reusable legal automation workflows
- **Account** (/account): Profile, credits, and API keys

## Available Actions
- getAppState: Route, user, and high-level assistant slice. Call FIRST for the initial greeting.
- getChatContext: Active chat history, documents, draft in input, and send readiness.
- listRecentChats: Sidebar recent chats (titles and ids).
- updateChatDraft: Update the live draft in the chat input as discussion progresses (call often; silent UI update).
- sendChatPrompt: Press Send when the user approves the draft (confirmed must be true).

Help users navigate Mike, discuss their legal work, and send finalized prompts into the chat.`,
        navigationAdapter,
        floatingCursor: { enabled: false },
        borderGlow: {
            enabled: true,
            color: "rgba(99, 102, 241, 0.5)",
            intensity: 30,
            pulse: true,
        },
        _caption: {
            enabled: true,
            position: "top-center",
            maxWidth: "600px",
            showRole: true,
            showOnMobile: false,
        },
    });

    const primeEnv = voiceConfig.vowelPrimeConfig?.environment;
    console.log(
        `✅ Vowel client configured (provider: ${provider}${primeEnv ? `, prime: ${primeEnv}` : ""}, stt: ${voiceConfig.stt?.provider ?? "default"}, tts: ${voiceConfig.tts?.provider ?? "default"})`,
    );

    registerCustomActions(vowel);
    return vowel;
}

function registerCustomActions(vowel: Vowel): void {
    vowel.registerAction(
        "getAppState",
        {
            description:
                "Get current route, user profile, and assistant chat summary. CALL THIS FIRST when starting a new session for the initial greeting — context may not be populated yet.",
            parameters: {},
        },
        async () => {
            const state = buildVowelContext();
            return { success: true, ...state };
        },
    );

    vowel.registerAction(
        "getChatContext",
        {
            description:
                "Get the active Mike assistant chat: recent message summaries, available documents, chat/project ids, and whether a prompt can be submitted. Use before discussing history or drafting a prompt.",
            parameters: {},
        },
        async () => {
            const session = getVowelChatSession();
            if (!session) {
                return {
                    success: true,
                    active: false,
                    message:
                        "No assistant chat is open. Navigate to Assistant or a project assistant chat first.",
                };
            }

            const mentionedDocIds = documentIdsFromMessages(session.messages);
            return {
                success: true,
                active: true,
                kind: session.kind,
                chatId: session.chatId,
                chatTitle: session.chatTitle ?? null,
                projectId: session.projectId ?? null,
                projectName: session.projectName ?? null,
                messageCount: session.messages.length,
                recentMessages: summarizeMessagesForVowel(session.messages, 20),
                documents: session.documents,
                mentionedDocumentIds: mentionedDocIds,
                isResponseLoading: session.isResponseLoading,
                draft: getVowelChatInput()?.getDraft() ?? {
                    text: "",
                    hasContent: false,
                },
                canUpdateDraft:
                    !session.isResponseLoading &&
                    !!session.chatId &&
                    !!getVowelChatInput(),
                canSendDraft:
                    !session.isResponseLoading &&
                    !!session.chatId &&
                    !!getVowelChatInput()?.getDraft().hasContent,
            };
        },
    );

    vowel.registerAction(
        "listRecentChats",
        {
            description:
                "List the user's recent assistant chats (id, title, project_id) from the sidebar.",
            parameters: {
                limit: {
                    type: "number",
                    description: "Max chats to return (default 10, max 20)",
                    optional: true,
                },
            },
        },
        async ({ limit }: { limit?: number }) => {
            const capped = Math.min(Math.max(limit ?? 10, 1), 20);
            try {
                const chats = await listChats({ limit: capped });
                return {
                    success: true,
                    chats: chats.map((c) => ({
                        id: c.id,
                        title: c.title,
                        project_id: c.project_id,
                        created_at: c.created_at,
                    })),
                };
            } catch (err) {
                return {
                    success: false,
                    error:
                        err instanceof Error
                            ? err.message
                            : "Failed to load chats",
                };
            }
        },
    );

    vowel.registerAction(
        "updateChatDraft",
        {
            description:
                "Update the live draft in the Mike chat input. Call repeatedly as the voice discussion refines the prompt — the user sees it change in real time. Do not announce this action or read the draft aloud. Omit documentIds to leave attachments unchanged.",
            parameters: {
                prompt: {
                    type: "string",
                    description:
                        "Full current draft text for the chat input (replace previous draft)",
                },
                documentIds: {
                    type: "array",
                    description:
                        "Optional document UUIDs to attach; omit to keep existing attachments",
                    optional: true,
                },
            },
        },
        async ({
            prompt,
            documentIds,
        }: {
            prompt: string;
            documentIds?: string[];
        }) => {
            const text = typeof prompt === "string" ? prompt : "";
            if (!text.trim()) {
                return { success: false, error: "prompt cannot be empty" };
            }

            const session = getVowelChatSession();
            if (!session) {
                return {
                    success: false,
                    error: "No active assistant chat. Open a chat page first.",
                };
            }
            if (session.isResponseLoading) {
                return {
                    success: false,
                    error: "Mike is still responding. Wait before updating the draft.",
                };
            }

            const input = getVowelChatInput();
            if (!input) {
                return {
                    success: false,
                    error: "Chat input is not available on this page.",
                };
            }

            const ids = Array.isArray(documentIds)
                ? documentIds.filter((id): id is string => typeof id === "string")
                : undefined;
            input.setDraft(text, ids?.length ? ids : undefined);

            return { success: true };
        },
    );

    vowel.registerAction(
        "sendChatPrompt",
        {
            description:
                "Press Send to submit the current chat input draft. ONLY when the user verbally approves (e.g. says send it).",
            parameters: {
                confirmed: {
                    type: "boolean",
                    description:
                        "Must be true — user explicitly approved sending the draft",
                },
            },
        },
        async ({ confirmed }: { confirmed: boolean }) => {
            if (!confirmed) {
                return {
                    success: false,
                    error:
                        "User has not confirmed. Wait until they say to send it, then call with confirmed: true.",
                };
            }

            const session = getVowelChatSession();
            if (!session) {
                return {
                    success: false,
                    error: "No active assistant chat. Open a chat page first.",
                };
            }
            if (session.isResponseLoading) {
                return {
                    success: false,
                    error: "Mike is still responding. Wait for the current reply to finish.",
                };
            }

            const input = getVowelChatInput();
            if (!input) {
                return {
                    success: false,
                    error: "Chat input is not available on this page.",
                };
            }

            const draft = input.getDraft();
            if (!draft.hasContent) {
                return {
                    success: false,
                    error: "Chat input is empty. Call updateChatDraft first.",
                };
            }

            const result = input.sendDraft();
            if (!result.success) {
                return { success: false, error: result.error ?? "Send failed" };
            }

            return {
                success: true,
                message: "Sent — Mike is responding.",
                chatId: session.chatId,
            };
        },
    );
}

/**
 * Creates the Vowel client after app mount. Call from a client component with the Next.js router.
 * Pushes initial context immediately so the agent has state before the first turn.
 */
export function setAppId(appId: string, router: VowelNextRouter): void {
    if (!appId) return;
    try {
        vowelInstance = createVowelClient(appId, router);
        vowelInstance.updateContext(
            buildVowelContext() as unknown as Record<string, unknown>,
        );
        vowelChangeListeners.forEach((listener) => listener(vowelInstance));
        console.log("✅ Vowel client initialized");
    } catch (err) {
        console.error("Vowel init failed (app continues without voice):", err);
        vowelInstance = null;
        vowelChangeListeners.forEach((listener) => listener(null));
    }
}

/** Returns the current Vowel client instance, if initialized. */
export function getVowel(): Vowel | null {
    return vowelInstance;
}

/**
 * Subscribes to Vowel client creation or teardown. Syncs immediately if a client already exists.
 */
export function subscribeToVowelChanges(
    listener: VowelChangeListener,
): () => void {
    vowelChangeListeners.add(listener);
    if (vowelInstance) {
        listener(vowelInstance);
    }
    return () => {
        vowelChangeListeners.delete(listener);
    };
}

export type VowelClientType = Vowel | null;
