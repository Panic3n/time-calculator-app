/**
 * Premium Apple-like Design System
 * Shared styling classes and utilities for consistent enterprise design
 */

export const designSystem = {
  // Containers & Backgrounds
  pageContainer: "min-h-screen bg-gradient-to-br from-[var(--color-bg)] via-[var(--color-bg)] to-[var(--color-surface)]/10",
  mainContent: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12",
  
  // Typography
  pageTitle: "text-4xl font-bold tracking-tight text-[var(--color-text)]",
  sectionTitle: "text-2xl font-bold text-[var(--color-text)] tracking-tight",
  cardTitle: "text-sm font-semibold text-[var(--color-text)]/80",
  subtitle: "text-sm text-[var(--color-text)]/70 font-medium",
  
  // Accent line
  accentLine: "h-1 w-12 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary)]/50 rounded-full",
  
  // Cards
  card: "relative backdrop-blur-sm bg-[var(--color-surface)]/40 border border-[var(--color-surface)]/60 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl",
  cardHoverGlow: "absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300",
  
  // Buttons & Interactive
  primaryButton: "bg-[var(--color-primary)] text-white rounded-lg px-4 py-2 font-medium shadow-md hover:shadow-lg transition-all hover:scale-105",
  secondaryButton: "border border-[var(--color-surface)] bg-[var(--color-bg)]/80 backdrop-blur-sm text-[var(--color-text)] rounded-lg px-3 py-2 font-medium shadow-md hover:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50",
  navButton: (isActive: boolean) => isActive 
    ? "px-3 py-2 rounded-lg font-medium transition-all bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/30 shadow-md"
    : "px-3 py-2 rounded-lg font-medium transition-all text-[var(--color-text)]/70 hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]/50",
  
  // Inputs
  input: "border border-[var(--color-surface)] bg-[var(--color-bg)]/80 backdrop-blur-sm text-[var(--color-text)] rounded-lg h-10 px-3 text-sm font-medium shadow-md hover:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50",
  
  // Spacing
  sectionGap: "gap-6 lg:gap-8",
  cardGap: "gap-4 lg:gap-x-8",
};

export const cardVariants = {
  metric: "aspect-square",
  full: "w-full",
  compact: "p-4",
  spacious: "p-6",
};
