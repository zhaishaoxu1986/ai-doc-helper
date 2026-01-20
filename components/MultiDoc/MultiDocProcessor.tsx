import React, { useState, useRef, useEffect, useMemo } from 'react';
import mammoth from 'mammoth';
import ReactMarkdown from 'react-markdown';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import JSZip from 'jszip';
import { getModelConfig } from '../../utils/settings';
import { generateContent, generateContentStream } from '../../utils/aiHelper';
import { Type } from '@google/genai';
import { downloadDocx } from '../../utils/converter';
import { WordTemplate } from '../../types';
import { addHistoryItem } from '../../utils/historyManager';
import { getPrompt, getPromptWithLocale, isDefaultPrompt, useI18n, type Locale } from '../../utils/i18n';
import { MULTI_DOC_SAMPLES } from '../../utils/i18n-resources/multiDocSamples';

// PDF & Excel Imports
// Note: These libraries are loaded via <script> tags in index.html to expose global variables
declare const pdfjsLib: any;
declare const XLSX: any;

type Mode = 'deep_research' | 'report' | 'missing' | 'rename';

interface FileItem {
  file: File;
  contentSnippet: string; // 提取的前N个字符用于分析
  status: 'pending' | 'processing' | 'done' | 'error';
  newName?: string;
  reason?: string;
}

interface CheckResult {
  submitted: { name: string; fileName: string }[];
  missing: string[];
  extras: string[]; // 文件存在但不在名单中
}

interface ResearchTemplate {
    id: string;
    title: string;
    icon: string;
    prompt: string;
    isCustom?: boolean;
}

const buildResearchTemplates = (
  locale: Locale,
  t: (key: string, vars?: Record<string, string | number>) => string
): ResearchTemplate[] => [
    {
        id: 'paper',
        title: t('multiDoc.template.paper.title'),
        icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
        prompt: getPrompt('multiDoc.template.paper', locale)
    },
    {
        id: 'theory',
        title: t('multiDoc.template.theory.title'),
        icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
        prompt: getPrompt('multiDoc.template.theory', locale)
    },
    {
        id: 'code',
        title: t('multiDoc.template.code.title'),
        icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
        prompt: getPrompt('multiDoc.template.code', locale)
    }
];

// Define mode-specific state type
interface ModeState {
  files: FileItem[];
  resultReport: string;
  checkResult: CheckResult | null;
  rosterText: string;
  renamePattern: string;
}

// Helper function to load mode state from localStorage
const loadModeState = (mode: Mode): ModeState => {
  const loadFiles = (): FileItem[] => {
    try {
      const saved = localStorage.getItem(`multidoc_${mode}_files`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  };

  const loadResultReport = (): string => {
    // Try new format first
    const newFormat = localStorage.getItem(`multidoc_${mode}_result_report`);
    if (newFormat) {
      try {
        return newFormat;
      } catch {
        return '';
      }
    }
    // Fallback to old format
    try {
      const oldFormat = localStorage.getItem('multidoc_result_report');
      if (oldFormat) {
        const reports = JSON.parse(oldFormat);
        return typeof reports === 'string' ? oldFormat : (reports[mode] || '');
      }
    } catch {
      return '';
    }
    return '';
  };

  const loadCheckResult = (): CheckResult | null => {
    try {
      const saved = localStorage.getItem(`multidoc_${mode}_check_result`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const loadRosterText = (): string => {
    // Try new format first
    const newFormat = localStorage.getItem(`multidoc_${mode}_roster_text`);
    if (newFormat !== null) {
      return newFormat;
    }
    // Fallback to old format only for missing mode
    if (mode === 'missing') {
      const oldFormat = localStorage.getItem('multidoc_roster_text');
      return oldFormat || '';
    }
    return '';
  };

  const loadRenamePattern = (): string => {
    // Try new format first
    const newFormat = localStorage.getItem(`multidoc_${mode}_rename_pattern`);
    if (newFormat !== null) {
      return newFormat;
    }
    // Fallback to old format only for rename mode
    if (mode === 'rename') {
      const oldFormat = localStorage.getItem('multidoc_rename_pattern');
      return oldFormat || '';
    }
    return '';
  };

  return {
    files: loadFiles(),
    resultReport: loadResultReport(),
    checkResult: loadCheckResult(),
    rosterText: loadRosterText(),
    renamePattern: loadRenamePattern()
  };
};

const MultiDocProcessor: React.FC = () => {
  const { locale, t } = useI18n();
  const [mode, setMode] = useState<Mode>(() => {
    const saved = localStorage.getItem('multidoc_mode');
    return (saved as Mode) || 'rename';
  });
  
  // Global state (shared across all modes)
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<'preparing' | 'analyzing' | 'streaming' | 'completed' | null>(null);
  const [progressText, setProgressText] = useState<string>('');
  const [shouldStop, setShouldStop] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Mode-specific state
  const [modeStates, setModeStates] = useState<Record<Mode, ModeState>>(() => {
    const initialStates: Record<Mode, ModeState> = {
      deep_research: loadModeState('deep_research'),
      report: loadModeState('report'),
      missing: loadModeState('missing'),
      rename: loadModeState('rename')
    };
    return initialStates;
  });
  
  // Research Mode
  const baseTemplates = useMemo(() => buildResearchTemplates(locale, t), [locale, t]);
  const [templates, setTemplates] = useState<ResearchTemplate[]>(baseTemplates);
  const [activeTemplate, setActiveTemplate] = useState<ResearchTemplate>(() => {
    const saved = localStorage.getItem('multidoc_active_template');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return baseTemplates[0];
      }
    }
    return baseTemplates[0];
  });
  const [customPrompt, setCustomPrompt] = useState(() => {
    const saved = localStorage.getItem('multidoc_custom_prompt');
    return saved || baseTemplates[0].prompt;
  });
  
  // Custom Template Creation
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplatePrompt, setNewTemplatePrompt] = useState('');
  const [isOptimizingTemplatePrompt, setIsOptimizingTemplatePrompt] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const rosterInputRef = useRef<HTMLInputElement>(null);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [renamePrompt, setRenamePrompt] = useState(() => getPromptWithLocale('prompt_rename', 'multiDoc.rename', locale));
  const [reportPrompt, setReportPrompt] = useState(() => getPromptWithLocale('prompt_report', 'multiDoc.report', locale));
  const [missingPrompt, setMissingPrompt] = useState(() => getPromptWithLocale('prompt_missing', 'multiDoc.missing', locale));
  
  const [tempPrompt, setTempPrompt] = useState('');

  const config = getModelConfig('text');

  // Helper functions to get/set current mode state
  const getCurrentFiles = () => modeStates[mode].files;
  const setCurrentFiles = (files: FileItem[] | ((prev: FileItem[]) => FileItem[])) => {
    setModeStates(prev => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        files: typeof files === 'function' ? files(prev[mode].files) : files
      }
    }));
  };

  const getCurrentResultReport = () => modeStates[mode].resultReport;
  const setCurrentResultReport = (report: string) => {
    setModeStates(prev => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        resultReport: report
      }
    }));
  };

  const getCurrentCheckResult = () => modeStates[mode].checkResult;
  const setCurrentCheckResult = (result: CheckResult | null) => {
    setModeStates(prev => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        checkResult: result
      }
    }));
  };

  const getCurrentRosterText = () => modeStates[mode].rosterText;
  const setCurrentRosterText = (text: string) => {
    setModeStates(prev => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        rosterText: text
      }
    }));
  };

  const getCurrentRenamePattern = () => modeStates[mode].renamePattern;
  const setCurrentRenamePattern = (pattern: string) => {
    setModeStates(prev => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        renamePattern: pattern
      }
    }));
  };

  // Save mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('multidoc_mode', mode);
  }, [mode]);

  // Save mode-specific states to localStorage
  useEffect(() => {
    // Save files
    localStorage.setItem(`multidoc_${mode}_files`, JSON.stringify(modeStates[mode].files));
  }, [mode, modeStates[mode].files]);

  useEffect(() => {
    // Save result report
    localStorage.setItem(`multidoc_${mode}_result_report`, modeStates[mode].resultReport);
  }, [mode, modeStates[mode].resultReport]);

  useEffect(() => {
    // Save check result
    if (modeStates[mode].checkResult) {
      localStorage.setItem(`multidoc_${mode}_check_result`, JSON.stringify(modeStates[mode].checkResult));
    }
  }, [mode, modeStates[mode].checkResult]);

  useEffect(() => {
    // Save roster text
    localStorage.setItem(`multidoc_${mode}_roster_text`, modeStates[mode].rosterText);
  }, [mode, modeStates[mode].rosterText]);

  useEffect(() => {
    // Save rename pattern
    localStorage.setItem(`multidoc_${mode}_rename_pattern`, modeStates[mode].renamePattern);
  }, [mode, modeStates[mode].renamePattern]);

  // Clear current mode state when switching modes (similar to OCR mode)
  useEffect(() => {
    // Clear files, results, and check results when switching modes
    // Each mode should have its own independent state
  }, [mode]);

  // Save active template to localStorage
  useEffect(() => {
    localStorage.setItem('multidoc_active_template', JSON.stringify(activeTemplate));
  }, [activeTemplate]);

  // Save custom prompt to localStorage
  useEffect(() => {
    localStorage.setItem('multidoc_custom_prompt', customPrompt);
  }, [customPrompt]);

  // Sync templates and prompts when locale changes
  useEffect(() => {
    const savedTemplates = localStorage.getItem('custom_research_templates');
    let customTemplates: ResearchTemplate[] = [];
    if (savedTemplates) {
        try {
            customTemplates = JSON.parse(savedTemplates);
        } catch (e) {
            console.error("Failed to load custom templates", e);
        }
    }

    const merged = [...baseTemplates, ...customTemplates];
    setTemplates(merged);

    setActiveTemplate(prev => {
      if (prev?.isCustom) return prev;
      return baseTemplates.find(t => t.id === prev?.id) || baseTemplates[0];
    });

    setCustomPrompt(prev => {
      const isDefault =
        isDefaultPrompt('multiDoc.template.paper', prev) ||
        isDefaultPrompt('multiDoc.template.theory', prev) ||
        isDefaultPrompt('multiDoc.template.code', prev);
      if (!isDefault) return prev;
      const target = baseTemplates.find(t => t.id === activeTemplate?.id) || baseTemplates[0];
      return target.prompt;
    });

    setRenamePrompt(getPromptWithLocale('prompt_rename', 'multiDoc.rename', locale));
    setReportPrompt(getPromptWithLocale('prompt_report', 'multiDoc.report', locale));
    setMissingPrompt(getPromptWithLocale('prompt_missing', 'multiDoc.missing', locale));
  }, [baseTemplates, locale]);

  const handleCreateTemplate = () => {
      if (!newTemplateTitle.trim() || !newTemplatePrompt.trim()) {
          alert(t('multiDoc.template.alert.missingFields'));
          return;
      }
      const newTpl: ResearchTemplate = {
          id: `custom-${Date.now()}`,
          title: newTemplateTitle.trim(),
          prompt: newTemplatePrompt.trim(),
          icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
          isCustom: true
      };
      const updatedTemplates = [...templates, newTpl];
      setTemplates(updatedTemplates);
      localStorage.setItem('custom_research_templates', JSON.stringify(updatedTemplates.filter(t => t.isCustom)));
      
      setIsCreatingTemplate(false);
      setNewTemplateTitle('');
      setNewTemplatePrompt('');
      
      // Auto select
      setActiveTemplate(newTpl);
      setCustomPrompt(newTpl.prompt);
 };

 const optimizeTemplatePrompt = async () => {
     if (!newTemplateTitle.trim()) {
         alert(t('multiDoc.template.alert.missingTitle'));
         return;
     }
     
     const config = getModelConfig('text');
     if (!config.apiKey) {
         alert(t('multiDoc.alert.missingApiKey'));
         return;
     }

     setIsOptimizingTemplatePrompt(true);
     
     try {
         const contextPrompt = getPrompt('multiDoc.template.optimize', locale, {
           title: newTemplateTitle,
           idea: newTemplatePrompt.trim()
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
             setNewTemplatePrompt(generatedPrompt);
         }

     } catch (err) {
         console.error('AI Optimization Error:', err);
         alert(t('multiDoc.template.alert.optimizeFail'));
     } finally {
         setIsOptimizingTemplatePrompt(false);
     }
 };

 const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
     e.stopPropagation();
     if (!confirm(t('multiDoc.template.confirm.delete'))) return;

      const updatedTemplates = templates.filter(t => t.id !== id);
      setTemplates(updatedTemplates);
      localStorage.setItem('custom_research_templates', JSON.stringify(updatedTemplates.filter(t => t.isCustom)));

      if (activeTemplate.id === id) {
          setActiveTemplate(updatedTemplates[0]);
          setCustomPrompt(updatedTemplates[0].prompt);
      }
  };

  // Unified File Parsing Logic
  const parseFile = async (file: File): Promise<string> => {
      try {
          if (file.name.endsWith('.docx')) {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            return result.value;
          } else if (file.name.endsWith('.pdf')) {
             if (typeof pdfjsLib === 'undefined') return "[Error: PDF parser not loaded. Please ensure scripts are loaded.]";
             
             // Setup worker manually if using CDN import without bundler
             if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
                 pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
             }

             const arrayBuffer = await file.arrayBuffer();
             const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
             const pdf = await loadingTask.promise;
             let fullText = '';
             // Limit to first 15 pages to avoid OOM on client side for large docs
             const maxPages = Math.min(pdf.numPages, 15); 
             for (let i = 1; i <= maxPages; i++) {
                 const page = await pdf.getPage(i);
                 const textContent = await page.getTextContent();
                 const pageText = textContent.items.map((item: any) => item.str).join(' ');
                 fullText += `--- Page ${i} ---\n${pageText}\n`;
             }
             return fullText;
          } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
             if (typeof XLSX === 'undefined') return "[Error: Excel parser not loaded]";
             const arrayBuffer = await file.arrayBuffer();
             const workbook = XLSX.read(arrayBuffer);
             let fullText = '';
             workbook.SheetNames.forEach((sheetName: string) => {
                 const sheet = workbook.Sheets[sheetName];
                 // Sheet to CSV is token efficient
                 const csv = XLSX.utils.sheet_to_csv(sheet);
                 fullText += `--- Sheet: ${sheetName} ---\n${csv}\n`;
             });
             return fullText;
          } else {
            // Treat as text (txt, md, py, js, etc.)
            return await file.text();
          }
      } catch (err) {
          console.error("Parse Error", err);
          return `[Error parsing file: ${file.name}]`;
      }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement> | DataTransfer) => {
    const isChangeEvent = 'target' in e;
    const fileList = isChangeEvent ? (e as React.ChangeEvent<HTMLInputElement>).target?.files : (e as DataTransfer).files;
    if (fileList) {
      const newFiles: FileItem[] = [];
      const isDeepResearch = mode === 'deep_research';

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        
        // Parse content
        const content = await parseFile(file);
        
        // Truncate based on mode
        // Deep research needs more context (e.g. 50k chars), others just need a snippet (1k chars)
        const limit = isDeepResearch ? 50000 : 1000;
        const snippet = content.substring(0, limit);

        newFiles.push({ file, contentSnippet: snippet, status: 'pending' });
      }
      setCurrentFiles(prev => [...prev, ...newFiles]);
    }
    if (isChangeEvent) {
      (e as React.ChangeEvent<HTMLInputElement>).target.value = '';
    }
  };
  
  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer);
    }
  };

  const handleRosterImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
          const text = await parseFile(file);
          const cleanList = text.split(/\r?\n/).map(l => l.trim()).filter(l => l).join('\n');
          setCurrentRosterText(cleanList);
      } catch (err) {
          alert(t('multiDoc.alert.rosterReadFail'));
      }
      if (e.target) e.target.value = '';
  };

  const createDocxBlob = async (text: string): Promise<Blob> => {
      const doc = new Document({
          sections: [{
              properties: {},
              children: text.split('\n').map(line => new Paragraph({
                  children: [new TextRun(line)],
              })),
          }],
      });
      return await Packer.toBlob(doc);
  };

  const loadSampleFiles = async () => {
    const samplesByLocale = MULTI_DOC_SAMPLES[locale] || MULTI_DOC_SAMPLES.zh;
    let samples: { name: string; text: string }[] = [];
    
    // 清除旧数据
    setCurrentFiles([]);
    setCurrentResultReport('');
    setCurrentCheckResult(null);

    if (mode === 'rename') {
        samples = samplesByLocale.rename;
        setCurrentRenamePattern(samplesByLocale.renamePatternSample);
    } else if (mode === 'report') {
        samples = samplesByLocale.report;
    } else if (mode === 'missing') {
        setCurrentRosterText(samplesByLocale.missing.roster);
        samples = samplesByLocale.missing.files;
    } else if (mode === 'deep_research') {
        if (activeTemplate.id === 'paper') {
            samples = samplesByLocale.deepResearch.paper;
        } else if (activeTemplate.id === 'theory') {
            samples = samplesByLocale.deepResearch.theory;
        } else if (activeTemplate.id === 'code') {
            samples = samplesByLocale.deepResearch.code;
        } else {
            samples = samplesByLocale.deepResearch.fallback;
        }
    }

    const newFiles: FileItem[] = [];
    for (const s of samples) {
        let blob;
        // If name implies docx, create docx blob, otherwise text/plain
        if (s.name.endsWith('.docx')) {
            blob = await createDocxBlob(s.text);
        } else {
            blob = new Blob([s.text], { type: 'text/plain' });
        }
        
        // Infer mime type
        const type = s.name.endsWith('.docx') 
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
            : 'text/plain';

        const file = new File([blob], s.name, { type });
        
        newFiles.push({
            file: file,
            contentSnippet: s.text,
            status: 'pending'
        });
    }
    setCurrentFiles(newFiles);
  };

  const clearFiles = () => {
    setCurrentFiles([]);
    // Note: Don't clear other modes' states here
    // Each mode tracks its own state independently
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const clearCurrentModeResults = () => {
    // Clear results for current mode only
    setCurrentResultReport('');
    if (mode === 'missing') {
      setCurrentCheckResult(null);
      setCurrentRosterText('');
    }
    setProgressText('');
    setProcessingStatus(null);
  };
  
  const saveToHistory = (currentMode: Mode, result: string) => {
    // 使用新的统一历史记录系统
    const currentFiles = getCurrentFiles();
    const currentRosterText = getCurrentRosterText();
    addHistoryItem({
      module: 'multidoc',
      status: 'success',
      title: currentMode === 'rename'
        ? t('multiDoc.history.rename.title', { count: currentFiles.length })
        : currentMode === 'report'
          ? t('multiDoc.history.report.title', { count: currentFiles.length })
          : currentMode === 'deep_research'
            ? t('multiDoc.history.deepResearch.title', { title: activeTemplate.title })
            : t('multiDoc.history.check.title', { count: currentRosterText.split('\n').filter(l => l.trim()).length }),
      preview: result.slice(0, 200) + (result.length > 200 ? '...' : ''),
      fullResult: result,
      metadata: {
        docMode: currentMode,
        fileCount: currentFiles.length
      }
    });
  };

  // --- Process Functions ---

  const processRename = async () => {
    const currentFiles = getCurrentFiles();
    if (currentFiles.length === 0) return;
    setIsProcessing(true);
    try {
      const inputs = currentFiles.map(f => ({
        originalName: f.file.name,
        contentStart: f.contentSnippet.replace(/\n/g, ' ').substring(0, 500)
      }));
      const effectivePattern = getCurrentRenamePattern() || t('multiDoc.renamePattern.default');
      const prompt = `${renamePrompt}\n\nIMPORTANT: Use this Target Naming Pattern: "${effectivePattern}"\n\nFiles to process:\n${JSON.stringify(inputs, null, 2)}`;
      
      // 🐛 调试：打印完整的 Prompt
      console.log('=== Rename Prompt ===');
      console.log(prompt);
      
      const response = await generateContent({
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
        prompt: prompt,
        jsonSchema: { type: Type.ARRAY }
      });
      
      // 🐛 调试：打印 AI 原始响应（前500字符）
      const truncatedRawResponse = response.substring(0, 500);
      console.log('=== AI Raw Response (first 500 chars) ===');
      console.log(truncatedRawResponse);
      
      let jsonStr = response.trim().replace(/```json|```/g, '');
      
      // 🐛 调试：打印 AI 响应的完整长度
      console.log('=== AI Response Length ===');
      console.log(response.length);
      
      // 🐛 调试：打印清理后的 JSON 字符串
      console.log('=== Cleaned JSON (removed ```json) ===');
      console.log(jsonStr);
      
      let mapping;
      
      // 健壮的JSON解析
      try {
        mapping = JSON.parse(jsonStr);
        
        // 🐛 调试：打印解析成功
        console.log('=== JSON Parse Success ===');
        console.log('Parsed type:', typeof mapping, 'isArray:', Array.isArray(mapping));
        console.log('Parsed result:', JSON.stringify(mapping, null, 2));
        
      } catch (parseError) {
        // 🐛 调试：打印解析失败
        console.log('=== JSON Parse Failed ===');
        console.log('Error:', parseError.message);
        console.log('JSON string:', jsonStr);
        throw new Error(t('multiDoc.error.aiFormat', { message: parseError.message }));
      }

      // 验证返回数据格式
      console.log('=== Validate Response Format ===');
      
      // AI 可能返回 { files: [...] } 或直接返回 [...]
      if (!Array.isArray(mapping) && mapping.files && Array.isArray(mapping.files)) {
        console.log('Detected object with files field; extracting files array');
        mapping = mapping.files;
      }
      
      if (!Array.isArray(mapping)) {
        console.error('❌ Error: AI returned non-array');
        throw new Error(t('multiDoc.error.aiFormatType', { type: typeof mapping }));
      }
      
      console.log('✓ Array validation passed, length:', mapping.length);
      
      console.log('✓ Array validation passed, length:', mapping.length);
      
      // 验证数组内容
      let validCount = 0;
      const validMapping = mapping.filter((m: any) => {
        const hasName = m.originalName && typeof m.originalName === 'string';
        const hasNewName = m.newName && typeof m.newName === 'string';
        const hasReason = m.reason && typeof m.reason === 'string';
        const isValid = hasName && hasNewName && hasReason;
        
        if (isValid) {
          // 🐛 调试：打印每个元素的验证结果
          console.log(`Item ${validCount + 1}:`, JSON.stringify(m, null, 2));
          validCount++;
        }
        
        return isValid;
      });
      
      console.log('✓ Valid rename results:', validMapping.length);

      if (validMapping.length === 0) {
        throw new Error(t('multiDoc.error.noValidRename'));
      }

      console.log('AI valid rename results:', validMapping);

      setCurrentFiles(prev => prev.map(f => {
        const match = validMapping.find((m: any) => m && m.originalName === f.file.name);
        
        // 🐛 调试：打印每个文件的匹配结果
        console.log(`Processing file: ${f.file.name}`);
        console.log('AI original name:', f.file.name);
        if (match) {
          console.log(`✅ Match found, new name: ${match.newName}`);
          console.log('  Reason:', match.reason);
        } else {
          console.warn('⚠️ No match found');
        }
        
        return match ? { ...f, newName: match.newName, reason: match.reason, status: 'done' } : f;
      }));
      
      const renamedCount = validMapping.length;
      
      // 保存到统一历史记录
      addHistoryItem({
        module: 'multidoc',
        status: 'success',
        title: t('multiDoc.history.rename.successTitle', { total: currentFiles.length, renamed: renamedCount }),
        preview: validMapping.slice(0, 3).map((m: any) => `${m.originalName} → ${m.newName}`).join('\n') + (validMapping.length > 3 ? '\n...' : ''),
        fullResult: JSON.stringify(validMapping),
        metadata: {
          docMode: 'rename',
          fileCount: currentFiles.length,
          renamedCount: renamedCount,
          failedCount: currentFiles.length - renamedCount
        }
      });
    } catch (e) {
      console.error(e);
      alert(t('multiDoc.alert.renameFail'));
    } finally {
      setIsProcessing(false);
    }
  };

  const processReport = async () => {
    const currentFiles = getCurrentFiles();
    if (currentFiles.length === 0) return;
    setIsProcessing(true);
    setShouldStop(false);
    setCurrentResultReport('');
    setProcessingStatus('preparing');
    setProgressText(t('multiDoc.progress.preparingFiles', { count: currentFiles.length }));
    
    try {
      setProcessingStatus('analyzing');
      setProgressText(t('multiDoc.progress.analyzingFiles', { count: currentFiles.length }));
      
      // Simulate file analysis progress
      for (let i = 0; i < currentFiles.length; i++) {
        if (shouldStop) {
          setProcessingStatus('completed');
          setProgressText('');
          setIsProcessing(false);
          return;
        }
        setCurrentFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'processing' } : f));
        await new Promise(resolve => setTimeout(resolve, 300)); // Small delay for UI update
      }
      
      const combinedContent = currentFiles.map((f, idx) => `--- Report ${idx + 1} (${f.file.name}) ---\n${f.contentSnippet}`).join('\n\n');
      const prompt = `${reportPrompt}\n\nReports Content:\n${combinedContent}`;
      
      setProcessingStatus('streaming');
      setProgressText(t('multiDoc.progress.generatingReport'));
      
      // Use streaming for real-time output
      const stream = generateContentStream({
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
        prompt: prompt
      });
      
      let fullText = '';
      for await (const chunk of stream) {
        if (shouldStop) {
          setProgressText(t('multiDoc.progress.stopped'));
          setProcessingStatus('completed');
          setIsProcessing(false);
          return;
        }
        fullText += chunk;
        setCurrentResultReport(fullText);
      }
      
      setCurrentFiles(prev => prev.map(f => ({ ...f, status: 'done' })));
      setProcessingStatus('completed');
      setProgressText(t('multiDoc.progress.reportDone'));
      
      // Save to history
      saveToHistory('report', fullText);
      
      setTimeout(() => {
        setProcessingStatus(null);
        setProgressText('');
      }, 3000);
    } catch (e) {
      console.error(e);
      setProgressText(t('multiDoc.progress.failedRetry'));
      setProcessingStatus('completed');
      setTimeout(() => {
        setProcessingStatus(null);
        setProgressText('');
      }, 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  const processCheckMissing = async () => {
      const currentFiles = getCurrentFiles();
      const currentRosterText = getCurrentRosterText();
      if (currentFiles.length === 0 || !currentRosterText.trim()) {
          alert(t('multiDoc.alert.missingRosterOrFiles'));
          return;
      }
      setIsProcessing(true);
      setCurrentCheckResult(null);

      try {
          const rosterList = currentRosterText.split(/\n|,|，/).map(s => s.trim()).filter(s => s);
          const fileInputs = currentFiles.map(f => ({
              fileName: f.file.name,
              snippet: f.contentSnippet.replace(/\n/g, ' ').substring(0, 200)
          }));

          const prompt = `${missingPrompt}\n\nClass Roster:\n${JSON.stringify(rosterList)}\n\nSubmitted Files:\n${JSON.stringify(fileInputs)}`;

          const response = await generateContent({
            apiKey: config.apiKey,
            model: config.model,
            baseUrl: config.baseUrl,
            prompt: prompt,
            jsonSchema: {
                type: Type.OBJECT,
                properties: {
                    submitted: { type: Type.ARRAY },
                    missing: { type: Type.ARRAY },
                    extras: { type: Type.ARRAY }
                }
            }
          });

          let jsonStr = response.trim().replace(/```json|```/g, '');
          const result = JSON.parse(jsonStr);
          setCurrentCheckResult(result);
          setCurrentFiles(prev => prev.map(f => ({ ...f, status: 'done' })));
          
          // 保存到统一历史记录
          addHistoryItem({
            module: 'multidoc',
            status: 'success',
            title: t('multiDoc.history.check.title', { count: getCurrentRosterText().split('\n').filter(l => l.trim()).length }),
            preview: t('multiDoc.history.check.preview', { submitted: result.submitted.length, missing: result.missing.length }),
            fullResult: JSON.stringify(result),
            metadata: {
              docMode: 'missing',
              fileCount: currentFiles.length
            }
          });

      } catch (e) {
          console.error(e);
          alert(t('multiDoc.alert.checkFail'));
      } finally {
          setIsProcessing(false);
      }
  };

  const processDeepResearch = async () => {
      const currentFiles = getCurrentFiles();
      if (currentFiles.length === 0) return;
      setIsProcessing(true);
      setShouldStop(false);
      setCurrentResultReport('');
      setProcessingStatus('preparing');
      setProgressText(t('multiDoc.progress.preparingDocs', { count: currentFiles.length }));
      
      try {
          setProcessingStatus('analyzing');
          setProgressText(t('multiDoc.progress.analyzingDocs', { count: currentFiles.length }));
          
          // Simulate file analysis progress
          for (let i = 0; i < currentFiles.length; i++) {
              if (shouldStop) {
                  setProcessingStatus('completed');
                  setProgressText('');
                  setIsProcessing(false);
                  return;
              }
              setCurrentFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'processing' } : f));
              await new Promise(resolve => setTimeout(resolve, 300)); // Small delay for UI update
          }
          
          // Combine all file contents
          let combinedDocs = '';
          currentFiles.forEach((f, i) => {
              combinedDocs += `\n\n=== DOCUMENT ${i+1}: ${f.file.name} ===\n${f.contentSnippet}\n`;
          });

          const prompt = `${customPrompt}\n\nDocuments to Analyze:\n${combinedDocs}`;
          
          setProcessingStatus('streaming');
          setProgressText(t('multiDoc.progress.generatingDeepReport'));
          
          // Use streaming for real-time output
          const stream = generateContentStream({
              apiKey: config.apiKey,
              model: config.model,
              baseUrl: config.baseUrl,
              prompt: prompt
          });
          
          let fullText = '';
          for await (const chunk of stream) {
              if (shouldStop) {
                  setProgressText(t('multiDoc.progress.stopped'));
                  setProcessingStatus('completed');
                  setIsProcessing(false);
                  return;
              }
              fullText += chunk;
              setCurrentResultReport(fullText);
          }
          
          setCurrentFiles(prev => prev.map(f => ({ ...f, status: 'done' })));
          setProcessingStatus('completed');
          setProgressText(t('multiDoc.progress.deepReportDone'));
          
          // Save to history
          saveToHistory('deep_research', fullText);
          
          setTimeout(() => {
              setProcessingStatus(null);
              setProgressText('');
          }, 3000);

      } catch (e) {
          console.error(e);
          setProgressText(t('multiDoc.progress.deepReportFail'));
          setProcessingStatus('completed');
          setTimeout(() => {
              setProcessingStatus(null);
              setProgressText('');
          }, 3000);
      } finally {
          setIsProcessing(false);
      }
  };

  // --- Downloads ---

  const handleDownloadFile = (fileItem: FileItem) => {
    const fileName = (fileItem.status === 'done' && fileItem.newName) ? fileItem.newName : fileItem.file.name;
    const url = URL.createObjectURL(fileItem.file);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = async () => {
      const currentFiles = getCurrentFiles();
      if (currentFiles.length === 0) return;
      const zip = new JSZip();
      let hasFiles = false;
      currentFiles.forEach(f => {
          if (f.file) {
              const fileName = (f.status === 'done' && f.newName) ? f.newName : f.file.name;
              zip.file(fileName, f.file);
              hasFiles = true;
          }
      });
      if (!hasFiles) return;
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `renamed_files_${new Date().getTime()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleDownloadReport = async () => {
      const currentReport = getCurrentResultReport();
      if (!currentReport) return;
      // Deep Research 默认使用学术模板，普通周报使用标准模板
      const tpl = mode === 'deep_research' ? WordTemplate.ACADEMIC : WordTemplate.STANDARD;
      await downloadDocx(currentReport, tpl);
  };

  const openSettings = () => {
      if (mode === 'rename') setTempPrompt(renamePrompt);
      else if (mode === 'report') setTempPrompt(reportPrompt);
      else if (mode === 'missing') setTempPrompt(missingPrompt);
      else setTempPrompt(customPrompt); // Deep research custom prompt
      setShowSettings(true);
  };

  const saveSettings = () => {
      if (mode === 'rename') {
          setRenamePrompt(tempPrompt);
          localStorage.setItem('prompt_rename', tempPrompt);
      } else if (mode === 'report') {
          setReportPrompt(tempPrompt);
          localStorage.setItem('prompt_report', tempPrompt);
      } else if (mode === 'missing') {
          setMissingPrompt(tempPrompt);
          localStorage.setItem('prompt_missing', tempPrompt);
      } else {
          // For deep research, we update the current active template's prompt locally in state if needed, 
          // but usually 'customPrompt' tracks the prompt for the current session/template.
          // If it's a custom template, we might want to persist it.
          setCustomPrompt(tempPrompt);
          // If it is a custom template, update it in storage
          if (activeTemplate.isCustom) {
               const updatedTemplates = templates.map(t => t.id === activeTemplate.id ? { ...t, prompt: tempPrompt } : t);
               setTemplates(updatedTemplates);
               localStorage.setItem('custom_research_templates', JSON.stringify(updatedTemplates.filter(t => t.isCustom)));
          }
      }
      setShowSettings(false);
  };

  const getActionName = () => {
      if (mode === 'rename') return t('multiDoc.action.rename');
      if (mode === 'report') return t('multiDoc.action.report');
      if (mode === 'deep_research') return t('multiDoc.action.deepResearch');
      return t('multiDoc.action.check');
  };

  const runProcess = () => {
      if (mode === 'rename') processRename();
      else if (mode === 'report') processReport();
      else if (mode === 'deep_research') processDeepResearch();
      else processCheckMissing();
  };

  return (
    <div className="p-6 lg:p-12 max-w-[1440px] mx-auto min-h-full flex flex-col">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-extrabold text-slate-900 mb-2">{t('multiDoc.title')}</h2>
        <p className="text-slate-500">{t('multiDoc.subtitle')}</p>
      </div>

      {/* Mode Switcher */}
      <div className="flex justify-center mb-8 overflow-x-auto">
        <div className="bg-slate-100 p-1 rounded-xl flex space-x-1 shadow-inner shrink-0">
           <button
            onClick={() => { setMode('deep_research'); clearFiles(); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center ${mode === 'deep_research' ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            {t('multiDoc.mode.deepResearch')}
          </button>
          <button
            onClick={() => { setMode('report'); clearFiles(); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${mode === 'report' ? 'bg-white text-[var(--primary-color)] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t('multiDoc.mode.report')}
          </button>
          <button
            onClick={() => { setMode('missing'); clearFiles(); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${mode === 'missing' ? 'bg-white text-rose-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t('multiDoc.mode.missing')}
          </button>
          <button
            onClick={() => { setMode('rename'); clearFiles(); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${mode === 'rename' ? 'bg-white text-[var(--primary-color)] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t('multiDoc.mode.rename')}
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white border border-slate-200 rounded-3xl p-6 lg:p-8 shadow-sm flex flex-col min-h-[500px]">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
                <h3 className="text-xl font-bold text-slate-800">
                    {mode === 'rename'
                      ? t('multiDoc.section.rename.title')
                      : mode === 'report'
                        ? t('multiDoc.section.report.title')
                        : mode === 'deep_research'
                          ? t('multiDoc.section.deepResearch.title')
                          : t('multiDoc.section.missing.title')}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                    {mode === 'rename' && t('multiDoc.section.rename.desc')}
                    {mode === 'report' && t('multiDoc.section.report.desc')}
                    {mode === 'missing' && t('multiDoc.section.missing.desc')}
                    {mode === 'deep_research' && t('multiDoc.section.deepResearch.desc')}
                </p>
            </div>
            <div className="flex space-x-3 w-full md:w-auto flex-wrap gap-y-2">
                 <button
                    onClick={openSettings}
                    className="flex-1 md:flex-none flex items-center justify-center px-3 py-2 text-xs font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                 >
                     <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                     {t('multiDoc.action.configurePrompt')}
                 </button>
                 <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 md:flex-none bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-all flex items-center justify-center"
                 >
                     <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                     {t('multiDoc.action.addFiles')}
                 </button>
                 <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept={mode === 'deep_research' ? ".pdf,.docx,.xlsx,.xls,.txt,.md,.py,.js,.java,.c,.cpp" : ".docx,.txt,.md"} />
            </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
            
            {/* Left/Top Area: Inputs */}
            <div className={`flex-1 flex flex-col ${mode === 'missing' ? 'lg:w-1/3 lg:flex-none' : 'w-full'}`}>
                
                {/* 1. Deep Research: Template Selection */}
                {mode === 'deep_research' && (
                    <div className="mb-6">
                        <div className="grid grid-cols-3 gap-3">
                            {templates.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => {
                                        setActiveTemplate(t);
                                        setCustomPrompt(t.prompt);
                                        // In deep_research mode, preserve resultReport when switching templates
                                        // Only clear progress and status
                                        if (mode === 'deep_research') {
                                            setProgressText('');
                                            setProcessingStatus(null);
                                        } else {
                                            clearCurrentModeResults();
                                        }
                                    }}
                                    className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${activeTemplate.id === t.id ? 'bg-purple-50 border-purple-500 text-purple-700 ring-1 ring-purple-500' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-500'}`}
                                >
                                    <svg className="w-6 h-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={t.icon} /></svg>
                                    <span className="text-xs font-bold text-center">{t.title}</span>
                                    
                                    {t.isCustom && (
                                        <div 
                                            onClick={(e) => handleDeleteTemplate(t.id, e)}
                                            className="absolute top-1 right-1 text-slate-300 hover:text-red-500 p-1"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </div>
                                    )}
                                </button>
                            ))}
                            {/* Create New Template Button */}
                            <button
                                onClick={() => setIsCreatingTemplate(true)}
                                className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-slate-300 bg-white text-slate-400 hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] hover:bg-[var(--primary-50)] transition-all"
                            >
                                <svg className="w-6 h-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                <span className="text-xs font-bold">{t('multiDoc.template.create')}</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* 2. Missing Mode: Roster Input */}
                {mode === 'missing' && (
                    <div className="mb-6 bg-rose-50 p-4 rounded-xl border border-rose-100 flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-rose-600 uppercase tracking-wider">{t('multiDoc.roster.label')}</label>
                            <button 
                                onClick={() => rosterInputRef.current?.click()}
                                className="text-[10px] bg-white border border-rose-200 text-rose-500 px-2 py-1 rounded hover:bg-rose-100 font-bold transition-colors"
                            >
                                {t('multiDoc.roster.import')}
                            </button>
                            <input type="file" ref={rosterInputRef} className="hidden" onChange={handleRosterImport} accept=".txt,.docx" />
                        </div>
                        <textarea
                            value={getCurrentRosterText()}
                            onChange={(e) => setCurrentRosterText(e.target.value)}
                            placeholder={t('multiDoc.roster.placeholder')}
                            className="w-full flex-1 min-h-[150px] lg:min-h-0 p-3 rounded-lg border border-rose-200 text-sm focus:ring-2 focus:ring-rose-500 outline-none resize-none bg-white text-slate-700"
                        />
                        <p className="text-[10px] text-rose-400 mt-2">{t('multiDoc.roster.hint')}</p>
                    </div>
                )}

                {/* 3. Rename Mode: Format Input */}
                {mode === 'rename' && (
                    <div className="mb-6 bg-[var(--primary-50)] p-4 rounded-xl border border-[var(--primary-color)] border-opacity-30">
                        <div className="flex flex-col space-y-2">
                            <div className="flex items-center text-[var(--primary-color)] font-bold text-sm">
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                {t('multiDoc.renamePattern.label')}
                            </div>
                            <input
                                type="text"
                                value={getCurrentRenamePattern()}
                                onChange={(e) => setCurrentRenamePattern(e.target.value)}
                                placeholder={t('multiDoc.renamePattern.placeholder')}
                                className="w-full px-4 py-2 rounded-lg border border-[var(--primary-color)] border-opacity-40 bg-white text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none text-slate-900"
                            />
                            {/* Sample Pill */}
                            <div className="pt-1">
                                <button
                                    onClick={() => setCurrentRenamePattern(t('multiDoc.renamePattern.sample'))}
                                    className="text-[10px] bg-white border border-[var(--primary-color)] border-opacity-40 text-[var(--primary-color)] px-2 py-0.5 rounded hover:bg-[var(--primary-color)] hover:text-white transition-all"
                                >
                                    {t('multiDoc.renamePattern.fillSample')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. File List Area */}
                {getCurrentFiles().length > 0 ? (
                    <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex-1 flex flex-col">
                        <div className="p-3 bg-slate-100 border-b border-slate-200 font-bold text-xs text-slate-500 flex justify-between">
                            <span>{t('multiDoc.files.count', { count: getCurrentFiles().length })}</span>
                            <button onClick={clearFiles} className="text-red-400 hover:text-red-600">{t('multiDoc.files.clear')}</button>
                        </div>
                        <div className="overflow-y-auto custom-scrollbar max-h-[300px] lg:max-h-[400px]">
                            <ul className="divide-y divide-slate-200">
                                {getCurrentFiles().map((f, i) => (
                                    <li key={i} className="p-3 flex justify-between items-center hover:bg-white text-sm">
                                        <div className="truncate pr-4 flex-1">
                                            <div className="text-slate-700 font-mono truncate" title={f.file.name}>{f.file.name}</div>
                                            {mode === 'rename' && f.newName && (
                                                <div className="text-[var(--primary-color)] font-bold font-mono text-xs mt-0.5 truncate">➜ {f.newName}</div>
                                            )}
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {f.status === 'done' && <span className="text-green-500 text-xs">✔</span>}
                                            {f.status === 'processing' && <span className="text-[var(--primary-color)] text-xs animate-pulse">...</span>}
                                            <button onClick={() => handleDownloadFile(f)} className="text-slate-400 hover:text-[var(--primary-color)]"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ) : (
                    // Empty State with Drag & Drop
                    <div
                        className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-slate-400 min-h-[200px] group transition-all relative ${
                            isDragOver
                                ? 'border-[var(--primary-color)] bg-[var(--primary-50)]'
                                : 'border-slate-200 hover:border-[var(--primary-color)] hover:bg-[var(--primary-50)]'
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                         <div className="absolute inset-0 cursor-pointer" onClick={() => fileInputRef.current?.click()}></div>
                         <svg className="w-10 h-10 mb-2 opacity-50 group-hover:text-[var(--primary-color)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                         </svg>
                         <span className="text-xs">
                           {t('multiDoc.files.dropHint')}
                           {mode === 'deep_research' ? ` ${t('multiDoc.files.dropHintDeep')}` : ''}
                         </span>
                        
                        {isDragOver && (
                            <div className="absolute inset-0 flex items-center justify-center bg-[var(--primary-color)]/10 backdrop-blur-sm z-10">
                                <span className="text-lg font-bold text-[var(--primary-color)]">{t('multiDoc.files.dropActive')}</span>
                            </div>
                        )}
                         
                         <button
                            onClick={(e) => { e.stopPropagation(); loadSampleFiles(); }}
                            className="mt-4 px-3 py-1.5 rounded-full bg-white text-[var(--primary-color)] text-xs font-bold border border-[var(--primary-color)] hover:bg-[var(--primary-color)] hover:text-white transition-all relative z-10"
                        >
                            {t('multiDoc.samples.load')}
                        </button>
                    </div>
                )}
                
                {/* Progress Bar */}
                {processingStatus && (
                    <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 animate-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                {processingStatus === 'preparing' && (
                                    <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                                )}
                                {processingStatus === 'analyzing' && (
                                    <svg className="w-6 h-6 text-blue-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                                )}
                                {processingStatus === 'streaming' && (
                                    <svg className="w-6 h-6 text-green-500 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                )}
                                <span className="text-sm font-bold text-slate-700">{progressText}</span>
                            </div>
                            <button
                                onClick={() => setShouldStop(true)}
                                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 border border-red-300 text-red-600 text-xs font-bold rounded-lg transition-colors flex items-center"
                            >
                                <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
                                {t('multiDoc.action.stop')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Action Button */}
                <div className="mt-6">
                    <button
                        onClick={runProcess}
                        disabled={getCurrentFiles().length === 0 || isProcessing || (mode === 'missing' && !getCurrentRosterText().trim())}
                        className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all ${
                            getCurrentFiles().length === 0 || isProcessing || (mode === 'missing' && !getCurrentRosterText().trim())
                            ? 'bg-slate-300 cursor-not-allowed'
                            : mode === 'deep_research' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:scale-105'
                            : 'bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] hover:scale-105'
                        }`}
                    >
                        {isProcessing ? t('multiDoc.action.processing') : getActionName()}
                    </button>

                    {mode === 'rename' && getCurrentFiles().some(f => f.status === 'done') && (
                        <button
                            onClick={handleDownloadAll}
                            className="w-full mt-3 py-3 rounded-xl font-bold text-[var(--primary-color)] bg-[var(--primary-50)] border border-[var(--primary-color)] hover:bg-[var(--primary-color)] hover:text-white transition-all flex items-center justify-center shadow-sm"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            {t('multiDoc.action.downloadZip')}
                        </button>
                    )}
                </div>

            </div>

            {/* Right/Bottom Area: Results */}
            {(mode === 'missing' || mode === 'report' || mode === 'deep_research') && (
                <div className="flex-[2] flex flex-col min-h-[400px]">
                    {mode === 'missing' && (
                        <div className="h-full bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-sm">
                            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                                <h4 className="font-bold text-slate-700">{t('multiDoc.check.title')}</h4>
                                {getCurrentCheckResult() && (
                                    <div className="text-xs space-x-2">
                                        <span className="text-green-600 font-bold">{t('multiDoc.check.submitted', { count: getCurrentCheckResult()!.submitted.length })}</span>
                                        <span className="text-red-500 font-bold">{t('multiDoc.check.missing', { count: getCurrentCheckResult()!.missing.length })}</span>
                                    </div>
                                )}
                            </div>
                            
                            {!getCurrentCheckResult() ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                                    <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <p className="text-sm">{t('multiDoc.check.emptyHint')}</p>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Missing Column */}
                                    <div className="border border-red-100 bg-red-50/50 rounded-xl overflow-hidden flex flex-col">
                                        <div className="bg-red-100/80 px-4 py-2 text-red-700 font-bold text-xs uppercase tracking-wide flex justify-between">
                                            <span>{t('multiDoc.check.missingList', { count: getCurrentCheckResult()!.missing.length })}</span>
                                        </div>
                                        <div className="p-3 overflow-y-auto max-h-[300px] custom-scrollbar">
                                            {getCurrentCheckResult()!.missing.length === 0 ? (
                                                <div className="text-green-500 text-sm text-center py-4">{t('multiDoc.check.allSubmitted')}</div>
                                            ) : (
                                                <ul className="space-y-1">
                                                    {getCurrentCheckResult()!.missing.map((name, idx) => (
                                                        <li key={idx} className="bg-white border border-red-100 px-3 py-2 rounded text-red-600 font-bold text-sm shadow-sm">
                                                            {name}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>

                                    {/* Submitted Column */}
                                    <div className="border border-green-100 bg-green-50/50 rounded-xl overflow-hidden flex flex-col">
                                        <div className="bg-green-100/80 px-4 py-2 text-green-700 font-bold text-xs uppercase tracking-wide flex justify-between">
                                            <span>{t('multiDoc.check.submittedList', { count: getCurrentCheckResult()!.submitted.length })}</span>
                                        </div>
                                        <div className="p-3 overflow-y-auto max-h-[300px] custom-scrollbar">
                                            <ul className="space-y-2">
                                                {getCurrentCheckResult()!.submitted.map((item, idx) => (
                                                    <li key={idx} className="bg-white border border-green-100 px-3 py-2 rounded text-slate-700 text-sm shadow-sm">
                                                        <span className="font-bold text-green-700 block">{item.name}</span>
                                                        <span className="text-[10px] text-slate-400 block truncate" title={item.fileName}>📄 {item.fileName}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Extras Column */}
                                    {getCurrentCheckResult()!.extras.length > 0 && (
                                        <div className="md:col-span-2 border border-slate-200 bg-slate-50 rounded-xl overflow-hidden mt-2">
                                            <div className="bg-slate-200/50 px-4 py-2 text-slate-600 font-bold text-xs uppercase tracking-wide">
                                                {t('multiDoc.check.extras', { count: getCurrentCheckResult()!.extras.length })}
                                            </div>
                                            <div className="p-3">
                                                 <div className="flex flex-wrap gap-2">
                                                    {getCurrentCheckResult()!.extras.map((name, idx) => (
                                                        <span key={idx} className="px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-500 truncate max-w-[200px]" title={name}>
                                                            {name}
                                                        </span>
                                                    ))}
                                                 </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {(mode === 'report' || mode === 'deep_research') && getCurrentResultReport() && (
                        <div className="h-full bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-sm">
                             <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                                 <h4 className="font-bold text-slate-700">{mode === 'deep_research' ? t('multiDoc.report.deepTitle') : t('multiDoc.report.weeklyTitle')}</h4>
                                 <button 
                                    onClick={handleDownloadReport}
                                    className="text-xs bg-white border border-slate-300 hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] px-3 py-1.5 rounded-lg font-bold transition-all shadow-sm flex items-center"
                                 >
                                     <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                     {t('multiDoc.action.exportWord')}
                                 </button>
                             </div>
                             <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-50">
                                 <div className="prose prose-slate max-w-none text-sm bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                    <ReactMarkdown>{getCurrentResultReport()}</ReactMarkdown>
                               </div>
                            </div>
                        </div>
                    )}
                     
                    {(mode === 'report' || mode === 'deep_research') && !getCurrentResultReport() && (
                         <div className="h-full flex flex-col items-center justify-center text-slate-300 border border-slate-200 border-dashed rounded-xl">
                            <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            <p className="text-sm">{t('multiDoc.report.placeholder')}</p>
                        </div>
                    )}
                </div>
            )}
        </div>

      </div>

      {/* Settings Modal (Reused for Config) */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-lg">
                        {t('multiDoc.settings.title', { mode: mode === 'rename'
                          ? t('multiDoc.settings.mode.rename')
                          : mode === 'report'
                            ? t('multiDoc.settings.mode.report')
                            : mode === 'deep_research'
                              ? t('multiDoc.settings.mode.deepResearch')
                              : t('multiDoc.settings.mode.missing') })}
                    </h3>
                    <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6">
                    <p className="text-xs text-slate-500 mb-2">{t('multiDoc.settings.desc')}</p>
                    <textarea 
                        className="w-full h-64 p-4 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[var(--primary-color)] outline-none resize-none font-mono bg-slate-50 text-slate-700 leading-relaxed shadow-inner"
                        value={tempPrompt}
                        onChange={(e) => setTempPrompt(e.target.value)}
                    ></textarea>
                    
                    <div className="mt-6 flex justify-end space-x-3">
                        <button 
                            onClick={() => setShowSettings(false)}
                            className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button 
                            onClick={saveSettings}
                            className="px-6 py-2.5 text-sm font-bold text-white bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] rounded-xl shadow-lg"
                        >
                            {t('common.save')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

     {/* Create Template Modal */}
      {isCreatingTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-lg">{t('multiDoc.template.modalTitle')}</h3>
                    <button onClick={() => setIsCreatingTemplate(false)} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('multiDoc.template.field.title')}</label>
                        <input 
                            type="text"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none bg-white"
                            placeholder={t('multiDoc.template.placeholder.title')}
                            value={newTemplateTitle}
                            onChange={(e) => setNewTemplateTitle(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('multiDoc.template.field.prompt')}</label>
                        <textarea 
                            className="w-full h-40 p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none resize-none font-mono bg-slate-50 text-slate-700"
                            placeholder={t('multiDoc.template.placeholder.prompt')}
                            value={newTemplatePrompt}
                            onChange={(e) => setNewTemplatePrompt(e.target.value)}
                        ></textarea>
                        
                        {/* AI 优化按钮 */}
                        <button
                            onClick={optimizeTemplatePrompt}
                            disabled={isOptimizingTemplatePrompt}
                            className={`mt-3 w-full py-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center ${
                                isOptimizingTemplatePrompt
                                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-[var(--primary-50)] to-purple-50 text-[var(--primary-color)] hover:from-[var(--primary-100)] hover:to-purple-100 border border-[var(--primary-200)]'
                            }`}
                        >
                            {isOptimizingTemplatePrompt ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    {t('multiDoc.template.optimizeRunning')}
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    {t('multiDoc.template.optimize')}
                                </>
                            )}
                        </button>
                    </div>
                    <div className="mt-4 flex justify-end space-x-2 pt-2">
                        <button
                            onClick={() => setIsCreatingTemplate(false)}
                            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={handleCreateTemplate}
                            disabled={isOptimizingTemplatePrompt}
                            className="px-6 py-2 text-xs font-bold text-white bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {t('multiDoc.template.createAction')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default MultiDocProcessor;
