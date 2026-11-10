# Compatibility

Checked on 2026-11-09 from published npm tarballs. No Windows desktop process was started. No model call was made.

## Gate

`@deepseek-ai/dsh-app-boot@0.2.0-rc.2` `evaluatePluginCompatibility` checks every `@deepseek-ai/dsh` and `@deepseek-ai/dsh-*` peer with `semver.satisfies(version, range, { includePrerelease: true })`. It does not read `engines.dsh`.

`@deepseek-ai/dsh-app-boot@0.2.2-rc.1` reads `engines.dsh` first and, when that field exists, does not consult peers. The same `includePrerelease: true` flag is used.

This package sets both fields to:

```text
>=0.2.0-rc.2 <0.2.2-0 || 0.2.2-rc.1
```

| Runtime | Peer gate (0.2.0-rc.2) | engines.dsh gate (0.2.2-rc.1) |
| --- | --- | --- |
| 0.1.3-alpha.2 (old checkout) | no | no |
| 0.2.0-rc.1 | no | no |
| 0.2.0-rc.2 (installed desktop) | yes | yes |
| 0.2.1-alpha.1 … 0.2.1-rc.5 | yes | yes |
| 0.2.2-alpha.2 / 0.2.2-alpha.3 | no | no |
| 0.2.2-rc.1 | yes | yes |

`0.2.1` is admitted by the range because `overrideTokens(source, { light, dark })` has the same signature at both ends. Those builds were not booted in this workspace.

## API this skin calls

From `lib/types/client/index.d.ts` in both theme packages:

```ts
overrideTokens(source: string, tokens: ThemeTokenOverrides): () => void
```

`ThemeTokenOverrides` is a record of `{ light: string, dark: string }`. A bare string throws in 0.2.0-rc.2 (`validateOverrides`).

`ThemeDefinition.icons` exists on 0.2.2-rc.1 and is absent on 0.2.0-rc.2. This skin does not pass icons.

Token names were taken from the intersection of `--dsw-alias-*` and `--dsw-specific-*` literals in the two `lib/client.js` bundles. Omitted on purpose:

- `--dsw-specific-sidebar-nav-item-hover` (0.2.0-rc.2 only)
- `--dsw-alias-illustration-*` and `--dsw-alias-state-done-primary` (0.2.2-rc.1 only)

`tests/skin.test.ts` fails if a shipped name is missing from either published client bundle.

## DOM this skin styles

Verified by reading the 0.2.0-rc.2 client bundles (and the chat bundle again at 0.2.2-rc.1):

- `data-shell-overlay`, `data-sidebar-collapsed`, `data-rightbar-col` (`dsh-client-ui-layout`)
- `data-row-key="session:…"`, `role="treeitem"`, `aria-selected` (`dsh-client-ui-workspace`)
- `data-chat-flow-kind` values `user`, `steering`, `assistant-step`, `tool-call` (`dsh-client-ui-chat`)
- `data-composer-card`, `data-composer-input`, `data-conversation-header-leading` (`dsh-client-ui-conversation`)
- `document.title` written by layout `DocumentTitle` when the main-view session changes

Frame child order in 0.2.0-rc.2 `AppFrame`: sidebar column, center column, right column, overlay. 0.2.2-rc.1 inserts `[data-shell-bottom]` after the right column and a drag handle after the overlay. The skin still paints `nth-child(1)` and `nth-child(2)`, which matched this boot. A later layout that inserts a DOM node in front of the sidebar will mis-paint those two columns; token overrides and data-attribute rules still apply.

## Live empty landing on 0.2.2-rc.1

A local `dsh@0.2.2-rc.1` web profile was booted with this bundle as its only added dependency. No API key, no sign-in, and no message was sent. The test profile's workspace directory was set with the host's `documentsDirectory` option so the client could create its default workspace. The signed-out "Get started" dialog was closed before the shots. It is host chrome, not part of the skin.

0.4.2 enlarges the empty-landing headline to about 44–68px and the preview stamp to 20px. Conversation titles stay about 32–40px. Each star keeps its place and draws three black contours with white bands between them.

0.4.1 keeps that frame and corrects the 0.4.0 regressions. DEEPSEEK and HARNESS use the SESSION tile grammar with slots wider than the scaled glyph, and the block sits below the sidebar header so the host mark and toggle do not cover the first letters. Stars are filled alternating black and white rings from the same four v9 contours, packed on the diagonal. Chinese nav labels use ZCOOL KuaiLe, which is in the font stack after Anton. Welcome tiles are 22px and preview tiles are 15px. Assistant runs each take a face and a paper, ink, or red chip. The fixture scroll ends above the composer.

0.4.0 keeps that frame. The upper-left mark is always DEEPSEEK over HARNESS, in the same mixed cutout letters. The active page is a small chip. Welcome titles, including 探索未至之境 and Into the Unknown, and the preview tag (预览版 or Preview) are cut per character after the text has sat still for half a second. Assistant paragraphs are then split into short runs with Noto Sans SC, Noto Serif SC, ZCOOL KuaiLe, and Ma Shan Zheng. Code, tables, URLs, and the composer are not split. A text change restores the block before it is painted again. Star contours stay the four v9 rings, with a 2.4 stroke so the gaps between rings stay visible.

0.3.3 keeps the 0.3.2 column, nav, and sheet. On the 1440×900 boot the sidebar is 461×900 and the sheet is x=477, y=216, 935×644. At 1024×547 those boxes are 328×547 and x=344, y=180, 652×327. The labeled conversation fixture uses the same rules and lands on the same boxes. The composer card is about 112px tall in the fixture and 114px on the host. The star layer is no longer a horizontal tile clipped by a diagonal. `assets/star-field.svg` copies the four concentric contours from the v9 `star-band.svg` (`80.0,4.0 …` through the inner ring) and places those marks on a diagonal lattice so neighboring arms overlap. A short heading that stays unchanged for half a second is split into one `.dsh-cc-han` paper tile per character. A heading longer than 12 characters is left as one stamp, so a streaming title is not torn apart while tokens arrive. The fixture loads `lib/fixture-boot.js`, which calls that same `splitHeading`.

0.3.0 paints the v9 ground behind the columns: white diagonal, red fault, and a diagonal lattice of nested stars. The sidebar track is at least 32% of the frame and the drag handle follows it. The word sits behind the nav. On a 1440×900 boot the column measured about 461px and the SESSION glyphs started inside the viewport (top about 3px, left about 9px). At 1024×547 the column was about 328px. `elementFromPoint` on the composer card hit that card. Setting the handle's `left` to 560px widened the column to 560px.

0.2.0 moved the architectural word to the left edge of the frame. At 1024×547 the SESSION glyphs start at y=54. At 1440×900 they start at y=26. Neither crop is the top of the letter. The sidebar column measured 280px, inside the host drag clamp of 264–420. The grid was not overridden. The first nav button is below the word and `elementFromPoint` hits that button. Its visible text stays the host label (`NEW SESSION` is `text-transform` only); the gloss `新会话` is an extra translation of that label. Plugins, Automation tasks, and More keep their own labels and glosses `插件`, `自动化`, `更多`. The workspace row and the session row are on screen at both sizes. The main sheet starts lower than the word, to the right of the nav. Its white frame and red backing are column pseudos. The content box stays a rectangle. The native headline is a white stamp (`Into the Unknown`) with a red `Preview` tag. `elementFromPoint` on the composer card hits that card. Opening Plugins changes the word to PLUGINS while `document.title` stays `DeepSeek Harness`. Reduced motion sets the transition to `display: none`.

The white diagonal and the star band are frame pseudos with `z-index: -1`. They only become visible once the frame is a stacking context (`isolation: isolate`); without that they paint behind the frame's black background. Sampled pixels in the upper right of the 1440 shot are `#ffffff` with the star tile, and the left field under the word is white.

## Enablement on 0.2.2-rc.1

The Plugins switch calls `pluginManager.setBundleEnabled`. In `@deepseek-ai/dsh-plugin-manager` `lib/index.js`, that writes `package.json` `dsh.profile.bundles` through `selectBundle` and keeps the dependency. `reload()` hot-reconciles only when `ctx.get("hmr")` is set. Without it, `reload()` runs `composeEntries` and `change()` returns `application: "restart-required"`, `restartReason: "no-hmr"`. `refreshPackages()` returns immediately when a name in `profile.startedBundles` is no longer selected, so the web client table is not republished. `@deepseek-ai/dsh-client-modules` serves `dsh.client` entries from the host Loader, and `profile-boot` fills `startedBundles` from the composition at process start. The card's `enabled` flag is the saved selection, not the running fiber. The plugin-manager README states the same rule: without HMR, the running composition remains until restart.

On this profile the switch removed `dsh-calling-card-skin` from `dsh.profile.bundles` and left `@deepseek-ai/dsh-base` and `@deepseek-ai/dsh-web-app`. The card read disabled. A full page reload still had `data-dsh-calling-card-skin`, `style[data-plugin="dsh-calling-card-skin"]`, and the architectural word. Restarting the `dsh` process cleared all three. New Session and Plugins were still there, and the card stayed disabled. Turning the switch on wrote the bundle back; the next process start restored the attribute, the style, and the word `SESSION`. Stopping the process and running `dsh plugin --profile calling-card remove dsh-calling-card-skin` deleted only that dependency. The next start had no attribute, no style, no architectural word, and no package card. New Session and the Plugins page still loaded.

A page reload is not a disable. The supported controls are the Plugins switch, or `dsh plugin remove`, followed by a process restart. The unit test removes the style tag and the root attribute when `apply()` is disposed. The host does not call that dispose until the process composes the profile again.

There is no live transcript in that boot. No supported import was used to invent one. `preview/conversation.html` is a labeled fixture for the prompt slip and response sheet selectors. Streaming was not exercised. Compared with the v9 sheet: the giant mixed word, the left white field, the upper-right star band, the stepped nav, and the lowered main sheet with a thick white edge and red backing are the same composition. The deviations are the ones above: host column width, the word sitting above the nav, a rectangular content box, and no live chat sheets.

## Not claimed

- No screenshot of the installed `DeepSeek Harness.exe`.
- No proof that Desktop's `desktop` profile accepted `dsh plugin add` (npm `dsh` refuses that profile; the bundled command was not run here).
- The preview server is a fixture.
