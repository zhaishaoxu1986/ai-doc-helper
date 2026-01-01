import React, { useRef, useState, useEffect } from 'react';
import mammoth from 'mammoth';
import { getModelConfig } from '../../utils/settings';
import { generateContentStream } from '../../utils/aiHelper';
import { htmlToMarkdown } from '../../utils/converter';

interface MarkdownEditorProps {
  value: string;
  onChange: (val: string) => void;
  onProcessing?: (isProcessing: boolean) => void;
}

interface Tool {
  id: string;
  title: string;
  prompt: string;
  isCustom?: boolean;
}

const DEFAULT_TOOLS: Tool[] = [
  {
    id: 'pre-export',
    title: '导出预优化',
    prompt: 'You are an expert Markdown optimizer. Please prepare this document for high-quality Word conversion. 1. Fix LaTeX formulas: ensure inline math has $...$ with NO spaces ($x$ instead of $ x $), and block math has $$...$$. 2. Fix tables: ensure they are correctly balanced with pipes. 3. Simplify complex LaTeX environments that Word might not support. 4. Maintain original content exactly.\n\n优化后的文档应保持原有的结构和样式\n\n输出要求：\n- 只返回优化后的Markdown内容，不要添加任何解释'
  },
  {
    id: 'polish',
    title: '学术化润色',
    prompt: 'Please rewrite this document to be more academic and professional. Use formal vocabulary and passive voice where appropriate. Keep all Markdown elements like tables and formulas intact.\n\n优化后的文档应保持原有的结构和样式\n\n输出要求：\n- 只返回优化后的Markdown内容，不要添加任何解释'
  },
  {
    id: 'translate-en',
    title: '中文翻译成英文',
    prompt: 'Please translate the following content into professional English suitable for academic or technical documents. Maintain all Markdown structures, tables, and formulas exactly as they are.\n\n优化后的文档应保持原有的结构和样式\n\n输出要求：\n- 只返回优化后的Markdown内容，不要添加任何解释'
  }
];

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ value, onChange, onProcessing }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showAiTools, setShowAiTools] = useState(false);
  const [history, setHistory] = useState<string[]>([value]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isLocked, setIsLocked] = useState(false); // Locking editor during streaming
  
  // Selection State for UI feedback
  const [selectionRange, setSelectionRange] = useState<{start: number, end: number} | null>(null);

  // Tools State
  const [tools, setTools] = useState<Tool[]>(DEFAULT_TOOLS);
  
  // Edit State
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [editPromptValue, setEditPromptValue] = useState('');
  
  // Create State
  const [isCreating, setIsCreating] = useState(false);
  const [newToolTitle, setNewToolTitle] = useState('');
  const [newToolPrompt, setNewToolPrompt] = useState('');
  const [isOptimizingPrompt, setIsOptimizingPrompt] = useState(false);

  // 初始化历史记录，避免第一次 undo 为空
  useEffect(() => {
    if (history.length === 1 && history[0] !== value) {
        setHistory([value]);
    }
  }, []);

  // 加载用户自定义的 Prompts 和 Custom Tools
  useEffect(() => {
    const savedCustomToolsStr = localStorage.getItem('user_custom_tools');
    let customTools: Tool[] = [];
    if (savedCustomToolsStr) {
        try { customTools = JSON.parse(savedCustomToolsStr); } catch(e) { console.error(e); }
    }

    const savedPromptsStr = localStorage.getItem('user_tool_prompts');
    let savedPrompts: Record<string, string> = {};
    if (savedPromptsStr) {
        try { savedPrompts = JSON.parse(savedPromptsStr); } catch(e) { console.error(e); }
    }

    const mergedDefaultTools = DEFAULT_TOOLS.map(t => ({
        ...t,
        prompt: savedPrompts[t.id] || t.prompt
    }));

    setTools([...mergedDefaultTools, ...customTools]);
  }, []);

  // Track selection changes to update UI in dropdown
  const checkSelection = () => {
    const textarea = textareaRef.current;
    if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
        setSelectionRange({ start: textarea.selectionStart, end: textarea.selectionEnd });
    } else {
        setSelectionRange(null);
    }
  };

  const saveToolPrompt = (id: string, newPrompt: string) => {
    const updatedTools = tools.map(t => t.id === id ? {...t, prompt: newPrompt} : t);
    setTools(updatedTools);
    
    const tool = updatedTools.find(t => t.id === id);
    if (tool?.isCustom) {
         const customTools = updatedTools.filter(t => t.isCustom);
         localStorage.setItem('user_custom_tools', JSON.stringify(customTools));
    } else {
         const promptMap = updatedTools
            .filter(t => !t.isCustom)
            .reduce((acc, t) => ({...acc, [t.id]: t.prompt}), {} as Record<string, string>);
         localStorage.setItem('user_tool_prompts', JSON.stringify(promptMap));
    }
    
    setEditingTool(null);
  };

  const createTool = () => {
    if (!newToolTitle.trim() || !newToolPrompt.trim()) {
        alert("请输入功能名称和 Prompt");
        return;
    }
    
    const newTool: Tool = {
        id: `custom-${Date.now()}`,
        title: newToolTitle.trim(),
        prompt: newToolPrompt.trim(),
        isCustom: true
    };
    
    const updatedTools = [...tools, newTool];
    setTools(updatedTools);
    
    const customTools = updatedTools.filter(t => t.isCustom);
    localStorage.setItem('user_custom_tools', JSON.stringify(customTools));
    
    setIsCreating(false);
    setNewToolTitle('');
    setNewToolPrompt('');
  };

  const deleteTool = (id: string) => {
    if (!confirm("确定要删除这个自定义功能吗？")) return;
    
    const updatedTools = tools.filter(t => t.id !== id);
    setTools(updatedTools);
    
    const customTools = updatedTools.filter(t => t.isCustom);
    localStorage.setItem('user_custom_tools', JSON.stringify(customTools));
    
    setEditingTool(null);
  };

  const optimizePromptWithAI = async () => {
      if (!newToolTitle.trim()) {
          alert('请先输入功能名称');
          return;
      }
      
      const config = getModelConfig('text');
      if (!config.apiKey) {
          alert('请先在右上角用户中心配置 API Key');
          return;
      }

      setIsOptimizingPrompt(true);
      
      try {
          const contextPrompt = `Please help me create a professional AI prompt for a document editing tool.

Tool Name: "${newToolTitle}"
${newToolPrompt.trim() ? `User's partial idea: "${newToolPrompt}"` : ''}

Requirements for prompt:
1. It should tell AI to process selected text or full document appropriately
2. Should maintain all Markdown structures (tables, formulas, code blocks, etc.)
3. Should only output processed content, no explanations
4. Keep the prompt clear and professional
5. Language preference: ${newToolTitle.includes('中文') || newToolTitle.includes('翻译') ? 'Use Chinese where appropriate' : 'Use English'}

Please respond with ONLY the complete prompt text, nothing else.`;

          const stream = generateContentStream({
              apiKey: config.apiKey,
              model: config.model,
              baseUrl: config.baseUrl,
              prompt: contextPrompt
          });

          let generatedPrompt = '';
          for await (const chunk of stream) {
              generatedPrompt += chunk;
              setNewToolPrompt(generatedPrompt);
          }

      } catch (err) {
          console.error('AI Optimization Error:', err);
          alert('AI 优化失败，请检查配置或网络连接。');
      } finally {
          setIsOptimizingPrompt(false);
      }
  };

  const resetToolPrompt = (id: string) => {
    const defaultTool = DEFAULT_TOOLS.find(t => t.id === id);
    if (defaultTool) {
      setEditPromptValue(defaultTool.prompt);
    }
  };

  const updateHistory = (newValue: string) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newValue);
    if (newHistory.length > 50) {
        newHistory.shift();
    } else {
        setHistoryIndex(newHistory.length - 1);
    }
    setHistory(newHistory);
    onChange(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isLocked) {
        e.preventDefault();
        return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        if (historyIndex < history.length - 1) {
          const nextIndex = historyIndex + 1;
          setHistoryIndex(nextIndex);
          onChange(history[nextIndex]);
        }
      } else {
        if (historyIndex > 0) {
          const prevIndex = historyIndex - 1;
          setHistoryIndex(prevIndex);
          onChange(history[prevIndex]);
        }
      }
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(val);
      if (newHistory.length > 50) newHistory.shift();
      else setHistoryIndex(newHistory.length - 1);
      
      setHistory(newHistory);
      onChange(val);
      checkSelection();
  };

  // Support Image Paste
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    let hasImage = false;

    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            hasImage = true;
            e.preventDefault();
            const blob = items[i].getAsFile();
            if (blob) {
                // Convert to Base64
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64 = event.target?.result as string;
                    if (base64) {
                        insertText(`![image](${base64})\n`);
                    }
                };
                reader.readAsDataURL(blob);
            }
        }
    }
  };

  const toolbarActions = [
    { label: 'H1', action: () => insertText('# ') },
    { label: 'H2', action: () => insertText('## ') },
    { label: 'B', action: () => insertText('**', '**') },
    { label: 'Math', action: () => insertText('$$', '$$') },
    { label: 'Code', action: () => insertText('```\n', '\n```') },
    { label: 'Img', action: () => insertText('![alt](', ')') }, 
  ];

  const runAiTool = async (tool: Tool) => {
    setShowAiTools(false);
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const hasSelection = start !== end;
    const textToProcess = hasSelection ? value.substring(start, end) : value;

    const config = getModelConfig('text');
    if (!config.apiKey) {
        alert('请先在右上角用户中心配置 API Key');
        return;
    }

    if (onProcessing) onProcessing(true);
    setIsLocked(true); // Lock editor
    
    try {
      const contextPrefix = hasSelection 
        ? "I want you to process the following text FRAGMENT (snippet from a larger document)." 
        : "I want you to process the following Markdown document.";
      
      const fullPrompt = `${contextPrefix} ${tool.prompt}\n\nContent:\n${textToProcess}`;
      
      // Initial state before streaming
      const beforeContent = hasSelection ? value.substring(0, start) : '';
      const afterContent = hasSelection ? value.substring(end) : '';
      let accumulatedGeneratedText = '';

      // Start Stream
      const stream = generateContentStream({
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
        prompt: fullPrompt
      });

      for await (const chunk of stream) {
          accumulatedGeneratedText += chunk;
          // Real-time update
          const newDoc = beforeContent + accumulatedGeneratedText + afterContent;
          onChange(newDoc);
      }
      
      // Final history update
      const finalDoc = beforeContent + accumulatedGeneratedText + afterContent;
      updateHistory(finalDoc);

    } catch (err) {
      console.error('AI Tool Error:', err);
      alert('AI 处理失败，请检查配置或网络连接。');
    } finally {
      if (onProcessing) onProcessing(false);
      setIsLocked(false);
      // Restore focus
      setTimeout(() => {
          if (textareaRef.current) textareaRef.current.focus();
      }, 50);
    }
  };

  const insertText = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;
    const selected = current.substring(start, end);
    const newValue = current.substring(0, start) + before + selected + after + current.substring(end);
    
    updateHistory(newValue);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const handleImportWord = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      try {
        // Improved: Use convertToHtml to preserve images as Base64, then parse HTML to Markdown
        const result = await (mammoth as any).convertToHtml({ arrayBuffer });
        const markdown = htmlToMarkdown(result.value);
        updateHistory(markdown);
      } catch (err) {
        console.error("Word import error:", err);
        alert("Word 导入失败，请确保文件格式正确。");
      }
    };
    reader.readAsArrayBuffer(file);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const activeConfig = getModelConfig('text');

  const selectedContent = selectionRange ? value.substring(selectionRange.start, selectionRange.end) : '';
  const displaySnippet = selectedContent.length > 28 
      ? selectedContent.substring(0, 28).replace(/[\n\r]+/g, ' ') + '...' 
      : selectedContent.replace(/[\n\r]+/g, ' ');

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-[#F8FAFC]">
        <div className="flex items-center space-x-1">
          {toolbarActions.map((btn, idx) => (
            <button
              key={idx}
              onClick={btn.action}
              disabled={isLocked}
              className="p-1.5 px-3 rounded hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-300 text-[11px] font-bold text-slate-600 transition-all uppercase disabled:opacity-50"
            >
              {btn.label}
            </button>
          ))}
          
          <div className="h-4 w-[1px] bg-slate-300 mx-2"></div>

          {/* AI Tools Dropdown */}
          <div className="relative">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { if(!isLocked) { checkSelection(); setShowAiTools(!showAiTools); } }}
              disabled={isLocked}
              className={`flex items-center px-3 py-1.5 rounded text-[11px] font-bold border transition-all ${
                  showAiTools 
                  ? 'bg-[var(--primary-50)] text-[var(--primary-color)] border-[var(--primary-50)]' 
                  : 'bg-white text-slate-700 border-slate-200 hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              AI 助手
              <svg className={`w-3 h-3 ml-1 transform transition-transform ${showAiTools ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            
            {showAiTools && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowAiTools(false)}></div>
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                   <div className="px-3 py-2 bg-[var(--primary-50)] border-b border-slate-100 flex flex-col gap-1">
                       <p className="text-[10px] text-[var(--primary-color)] font-medium flex items-center justify-between">
                           <span>当前引擎: {activeConfig.modelName}</span>
                       </p>
                       
                       {selectionRange ? (
                           <div className="bg-white/80 border border-[var(--primary-color)] border-opacity-30 rounded-lg p-2 mt-1 shadow-sm">
                               <p className="text-[10px] font-bold text-[var(--primary-color)] flex items-center mb-1">
                                   <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>
                                   已选中 {selectionRange.end - selectionRange.start} 字符 (仅处理选区)
                               </p>
                               <div className="text-[10px] text-slate-600 font-mono bg-slate-50 rounded px-1.5 py-1 truncate border border-slate-200 opacity-80">
                                   "{displaySnippet}"
                               </div>
                           </div>
                       ) : (
                           <div className="mt-1 px-2 py-1 rounded border border-transparent">
                                <p className="text-[10px] font-bold text-slate-400 flex items-center">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-1.5"></span>
                                    未选择文字 (将处理全文)
                                </p>
                           </div>
                       )}
                   </div>
                   <div className="py-1 max-h-[320px] overflow-y-auto custom-scrollbar">
                      {tools.map(tool => (
                        <div key={tool.id} className="group flex items-center w-full hover:bg-[var(--primary-50)] transition-colors pr-2">
                            <button
                                onClick={() => runAiTool(tool)}
                                className="flex-1 text-left px-4 py-2.5 text-xs text-slate-700 hover:text-[var(--primary-color)] font-medium flex items-center"
                            >
                                <span className={`w-1.5 h-1.5 rounded-full mr-2 transition-colors ${tool.isCustom ? 'bg-orange-300 group-hover:bg-orange-500' : 'bg-slate-300 group-hover:bg-[var(--primary-color)]'}`}></span>
                                {tool.title}
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingTool(tool);
                                    setEditPromptValue(tool.prompt);
                                    setShowAiTools(false);
                                }}
                                className="p-1.5 rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-200 opacity-0 group-hover:opacity-100 transition-all"
                                title="设置 Prompt"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </button>
                        </div>
                      ))}
                   </div>
                   <div className="border-t border-slate-100 p-1 bg-slate-50">
                        <button 
                            onClick={() => { setShowAiTools(false); setIsCreating(true); }}
                            className="w-full text-left px-3 py-2 text-[11px] text-[var(--primary-color)] hover:bg-[var(--primary-50)] rounded-lg font-bold flex items-center transition-colors"
                        >
                            <div className="w-5 h-5 rounded-full bg-[var(--primary-50)] flex items-center justify-center mr-2 text-[var(--primary-color)]">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            </div>
                            新建自定义功能
                        </button>
                   </div>
                </div>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center">
            <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLocked}
            className="flex items-center px-3 py-1.5 rounded bg-[var(--primary-50)] text-[var(--primary-color)] text-[11px] font-bold border border-[var(--primary-50)] hover:brightness-95 transition-all disabled:opacity-50"
            >
            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            导入 WORD
            </button>
            <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImportWord} 
            className="hidden" 
            accept=".docx" 
            />
        </div>
      </div>
      <textarea
        ref={textareaRef}
        style={{ caretColor: '#1f2937' }}
        className={`flex-1 w-full p-8 resize-none focus:outline-none markdown-editor text-sm leading-relaxed text-slate-800 bg-[#f3f4f6] selection:bg-[var(--primary-50)] ${isLocked ? 'cursor-not-allowed opacity-80' : 'cursor-text'}`}
        placeholder="在这里输入 Markdown 内容，或点击上方导入 Word... (支持 Ctrl+Z 撤销，支持直接粘贴截图)"
        value={value}
        onChange={handleTextareaChange}
        onSelect={checkSelection}
        onKeyDown={handleKeyDown}
        onClick={checkSelection}
        onPaste={handlePaste} // Paste Handler Added
        readOnly={isLocked}
      />

      {/* Modals for Edit/Create */}
      {editingTool && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/10 backdrop-blur-[2px]">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">编辑功能: {editingTool.title}</h3>
                    <button onClick={() => setEditingTool(null)} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6">
                    <p className="text-xs text-slate-500 mb-2">您可以修改发送给 AI 的指令以微调结果：</p>
                    <textarea 
                        className="w-full h-40 p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none resize-none font-mono bg-slate-50 text-slate-700"
                        value={editPromptValue}
                        onChange={(e) => setEditPromptValue(e.target.value)}
                    ></textarea>
                    <div className="mt-4 flex justify-between items-center">
                        <div>
                            {!editingTool.isCustom ? (
                                <button 
                                    onClick={() => resetToolPrompt(editingTool.id)}
                                    className="text-xs text-slate-400 hover:text-[var(--primary-color)] font-medium hover:underline"
                                >
                                    恢复默认指令
                                </button>
                            ) : (
                                <button 
                                    onClick={() => deleteTool(editingTool.id)}
                                    className="text-xs text-red-400 hover:text-red-600 font-medium hover:underline flex items-center"
                                >
                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    删除此功能
                                </button>
                            )}
                        </div>
                        <div className="space-x-2">
                            <button 
                                onClick={() => setEditingTool(null)}
                                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                取消
                            </button>
                            <button 
                                onClick={() => saveToolPrompt(editingTool.id, editPromptValue)}
                                className="px-4 py-2 text-xs font-bold text-white bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] rounded-lg shadow-sm transition-colors"
                            >
                                保存修改
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {isCreating && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/10 backdrop-blur-[2px]">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">新建自定义功能</h3>
                    <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">功能名称 (Title)</label>
                        <input 
                            type="text"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none bg-white"
                            placeholder="例如：翻译为日文"
                            value={newToolTitle}
                            onChange={(e) => setNewToolTitle(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">指令 (Prompt)</label>
                        <textarea 
                            className="w-full h-32 p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none resize-none font-mono bg-slate-50 text-slate-700"
                            placeholder="告诉 AI 应该怎么处理您的文档..."
                            value={newToolPrompt}
                            onChange={(e) => setNewToolPrompt(e.target.value)}
                        ></textarea>
                        
                        {/* AI 优化按钮 */}
                        <button
                            onClick={optimizePromptWithAI}
                            disabled={isOptimizingPrompt}
                            className={`mt-3 w-full py-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center ${
                                isOptimizingPrompt
                                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-[var(--primary-50)] to-purple-50 text-[var(--primary-color)] hover:from-[var(--primary-100)] hover:to-purple-100 border border-[var(--primary-200)]'
                            }`}
                        >
                            {isOptimizingPrompt ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    AI 正在优化 Prompt...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    AI 优化 Prompt
                                </>
                            )}
                        </button>
                    </div>
                    <div className="mt-4 flex justify-end space-x-2 pt-2">
                        <button
                            onClick={() => setIsCreating(false)}
                            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            取消
                        </button>
                        <button
                            onClick={createTool}
                            disabled={isOptimizingPrompt}
                            className="px-6 py-2 text-xs font-bold text-white bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            创建功能
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default MarkdownEditor;