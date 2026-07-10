# ADR 0001: Generate a static deploy tree from shared sources

- Status: accepted
- Date: 2026-07-10

## Context

The GitHub Pages site previously repeated its header, footer, styles, and data-rendering
logic across public HTML files. The repository also needs root-level HTML because it is
served directly from the branch rather than through a framework build host.

## Decision

Keep authoring sources in `site/pages/`, `site/styles/`, and `data/`. A dependency-free
Node build in `tools/site/` generates the root HTML files and deploy stylesheet. The
generated files stay committed so branch-based GitHub Pages continues to work.

Runtime JavaScript is reserved for interaction. Team members, instruments, and
publications are rendered into HTML during the build. CI regenerates the site and fails
if committed deploy output differs from its sources.

## Consequences

- Shared shell and styles have one source of truth.
- Initial content does not depend on client-side fetches or rendering.
- Contributors must edit source files and run `npm run build` before committing.
- Generated HTML diffs can be larger, but they are deterministic and automatically
  checked with `npm test`.
