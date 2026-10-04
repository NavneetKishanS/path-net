# Anti-patterns: what makes a UI read as AI-generated, and what we do instead

Every screen in `web/` is reviewed against this list before it is called done. The goal is not a style ban; it is that every visual choice is deliberate and carries meaning. "Any one default is forgivable if real craft sits next to it. The AI look is the bundle of defaults with nothing compensating." (ai-design-tells)

## Sources

- Hallmark anti-pattern reference (Nutlope): https://github.com/Nutlope/hallmark/blob/main/skills/hallmark/references/anti-patterns.md
- Design anti-pattern catalog with override conditions (event4u): https://github.com/event4u-app/agent-config/blob/main/docs/guidelines/design-antipatterns.md
- AI design tells checklist (hankimis): https://github.com/hankimis/ai-design-tells/blob/main/harness/AI-DESIGN-TELLS.md
- "What is AI slop?" (UX Skill): https://uxskill.laithjunaidy.com/what-is-ai-slop.html
- "Anti-slop design" (GradientDeck): https://gradientdeck.com/blog/anti-slop-design-with-gradientdeck

## The list

### Colour
| Tell | Our rule |
|---|---|
| Purple/indigo/violet as the default accent; blue-to-purple or purple-to-pink gradients | One health-blue accent (`#005eb8`, as on NHS and NIH sites) for brand, links and interaction. No gradients anywhere. |
| Gradient headline text (`background-clip: text`) | Solid ink. Emphasis comes from size and weight. |
| Glowing neon accents and orbs on dark mode, aurora/mesh blobs | Dark theme is the same token set with lower lightness. No glow, no box-shadow colour. |
| The current "warm editorial" default: cream/sand background, serif display, brass/terracotta accent | White paper with pale blue-grey panels, as on health sites. No cream, no serif display. |
| Colour used as decoration; raw `-500` utility colours with no semantic token | Colour carries meaning only: accent, supports, inferred, contradicts, and four cluster identities. All are CSS variables. |
| Colour as the only signal | Every coloured mark has a text label or a line pattern (solid = observed, dashed = inferred, red with a "Contradicts" label). |
| Grey text on colour that fails contrast | All text tokens checked for WCAG AA on both themes. |

### Typography
| Tell | Our rule |
|---|---|
| Inter (or Geist, DM Sans, Space Grotesk) as the only face | IBM Plex Sans for headings and text, IBM Plex Mono for identifiers (gene symbols, MONDO/HPO/PMID ids). |
| Flat hierarchy; same size and weight everywhere | Scale 13 / 14 / 16 / 18 / 20 / 26 / 36 px with clear roles; body text never below 16px. |
| ALL-CAPS eyebrow above every section; numbered "01 / 02 / 03" section markers | Short semibold labels only for metadata rows (relation type, source). No section numbering. |
| Crushed display letter-spacing, wide-tracked body | Default tracking; tabular numerals in tables. |
| Lines over 80 characters | Prose capped at about 68ch. |

### Layout and surfaces
| Tell | Our rule |
|---|---|
| Every element a rounded card with the same soft shadow; nested cards | No shadows except on floating layers (menus, sheets). Sections are separated by whitespace and 1px hairlines. |
| Three identical icon-in-a-circle feature cards; bento grids | Lists and tables with real content; uneven columns where the content is uneven. |
| Pill buttons and pill badges everywhere, large radii on small elements | Radius scale 2 / 4 / 6 px. Badges are square-cornered text labels. |
| Side-stripe `border-left` coloured card accent | Not used. Status is a labelled badge or a line pattern. |
| Generic stock dashboard: giant metric row, decorative charts | Admin shows counts only where they answer a question (coverage per source), next to the query that produced them. |
| Centred hero with a big headline | Only the Patient / Caregiver home is centred, because it is a single search. Everything else is left-aligned, reading order first. |
| Magic z-index numbers, dropdowns clipped by `overflow: hidden` | Radix portals for floating layers. |

### Motion
| Tell | Our rule |
|---|---|
| Gratuitous entrance animations, scroll-triggered fade-ups, parallax | Motion only to show continuity: the side panel sliding in, a route step expanding. 120 to 180 ms, ease-out. |
| Bounce/elastic easing, `transition: all`, `hover:scale-105` | Named properties only (`opacity`, `transform`, `background-color`). |
| Skeleton shimmer on everything; spinners that flash | The slice loads in well under a second, so most views render content directly. A static placeholder (no shimmer) only where the graph library loads lazily. |
| Ignoring `prefers-reduced-motion` | Global reduced-motion rule plus `MotionConfig reducedMotion="user"`. |

### Iconography
| Tell | Our rule |
|---|---|
| Sparkles for "AI", robot icons, magic wands | No AI iconography. Generated or inferred content is labelled "Inferred by the graph" in words. |
| Emoji as icons; mixed icon sets | One icon set (Lucide), used sparingly and always with a text label. |
| Chat-bubble UI as the default for everything | No chat. One search box, structured results. |

### Copy
| Tell | Our rule |
|---|---|
| "Unlock the power of", "Seamlessly", "Supercharge", "Revolutionize" | Plain verbs. Say what the screen shows and what the reader can do next. |
| Em-dash-heavy copy | Commas, colons and full stops. |
| Lorem ipsum, fake testimonials, fake logos, placeholder names | Real records from the pinned data slice. Anything that is sample data carries a visible "Sample" label. |
| Confident AI answers with no citations | Every connection shown has a path to its evidence. Inferred links say so in words and list the observed links they were built from. |
| Fake precision: invented percentages and scores | The slice has no calibrated confidence yet, so the UI says "not scored" rather than inventing a number. Rankings state their rule ("shared mechanism first, then shared investigator") instead of showing a made-up score. |
| Celebratory toasts, confirmation dialogs for reversible actions | Quiet inline confirmations. Review decisions can be undone. |

## Review checklist (run per screen)

1. Could any colour on this screen be removed without losing meaning? Remove it.
2. Is there a card, shadow or border that whitespace could replace?
3. Does every edge or claim on screen have a one-click path to its source?
4. Is anything inferred presented without the word "inferred" or a dashed line?
5. Is there a number with no stated basis?
6. Does the copy pass the 2 a.m. test in `plain` mode, and the reviewer test in `technical` mode?
7. Keyboard: can I reach and operate everything, with a visible focus ring?
8. Reduced motion and dark theme: still readable, nothing moving?
