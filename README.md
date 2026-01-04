<p align="center">
   <a href="./public/logo.png" target="_blank">
     <img src="./public/logo.png" alt="AI Doc Helper Logo" width="120" />
   </a>
 </p>

<h1 align="center">AI Doc Helper</h1>
<p align="center">🚀 AI 驱动的智能文档处理助手 V2.0</p>

<p align="center">
   <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-18.x-61dafb.svg" alt="React 18" /></a>
   <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.x-3178c6.svg" alt="TypeScript 5" /></a>
   <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-5.x-646CFF.svg" alt="Vite 5" /></a>
   <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white" alt="node >=18" /></a>
   <a href="https://www.npmjs.com/"><img src="https://img.shields.io/badge/npm-%3E%3D9-CB3837?logo=npm&logoColor=white" alt="npm >=9" /></a>
   <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="MIT License" /></a>
</p>

<p align="center">
   <a href="https://ai-doc.xyz" target="_blank" style="display: inline-flex; align-items: center;">
     👉
     <span style="font-size: 16px; font-weight: bold; color: #2563eb;">快速体验：https://ai-doc.xyz</span>
   </a>
</p>

<p align="center">
   <a href="#-简介">简介</a> ·
   <a href="#-核心功能">核心功能</a> ·
   <a href="#-快速开始">快速开始</a> ·
   <a href="#-技术栈">技术栈</a> ·
   <a href="#-项目结构">项目结构</a>
</p>

---

## 💡 简介

**AI Doc Helper** 是一款基于 **React + Vite + API** 的专业文档处理工具，专为学术写作、报告生成和文档处理而设计。

它集成了 **Markdown 编辑器**、**Word 完美导出**（支持 LaTeX 公式）、**AI 视觉识别中心**（公式/表格/手写/PDF/去水印）、**多文档智能处理**、**AI 深度调研**、**统一历史记录管理**以及 **AI 长期记忆**功能，让你的文档创作效率提升！

---

## ✨ 核心功能

### 1.📝 沉浸式编辑器
双栏设计，左侧 Markdown 编辑，右侧实时预览 Word A4 纸张排版效果。支持一键"学术化润色"和"LaTeX 公式修正"与"自定义功能"等等。

#### 1.1 AI助手修正格式
从deepseek复制内容，并用AI助手修正生成正确的markdown格式的公式与表格。
<img src="public/gif/editor_ai.gif" alt="编辑器 AI 助手演示" width="600" />

#### 1.2 自定义AI助手功能
填写功能名称，大模型自动生成prompt并应用，支持全文修正，也支持节选片段修正。
动图例子为【补充得更详细】
<img src="public/gif/editor_aidiy.gif" alt="自定义 AI 助手" width="600" />


---

### 2.🤖 AI 视觉识别中心
支持截图识别数学公式、复杂表格、手写笔记、PDF 智能转换。自动转换为 LaTeX 或 Markdown 格式，一键插入文档。

####  2.1 公式识别
识别数学公式并转换为 LaTeX 格式
<img src="public/gif/ocr_latexgif.gif" alt="公式识别演示" width="600" />

####  2.2 表格识别
将截图中的表格转换为 Markdown 格式
<img src="public/gif/ocr_tablegif.gif" alt="表格识别演示" width="600" />

####  2.3 手写体识别
识别手写内容并转换为 Markdown
<img src="public/gif/ocr_writegif.gif" alt="手写识别演示" width="600" />

####  2.4 PDF 智能转换
处理 PDF 页面，智能提取文本和图片
<img src="public/gif/ocr_pdf.gif" alt="PDF 转换演示" width="600" />



---

### 3.📚 多文档智能处理
批量文件重命名与周报自动聚合。AI 自动分析文件内容，提取关键信息（如作者、日期、作业批次）并生成规范文件名。

#### 3.1 Deep Research
上传多格式文件进行深度研究并生成报告，包含论文，代码，理论和自定义功能的研究。
大模型自动生成prompt并应用，动图例子为【财报研究】。

<img src="public/gif/multidoc_dp.gif" alt="Deepresearch命名演示" width="600" />


#### 3.2 周报整合
批量报告文件处理，自动聚合生成统一报告，再也不需要手动整理周报。

<img src="public/gif/multidoc_week.gif" alt="周报整合" width="600" />

#### 3.3 查缺补漏
输入应交名单，导入文件，自动生成核对结果（包含实交，未交和异常文件），检查班里谁没有交作业！

<img src="public/gif/multidoc_check.gif" alt="查缺补漏" width="600" />

#### 3.4 智能重命名
上交的作业不规范？一键重命名，自动提取文件名中的关键信息，如作者、日期、作业批次等，并生成规范的文件名。

<img src="public/gif/multidoc_rename.gif" alt="智能重命名" width="600" />


---

### 4.🔍 AI 深度调研
自动化研究报告生成系统，支持网络搜索、网页访问、信息聚合和报告生成。可自定义 AI 智能体 Prompt，满足个性化研究需求。

<img src="public/gif/airesearch.gif" alt="AI深度调研" width="600" />


---

### 5.📜 用户中心
可配置主题颜色、管理API和自定义LLM


追踪所有模块的操作历史，所有内容保存在浏览器本地，保证数据安全


<img src="public/user/user.png" alt="用户中心" width="200" />

---

## 🚀 快速开始（您也可以访问https://ai-doc.xyz/直接体验）

### 环境准备

确保已安装 [Node.js](https://nodejs.org/)（推荐 v18 或 v20）

```bash
# 检查 Node.js 版本
node -v
npm -v
```

### 安装依赖

```bash
# 克隆项目（如果还没有）
git clone <项目地址>
cd ai-doc-helper

# 安装依赖包
npm install
```

### 启动开发服务器

```bash
npm run dev
```

启动成功后，浏览器访问 [http://localhost:5173](http://localhost:5173) 即可开始使用。

### API Key 配置

为了方便使用，您可以直接在网页右上角的 **「用户中心」** 填写 API Key：


> 🔒 **隐私保护**：API Key 仅保存在本地浏览器 LocalStorage 中，不会上传到任何服务器。

### 生产环境构建

```bash
# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

---

## 🛠️ 技术栈 

| 技术 | 版本 | 说明 |
|------|------|------|
| **前端框架** | React 18 + TypeScript + Vite 5 | 现代化前端开发框架 |
| **语言** | TypeScript 5.x | 类型安全的 JavaScript 超集 |
| **构建工具** | Vite 5.x | 下一代前端构建工具 |
| **UI 样式** | Tailwind CSS | 实用优先的 CSS 框架 |
| **Markdown 渲染** | react-markdown | React 组件化的 Markdown 渲染 |
| **数学公式** | KaTeX + remark-math | 快速的数学公式渲染 |
| **Word 处理** | docx | 生成和操作 Word 文档 |
| **PDF 处理** | mammoth | 将 Word 转换为 Markdown/HTML |
| **AI 集成** | OpenAI API | 兼容多种多模态和文本模型 |

---

## 📂 项目结构

```
ai-doc-helper/
├── components/          # 组件目录
│   ├── Editor/         # 编辑器组件
│   │   └── MarkdownEditor.tsx
│   ├── Layout/         # 布局组件
│   │   ├── Header.tsx         # 顶部导航
│   │   ├── UserCenter.tsx     # 用户中心（配置、记忆）
│   │   ├── AboutModal.tsx     # 关于弹窗
│   │   └── HistoryPanel.tsx   # 历史记录面板
│   ├── MultiDoc/       # 多文档处理
│   │   └── MultiDocProcessor.tsx
│   ├── OCR/            # OCR 识别
│   │   └── FormulaOCR.tsx     # 视觉识别（公式/表格/手写/PDF/去水印）
│   ├── PDF/            # PDF 转换
│   │   └── PDFConverter.tsx
│   ├── Preview/        # 预览组件
│   │   └── WordPreview.tsx
│   ├── Research/       # AI 研究
│   │   └── AIResearch.tsx
│   ├── Tools/          # 工具组件
│   │   └── DocumentTools.tsx
│   └── WebSum/         # 网页摘要
│       └── WebSummarizer.tsx
├── utils/              # 工具函数
│   ├── aiHelper.ts     # AI 辅助函数（多模态/文本模型）
│   ├── converter.ts    # 格式转换
│   ├── gemini.ts       # Gemini API 封装
│   ├── settings.ts     # 配置管理（模型/主题/Prompt/记忆）
│   ├── historyManager.ts   # 统一历史记录管理
├── public/             # 静态资源
│   ├── logo.png
│   └── ocr/           # OCR 示例图片
├── App.tsx             # 主应用组件
├── index.tsx           # 入口文件
├── types.ts            # 类型定义
└── package.json        # 项目配置
```

---

## 📄 许可证

本项目采用 [MIT License](./LICENSE) 开源协议。

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

---

## ⭐ Star History

如果这个项目对你有帮助，请给个 Star ⭐️ 支持一下！

---

<p align="center">
   Made with ❤️ by SYSU - The College Dropout
</p>