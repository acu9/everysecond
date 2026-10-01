# Every Second

[English](README.md) · **简体中文**

一个交互式的摄影作品档案，用于个人摄影作品集，重现了 AFP 与 Gobelins 合作的
[Every Second](https://www.behance.net/gallery/80083153/Every-Second) 体验。

照片沿着一条从左下到右上的等轴测（isometric）长带层层堆叠。你可以沿着这条长带滚动浏览，
将光标移到上面时它会在光标附近展开，点击某一帧即可让照片铺满画面。

## 特性

- **三种状态，同一种几何**：收拢的总览（ribbon）、展开的浏览（browse）、单张大图（detail），
  本质上都是同一个等轴测堆叠在不同间距下的样子，彼此之间平滑过渡。
- **不依赖框架和 3D 库**：长带完全由 CSS 3D transform 实现，由单个 `requestAnimationFrame`
  循环统一驱动所有缓动。
- **悬停展开**：光标附近的照片局部分开，远处的照片只做整体平移，长带不会整条被撑长。
- **惯性滚动**、方向键逐张切换、按系列（series）筛选。
- **时间刻度**：长带本身就是一条时间轴，沿带分布着日期刻度；粒度（年 / 月 / 周 / 日 / 小时）
  由当前（可能已筛选的）照片跨度决定，而不是写死的。
- **收藏与分享**：可以收藏照片（存在浏览器本地），或复制一条直接打开某张照片的链接。
- **Collection 页面**：以印样（contact sheet）网格呈现整个档案，可按系列以及「已收藏」筛选。
- **`?` 快捷键面板**：把三种状态下的所有操作集中写在一处。
- **触屏支持**：拖动沿长带的轴向投影，浏览时可甩动滑行，大图模式下滑动切换照片。
- **手机布局**：时间戳与标志分列顶部两角，系列筛选改为底部横向滚动的一行。
- **堆叠下方的柔和阴影**：两块沿轴拉伸的渐变，而不是 200 个逐帧阴影——后者正是渲染开销上
  负担不起的那种做法。
- **按需加载清晰度**：列表中使用 240w 缩略图，打开某张照片时才替换为 1400w 版本。

## 操作方式

| 操作 | 总览 | 浏览 | 大图 |
| --- | --- | --- | --- |
| 鼠标移动 | 展开光标附近的照片 | — | — |
| 滚轮 | 在长带上移动焦点 | 滚动长带 | 切换上一张 / 下一张 |
| 点击 | 进入浏览并定位到展开处的照片 | 选中照片，再次点击打开 | 点击当前照片关闭，点击旁边的照片切换 |
| 点击空白处 | — | 回到总览 | 回到总览 |
| `←` `↓` / `→` `↑` | 上一张 / 下一张 | 上一张 / 下一张 | 上一张 / 下一张 |
| `空格` | 进入浏览 | 打开照片 | 关闭照片 |
| `Esc` | — | 回到总览 | 回到浏览 |
| `s` | 收藏当前正在看的照片 | 同左 | 同左 |
| `?` | 打开快捷键面板 | 同左 | 同左 |
| 触屏拖动 | 展开 | 拖动长带，松手后惯性滑行 | 滑动切换照片 |

右下角工具栏：`collection` 进入收藏页，书签图标收藏当前照片，分享图标复制直达链接
（手机上调用系统分享面板），`?` 打开快捷键面板。大图模式下照片正下方还有
`read more`（展开完整著录信息）与 `save this picture`。

## 技术栈

- [Astro](https://astro.build) 5 + TypeScript
- [sharp](https://sharp.pixelplumbing.com)（由 Astro 图片管线生成各尺寸图片）
- ESLint（`@antfu/eslint-config`）
- pnpm

## 快速开始

需要 Node.js 和 pnpm（见 `package.json` 中的 `packageManager` 字段）。

```bash
pnpm install
pnpm dev        # 开发服务器，http://localhost:4321
```

## 常用命令

```bash
pnpm dev        # 启动开发服务器（:4321）
pnpm check      # astro check，检查 .astro 与 .ts 的类型
pnpm lint       # ESLint 检查；pnpm lint:fix 自动修复
pnpm build      # 类型检查 + 构建；会生成约 400 个图片尺寸变体，冷启动约 25 秒
pnpm preview    # 预览 dist/ 构建产物
pnpm manifest   # 根据 src/assets/photos/ 重新生成 src/data/photos.json
```

项目没有测试套件，请在浏览器中实际操作运行中的应用来验证改动。

## 添加或更换照片

1. 将 `.webp` 文件放入 `src/assets/photos/`。
   照片必须放在 `src/assets` 下（而不是 `public/`），这样 Astro 才能生成不同尺寸的图片。
2. 运行 `pnpm manifest` 重新生成清单。

`scripts/generate-manifest.mjs` 会直接解析 WebP 文件头来读取真实尺寸，并根据文件名生成
确定性的拍摄时间、地点、EXIF 和系列标签——因此重复生成不会打乱画廊顺序。

> **注意**：目前这些元数据是**占位数据**。接入真实照片时，应将脚本中的合成步骤替换为读取真实 EXIF。
> `src/data/photos.json` 是生成文件，请修改脚本而不是直接编辑 JSON。

## 项目结构

```
scripts/
  generate-manifest.mjs   照片清单生成脚本
src/
  assets/photos/          照片源文件（.webp）
  components/
    Ribbon.astro          长带的标记与全部交互控制逻辑
    Stamp.astro           左上角的拍摄日期时间
    Caption.astro         大图模式下的地点、相机信息、完整著录与操作
    TagPanel.astro        系列筛选面板
    TimeAxis.astro        沿长带分布的时间刻度（由控制器填充）
    SwipeHint.astro       触屏滑动提示
    Shortcuts.astro       `?` 快捷键面板
    Brandmark.astro       居中的标志
    Toolbar.astro         工具栏
  data/                   照片清单与类型
  layouts/                页面布局
  lib/
    ribbon.ts             长带几何计算与时间刻度（纯函数，不涉及 DOM）
    collection.ts         收藏夹（localStorage，跨标签页同步）
  pages/
    index.astro           首页
    collection.astro      收藏 / 印样页
  styles/                 重置样式与设计变量
```

更详细的架构说明、渲染性能上的限制及其原因，请参阅 [CLAUDE.md](CLAUDE.md)（英文）。

## 当前进度

**已完成**：长带渲染、悬停展开、惯性滚动、浏览模式、大图模式（含高清图替换）、方向键切换、
Esc 返回、系列筛选、照片说明信息、触屏拖动、滑动切换及其提示；`read more` 展开完整著录、
收藏与分享、Collection 页面、`?` 快捷键面板、沿长带的时间刻度、手机布局，以及每个堆叠
下方的柔和阴影。

**仍然遗留**：

- 清单里的拍摄时间、地点、EXIF 和系列都是**按文件名合成的占位数据**，接入真实照片时应把
  `scripts/generate-manifest.mjs` 中的合成步骤换成读取真实 EXIF（见上文「添加或更换照片」）。
- 手机上重新排布的是周边界面，长带本身的间距参数仍按桌面视口调校：总览会自动适配视口，
  浏览与大图模式的间距则是固定值。
- 收藏存在浏览器本地（localStorage），没有账号，因此不会跨设备同步。

## 致谢

- 视觉与交互设计参考 AFP × Gobelins 的
  [Every Second](https://www.behance.net/gallery/80083153/Every-Second)
- 实现思路参考 [radishzzz/stack-gallery](https://github.com/radishzzz/stack-gallery)
