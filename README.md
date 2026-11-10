# dsh-calling-card-skin

Calling-card skin for the DeepSeek Harness **web** client. One red / black / white palette, a two-line paper-cut **DEEPSEEK / HARNESS** mark, stepped session rows, black prompt slips, and collage response sheets. It is a separate installable bundle. It does not replace DeepSeek Harness, `dsh-industrial-acid-skin`, or `dsh-audio-reactive`.

中文说明见 [README.zh.md](README.zh.md). Compatibility evidence is in [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md).

## What it actually changes

| Seam | Used |
| --- | --- |
| `ctx.theme.overrideTokens` | Yes. Both `light` and `dark` carry the same value, so the host Appearance control does not grow a second theme and this plugin does not write that setting. |
| Plugin stylesheet | Yes. One `<style data-plugin="dsh-calling-card-skin">` removed when the bundle unloads. Rules sit under `html[data-dsh-calling-card-skin]`. |
| `shell.overlay` | Yes. Architectural type, paper-cut, and a replay button. The overlay root is click-through. |
| `sidebar.brand.mark` / `sidebar.brand.name` | Yes, at priority `-1`, released on unload. |
| `root`, `sidebar`, `main`, `rightbar` | Not registered. ui-renderer documents that replacing `root` removes the frame and every seat inside it. |

The page ground is the v9 sheet: a white diagonal, a red fault, and one diagonal band of large nested stars (`assets/star-field.svg`). The giant word is `clamp(96px, 11vw, 168px)`, rotated, and painted behind the columns so the caps stay readable and the nav meets the baseline. The sidebar track is `max(32%, var(--dsh-cc-side))`. The host sidebar root keeps an inline `width` from the layout store; this skin sets that root to `width: 100%` so the cards fill the track instead of sitting in a 280px slab with an empty gap. The drag handle's `left` follows the same track. The main sheet starts at `max(180px, 24vh)`, under the title, with a stepped white frame and a red backing. Nav cards are one line, short, and as wide as the column. Session rows stay the host titles. The blank-session fish is replaced through `conversation.hero.brand.mark`. The native headline and its preview tag are marked from that star. On 0.2.2-rc.1 the walker climbs from `svg.dsh-cc-hero` to the host title group.

On 0.2.2-rc.1, `document.title` stays `DeepSeek Harness`. While `data-phase="hero"`, the architectural word is SESSION even if the blank row is labeled New Session. Any other current panel uses its own label. A short Latin word is a cutout. A space, a long Latin label, or Chinese is one stamp.

`preview/conversation.html` is a labeled fixture. It is not the host and not model output.

Live sessions, Markdown, streaming, the composer, and tool rows stay the host's. This package does not send messages or call a model.

## Honest gaps

- There is no supported layout-replacement API that keeps sessions, streaming, and the composer. The center column's content box stays a rectangle. The stepped white frame and the offset red backing are `::before` / `::after` in the margin. They do not clip the transcript, the composer, or the workspace controls.
- The content box inside the sheet stays rectangular so the composer, selection, and scroll are not clipped. The jagged edge is the white and red margin around it.
- The sidebar floor is 32% of the frame. Dragging the handle above that widens the column; dragging below it stays at 32%. The host's own 264–420 clamp still stores the drag, and the visible width is `max(32%, that stored left)`. Collapsed and drawer modes are left on the host grid.
- The Plugins switch writes `dsh.profile.bundles` and leaves the dependency installed. On this host, HMR is off, so `setBundleEnabled` returns `restart-required` / `no-hmr`. The running client fiber stays until the DSH process restarts. A page reload does not remove the style, the root attribute, or the architectural word. Quit DSH and start it again. `dsh plugin --profile calling-card remove dsh-calling-card-skin` deletes only this dependency, and that also takes effect at the next process start. The unit test covers fiber dispose. It does not stand in for that restart.
- Headings are stamped as whole elements. The prototype's per-letter Chinese cutouts rewrite text nodes; doing that here would fight React while a reply streams. Body paragraphs and code are not rotated.
- The giant **SESSION** word is skin chrome. The real session title stays in the host header and is shown again, as plain text, on the navigation stamp.
- Hashed CSS-module class names are not targeted. Selectors are data attributes and the frame's child order checked in `@deepseek-ai/dsh-client-ui-layout@0.2.0-rc.2`.
- `0.2.1.x` is inside the declared range because the token API matches at `0.2.0-rc.2` and `0.2.2-rc.1`. Those intermediate builds were not booted here.
- This environment cannot open the Windows desktop install or its sessions.

## Install

Use the `dsh` that belongs to the installed app. `dsh --version` must print a version inside `>=0.2.0-rc.2 <0.2.2-0 || 0.2.2-rc.1`. The old checkout at `0.1.3-alpha.2` is outside that range.

Prefer a **separate profile** so this skin and the industrial skin are not two token layers in one composition. Windows PowerShell, from the folder that contains the tarball:

```powershell
dsh --version
dsh --profile calling-card --from-default-profile web
```

Stop that process, then:

```powershell
dsh plugin --profile calling-card add .\dsh-calling-card-skin-0.4.6.tgz
dsh --profile calling-card --dump-config
dsh --profile calling-card
```

`--dump-config` should show a `# == dsh-calling-card-skin` layer. The first `plugin add` creates a base-backed profile if you skip `--from-default-profile`; a skin needs the **web** template so the GUI bundles are present.

The npm `dsh` command refuses plugin changes to the reserved `desktop` profile. The Desktop-bundled `dsh` can manage it. Installing there stacks this skin on top of whatever that profile already enables, including industrial and audio. To avoid that, keep this skin on `calling-card`.

### Remove and roll back

```powershell
dsh plugin --profile calling-card remove dsh-calling-card-skin
```

Stop the DSH process first. The command drops this dependency and its line in `dsh.profile.bundles`. It does not edit the industrial package, the audio package, or `$env:USERPROFILE\.dsh\cordis.patch.yml`. Start DSH again. The web client then has no calling-card style, root attribute, or architectural word. Settings → Plugins can deselect the bundle without deleting the files; that selection is saved immediately and the client drops it on the next process start, not on a page reload. Launch the previous profile to leave `calling-card` unused. Do not grant `allow-version` unless you accept an untested host.

```powershell
Get-FileHash -Algorithm SHA256 .\dsh-calling-card-skin-0.4.6.tgz
```

## Develop

```sh
npm install
npm test
npm run preview
```

The preview at `http://127.0.0.1:43123` is a labeled fixture. It mounts the built client bundle on fake DOM. It is not a connected Harness.

## License

MIT for the code. Anton, Archivo Black, Abril Fatface, Noto Sans SC, Noto Serif SC, ZCOOL KuaiLe, and Ma Shan Zheng are SIL OFL 1.1 (`LICENSES/`, `NOTICE`).
