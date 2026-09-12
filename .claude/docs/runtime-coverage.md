# Runtime coverage and v2 roadmap

Cloud9 chat (this Zola fork) fronts two agent runtimes through one UI:

- **Hermes Agent** (main agent) via `HERMES_API_URL` `/v1/responses` SSE, one Hermes session per chat (`X-Hermes-Session-Key`). Admin data via the Hermes dashboard API (`HERMES_DASHBOARD_URL`).
- **OpenCode** (coder agent) via `OPENCODE_URL` server API (`/session`, `/session/:id/prompt_async`, `/event` SSE), one OpenCode session per chat (`chats.runtime_session_id`).

Both runtimes are mapped to the same AI SDK UI message stream (`lib/hermes/stream.ts`, `lib/opencode/stream.ts`). Tool names are normalised to one vocabulary (`normalizeOpencodeTool`), so the chat components contain no runtime-specific code. The only runtime-aware places are the `runtime` field per agent in `NEXT_PUBLIC_AGENTS`, the dispatch in `app/api/chat/route.ts`, and the two mappers.

## Current coverage (v1)

### Hermes

Covered: streaming text, reasoning, every tool call with arguments and results (terminal, execute_code, process_manage, read/write/patch/search files, web_search, web_extract, browser_*, vision_analyze, image_generate, delegate_task, memory, todo_list, skills, cronjob_manage, session_search), per-request model override, session continuity, image inputs as data URLs. Admin pages: skills list, scheduled jobs, connectors (MCP servers), kanban data.

Not covered: slash commands (Hermes exposes them only through gateway platforms and the TUI JSON-RPC `slash.exec`), profile switching (needs `gateway.multiplex_profiles` or a second API instance), interactive approval prompts for risky commands (the API server has no approval channel; its configured auto policy applies), skill create/edit, memory browser, MoA presets, voice, non-image attachments. `GET /v1/skills` is broken upstream at the pinned commit; skills come from the dashboard API instead.

### OpenCode

Covered: session create/list, streaming text and reasoning, tools bash/read/write/edit/glob/grep/list/webfetch/todowrite/todoread/task rendered with the terminal/file/diff/web/summary bodies, model selection, session diff endpoint, file read/list/find for the right-hand workspace pane, health in the agents API.

Not covered: agent mode selection (build / plan; the prompt body accepts `agent`), permission prompts (`permission.updated` events are never answered, so a session that asks would hang), subagent child sessions (their events carry another `sessionID` and are filtered out, so child tool calls are invisible), abort (the UI stop button only cancels the fetch; OpenCode keeps running), project list and sessions per project, revert/undo, share, compaction status.

## v2 goal

Support the maximum of both runtimes' features that their HTTP APIs expose, without patching Hermes or OpenCode themselves (CLOUD9 `CLAUDE.md` §2b). Anything that needs an upstream change is tracked as an upstream issue, not reimplemented here.

### Cheapest wins (items 1 to 4 shipped 2026-09-12 in 63197e5; item 5 open)

1. **OpenCode abort on stop.** When the user presses stop on an OpenCode chat, call `POST /session/:id/abort` in addition to cancelling the fetch. Server route: `app/api/cloud9/opencode/abort`.
2. **OpenCode agent mode picker.** Expose `build` / `plan` (from `GET /agent`) next to the model picker for OpenCode chats and pass `agent` in the prompt body.
3. **OpenCode permission replies.** Handle `permission.updated` in the mapper: emit a custom data part the UI renders as an approve / deny card, and reply through `POST /session/:id/permissions/:permissionID`. Verified on the VM (2026-09-12): every agent allows `*` but asks for `doom_loop` and `external_directory`, so a session that trips either one hangs today. Interim mitigation live since cloud9 e4a2f41: both set to `allow` in `hermes/opencode.json`. The approve/deny card is built; switch the two rules back to `ask` after one real permission prompt has been answered through the card.
4. **Per-chat agent.** Store `agent_id` on `chats` so reopening an OpenCode chat shows OpenCode in the header instead of the user's default preference.
5. **Subagent visibility.** Track child sessions of the current session (from `session.created` events with `parentID`) and render their tool calls nested under the `task` row.

### Hermes items

- Reasoning stream: Hermes exposes no model reasoning to HTTP clients at the pinned commit (verified 2026-09-13 in the source, not just the API docs). `/v1/responses` and `/v1/chat/completions` wire the progress callback as a no-op; `/api/sessions/{id}/chat/stream` does emit `tool.progress` with `tool_name: "_thinking"`, but that payload is the assistant's interstitial text between tool calls (`agent/turn_response_intake.py::_relay_thinking`, first 500 chars), not provider `reasoning_content`, which Hermes keeps internal (`plugins.stream_reasoning_deltas` only feeds plugin hooks). Track upstream; OpenCode chats already stream reasoning. Reasoning *effort* is supported today: the chat box "Thinking" picker sends `model_options.reasoning.effort` to Hermes and `variant` to OpenCode (variants `low|medium|high` declared per model in `hermes/opencode.json`, live after the next cloud9 deploy).

- Slash commands: Settings > Commands tab (user- or agent-created). Execution path to decide with upstream: either the gateway `slash.exec` JSON-RPC, or plain prompt expansion on the client. Prompt expansion needs no upstream change and is the v2 default.
- Profiles: runtime picker lists one entry per Hermes profile when `gateway.multiplex_profiles` is enabled; each maps to its own API port.
- Skills: create and edit through the dashboard API when it exposes write endpoints; view stays as is.
- Approvals: depends on an upstream approval channel in the API server. Track upstream; do not fake it client-side.
- Attachments: documents via `web_extract`-style upload to a VM path, then a file reference in the prompt.

### Projects (v2, agent-fed)

A project is a repository the coder works on. Source of truth is OpenCode `GET /project` synced with the Hermes kanban board. The Projects page lists projects, sessions per project (`GET /session?directory=`), and opens the workspace pane rooted at the project directory. No manual project creation in the UI.

### Shipped 2026-09-13 (local commits, deploy pending)

- Tool UI (`components/tool-ui/`, MIT, shadcn registry `@tool-ui`): `Terminal` for terminal/execute_code/process_manage, `CodeBlock` for write_file, `Plan` for todo_list. Everything else stays on the AI Elements `Tool` card with the existing per-tool bodies. Not adopted: `CodeDiff` (its `@pierre/diffs` renderer mounted an empty shadow root under Turbopack after the theme fixes; patch keeps the prompt-kit diff view). Revisit when tool-ui ships a Turbopack-verified release.
- Step group: everything before the final answer (interstitial text, reasoning, tool calls, permission cards) folds into one collapsible header with the turn duration (`app/components/chat/work-group.tsx`).
- `data-turn` part per assistant message (`lib/turn.ts`): duration + usage from `response.completed` (Hermes) / assistant `message.updated.tokens` (OpenCode). Feeds the AI Elements `Context` meter in the chat box; window size from LiteLLM `/model/info` via `/api/cloud9/context-window`, fallback 128k.
- Generated chat titles after the first exchange (`lib/title.ts`): LiteLLM `deepseek-v4-flash`, falling back to one non-streaming Hermes turn when LiteLLM is unreachable (dev laptop).

### Not planned

Custom board, custom approval flows that bypass the runtime's own policy, tunnels from the laptop, re-implementing anything the runtime already ships.
