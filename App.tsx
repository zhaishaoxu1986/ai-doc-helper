
import React, { useState, useCallback, useEffect } from 'react';
import Header from './components/Layout/Header';
import MarkdownEditor from './components/Editor/MarkdownEditor';
import WordPreview from './components/Preview/WordPreview';
import FormulaOCR from './components/OCR/FormulaOCR';
import MultiDocProcessor from './components/MultiDoc/MultiDocProcessor';
import { AppView, DocumentState } from './types';
import { getTheme } from './utils/settings';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.EDITOR);
  const [docState, setDocState] = useState<DocumentState>({
    markdown: `# AI 智能文档助理使用手册

这是一个专业的文档处理平台，支持将 **Markdown** 无缝转换为 **Word** 格式。

### 1. 公式展示 (LaTeX)

系统支持复杂的数学公式渲染，并能直接导出为 Word 原生公式对象。例如 Transformer 的核心注意力机制：

$$
\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V
$$

### 2. 表格支持 (Table)

标准 Markdown 表格可完美转换为 Word 表格，并保持列对齐方式：

| 模型 (Model) | 架构 (Architecture) | 参数 (Params) | 来源 |
| :--- | :---: | :---: | ---: |
| Transformer | Encoder-Decoder | 65M | Google |
| BERT | Encoder Only | 110M/340M | Google |
| GPT-3 | Decoder Only | 175B | OpenAI |
| LLaMA | Decoder Only | 65B | Meta |

### 3. Transformer 架构图

支持图片嵌入，导出 Word 时会自动下载并嵌入文档（保持原始比例）：

![Transformer Architecture](https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Transformer%2C_full_architecture.png/1280px-Transformer%2C_full_architecture.png)

### 4. 功能特性

- **AI 视觉**：截图粘贴即可识别数学公式、表格和手写体。
- **一键排版**：自动修正中英文间距，提升专业感。
- **公众号适配**：右侧预览区支持一键复制为微信公众号格式。

### 5. 代码

支持代码高亮显示，导出 Word 时会保持代码块格式：

\`\`\`python
class DocHelper:
    def __init__(self):
        self.name = "AI Doc Helper"
    
    def greet(self):
        print(f"Welcome to {self.name}!")
\`\`\`

> 提示：您可以随意更换上面的图片链接。点击“AI 助手”体验一键润色，支持 Ctrl+Z 撤销。`,
    isProcessing: false,
    progress: 0
  });

  // Load and apply theme on mount
  useEffect(() => {
    const applyTheme = () => {
      const theme = getTheme();
      const root = document.documentElement;
      root.style.setProperty('--primary-color', theme.color);
      root.style.setProperty('--primary-hover', theme.hover);
      root.style.setProperty('--primary-50', theme.light);
    };
    
    window.addEventListener('storage', applyTheme);
    window.addEventListener('theme-change', applyTheme);
    
    applyTheme();

    return () => {
      window.removeEventListener('storage', applyTheme);
      window.removeEventListener('theme-change', applyTheme);
    };
  }, []);

  const handleMarkdownChange = (val: string) => {
    setDocState(prev => ({ ...prev, markdown: val }));
  };

  const handleProcessing = (isProcessing: boolean) => {
     setDocState(prev => ({ 
         ...prev, 
         isProcessing, 
         progress: isProcessing ? 30 : 100 
     }));
     
     if (isProcessing) {
         const interval = setInterval(() => {
             setDocState(prev => {
                 if (!prev.isProcessing || prev.progress >= 90) {
                     clearInterval(interval);
                     return prev;
                 }
                 return { ...prev, progress: prev.progress + 5 };
             });
         }, 500);
     } else {
         setTimeout(() => setDocState(prev => ({ ...prev, progress: 0 })), 500);
     }
  };

  const insertAtCursor = useCallback((text: string) => {
    setDocState(prev => ({
      ...prev,
      markdown: prev.markdown + '\n' + text + '\n'
    }));
    setView(AppView.EDITOR);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#F7F9FB] text-slate-800">
      <Header currentView={view} setView={setView} />
      
      <main className="flex-1 overflow-hidden relative">
        {view === AppView.EDITOR && (
          <div className="flex h-full animate-in fade-in duration-300">
            <div className="w-1/2 h-full border-r border-slate-200 bg-white">
              <MarkdownEditor 
                value={docState.markdown} 
                onChange={handleMarkdownChange} 
                onProcessing={handleProcessing}
              />
            </div>
            <div className="w-1/2 h-full bg-[#f1f3f5] overflow-x-auto overflow-y-hidden">
              <WordPreview 
                markdown={docState.markdown} 
                isProcessing={docState.isProcessing}
                progress={docState.progress}
              />
            </div>
          </div>
        )}

        {view === AppView.AI_VISION && (
          <div className="h-full animate-in slide-in-from-bottom-4 duration-300 overflow-y-auto">
            <FormulaOCR onResult={insertAtCursor} />
          </div>
        )}

        {view === AppView.MULTI_DOC && (
          <div className="h-full animate-in slide-in-from-bottom-4 duration-300 overflow-y-auto">
            <MultiDocProcessor />
          </div>
        )}
      </main>

      {docState.isProcessing && (
        <div className="fixed bottom-0 left-0 w-full h-1 bg-slate-100 z-50">
          <div 
            className="h-full bg-[var(--primary-color)] transition-all duration-300 ease-out" 
            style={{ width: `${docState.progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default App;
