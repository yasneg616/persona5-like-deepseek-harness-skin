# dsh-calling-card-skin

DeepSeek Harness 网页客户端的预告信皮肤。只有一套红、黑、白。巨大的剪贴字 **SESSION**、斜向阶梯会话条、黑色提问纸条、白色回复信纸。这是独立可安装的 bundle，不覆盖 DeepSeek Harness 本体，也不改 `dsh-industrial-acid-skin` 和 `dsh-audio-reactive`。

兼容性证据见 [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md)。英文安装说明见 [README.md](README.md)。

## 它真正接上的接口

对照已发布的 `@deepseek-ai/dsh-client-ui-theme@0.2.0-rc.2` 与 `0.2.2-rc.1`，以及当时的布局、会话、聊天包：

- **`ctx.theme.overrideTokens(source, tokens)`**。每个令牌都是 `{ light, dark }`，而且两边写同一个值。宿主「外观」仍然只有浅色 / 深色 / 跟随系统。本插件不调用 `setTheme`，不把选择写进设置。
- **插件自己的样式表**。一条带 `data-plugin="dsh-calling-card-skin"` 的 `<style>`。卸载或禁用时由客户端模块系统连同本插件的 effect 一起摘掉。选择器都挂在 `html[data-dsh-calling-card-skin]` 下。
- **`shell.overlay`**。这是布局包声明的列表槽，说明文字写明它用来放浮层，并且层本身不接点击。建筑字、斜切转场和「重播转场」放在这里。根节点 `pointer-events: none`，只有重播按钮重新打开点击。
- **`sidebar.brand.mark` 与 `sidebar.brand.name`**。侧栏文档写明这里可以换掉鱼标和默认名称。注册优先级 `-1`，卸下后原来的占用者回来。若该格点已被同样优先级占用，会留下警告并放弃这一格，主题令牌仍然生效。

没有注册 `root`、`sidebar`、`main`、`rightbar`。`ui-renderer` 写明：往 `root` 再注册会盖掉整个 AppFrame，侧栏和会话一起消失。那不是皮肤，是把客户端拆掉。

会话、Markdown、流式输出、输入框、工具行仍然是宿主的组件。本包不发送消息，也不发起模型请求。

## 和已确认的 v9 稿之间的差别

v9 是静态原型。下面这些没有做成假页面，也没有用 iframe 去冒充客户端：

- 没有「换掉整个布局」的受支持接口，同时又保住会话、流式回复和输入框。中间栏的内容盒仍是矩形。阶梯白纸框和错位的红底是栏边距上的 `::before` / `::after`，不裁切正文、输入框或工作区按钮。
- 侧栏宽度仍走宿主轨道。布局把拖拽夹在 264 到 420（`SIDEBAR_MIN` / `SIDEBAR_MAX`），手柄的 `left` 用的就是这个宽度。皮肤测量这一列，不改 `grid-template-columns`。另写一套宽度会让手柄留在旧边上。1440 上原型的导航比 280 宽；这里用大字号和左侧结构字来撑起尺度。
- 结构字画在各栏后面，导航纸片压住字的下沿。侧栏宽度至少是画面的 32%，拖拽手柄跟这个宽度走；再往右拖会变宽，往左不会窄过 32%。折叠和抽屉仍用宿主自己的网格。
- 插件页的开关只改 `dsh.profile.bundles`，依赖还在。这台宿主没有开 HMR，`setBundleEnabled` 返回 `restart-required` / `no-hmr`。已经跑着的客户端纤维要等 DSH 进程重启才卸。刷新页面不会去掉样式、根属性或结构字。先退出 DSH 再启动。`dsh plugin --profile calling-card remove dsh-calling-card-skin` 只删这个依赖，同样在下一次进程启动后生效。单元测试只覆盖纤维销毁，不能代替这次重启。
- 正文和代码不逐字旋转。标题做成整块印章。原型里的逐字中文剪贴会改掉 React 正在更新的文本节点，流式输出时会打架。
- 巨大的 **SESSION** 是皮肤自己的结构字。真正的会话标题仍在宿主顶栏；切换会话时，转场印章上再显示这份真实标题（纯文本，不是逐字剪贴）。
- 不依赖会随构建变化的 CSS Modules 哈希类名。用的是数据属性，以及 `0.2.0-rc.2` 布局源码里的子节点顺序（侧栏、中间栏、`data-rightbar-col`、`data-shell-overlay`）。
- 声明的版本范围含 `0.2.1` 一线，因为两端的 `overrideTokens` 形状一致。中间版本没有在这里启动过。
- 这里打不开 Windows 上已安装的 DeepSeek Harness，也看不到本机会话。

画面底是第九稿的结构：白纸斜面、红断层，以及一条斜向的大嵌套星带（`assets/star-field.svg`）。巨大结构字是 `clamp(96px, 11vw, 168px)`，画在各栏后面，字面留在导航上方，导航只碰到基线。侧栏轨道至少 32%。宿主侧栏根节点带着布局存下来的行内 `width`；皮肤把它改成 `width: 100%`，纸片铺满这一列，不再缩在 280px 的黑条里、旁边留空。拖拽手柄的 `left` 跟同一条轨道。主纸从 `max(180px, 24vh)` 开始，在标题下面，带阶梯白框和红底。导航卡片一行、偏矮，和列同宽。会话行仍是宿主标题。空白会话的鱼标换成原创星标（`conversation.hero.brand.mark`）。宿主标题和 Preview 标签从这颗星往上找到标题组。0.2.2-rc.1 上星标外面即使多包一层也找得到。

`document.title` 在 0.2.2-rc.1 上一直是 DeepSeek Harness。`data-phase="hero"` 时结构字固定为 SESSION，空白行即使写成 New Session 也不占用这个位置。其他栏目用自己的文字。短的拉丁词做剪贴；含空格、较长的拉丁词或中文做成一块印章。

`preview/conversation.html` 是标明的对话样式夹具，不是宿主，也不是模型输出。

转场约 600ms，重播约 1050ms。遮罩不接收点击。连续切换以最后一次标题为准。系统「减少动态效果」时不播放，也不闪白。Esc 只收起转场；焦点在输入框、可编辑区域或已打开的对话框上时不动它，事件继续交给宿主。

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
dsh plugin --profile calling-card add .\dsh-calling-card-skin-0.4.4.tgz
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
Get-FileHash -Algorithm SHA256 .\dsh-calling-card-skin-0.4.4.tgz
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
