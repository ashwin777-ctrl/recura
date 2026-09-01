# UI/UX Craft, Design Tokens & Micro-Interactions

> Synthesized from **ui-ux-pro-max**, **impeccable**, and **huashu-design**.

---

## 1. Visual Hierarchy & Aesthetic Standards
- **Color Palettes**: Avoid generic primary colors. Use balanced dark-mode hues (`bg-[#09090b]`, `bg-[#121216]`, `border-zinc-800/80`, `text-zinc-100`).
- **Accent Signals**:
  - Success/Recovered: Emerald (`text-emerald-400`, `bg-emerald-500/10`, `border-emerald-500/20`).
  - In Progress: Violet/Indigo (`text-violet-400`, `bg-violet-500/10`, `border-violet-500/20`).
  - Terminal/Exhausted/Failed: Rose/Amber (`text-rose-400`, `bg-rose-500/10`, `border-rose-500/20`).
- **Glassmorphism**: Use backdrop filters (`backdrop-blur-md bg-zinc-900/60 border border-white/5 shadow-2xl`).

## 2. Micro-Interactions & Responsive Layouts
- **Transitions**: Apply smooth duration classes (`transition-all duration-200 ease-out hover:scale-[1.01] hover:border-zinc-700`).
- **Mobile First**: All tables and data grids must be scroll-safe or wrap into stacked cards on viewports `<= 640px` (tested down to 375x812 iPhone).
- **Empty States & Skeletons**: Always render subtle animated loading skeletons while fetching data from Supabase.
