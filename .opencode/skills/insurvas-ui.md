---
name: insurvas-ui
description: Expert-level Frontend UI generation based on the specific 'Insurvas' design system (Green theme). Enforces pixel-perfect consistency, spacing, card alignment, and micro-animations using React, Tailwind CSS, and shadcn/ui. Use when building UI components for the Insurvas insurance CRM, applying green theme styling, or implementing data-dense dashboards with forest green color palette.
---

# Insurvas UI Design System

Expert-level Frontend UI generation for the Insurvas insurance CRM. Enforces pixel-perfect consistency with a premium, muted green aesthetic.

## Core Design Tokens

### 1. Pixel-Perfect Alignment & Spacing

Adhere strictly to a *4pt spacing grid* (4, 8, 12, 16, 20, 24...).

*Page Layout:*
•⁠  ⁠Full-height fixed *Sidebar* (left)
•⁠  ⁠Full-height, padded *Main Content* area (right)
•⁠  ⁠Main heading is top-left; control groups (search, buttons) align to the right

*Card Grid:*
•⁠  ⁠Stat cards in horizontally flowing grid with even spacing (⁠ gap-6 ⁠)
•⁠  ⁠Equal height and width in their grid context

*Containers:*
•⁠  ⁠Large containers: ⁠ p-6 ⁠ or ⁠ p-8 ⁠
•⁠  ⁠Small sub-components: ⁠ p-4 ⁠

### 2. Color Palette (Insurvas Green Theme)

| Token | Value | Purpose | Tailwind |
|-------|-------|---------|----------|
| ⁠ bg-sidebar ⁠ | ⁠ #233217 ⁠ | Deep Forest Green (sidebar) | ⁠ bg-[#233217] ⁠ |
| ⁠ bg-main ⁠ | ⁠ #EEF5EE ⁠ | Very Pale Mint Green (main area) | ⁠ bg-[#EEF5EE] ⁠ |
| ⁠ bg-card ⁠ | ⁠ #FFFFFF ⁠ | Pure White (cards) | ⁠ bg-white ⁠ |
| ⁠ text-sidebar ⁠ | ⁠ #C2D5C2 ⁠ | Soft Light Green (sidebar items) | ⁠ text-[#C2D5C2] ⁠ |
| ⁠ text-sidebar-hover ⁠ | ⁠ #FFFFFF ⁠ | Pure White (active/hover) | ⁠ text-white ⁠ |
| ⁠ text-primary ⁠ | ⁠ #233217 ⁠ | Deep Forest Green (H1, main text) | ⁠ text-[#233217] ⁠ |
| ⁠ text-secondary ⁠ | ⁠ #647864 ⁠ | Muted Medium Green (labels) | ⁠ text-[#647864] ⁠ |
| ⁠ border-border ⁠ | ⁠ #D2E1D2 ⁠ | Light Grey-Green (dividers) | ⁠ border-[#D2E1D2] ⁠ |
| ⁠ bg-accent ⁠ | ⁠ #DCEBDC ⁠ | Light Accent Green (toggles) | ⁠ bg-[#DCEBDC] ⁠ |

### 3. Typography & Consistency

•⁠  ⁠*Font:* Clean geometric sans-serif (Inter, Poppins)
•⁠  ⁠*Hierarchy:* H1 large and bold; card labels smaller and muted
•⁠  ⁠*Rounding:* Consistent ⁠ rounded-xl ⁠ or ⁠ rounded-lg ⁠ universally

### 4. Component Styling (shadcn/ui)

*Stats Cards:*
•⁠  ⁠White background, ⁠ rounded-xl ⁠, subtle ⁠ border-border ⁠
•⁠  ⁠Large dark green value, small muted green label
•⁠  ⁠Icon positioned top-right

*Search Bar:*
•⁠  ⁠⁠ rounded-lg ⁠, subtle background (⁠ bg-[#EEF5EE] ⁠), inset search icon

*Buttons:*
•⁠  ⁠Primary: Deep forest green (⁠ #233217 ⁠) background
•⁠  ⁠Secondary: Clean outline style
•⁠  ⁠Include ⁠ hover: ⁠ and ⁠ focus-visible: ⁠ states

*Data Table:*
•⁠  ⁠Clean, minimal dividers
•⁠  ⁠Bold green headers, clear row alignment

### 5. Micro-Animations

Apply ⁠ transition-all duration-150 ease-in-out ⁠ universally.

| Element | Animation |
|---------|-----------|
| Sidebar items | ⁠ hover:scale-[1.01] ⁠, color fade to white |
| Active sidebar | Vertical indicator line (pseudo-element ⁠ :after ⁠) |
| Stat cards | ⁠ hover:shadow-md ⁠, ⁠ hover:-translate-y-0.5 ⁠ |
| Buttons | ⁠ active:scale-[0.98] ⁠ |
| Form controls | Subtle background fill on focus |
| Table rows | Subtle highlight on hover |

## Execution Workflow

When building or modifying UI:

1.⁠ ⁠*Analyze* the component request against design principles
2.⁠ ⁠*Establish layout* (Sidebar vs. Main Content)
3.⁠ ⁠*Implement* using React + Tailwind + shadcn/ui primitives
4.⁠ ⁠*Apply* design tokens (colors, spacing, rounding)
5.⁠ ⁠*Add* micro-animations (⁠ duration-150 ⁠) to interactive elements
6.⁠ ⁠*Verify* alignment and spacing consistency before outputting code

## Do/Don't

| Do | Don't |
|----|-------|
| Enforce precise alignment | Eye-ball alignment |
| Use exact ⁠ gap-6 ⁠/⁠ gap-8 ⁠ for grids | Let components drift apart |
| Stick to extracted color palette | Use generic Tailwind greens |
| Map deep green to theme extension | Use inline colors for primary bg |
| Add 150ms fade to hover states | Use instant state changes |
| Use correct ⁠ bg-accent ⁠ for toggles | Build toggles from scratch |
