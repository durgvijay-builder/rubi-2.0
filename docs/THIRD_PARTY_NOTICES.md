# Third-Party Software Notices & Acknowledgements

R.U.B.I. 2.0 (Responsive User Backlog & Intelligence) incorporates open-source components and design references in accordance with their respective open-source licenses.

---

## 1. shadcn/ui

- **Project URL:** [https://github.com/shadcn-ui/ui](https://github.com/shadcn-ui/ui)
- **Documentation:** [https://ui.shadcn.com/docs](https://ui.shadcn.com/docs)
- **Author:** shadcn (@shadcn)
- **License:** MIT License

### Usage in R.U.B.I. 2.0:
Source-level UI components inspired by and adapted from the shadcn/ui design system (New York style) using Tailwind CSS v3 tokens:
- `apps/client/src/components/ui/button.tsx` (cva button variants: default, secondary, destructive, outline, ghost, link)
- `apps/client/src/components/ui/badge.tsx` (status badges: default, secondary, destructive, outline, success, warning, info)
- `apps/client/src/components/ui/card.tsx` (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter)
- `apps/client/src/components/ui/input.tsx` (Accessible input field with 44px min-touch target)
- `apps/client/src/components/ui/textarea.tsx` (Accessible multiline textarea)
- `apps/client/src/components/ui/separator.tsx` (Radix UI Separator primitive)
- `apps/client/src/components/ui/tooltip.tsx` (Radix UI Tooltip primitive)
- `apps/client/src/components/ui/tabs.tsx` (Radix UI Tabs primitive)
- `apps/client/src/components/ui/dropdown-menu.tsx` (Radix UI DropdownMenu primitive)
- `apps/client/src/components/ui/dialog.tsx` (Radix UI Dialog modal primitive)
- `apps/client/src/components/ui/sheet.tsx` (Radix UI Sheet sliding drawer primitive)

---

## 2. Radix UI Primitives

- **Project URL:** [https://www.radix-ui.com/primitives](https://www.radix-ui.com/primitives)
- **Author:** WorkOS
- **License:** MIT License

### Packages utilized:
- `@radix-ui/react-dialog`
- `@radix-ui/react-dropdown-menu`
- `@radix-ui/react-tabs`
- `@radix-ui/react-tooltip`
- `@radix-ui/react-separator`
- `@radix-ui/react-slot`
- `@radix-ui/react-label`

---

## 3. React Bits (Design & Micro-Interaction References)

- **Project URL:** [https://github.com/DavidHDev/react-bits](https://github.com/DavidHDev/react-bits)
- **Author:** David Haz (@DavidHDev)
- **License:** MIT License

### Usage in R.U.B.I. 2.0:
Key visual patterns and interactive animations inspired by React Bits patterns, reimplemented cleanly using native CSS `@keyframes` and Tailwind CSS utilities without external heavy runtime dependencies:
- **Reactive Waveform & Sound Pulse Ring:** Ambient recording pulse rings and glowing radial border effects during live voice capture in `VoiceView` and `BottomNav` FAB.
- **Micro-Interaction Status Stepper:** Step indicator and transitions in `VoiceView` across pipeline states (`recording` -> `uploading` -> `transcribing` -> `understanding` -> `awaiting_approval`).
- **Telemetry Counter Animations:** Smooth metrics and token cost counters in `OverviewView` and `ApprovalsView`.

---

## 4. Lucide React (Icons)

- **Project URL:** [https://lucide.dev/](https://lucide.dev/)
- **License:** ISC License
- **Copyright:** (c) 2026 Lucide Contributors

### Usage in R.U.B.I. 2.0:
Consistent, scalable SVG icons utilized throughout desktop and mobile navigation, task status badges, modal actions, and telemetry summaries.

---

## 5. Typography

- **Font Family:** Inter Variable (`@fontsource-variable/inter`)
- **Author:** Rasmus Andersson
- **License:** SIL Open Font License (OFL) 1.1

---

## 6. CSS & Styling Utilities

- **Tailwind CSS:** MIT License (c) Tailwind Labs, Inc.
- **clsx:** MIT License (c) Luke Edwards
- **tailwind-merge:** MIT License (c) Dany Castillo
- **class-variance-authority:** MIT License (c) Joe Bell

