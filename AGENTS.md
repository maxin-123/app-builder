<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- All business math lives in `src/lib/profitVelocityEngine.ts` (user-owned; never edit). Components only call its functions and render results — why: one source of truth for Profit Velocity.
- Database rows become the engine `Model` only in `src/lib/modelAdapter.ts` — why: one place to change when the schema changes.
- The constraint is always a machine group; machines only supply capacity — why: core modelling rule from the product owner.
- Company isolation, role checks, scenario locks, last-admin protection and audit logging are enforced in Postgres (RLS + triggers), not just the UI — why: the UI is not a security boundary.
- Signed-in pages live under `src/routes/_authenticated/` (client-only); shell = sidebar + top bar in that layout — why: session is in browser storage.
- tsconfig keeps `strict` but disables exactOptionalPropertyTypes / noUncheckedIndexedAccess / noImplicitReturns / noPropertyAccessFromIndexSignature — why: they clashed with generated types and recharts.
