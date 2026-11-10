/**
 * Alias and specific tokens overridden through `ctx.theme.overrideTokens`.
 *
 * Both palette modes repeat the same value. DeepSeek Harness keeps the
 * built-in light / dark / system preference; this skin does not add another
 * selector and does not write that preference. Identical pairs keep the
 * calling-card palette when the host switches scheme.
 *
 * Names are the intersection of the custom properties shipped in
 * `@deepseek-ai/dsh-client-ui-theme` 0.2.0-rc.2 and 0.2.2-rc.1.
 * `--dsw-specific-sidebar-nav-item-hover` exists only on 0.2.0-rc.2 and is
 * omitted. Illustration and `--dsw-alias-state-done-primary` exist only on
 * 0.2.2-rc.1 and are omitted.
 */
export interface ThemeTokenModes {
  light: string
  dark: string
}

export type ThemeTokenOverrides = Record<string, ThemeTokenModes>

const RED = '#e60012'
const INK = '#0c0c0c'
const PAPER = '#f7f4ee'
const CREAM = '#f7f4ee'
const MUTED = '#b9b3a8'

function same(value: string): ThemeTokenModes {
  return { light: value, dark: value }
}

export const CALLING_CARD_SOURCE = 'dsh-calling-card-skin'

export const CALLING_CARD_TOKENS: ThemeTokenOverrides = {
  '--dsw-alias-bg-base': same(INK),
  '--dsw-alias-bg-layer-1': same('#141414'),
  '--dsw-alias-bg-layer-2': same('#1b1b1b'),
  '--dsw-alias-bg-layer-3': same('#242424'),
  '--dsw-alias-bg-overlay': same('#0c0c0cf2'),
  '--dsw-alias-bg-module-platform': same('#111111'),
  '--dsw-alias-bg-skeleton': same('#2a2a2a'),
  '--dsw-alias-bg-mask-1': same('#000000b8'),
  '--dsw-alias-bg-mask-2': same('#0000008c'),
  '--dsw-alias-bg-mask-3': same('#00000066'),
  '--dsw-alias-bg-mask-drop': same('#000000d6'),
  '--dsw-alias-bg-mask-photo': same('#00000099'),
  '--dsw-alias-bg-multi-select': same('#e6001226'),
  '--dsw-alias-bg-document-preview': same('#161616'),
  '--dsw-alias-bg-document-selection': same('#e6001266'),
  '--dsw-alias-border-l1': same('#3a3a3a'),
  '--dsw-alias-border-l2': same('#4a4a4a'),
  '--dsw-alias-border-l3': same('#ffffff2e'),
  '--dsw-alias-border-l4': same('#ffffff55'),
  '--dsw-alias-border-l2-darkmode-thin': same('#ffffff24'),
  '--dsw-alias-border-inverted': same(PAPER),
  '--dsw-alias-border-inverted2': same('#ffffff'),
  '--dsw-alias-brand-primary': same(RED),
  '--dsw-alias-brand-primary-invert': same(PAPER),
  '--dsw-alias-brand-primary-new-colorprimary-new-color': same(RED),
  '--dsw-alias-brand-text': same(RED),
  '--dsw-alias-label-primary': same(CREAM),
  '--dsw-alias-label-secondary': same('#e4ddd2'),
  '--dsw-alias-label-tertiary': same(MUTED),
  '--dsw-alias-label-caption': same('#8d887f'),
  '--dsw-alias-label-dimmed': same('#8d887f'),
  '--dsw-alias-label-primary-bluish': same(CREAM),
  '--dsw-alias-label-primary-dimmed': same('#d5cfc4'),
  '--dsw-alias-label-primary-foreground': same(INK),
  '--dsw-alias-label-primary-inverted': same(INK),
  '--dsw-alias-label-document-preview': same(CREAM),
  '--dsw-alias-label-shimmer': same('#ffffff73'),
  '--dsw-alias-label-deep-diving': same(RED),
  '--dsw-alias-label-deep-diving-shimmer': same('#ff4d62'),
  '--dsw-alias-link': same(RED),
  '--dsw-alias-button-primary-fill': same(RED),
  '--dsw-alias-button-primary-hover': same('#ff1f33'),
  '--dsw-alias-button-primary-dimmed': same('#a30010'),
  '--dsw-alias-button-contrast-fill': same(PAPER),
  '--dsw-alias-button-elevated-fill': same('#1b1b1b'),
  '--dsw-alias-button-floating-fill': same(PAPER),
  '--dsw-alias-button-floating-hover': same('#ffffff'),
  '--dsw-alias-button-ghost-active-border': same(RED),
  '--dsw-alias-button-ghost-active-fill': same('#e600121f'),
  '--dsw-alias-button-ghost-active-hover': same('#e6001233'),
  '--dsw-alias-button-info-fill': same('#1b1b1b'),
  '--dsw-alias-button-info-hover': same('#2a2a2a'),
  '--dsw-alias-button-tool-bar-fill': same('#141414'),
  '--dsw-alias-button-tool-bar-fill-invisible': same('#00000000'),
  '--dsw-alias-button-tool-bar-hover': same('#ffffff14'),
  '--dsw-alias-interactive-bg-hover': same('#ffffff14'),
  '--dsw-alias-interactive-bg-active': same('#e6001233'),
  '--dsw-alias-interactive-bg-hover-accent': same('#e6001224'),
  '--dsw-alias-interactive-bg-hover-danger': same('#e6001233'),
  '--dsw-alias-interactive-bg-hover-solid': same('#ffffff'),
  '--dsw-alias-markdown-code-block': same('#161616'),
  '--dsw-alias-markdown-code-block-banner': same('#101010'),
  '--dsw-alias-markdown-inline-code': same('#ffffff'),
  '--dsw-alias-markdown-code-segment-selected': same('#e6001233'),
  '--dsw-alias-markdown-code-segment-unselected': same('#1b1b1b'),
  '--dsw-alias-markdown-citation': same(RED),
  '--dsw-alias-markdown-placeholder': same('#8d887f'),
  '--dsw-alias-markdown-tag': same(INK),
  '--dsw-alias-menu-group-header-fill': same('#141414f0'),
  '--dsw-alias-menu-icon': same(CREAM),
  '--dsw-alias-scrollbar-bg-l1': same('#ffffff55'),
  '--dsw-alias-scrollbar-bg-l2': same('#00000055'),
  '--dsw-alias-scrollbar-hover-l1': same('#ffffff99'),
  '--dsw-alias-scrollbar-hover-l2': same('#00000088'),
  '--dsw-alias-settings-card-fill': same('#141414'),
  '--dsw-alias-settings-card-stroke': same('#ffffff55'),
  '--dsw-alias-state-business-primary': same(RED),
  '--dsw-alias-state-business-tertiary': same('#e6001233'),
  '--dsw-alias-state-error-primary': same('#ff4d4d'),
  '--dsw-alias-state-error-secondary': same('#ff4d4d33'),
  '--dsw-alias-state-idle-primary': same('#8d887f'),
  '--dsw-alias-state-success-primary': same('#d6ff4a'),
  '--dsw-alias-state-success-secondary': same('#d6ff4a33'),
  '--dsw-alias-state-success-tertiary': same('#d6ff4a1f'),
  '--dsw-alias-state-warn-primary': same('#ffb020'),
  '--dsw-alias-state-warn-secondary': same('#ffb02033'),
  '--dsw-alias-state-warn-tertiary': same('#ffb0201f'),
  '--dsw-alias-state-warn-label': same('#ffb020'),
  '--dsw-alias-switch-thumb': same(PAPER),
  '--dsw-alias-toast-bg': same(PAPER),
  '--dsw-alias-toast-label': same(INK),
  '--dsw-alias-tooltip-bg': same('#111111'),
  '--dsw-alias-tooltip-key-bg': same('#2a2a2a'),
  '--dsw-alias-turn-trigger-bg': same('#1b1b1b'),
  '--dsw-alias-turn-trigger-bg-hover': same('#2a2a2a'),
  '--dsw-alias-onboarding-accent': same(RED),
  '--dsw-alias-onboarding-card-fill': same('#141414cc'),
  '--dsw-alias-onboarding-checkbox-border': same(PAPER),
  '--dsw-alias-onboarding-secondary-fill': same('#1b1b1b'),
  '--dsw-alias-code-diff-added': same('#d6ff4a33'),
  '--dsw-alias-code-diff-deleted': same('#ff4d4d33'),
  '--dsw-alias-file-diff-added-bg': same('#d6ff4a1f'),
  '--dsw-alias-file-diff-added-gutter': same('#d6ff4a33'),
  '--dsw-alias-file-diff-added-marker': same('#d6ff4a'),
  '--dsw-alias-file-diff-deleted-bg': same('#ff4d4d1f'),
  '--dsw-alias-file-diff-deleted-gutter': same('#ff4d4d33'),
  '--dsw-alias-file-diff-deleted-marker': same('#ff4d4d'),
  '--dsw-specific-bubble': same(INK),
  '--dsw-specific-bubble-highlight': same('#1a1a1a'),
  '--dsw-specific-input-major': same(PAPER),
  '--dsw-specific-login-input': same(PAPER),
  '--dsw-specific-menu': same('#111111f2'),
  '--dsw-specific-selector': same('#1b1b1b'),
  '--dsw-specific-sidebar-fill': same('#111111'),
  '--dsw-specific-sidebar-nav-item-active': same(RED),
  '--dsw-specific-sidebar-nav-item-active-accent': same(PAPER),
  '--dsw-specific-tip': same(PAPER),
}

export function assertUnifiedTokens(tokens: ThemeTokenOverrides): void {
  for (const [name, modes] of Object.entries(tokens)) {
    if (!name.startsWith('--dsw-alias-') && !name.startsWith('--dsw-specific-')) {
      throw new Error(`token ${name} is outside the theme override names`)
    }
    if (typeof modes?.light !== 'string' || typeof modes.dark !== 'string') {
      throw new Error(`token ${name} must be a { light, dark } pair`)
    }
    if (modes.light !== modes.dark) {
      throw new Error(`token ${name} splits the single calling-card palette`)
    }
  }
}
