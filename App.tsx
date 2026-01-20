
import React, { useState, useCallback, useEffect } from 'react';
import Header from './components/Layout/Header';
import MarkdownEditor from './components/Editor/MarkdownEditor';
import WordPreview from './components/Preview/WordPreview';
import FormulaOCR from './components/OCR/FormulaOCR';
import MultiDocProcessor from './components/MultiDoc/MultiDocProcessor';
import AIResearch from './components/Research/AIResearch';
import { AppView, DocumentState, ResearchState } from './types';
import { getTheme } from './utils/settings';
import { getDefaultMarkdown, getInitialLocale, useI18n } from './utils/i18n';

const App: React.FC = () => {
  const { locale, t } = useI18n();
  const defaultMarkdown = getDefaultMarkdown(locale);
  const [view, setView] = useState<AppView>(AppView.EDITOR);
  const [docState, setDocState] = useState<DocumentState>(() => {
    const savedMarkdown = localStorage.getItem('markeditor_content');
    return {
      markdown: savedMarkdown || getDefaultMarkdown(getInitialLocale()),
      isProcessing: false,
      progress: 0
    };
  });

  const [researchState, setResearchState] = useState<ResearchState>(() => {
    const savedTopic = localStorage.getItem('research_topic');
    const savedReport = localStorage.getItem('research_report');
    const savedSources = localStorage.getItem('research_sources');
    const savedLogs = localStorage.getItem('research_logs');
    
    return {
      topic: savedTopic || '',
      isRunning: false,
      logs: savedLogs ? JSON.parse(savedLogs) : [],
      report: savedReport || '',
      sources: savedSources ? JSON.parse(savedSources) : []
    };
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

  // Sync default markdown when locale changes and user hasn't modified it
  useEffect(() => {
    const current = docState.markdown;
    const defaultZh = getDefaultMarkdown('zh');
    const defaultEn = getDefaultMarkdown('en');
    if ((current === defaultZh || current === defaultEn) && current !== defaultMarkdown) {
      setDocState(prev => ({ ...prev, markdown: defaultMarkdown }));
    }
  }, [defaultMarkdown, docState.markdown]);

  // Save markdown to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('markeditor_content', docState.markdown);
  }, [docState.markdown]);

  // Reset to default content
  const handleResetToDefault = useCallback(() => {
    if (confirm(t('editor.resetConfirm'))) {
      setDocState(prev => ({ ...prev, markdown: defaultMarkdown }));
    }
  }, [defaultMarkdown, t]);

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

  // We need a specific handler for Replacing content vs Appending
  const handleReplaceEditor = useCallback((newContent: string) => {
      setDocState(prev => ({ ...prev, markdown: newContent }));
      setView(AppView.EDITOR);
  }, []);

  const handleResearchStateUpdate = useCallback((updates: Partial<ResearchState> | ((prev: ResearchState) => ResearchState)) => {
    setResearchState(prev => {
      if (typeof updates === 'function') {
        return updates(prev);
      }
      return { ...prev, ...updates };
    });
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
                onResetToDefault={handleResetToDefault}
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

        {view === AppView.AI_RESEARCH && (
          <div className="h-full animate-in slide-in-from-bottom-4 duration-300 overflow-y-auto">
            <AIResearch 
              state={researchState}
              onUpdateState={handleResearchStateUpdate}
              onInsert={insertAtCursor} 
              onReplace={handleReplaceEditor} 
            />
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
