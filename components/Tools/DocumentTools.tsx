
import React, { useState } from 'react';
import { getModelConfig } from '../../utils/settings';
import { generateContent } from '../../utils/aiHelper';
import { getPrompt, useI18n } from '../../utils/i18n';

interface DocumentToolsProps {
  markdown: string;
  onUpdate: (val: string) => void;
}

const DocumentTools: React.FC<DocumentToolsProps> = ({ markdown, onUpdate }) => {
  const { locale, t } = useI18n();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);

  const runAITool = async (toolName: string, prompt: string) => {
    // Use 'text' model config
    const config = getModelConfig('text');
    if (!config.apiKey) {
        alert(t('docTools.alert.missingApiKey'));
        return;
    }

    setIsProcessing(true);
    setActiveTool(toolName);
    try {
      const newContent = await generateContent({
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
        prompt: getPrompt('docTools.wrapper', locale, { prompt, content: markdown })
      });
      
      onUpdate(newContent);
    } catch (err) {
      console.error('AI Tool Error:', err);
      alert(t('docTools.alert.fail'));
    } finally {
      setIsProcessing(false);
      setActiveTool(null);
    }
  };

  const tools = [
    {
      id: 'pre-export',
      title: t('docTools.tool.preExport.title'),
      desc: t('docTools.tool.preExport.desc'),
      prompt: getPrompt('docTools.preExport', locale),
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'
    },
    {
      id: 'format',
      title: t('docTools.tool.format.title'),
      desc: t('docTools.tool.format.desc'),
      prompt: getPrompt('docTools.format', locale),
      icon: 'M4 6h16M4 12h16m-7 6h7'
    },
    {
      id: 'polish',
      title: t('docTools.tool.polish.title'),
      desc: t('docTools.tool.polish.desc'),
      prompt: getPrompt('docTools.polish', locale),
      icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
    },
    {
      id: 'math',
      title: t('docTools.tool.math.title'),
      desc: t('docTools.tool.math.desc'),
      prompt: getPrompt('docTools.math', locale),
      icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z'
    }
  ];

  const activeConfig = getModelConfig('text');

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20">
      <div className="text-center">
        <div className="inline-block px-4 py-1.5 mb-4 rounded-full bg-[var(--primary-50)] text-[var(--primary-color)] text-xs font-bold uppercase tracking-widest">
          {t('docTools.badge')}
        </div>
        <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">{t('docTools.title')}</h2>
        <div className="flex items-center justify-center space-x-2 text-slate-500 mb-6">
            <span className="text-lg">{t('docTools.subtitle')}</span>
        </div>
        
        {/* Model Indicator */}
        <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-slate-200 bg-white shadow-sm">
             <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
             <span className="text-xs font-bold text-slate-600">{t('docTools.currentEngine', { model: activeConfig.modelName })}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {tools.map((tool) => (
          <div 
            key={tool.id} 
            className={`group relative bg-white border border-slate-200 rounded-[32px] p-8 transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 ${
              activeTool === tool.id ? 'ring-2 ring-[var(--primary-color)] border-transparent' : 'hover:border-[var(--primary-color)] hover:border-opacity-30'
            }`}
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-8 transition-all duration-500 ${
              activeTool === tool.id ? 'bg-[var(--primary-color)] text-white rotate-12' : 'bg-slate-50 text-slate-400 group-hover:bg-[var(--primary-50)] group-hover:text-[var(--primary-color)]'
            }`}>
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tool.icon} />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">{tool.title}</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-10 h-10">{tool.desc}</p>
            
            <button
              onClick={() => runAITool(tool.id, tool.prompt)}
              disabled={isProcessing}
              className={`w-full py-4 rounded-2xl text-sm font-black transition-all ${
                activeTool === tool.id
                  ? 'bg-[var(--primary-color)] text-white shadow-xl'
                  : isProcessing
                  ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                  : 'bg-slate-900 text-white hover:bg-[var(--primary-color)] hover:shadow-xl active:scale-95'
              }`}
            >
              {activeTool === tool.id ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('docTools.action.processing')}
                </span>
              ) : t('docTools.action.run')}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-br from-[var(--primary-color)] to-[var(--primary-hover)] rounded-[32px] p-10 text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center md:space-x-8">
          <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-md mb-6 md:mb-0">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="text-xl font-bold mb-2">{t('docTools.privacy.title')}</h4>
            <p className="text-white opacity-90 text-sm leading-relaxed max-w-2xl">
              {t('docTools.privacy.desc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentTools;
