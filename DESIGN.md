# EMDP Lab design system

The site uses a warm editorial system built around material science rather than a
generic product template. Dark carbon surfaces, paper-colored reading areas, and a
single molten-orange signal color connect the interface to the lab's research.

## Source of truth

- Design tokens and shared layout: `site/styles/base.css`
- Reusable page components: `site/styles/components.css`
- Home composition: `site/styles/home.css`
- Study hub composition: `site/styles/study.css`
- Generated deploy stylesheet: `assets/css/style.css`

Edit source styles and run `npm run build`; never edit the generated stylesheet.

## Foundations

### Color

| Token | Value | Role |
| --- | --- | --- |
| `--ink` | `#171310` | Primary dark canvas and text |
| `--ink-soft` | `#2a2420` | Elevated dark surfaces |
| `--paper` | `#fff8ee` | Reading surfaces and light text |
| `--paper-soft` | `#f1e9dc` | Secondary light surface |
| `--muted` | `#9d9488` | Secondary text on dark surfaces |
| `--muted-dark` | `#5f574f` | Secondary text on light surfaces |
| `--signal` | `#ff6a2a` | Calls to action and focus |
| `--success` | `#176b45` | Confirmed state |
| `--error` | `#a52e2e` | Validation and failure state |

Orange is a signal, not decoration. Use it for the active route, primary actions,
focus rings, and compact labels. Long reading areas remain neutral.

### Typography

- Display: Fraunces, 500–700. Use for page and section statements.
- Interface and body: Manrope, 400–800.
- Headings use tight line height and balanced wrapping; body copy uses a 1.65 line
  height and should remain near 60–70 characters per line.
- Labels use uppercase Manrope at 0.72–0.78rem with deliberate tracking.

The font links are the only third-party runtime assets. System fallbacks keep the
site usable if they are unavailable.

### Layout

- Main container: up to 1240px with 24px desktop and 12px mobile gutters.
- Editorial blocks use hard edges, 1px rules, and adjacent grids instead of rounded
  cards.
- Desktop heroes combine a large statement with a contrasting information or image
  panel. They collapse to one column below 960px.
- Repeated grids use three, two, then one column at 960px and 640px breakpoints.

## Components

- Header: sticky carbon surface, compact uppercase navigation, orange Apply action.
- Cards: paper for dense reading, soft carbon for short research summaries.
- Buttons: minimum 48px target height, square geometry, clear filled/outline states.
- Media: explicit dimensions where possible, lazy loading below the fold, WebP for
  photography, compressed MP4 for motion.
- Forms: persistent labels, inline validation, visible keyboard focus, honest queued
  versus confirmed submission language.
- Publications: semantic buttons expose expandable abstracts without requiring data
  fetches after page load.

## Motion and accessibility

Content is visible before JavaScript runs. Intersection-based reveals only animate
content that has entered the viewport and never hide off-screen content. Reduced
motion disables those animations. Every interactive control needs a visible
`:focus-visible` state, accessible name, and keyboard operation.

## Performance rules

- Shared content is generated at build time; the public site remains static.
- Team, instrument, and publication JSON are canonical inputs, not client-side fetches.
- Keep the generated CSS below 60KB and common JavaScript below 12KB.
- Do not add trackers, visitor-location lookups, duplicate exports, source snapshots,
  or original media once an optimized deploy asset exists.
- `npm test` validates data, links, generated output, bundle budgets, and key workflows.
