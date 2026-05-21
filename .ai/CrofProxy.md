**Crof.ai** (crof.ai) is a low-cost AI inference provider offering access to various open-source LLMs via an **OpenAI-compatible API**. It also provides an **Anthropic proxy/compatible endpoint**.

### Key Features
- **Very cheap pricing** — Free/pay-as-you-go tier + low monthly plans (e.g., $5 Hobby plan for 500 daily requests).
- OpenAI-compatible endpoint: `https://crof.ai/v1` (or `/v2` in some docs).
- **Anthropic-compatible endpoint**: `https://anthropic.nahcrof.com` — This lets you use tools/clients built for Anthropic’s API (like Claude Code, Claude Desktop, or any `/v1/messages` client) with Crof.ai’s hosted models.

### How to Use the Anthropic Proxy
Use this base URL for Anthropic-format requests:

```bash
base_url: https://anthropic.nahcrof.com
```

Example endpoint: `https://anthropic.nahcrof.com/v1/messages`

It supports common parameters like `max_tokens`, `temperature`, etc. You’ll need an API key from Crof.ai (sign up at crof.ai).

This is useful if you want to run cheaper OSS models (or specific hosted models) through apps that expect Anthropic’s API format.

**Website**: [https://crof.ai/](https://crof.ai/)  
**Docs**: Check their site or the GitHub repo (nahcrof-code/crofAI) for full examples and model list.

Note: As with many cheap inference providers, performance and uptime can vary depending on load. Some users report it works well for the price but can have occasional slowdowns.

## Mike integration

Mike routes CrofAI models through the **Anthropic proxy** using the existing Claude adapter (`backend/src/lib/llm/claude.ts`):

- Env: `CROFAI_API_KEY` (server-wide) or per-user key in **Account > Models & API Keys**
- Proxy base URL: `CROFAI_ANTHROPIC_BASE_URL` (defaults to `https://anthropic.nahcrof.com`)
- Provider id: `crofai`

Curated models exposed in the UI:

| Tier | Model IDs |
|------|-----------|
| Main chat | `deepseek-v4-pro`, `kimi-k2.6` |
| Tabular / mid | `glm-4.7-flash`, `qwen3.5-9b` |
| Title / low | `qwen3.5-9b` |

Apply `backend/migrations/001_add_crofai_provider.sql` on existing Supabase databases so per-user CrofAI keys can be stored.