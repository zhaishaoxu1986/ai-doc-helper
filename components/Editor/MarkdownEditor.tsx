import React, { useRef, useState, useEffect, useMemo } from 'react';
import mammoth from 'mammoth';
import MathEditorController, { type MathEditorHandle } from './MathEditorController';
import TableEditorController, { type TableEditorHandle } from './TableEditorController';
import AlignEditorController from './AlignEditorController';
import { getModelConfig } from '../../utils/settings';
import { generateContentStream } from '../../utils/aiHelper';
import { htmlToMarkdown } from '../../utils/converter';
import { getPrompt, isDefaultPrompt, useI18n, type Locale } from '../../utils/i18n';

interface MarkdownEditorProps {
  value: string;
  onChange: (val: string) => void;
  onProcessing?: (isProcessing: boolean) => void;
  onResetToDefault?: () => void;
}

interface Tool {
  id: string;
  title: string;
  prompt: string;
  isCustom?: boolean;
}

interface ToolbarAction {
  label: string;
  action: () => void;
  title?: string;
}

const TOOL_PROMPT_KEYS: Record<string, string> = {
  'pre-export': 'markdown.preExport',
  'polish': 'markdown.polish',
  'translate-en': 'markdown.translateEn'
};

const buildDefaultTools = (locale: Locale, t: (key: string, vars?: Record<string, string | number>) => string): Tool[] => [
  {
    id: 'pre-export',
    title: t('editor.tool.preExport'),
    prompt: getPrompt('markdown.preExport', locale)
  },
  {
    id: 'polish',
    title: t('editor.tool.polish'),
    prompt: getPrompt('markdown.polish', locale)
  },
  {
    id: 'translate-en',
    title: t('editor.tool.translateEn'),
    prompt: getPrompt('markdown.translateEn', locale)
  }
];

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ value, onChange, onProcessing, onResetToDefault }) => {
  const { locale, t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mathEditorRef = useRef<MathEditorHandle>(null);
  const tableEditorRef = useRef<TableEditorHandle>(null);
  const [showAiTools, setShowAiTools] = useState(false);
  const [history, setHistory] = useState<string[]>([value]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isLocked, setIsLocked] = useState(false); // Locking editor during streaming
  
  // Selection State for UI feedback
  const [selectionRange, setSelectionRange] = useState<{start: number, end: number} | null>(null);

  // Tools State
  const defaultTools = useMemo(() => buildDefaultTools(locale, t), [locale, t]);
  const [tools, setTools] = useState<Tool[]>(defaultTools);
  
  // Edit State
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [editPromptValue, setEditPromptValue] = useState('');
  
  // Create State
  const [isCreating, setIsCreating] = useState(false);
  const [newToolTitle, setNewToolTitle] = useState('');
  const [newToolPrompt, setNewToolPrompt] = useState('');
  const [isOptimizingPrompt, setIsOptimizingPrompt] = useState(false);

  // Initialize history to avoid empty first undo.
  useEffect(() => {
    if (history.length === 1 && history[0] !== value) {
        setHistory([value]);
    }
  }, []);

  // Load user custom prompts and tools.
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

    let updated = false;
    const mergedDefaultTools = defaultTools.map(t => {
        const promptKey = TOOL_PROMPT_KEYS[t.id];
        const saved = savedPrompts[t.id];
        if (saved && promptKey && isDefaultPrompt(promptKey, saved)) {
            const nextDefault = getPrompt(promptKey, locale);
            if (saved !== nextDefault) {
                savedPrompts[t.id] = nextDefault;
                updated = true;
                return { ...t, prompt: nextDefault };
            }
        }
        return { ...t, prompt: saved || t.prompt };
    });

    if (updated) {
        localStorage.setItem('user_tool_prompts', JSON.stringify(savedPrompts));
    }

    setTools([...mergedDefaultTools, ...customTools]);
  }, [defaultTools, locale]);

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
        alert(t('editor.alert.missingToolFields'));
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
    if (!confirm(t('editor.alert.deleteToolConfirm'))) return;
    
    const updatedTools = tools.filter(t => t.id !== id);
    setTools(updatedTools);
    
    const customTools = updatedTools.filter(t => t.isCustom);
    localStorage.setItem('user_custom_tools', JSON.stringify(customTools));
    
    setEditingTool(null);
  };

  const optimizePromptWithAI = async () => {
      if (!newToolTitle.trim()) {
          alert(t('editor.alert.missingToolTitle'));
          return;
      }
      
      const config = getModelConfig('text');
      if (!config.apiKey) {
          alert(t('editor.alert.missingApiKey'));
          return;
      }

      setIsOptimizingPrompt(true);
      
      try {
      const contextPrompt = getPrompt('markdown.toolBuilder', locale, {
          title: newToolTitle,
          idea: newToolPrompt.trim()
            ? t('editor.promptIdea', { idea: newToolPrompt })
            : '',
          languageHint: locale === 'zh' ? t('editor.languageHint.zh') : t('editor.languageHint.en')
      });

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
          alert(t('editor.alert.optimizeFail'));
      } finally {
          setIsOptimizingPrompt(false);
      }
  };

  const resetToolPrompt = (id: string) => {
    const defaultTool = defaultTools.find(t => t.id === id);
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

  const openMathEditor = () => {
    mathEditorRef.current?.open();
  };

  const openTableEditor = () => {
    tableEditorRef.current?.open();
  };

  const toolbarActionsPrimary: ToolbarAction[] = [
    { label: 'H1', action: () => insertText('# ') },
    { label: 'H2', action: () => insertText('## ') },
    { label: 'B', action: () => insertText('**', '**') }
  ];

  const toolbarActionsSecondary: ToolbarAction[] = [
    { label: 'Math', action: () => openMathEditor() },
    { label: 'Table', action: () => openTableEditor() },
    { label: 'Code', action: () => insertText('```\n', '\n```') },
    { label: 'Img', action: () => insertText('![alt](', ')') }
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
        alert(t('editor.alert.missingApiKey'));
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
      alert(t('editor.alert.aiFail'));
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
        alert(t('editor.alert.wordImportFail'));
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
          {toolbarActionsPrimary.map((btn, idx) => (
            <button
              key={idx}
              onClick={btn.action}
              disabled={isLocked}
              title={btn.title ?? btn.label}
              className="p-1.5 px-3 rounded hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-300 text-[11px] font-bold text-slate-600 transition-all uppercase disabled:opacity-50"
            >
              {btn.label}
            </button>
          ))}

          <AlignEditorController
            textareaRef={textareaRef}
            updateHistory={updateHistory}
            isLocked={isLocked}
          />

          {toolbarActionsSecondary.map((btn, idx) => (
            <button
              key={`secondary-${idx}`}
              onClick={btn.action}
              disabled={isLocked}
              title={btn.title ?? btn.label}
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
              {t('editor.aiAssistant')}
              <svg className={`w-3 h-3 ml-1 transform transition-transform ${showAiTools ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            
            {showAiTools && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowAiTools(false)}></div>
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                   <div className="px-3 py-2 bg-[var(--primary-50)] border-b border-slate-100 flex flex-col gap-1">
                       <p className="text-[10px] text-[var(--primary-color)] font-medium flex items-center justify-between">
                           <span>{t('editor.currentEngine', { model: activeConfig.modelName })}</span>
                       </p>
                       
                       {selectionRange ? (
                           <div className="bg-white/80 border border-[var(--primary-color)] border-opacity-30 rounded-lg p-2 mt-1 shadow-sm">
                               <p className="text-[10px] font-bold text-[var(--primary-color)] flex items-center mb-1">
                                   <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>
                                   {t('editor.selectionRange', { count: selectionRange.end - selectionRange.start })}
                               </p>
                               <div className="text-[10px] text-slate-600 font-mono bg-slate-50 rounded px-1.5 py-1 truncate border border-slate-200 opacity-80">
                                   "{displaySnippet}"
                               </div>
                           </div>
                       ) : (
                           <div className="mt-1 px-2 py-1 rounded border border-transparent">
                                <p className="text-[10px] font-bold text-slate-400 flex items-center">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-1.5"></span>
                                    {t('editor.selectionNone')}
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
                                title={t('editor.action.settingsPrompt')}
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
                            {t('editor.action.newCustomTool')}
                        </button>
                   </div>
                </div>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
            <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLocked}
            className="flex items-center px-3 py-1.5 rounded bg-[var(--primary-50)] text-[var(--primary-color)] text-[11px] font-bold border border-[var(--primary-50)] hover:brightness-95 transition-all disabled:opacity-50"
            >
            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {t('editor.action.importWord')}
            </button>
            <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportWord}
            className="hidden"
            accept=".docx"
            />
            {onResetToDefault && (
                <button
                onClick={onResetToDefault}
                disabled={isLocked}
                className="flex items-center px-3 py-1.5 rounded bg-slate-50 text-slate-600 text-[11px] font-bold border border-slate-200 hover:bg-slate-100 hover:text-slate-800 transition-all disabled:opacity-50"
                title={t('editor.action.resetToDefault')}
                >
                <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t('editor.action.reset')}
                </button>
            )}
        </div>
      </div>
      <textarea
        ref={textareaRef}
        style={{ caretColor: '#1f2937' }}
        className={`flex-1 w-full p-8 resize-none focus:outline-none markdown-editor text-sm leading-relaxed text-slate-800 bg-[#f3f4f6] selection:bg-[var(--primary-50)] ${isLocked ? 'cursor-not-allowed opacity-80' : 'cursor-text'}`}
        placeholder={t('editor.placeholder.inputMarkdown')}
        value={value}
        onChange={handleTextareaChange}
        onSelect={checkSelection}
        onKeyDown={handleKeyDown}
        onClick={checkSelection}
        onPaste={handlePaste} // Paste Handler Added
        readOnly={isLocked}
      />

      <MathEditorController
        ref={mathEditorRef}
        textareaRef={textareaRef}
        updateHistory={updateHistory}
        isLocked={isLocked}
      />
      <TableEditorController
        ref={tableEditorRef}
        textareaRef={textareaRef}
        updateHistory={updateHistory}
        isLocked={isLocked}
      />

      {/* Modals for Edit/Create */}
      {editingTool && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/10 backdrop-blur-[2px]">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">{t('editor.modal.editTitle', { title: editingTool.title })}</h3>
                    <button onClick={() => setEditingTool(null)} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6">
                    <p className="text-xs text-slate-500 mb-2">{t('editor.modal.editHint')}</p>
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
                                    {t('editor.modal.resetPrompt')}
                                </button>
                            ) : (
                                <button 
                                    onClick={() => deleteTool(editingTool.id)}
                                    className="text-xs text-red-400 hover:text-red-600 font-medium hover:underline flex items-center"
                                >
                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    {t('editor.modal.deleteTool')}
                                </button>
                            )}
                        </div>
                        <div className="space-x-2">
                            <button 
                                onClick={() => setEditingTool(null)}
                                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                {t('editor.modal.cancel')}
                            </button>
                            <button 
                                onClick={() => saveToolPrompt(editingTool.id, editPromptValue)}
                                className="px-4 py-2 text-xs font-bold text-white bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] rounded-lg shadow-sm transition-colors"
                            >
                                {t('editor.modal.save')}
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
                    <h3 className="font-bold text-slate-800">{t('editor.modal.createTitle')}</h3>
                    <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('editor.form.titleLabel')}</label>
                        <input 
                            type="text"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none bg-white"
                            placeholder={t('editor.form.titlePlaceholder')}
                            value={newToolTitle}
                            onChange={(e) => setNewToolTitle(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('editor.form.promptLabel')}</label>
                        <textarea 
                            className="w-full h-32 p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none resize-none font-mono bg-slate-50 text-slate-700"
                            placeholder={t('editor.form.promptPlaceholder')}
                            value={newToolPrompt}
                            onChange={(e) => setNewToolPrompt(e.target.value)}
                        ></textarea>
                        
                        {/* AI Optimization Button */}
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
                                    {t('editor.action.optimizing')}
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    {t('editor.action.optimizePrompt')}
                                </>
                            )}
                        </button>
                    </div>
                    <div className="mt-4 flex justify-end space-x-2 pt-2">
                        <button
                            onClick={() => setIsCreating(false)}
                            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            {t('editor.modal.cancel')}
                        </button>
                        <button
                            onClick={createTool}
                            disabled={isOptimizingPrompt}
                            className="px-6 py-2 text-xs font-bold text-white bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {t('editor.action.createTool')}
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
