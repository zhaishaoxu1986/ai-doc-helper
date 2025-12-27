
# AI Doc Helper (AI 文档助手)

这是一个基于 React + Vite + Gemini API 的专业文档处理工具。它集成了 Markdown 编辑器、Word 完美导出（支持 LaTeX 公式）、OCR 公式识别以及 AI 智能润色功能。

![App Screenshot](https://via.placeholder.com/800x400?text=AI+Doc+Helper+Preview)

## ✨ 核心功能

*   **Markdown 编辑器**: 双栏实时预览，支持丰富的快捷键。
*   **Word 完美导出**: 自动转换 Markdown 为 docx 格式，LaTeX 公式自动转为 Word 原生公式对象。
*   **AI 智能润色**: 内置“导出预优化”、“学术化润色”等 Prompt，支持自定义。
*   **OCR 识别**: 截图粘贴即可识别数学公式、表格和手写笔记。
*   **多模型支持**: 兼容 Google Gemini, Alibaba Qwen (通义千问), DeepSeek 等 OpenAI 格式接口。

---

## 🚀 快速开始 (本地运行)

适合开发人员或希望在本地快速体验的用户。

### 1. 环境准备
确保已安装 [Node.js](https://nodejs.org/) (推荐 v18 或 v20)。

### 2. 安装依赖
```bash
npm install
```

### 3. 配置 API Key (可选但推荐)
虽然你可以在网页的“用户中心”配置 Key，但为了开发方便，建议配置环境变量：
1. 复制 `.env.example` (如果没有则新建) 为 `.env`。
2. 填入你的 API Key：
   ```properties
   API_KEY=你的_sk_开头的Key
   ```

### 4. 启动服务
```bash
npm run dev
```
浏览器访问 `http://localhost:5173` 即可使用。

---

## 🐳 Docker 部署 (推荐)

本项目支持 Docker 部署，方便在服务器或 NAS 上运行。

### 方式一：直接构建运行

由于项目是纯前端构建（Client-Side），API Key 会在构建时注入到代码中，或者您可以留空，在网页端“用户中心”手动填写。

**1. 构建镜像**
```bash
# 如果你想在构建时预置 Key (推荐用于私有部署)
docker build --build-arg API_KEY=你的_sk_key -t ai-doc-helper .

# 如果不预置 Key (用户需要在网页端自行填写)
docker build -t ai-doc-helper .
```

**2. 运行容器**
```bash
docker run -d -p 8080:80 --name ai-doc-helper ai-doc-helper
```
现在访问 `http://localhost:8080` 即可。

### 方式二：使用 Docker Compose

在项目根目录创建一个 `docker-compose.yml` 文件：

```yaml
version: '3'
services:
  web:
    build:
      context: .
      args:
        - API_KEY=你的_sk_key # 可选
    ports:
      - "8080:80"
    container_name: ai-doc-helper
    restart: always
```

然后运行：
```bash
docker-compose up -d --build
```

---

## 🛠️ 技术栈

- **前端框架**: React 18 + TypeScript + Vite
- **UI 库**: Tailwind CSS (排版与样式)
- **文档处理**: 
  - `react-markdown` + `katex`: 预览渲染
  - `docx`: 生成 Word 文档
  - `mammoth`: 解析 Word 文档
- **AI 交互**: `@google/genai` (官方 SDK) + `fetch` (OpenAI 兼容接口)

## ⚠️ 注意事项

1.  **关于 API Key 安全**: 
    - 本项目是纯前端应用。如果您在构建时通过环境变量注入了 `API_KEY`，该 Key 会以明文形式存在于打包后的 JS 文件中。
    - **请勿**将包含您私有 Key 的构建产物发布到公共网络。
    - 推荐在构建时不注入 Key，而是让使用者在网页右上角的“用户中心”填入自己的 Key（存储在本地 LocalStorage）。

2.  **OCR 功能**:
    - OCR 功能依赖具备视觉能力的模型（如 `gemini-pro-vision`, `qwen-vl-max`）。请确保您的 Key 支持视觉模型。

## 📄 许可证

MIT License
