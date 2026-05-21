import type { VowelRoute } from "@vowel.to/client";

/**
 * Routes exposed to the Vowel voice agent for smart navigation.
 * Dynamic segments use bracket notation understood by the navigation adapter.
 */
export const MIKE_VOWEL_ROUTES: VowelRoute[] = [
    { path: "/assistant", description: "AI legal assistant — general chat" },
    {
        path: "/assistant/chat/[id]",
        description: "Open a specific assistant chat thread",
    },
    { path: "/projects", description: "List of legal projects" },
    {
        path: "/projects/[id]",
        description: "Project overview — documents and reviews",
    },
    {
        path: "/projects/[id]/assistant",
        description: "Project-scoped AI assistant",
    },
    {
        path: "/projects/[id]/assistant/chat/[chatId]",
        description: "Project assistant chat thread",
    },
    {
        path: "/projects/[id]/tabular-reviews",
        description: "Tabular reviews for a project",
    },
    {
        path: "/projects/[id]/tabular-reviews/[reviewId]",
        description: "Single tabular review spreadsheet",
    },
    { path: "/tabular-reviews", description: "All tabular reviews" },
    {
        path: "/tabular-reviews/[id]",
        description: "Standalone tabular review",
    },
    { path: "/workflows", description: "Workflow library" },
    { path: "/workflows/[id]", description: "View or run a workflow" },
    { path: "/account", description: "Account settings and profile" },
    { path: "/account/models", description: "Model and API key preferences" },
];
