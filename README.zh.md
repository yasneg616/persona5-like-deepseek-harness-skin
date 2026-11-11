# dsh-calling-card-skin

DeepSeek Harness 网页客户端的预告信皮肤。只有一套红、黑、白。巨大的剪贴字 **SESSION**、斜向阶梯会话条、黑色提问纸条、白色回复信纸。这是独立可安装的 bundle，不覆盖 DeepSeek Harness 本体，也不改 `dsh-industrial-acid-skin` 和 `dsh-audio-reactive`。

兼容性证据见 [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md)。英文安装说明见 [README.md](README.md)。

## 它真正接上的接口

对照已发布的 `@deepseek-ai/dsh-client-ui-theme@0.2.0-rc.2` 与 `0.2.2-rc.1`，以及当时的布局、会话、聊天包：

- **`ctx.theme.overrideTokens(source, tokens)`**。每个令牌都是 `{ light, dark }`，而且两边写同一个值。宿主「外观」仍然只有浅色 / 深色 / 跟随系统。本插件不调用 `setTheme`，不把选择写进设置。
- **插件自己的样式表**。一条带 `data-plugin="dsh-calling-card-skin"` 的 `<style>`。卸载或禁用时由客户端模块系统连同本插件的 effect 一起摘掉。选择器都挂在 `html[data-dsh-calling-card-skin]` 下。
- **`shell.overlay`**。这是布局包声明的列表槽，说明文字写明它用来放浮层，并且层本身不接点击。建筑字、斜切转场、信笺开关、桌面端窗口按钮和收起侧栏的会话票签放在这里。根节点 `pointer-events: none`，只有这些按钮重新打开点击。
- **`sidebar.brand.mark` 与 `sidebar.brand.name`**。侧栏文档写明这里可以换掉鱼标和默认名称。注册优先级 `-1`，卸下后原来的占用者回来。若该格点已被同样优先级占用，会留下警告并放弃这一格，主题令牌仍然生效。

没有注册 `root`、`sidebar`、`main`、`rightbar`。`ui-renderer` 写明：往 `root` 再注册会盖掉整个 AppFrame，侧栏和会话一起消失。那不是皮肤，是把客户端拆掉。

会话、Markdown、流式输出、输入框、工具行仍然是宿主的组件。本包不发送消息，也不发起模型请求。

## 对话字体与拼贴信开关（0.5.1）

消息和输入框换成随皮肤打包、离线可用的粗体窄体：拉丁字母用 Barlow Semi Condensed（正文 SemiBold，提问和加粗用 ExtraBold），中文用 Noto Sans SC 的 Bold / Black 子集（`CcHeavy`），标题用 Anton。缺字时依次回退到 Microsoft YaHei UI、Microsoft YaHei、PingFang SC、Noto Sans CJK SC。正文不用毛笔或书法字体。

主纸右上角有一个 **LETTERS 信笺** 开关：**平文 PLAIN**（默认）或 **拼贴 COLLAGE**。选择存进 `localStorage` 的 `dsh-cc-message-style`（这是本皮肤唯一存的值），重启后仍然有效。拼贴模式下，提问和回复里已经稳定的段落和标题会变成混合字体的剪贴字；宿主原来的文字仍留在下面（字号为 0），所以流式输出、复制和读屏仍然用真实文字。代码、链接、列表、表格、引用和工具卡保持平文。超过 220 字的段落保持平文，每条消息最多剪 480 个字，只剪最近 12 条消息。欢迎标题无论哪种模式都是拼贴。DSH 0.2.x 没有给客户端插件的设置接口，所以开关放在浮层里。

## 窗口按钮与收起侧栏（0.5.2）

「重播转场」已经去掉。**LETTERS 信笺** 开关移到主纸右上角。

Windows 桌面端顶部那条 40px 的栏不是系统原生的。主窗口无边框（`titleBarStyle: "hidden"`、`titleBarOverlay: false`），这条栏由桌面端 preload 画在网页里：
- 一个「应用 / 编辑」菜单宿主（`[data-windows-menu]`）；
- 一个最小化 / 最大化 / 关闭宿主（`[data-industrial-caption-fallback]`）；
- 同时提供 `window.dshDesktop.windowControls`（`invoke(action)`、`menu(name, x, y)`）。

**有这个接口时**，皮肤会：
- 在右上角画自己的一组：两张撕边菜单签（打开的是同一个原生菜单），三块斜切票签（最小化、最大化/还原、关闭；关闭悬停时变成白色漂移四边形加红叉）；
- 设 `html[data-cc-caption]`，隐藏两个 preload 宿主，去掉框架顶部 40px 的留白；
- 顶部 40px 仍是拖动区（`-webkit-app-region: drag`，双击照常最大化），所有按钮设为 `no-drag`。

**没有这个接口时**（浏览器 profile、macOS、没有这个接口的桌面版本）什么都不隐藏，宿主栏照旧。

展开/收起按钮是侧栏右上角的一张红票签。收起后侧栏变成 96px 的黑色斜切条，配一道红刃：
- 宿主真实的按钮（新会话、各面板、添加项目/搜索、设置）重新显示为带编号的纸票签，悬停时仍是宿主自己的提示；
- 当前面板是红色；
- 最近会话显示成红票签（编号加首字，悬停弹出标题），点击会先展开侧栏再点真实的那一行；
- 空间够时底部有竖排剪贴的 **DSH**。

展开和收起是 300ms 的弹性切换。这些按钮悬停时会前冲，并出现漂移红四边形。「减少动态效果」时不动。

限制：
- 收起时宿主不渲染会话行。票签来自上一次展开时的列表，只记会话键、标题和是否选中，只存在内存里。
- 收起条的各段按结构找（侧栏根节点下被宿主隐藏的直接子节点），不依赖带哈希的类名。
- 本版只在 `preview/desktop.html` 夹具里核对过。夹具模仿 preload，窗口接口是只记日志的桩。发布前没有在桌面端里实机验证。

## 对话里的控件（0.5.3）

对话里的卡片和提示也改成了同一套怪盗卡语言：
- **交付文件卡**（回复下方的文件，例如 `atrium-notes.md`、`after-atrium.png`）：斜切的纸票，右上角一块红楔，背后一道红色切口。通用图标换成粗体文件类型印章（`MD`、`PNG`、`TSX`……；文档黑色，图片和数据红色，代码黑底红字）。文件名加粗，说明保持 12px 的普通字。「用…打开」分体按钮变成两块斜切小票（黑色应用票、红色箭头票，菜单打开时箭头翻转）。悬停时卡片前冲并出现漂移红四边形；打开按钮有各自的悬停效果。
- **消息附件**：同样的票签，白纸版。
- **触发提示**（例如「后台任务状态更新」）：斜切纸条加红刃，标题是黑色印章，时间是空心数字，右侧红色切口箭头展开时甩转。展开后的内容是普通纸面加红线，正常阅读。
- **已停止**：黑色横幅印章，带红缺口和流动的红斜线。
- **本轮错误和警告**（任务已停止……）：黑色警示板，左侧红条，红色错位阴影；标题是斜切红签（警告是白签加红下划线），状态点变成红星，说明文字保持普通、易读。
- **其余**：代码块标题栏（黑条、红色语言签、斜切白色操作票，自动换行按下时变红）、终端（红线、红色复制签）、工具行（红色菱形分隔、错误/已停止标签、黑色 `+` 和红色 `−` 差异片）、批准卡（黑卡、红色等待带、斜切按钮）、状态点改成菱形、加载圈和步骤箭头变红，回复里的链接是粗字加红下划线，悬停时红色填满。

这些控件不参与拼贴信，不会被剪成字块；拼贴模式本身没有改变。「减少动态效果」时所有新动画和悬停前冲都关闭。

限制：
- 宿主没有 data 属性的地方，按 CSS 模块的本地类名匹配（`[class*="_fileName"]`、`span[class$="_stopped"]`、`[class*="_turnErrorRow"]` 等），不依赖哈希前缀。宿主更新若改了这些本地名，对应控件会退回宿主原样，不会坏。
- 文件类型印章只取自看得到的文件名；`widgets.ts` 写入 `data-cc-ext` / `data-cc-kind`，卸载时移除。
- 本版只在 `preview/widgets.html` 夹具（标明是夹具、仿宿主结构）里核对过，发布前没有在桌面端里实机验证。

## 和已确认的 v9 稿之间的差别

v9 是静态原型。下面这些没有做成假页面，也没有用 iframe 去冒充客户端：

- 没有「换掉整个布局」的受支持接口，同时又保住会话、流式回复和输入框。中间栏的内容盒仍是矩形。阶梯白纸框和错位的红底是栏边距上的 `::before` / `::after`，不裁切正文、输入框或工作区按钮。
- 侧栏宽度仍走宿主轨道。布局把拖拽夹在 264 到 420（`SIDEBAR_MIN` / `SIDEBAR_MAX`），手柄的 `left` 用的就是这个宽度。皮肤测量这一列，不改 `grid-template-columns`。另写一套宽度会让手柄留在旧边上。1440 上原型的导航比 280 宽；这里用大字号和左侧结构字来撑起尺度。
- 结构字画在各栏后面，导航纸片压住字的下沿。侧栏宽度至少是画面的 32%，拖拽手柄跟这个宽度走；再往右拖会变宽，往左不会窄过 32%。抽屉模式仍用宿主自己的网格；收起时是上面说的 96px 收起条。
- 插件页的开关只改 `dsh.profile.bundles`，依赖还在。这台宿主没有开 HMR，`setBundleEnabled` 返回 `restart-required` / `no-hmr`。已经跑着的客户端纤维要等 DSH 进程重启才卸。刷新页面不会去掉样式、根属性或结构字。先退出 DSH 再启动。`dsh plugin --profile calling-card remove dsh-calling-card-skin` 只删这个依赖，同样在下一次进程启动后生效。单元测试只覆盖纤维销毁，不能代替这次重启。
- 正文和代码不逐字旋转。标题做成整块印章。原型里的逐字中文剪贴会改掉 React 正在更新的文本节点，流式输出时会打架。
- 巨大的 **SESSION** 是皮肤自己的结构字。真正的会话标题仍在宿主顶栏；切换会话时，转场印章上再显示这份真实标题（纯文本，不是逐字剪贴）。
- 不依赖会随构建变化的 CSS Modules 哈希类名。用的是数据属性，以及 `0.2.0-rc.2` 布局源码里的子节点顺序（侧栏、中间栏、`data-rightbar-col`、`data-shell-overlay`）。
- 声明的版本范围含 `0.2.1` 一线，因为两端的 `overrideTokens` 形状一致。中间版本没有在这里启动过。
- 这里打不开 Windows 上已安装的 DeepSeek Harness，也看不到本机会话。

画面底是第九稿的结构：白纸斜面、红断层，以及一条斜向的大嵌套星带（`assets/star-field.svg`）。巨大结构字是 `clamp(96px, 11vw, 168px)`，画在各栏后面，字面留在导航上方，导航只碰到基线。侧栏轨道至少 32%。宿主侧栏根节点带着布局存下来的行内 `width`；皮肤把它改成 `width: 100%`，纸片铺满这一列，不再缩在 280px 的黑条里、旁边留空。拖拽手柄的 `left` 跟同一条轨道。主纸从 `max(180px, 24vh)` 开始，在标题下面，带阶梯白框和红底。导航卡片一行、偏矮，和列同宽。会话行仍是宿主标题。空白会话的鱼标换成原创星标（`conversation.hero.brand.mark`）。宿主标题和 Preview 标签从这颗星往上找到标题组。0.2.2-rc.1 上星标外面即使多包一层也找得到。

`document.title` 在 0.2.2-rc.1 上一直是 DeepSeek Harness。`data-phase="hero"` 时结构字固定为 SESSION，空白行即使写成 New Session 也不占用这个位置。其他栏目用自己的文字。短的拉丁词做剪贴；含空格、较长的拉丁词或中文做成一块印章。

`preview/conversation.html` 是标明的对话样式夹具，不是宿主，也不是模型输出。

转场约 600ms。遮罩不接收点击。连续切换以最后一次标题为准。系统「减少动态效果」时不播放，也不闪白。Esc 只收起转场；焦点在输入框、可编辑区域或已打开的对话框上时不动它，事件继续交给宿主。

## 安装（Windows PowerShell）

先确认用的是当前安装自带的 `dsh`，而不是旧检出 `0.1.3-alpha.2`。

```powershell
dsh --version
```

输出必须落在 `>=0.2.0-rc.2 <0.2.2-0 || 0.2.2-rc.1`。已安装的 `0.2.0-rc.2` 在这个范围内。

建议单独开一个配置档，避免和工业风皮肤叠两层令牌：

```powershell
dsh --profile calling-card --from-default-profile web
```

停掉这个进程，再安装本包（路径换成 tarball 的实际位置）：

```powershell
dsh plugin --profile calling-card add .\dsh-calling-card-skin-0.5.3.tgz
dsh --profile calling-card --dump-config
dsh --profile calling-card
```

`--dump-config` 里应出现 `# == dsh-calling-card-skin`。必须从 **web** 模板建档，皮肤才有网页界面可画。只含 `@deepseek-ai/dsh-base` 的空档没有这套 GUI。

npm 上的 `dsh` 拒绝改名为 `desktop` 的预留配置档。桌面版自带的 `dsh` 可以改它。装进 `desktop` 会叠在该档已经启用的工业风和音频插件之上。不想叠，就用 `calling-card`。

### 卸载与回滚

```powershell
dsh plugin --profile calling-card remove dsh-calling-card-skin
```

先停掉 DSH 进程。这条命令只删本包依赖和 `dsh.profile.bundles` 里的这一行。不改工业风仓库、不改音频插件、不改 `%USERPROFILE%\.dsh\cordis.patch.yml`。再启动 DSH，网页里就没有这层样式、根属性和结构字。插件页的开关可以只取消选中、不删文件；选择马上写入，客户端要等下一次进程启动才卸掉，刷新页面不够。之后照旧启动原来的配置档即可。不要为了强行装上而执行 `allow-version`，除非接受未测试宿主的风险。

校验压缩包：

```powershell
Get-FileHash -Algorithm SHA256 .\dsh-calling-card-skin-0.5.3.tgz
```

## 本地构建与夹具

```sh
npm install
npm test
npm run preview
```

`http://127.0.0.1:43123` 是标明的测试夹具：挂上构建好的 `lib/client.js`，DOM 是假的。它不是连上的 Harness，页面里的句子也不是模型输出。会话夹具在 `http://127.0.0.1:43123/conversation.html`，中文标题由 `lib/fixture-boot.js` 调用和宿主相同的 `splitHeading`，拆成逐字纸片。超过 12 个字的标题保持整块，避免流式输出被拆开。

0.4.0 左上角固定为两行 DEEPSEEK / HARNESS，仍是混排花字，不再被页面名换成 PLUGINS。欢迎语（探索未至之境、Into the Unknown）和预览标签按字切成不同字体的纸片。模型正文在稳定后按词拼贴，汉字使用包内的 Noto Sans SC、Noto Serif SC、站酷快乐体、马善政毛笔。代码、链接和输入框不拆。星纹仍是四层轮廓，描边改细，避免糊成黑块。侧栏和主纸框沿用 0.3.2。

## 许可

代码 MIT。Anton、Archivo Black、Abril Fatface，以及 Noto Sans SC、Noto Serif SC、站酷快乐体、马善政毛笔均为 SIL Open Font License 1.1，全文在 `LICENSES/`，体积和覆盖字数在 `NOTICE`。星纹轮廓取自已确认的 v9 原型。没有游戏角色、剪影或游戏字体。
