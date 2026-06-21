# AGENTS.md

## Stack

Tauri 2 + Vue 3.5 + TypeScript 5.6 + Vite 6 + Pinia 3. Desktop notepad app with SQLite storage. All UI text is Chinese (zh-CN).

## Commands

| Task | Command |
|------|---------|
| Install deps | `pnpm install` |
| Dev (full Tauri app) | `pnpm tauri dev` |
| Typecheck only | `vue-tsc --noEmit` |
| Build frontend | `pnpm build` (runs typecheck + vite build) |
| Build installer | `pnpm tauri build` |

There are **no lint, format, or test scripts**. No ESLint, Prettier, or test framework is configured. Typechecking via `vue-tsc --noEmit` is the only static check — run it before declaring changes complete.

## Architecture

- **Frontend**: `src/` — Vue 3 SFCs, Pinia store, Vue Router (hash history)
- **Rust backend**: `src-tauri/src/lib.rs` — minimal; only `get_app_version` and `backup_data` commands. System tray setup lives here.
- **Database**: `src/utils/db.ts` — single SQLite file (`desktop-notepad.db`) via `@tauri-apps/plugin-sql`. Tables created on first call to `getDb()`. Schema migrations are try/catch `ALTER TABLE` statements at the end of `initTables()`.
- **Pages**: `src/pages/{Dashboard,WorkTask,WechatEditor,AiSearch,Login,My,Settings}/` — each is a lazy-loaded route
- **Utilities**: `src/utils/` — `ai.ts` (streaming chat with retry), `db.ts` (all DB access), `editor.ts` (Markdown→WeChat HTML), `task.ts` (task helpers)

## Key patterns

- **Auth**: SHA-256 hashed passwords stored in SQLite. Session persisted via `localStorage.currentUserId`. Auth guard in `App.vue` redirects to `/login`.
- **AI providers**: DeepSeek, SiliconFlow, OpenRouter — provider config stored in `localStorage`. CSP in `tauri.conf.json` whitelists their API domains; adding a new provider requires updating CSP.
- **highlight.js**: Tree-shaken — only ~20 languages registered in `src/utils/editor.ts`. Add new languages there, not via bulk import.
- **WeChat editor**: Uses `juice` to inline CSS for WeChat compatibility. Themes defined as raw CSS strings in `editor.ts`.
- **CSP**: Defined in `src-tauri/tauri.conf.json` under `app.security.csp`. Must match any new `fetch` targets.

## Rust backend notes

- Cargo.toml version (`0.2.0`) is behind package.json version (`0.3.0`) — keep this in mind when updating versions.
- Crate name is `desktop_notepad_lib` (underscored). Only two Tauri commands exist; most logic lives in the frontend.
- Tray icon uses Chinese labels ("退出", "显示主窗口").

## CI

GitHub Actions (`.github/workflows/build.yml`) builds on tag push (`v*`). Targets: macOS (aarch64 + x86_64), Windows (x86_64), Ubuntu (x86_64). Creates a draft GitHub release.
