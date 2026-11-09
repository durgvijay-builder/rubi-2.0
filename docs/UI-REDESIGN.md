# R.U.B.I. 2.0 — Complete UI/UX Redesign & Responsive Engineering

## Executive Summary

R.U.B.I. 2.0 (**Responsive User Backlog & Intelligence**) has been transformed from an unstyled single-page prototype into a premium, production-grade AI productivity platform. The redesign establishes a high-polish, voice-first SaaS interface built on **React 19**, **TypeScript**, **Tailwind CSS**, **shadcn/ui** design patterns, and **Radix UI** primitives, with complete responsive support across mobile, tablet, and desktop viewports.

---

## 1. Design System & Visual Architecture

### Typography & Palette
- **Typography:** Inter Variable (`@fontsource-variable/inter`) rendered with KaTeX/prose standards, tabular numerals on metric counters, and clean font scaling (`xs`, `sm`, `base`, `lg`, `xl`, `2xl`).
- **Dark Surface Palette:**
  - Base Background: Deep charcoal / navy surface (`hsl(224, 71%, 4%)`)
  - Elevated Cards & Popovers: Slate charcoal (`hsl(224, 71%, 7%)` to `hsl(220, 14%, 10%)`)
  - Accent / Primary: Ruby red gradient (`hsl(346, 84%, 53%)` to `hsl(346, 84%, 40%)`)
  - Semantic Badges:
    - Success (Emerald): Completed tasks, live health status
    - Warning (Amber): Pending human-in-the-loop candidate review
    - Destructive (Rose): Circular dependency blockers, cycle errors
    - Info (Sky/Blue): In-progress sprint tasks

### Component Architecture (shadcn/ui + Radix UI)
All components are source-level primitives in `apps/client/src/components/ui/`:
- `button.tsx`: Polymorphic with CVA variant styling, 44px min-touch target.
- `badge.tsx`: Semantic status pills for task priority (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) and status.
- `card.tsx`: Consistent borders, subtle hover transitions, and generous whitespace.
- `input.tsx` & `textarea.tsx`: High-contrast, accessible forms with focus rings.
- `dialog.tsx`: Modals for critical confirmations (e.g., "Discard All Candidates").
- `sheet.tsx`: Accessible sliding drawers (right-sliding for desktop, bottom-sliding on mobile).
- `dropdown-menu.tsx`: Workspace switcher and user profile menus.
- `separator.tsx`, `tooltip.tsx`, `tabs.tsx`: Accessible Radix UI utilities.

---

## 2. Desktop Information Architecture (`>= 1024px`)

### Application Shell
1. **Persistent TopBar (`TopBar.tsx`):**
   - Brand logo mark with "2.0" pill.
   - Dynamic workspace selector dropdown with live task count and custom workspace switcher.
   - Provider status badge: Green glowing pulse for `Gnani Live` vs Slate badge for `Mock Mode`.
   - User profile dropdown with user initials, role, and settings shortcut.
2. **Left Sidebar (`Sidebar.tsx`):**
   - Fixed 256px sidebar with active route highlights.
   - Dynamic badge counters: active task count on `Tasks`, animated amber badge on `Approvals` when pending candidates exist.
   - Real-time voice engine status indicator.
3. **Six Modular Views (`apps/client/src/views/`):**
   - **Overview (`/`):** Executive dashboard with welcome banner, metrics grid (Active, Pending Review, Completion Rate, Blocked), quick voice capture card, pending approvals alert, upcoming tasks, and recent activity.
   - **Voice Studio (`/voice`):** Dedicated speech console with 5-stage pipeline stepper, large reactive pulse microphone, timer, file upload dropzone, editable transcript textarea with confidence/language badges, and spoken audio playback (Gnani Timbre TTS).
   - **Tasks (`/tasks`):** Backlog repository with live search, status filter chips, list view (and optional board view on XL), and task detail slide-over Sheet.
   - **Approvals (`/approvals`):** Human-in-the-loop review queue enforcing the core philosophy: *"Silence Never Implies Consent"*. Features extraction summary, token usage telemetry, circular dependency warnings (Kahn's DAG sort), and inline candidate editing.
   - **Activity (`/activity`):** Chronological, immutable audit stream of all user and system operations with action filtering.
   - **Settings (`/settings`):** Multi-tenant workspace switcher, provider health verification, and Reduced Motion toggle.

---

## 3. Mobile Information Architecture (`< 1024px`)

### Mobile-First Design Principles
- **No 7-Column Kanban Overflow:** In accordance with explicit UX specifications, mobile viewports (`320px`, `375px`, `430px`) render a vertical task list with horizontally scrollable status filter chips.
- **Bottom Navigation Bar (`BottomNav.tsx`):**
  - 5 accessible items: Home, Tasks, Center Voice FAB, Approvals (with notification badge), and Activity.
  - Safe-area-inset bottom padding (`pb-safe`) for iPhone home indicator.
  - Elevated central Voice FAB with reactive gradient and pulse ring.
- **Touch Ergonomics:**
  - Strict compliance with Apple Human Interface Guidelines and WCAG 2.2: all interactive touch targets are at least `44x44px`.
  - Zero horizontal overflow (`overflow-x-hidden`) at `320px`, `375px`, and `430px`.

---

## 4. State Persistence & Data Quality

### Client-Side State Architecture (`AppStateContext.tsx`)
All state is lifted into a centralized `AppStateProvider` context:
- Switching between tabs (`Overview` -> `Voice` -> `Approvals` -> `Tasks`) never unmounts active recording sessions, transcribing audio, or staged candidate tasks.
- Default fallback workspace updated from legacy dev workspace to verified clean demo workspace:
  - `workspace-rubi-demo-001` (*"Gnani Demo — Product Launch"*, 6 verified tasks, 3 users, 4 dependencies, 4 audit events).

### Database Test Isolation (`docs/DATA-QUALITY.md`)
- Isolated test runner to dedicated PostgreSQL database `rubi_test`.
- Dev database `rubi_dev` remains strictly isolated with zero test fixture bleed (verified: dev DB task count unchanged after 496 Vitest tests).

---

## 5. Viewport Verification & Screenshots Matrix

Playwright headless browser captured full-page screenshots across all 7 required viewports and 6 views (42 total screenshots):

| Viewport | Device Class | Resolution | Overview | Voice Studio | Tasks | Approvals | Activity | Settings |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **01_mobile_320px** | iPhone SE / Compact | 320 x 640 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **02_mobile_375px** | iPhone 13 mini | 375 x 667 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **03_mobile_430px** | iPhone 15 Pro Max | 430 x 932 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **04_tablet_768px** | iPad Portrait | 768 x 1024 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **05_laptop_1024px** | iPad Landscape / Small Desktop | 1024 x 768 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **06_desktop_1280px**| Standard Laptop | 1280 x 800 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **07_wide_1440px** | Widescreen Monitor | 1440 x 900 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

All screenshot artifacts are stored in `docs/screenshots/<viewport>/`.

