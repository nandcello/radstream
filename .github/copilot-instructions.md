# Copilot Instructions for `radstream`

## Project Overview
- **Stack:** Bun (JS runtime), React 19, TailwindCSS 4, no Vite/Node/NPM.
- **Entrypoint:** `src/index.tsx` (React app, Bun server, Tailwind integration).
- **Frontend:** React components in `src/`, styled with Tailwind. Main app: `App.tsx`.
- Install: `bun install`
- **Tailwind:** Uses `bun-plugin-tailwind` and `tailwindcss`.

## Key Conventions
- **Always use Bun:**
  - Use `bun` for scripts, builds, and running files (never `node`, `npm`, `vite`, etc.).
  - Bun auto-loads `.env` (do not use `dotenv`).
- **No Express/Vite:**
  - Use `Bun.serve()` for HTTP/WebSocket servers.
  - Use HTML imports for frontend (no Vite).
- **NEVER** run the dev server. The user has already one up and running.
- **NEVER** build the project.

## Patterns & Structure
- **React:** All UI logic/components in `src/`.
- **Styling:** Tailwind classes in JSX, config via `tailwind.config.js` (if present).
- **Build:** `build.ts` is the build script (see for custom logic).
- **No legacy Node APIs:** Use Bun's built-ins (e.g., `Bun.file`, `Bun.serve`).

## References
- See `README.md` for quickstart.
- Main app: `src/index.tsx`, `src/App.tsx`

---

**If unsure about a workflow, prefer Bun-native solutions and check for project-specific scripts in `package.json`.**
