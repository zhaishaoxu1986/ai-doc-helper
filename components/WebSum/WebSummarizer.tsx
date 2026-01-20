
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { getModelConfig } from '../../utils/settings';
import { generateContent } from '../../utils/aiHelper';
import { getPromptWithLocale, useI18n } from '../../utils/i18n';

const WebSummarizer: React.FC = () => {
  const { locale, t } = useI18n();
  const [url, setUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [prompt, setPrompt] = useState(() => getPromptWithLocale('prompt_web_sum', 'webSummarizer.default', locale));
  const [tempPrompt, setTempPrompt] = useState('');

  useEffect(() => {
    setPrompt(getPromptWithLocale('prompt_web_sum', 'webSummarizer.default', locale));
  }, [locale]);

  const config = getModelConfig('text');

  const fetchContent = async (targetUrl: string): Promise<string> => {
    // 使用 Jina Reader 解决 CORS 问题并获取高质量 Markdown
    // Jina Reader (https://jina.ai/reader) 是一个免费的转 Markdown 服务，对 LLM 非常友好
    try {
        const jinaUrl = `https://r.jina.ai/${targetUrl}`;
        const res = await fetch(jinaUrl);
        if (!res.ok) throw new Error(`Jina fetch failed: ${res.status}`);
        const markdown = await res.text();
        
        // 简单的错误检查，Jina 有时返回 "URL missing" 等文本
        if (markdown.includes("URL missing") || markdown.length < 50) {
            throw new Error("Content too short or invalid");
        }
        
        // 截断过长内容以节省 Token
        return markdown.substring(0, 20000); 
    } catch (e) {
        console.error("Content Fetch Error:", e);
        throw new Error("CORS_ERROR");
    }
  };

  const handleSummarize = async () => {
    if (!url) return;
    setIsProcessing(true);
    setError(null);
    setReport('');

    try {
        let contentToAnalyze = '';
        
        try {
            contentToAnalyze = await fetchContent(url);
        } catch (e: any) {
            setError(t('webSum.error.readFail'));
            setIsProcessing(false);
            return;
        }

        const fullPrompt = `${prompt}\n\n${contentToAnalyze}`;

        const response = await generateContent({
            apiKey: config.apiKey,
            model: config.model,
            baseUrl: config.baseUrl,
            prompt: fullPrompt
        });

        setReport(response);

    } catch (err) {
        console.error(err);
        setError(t('webSum.error.reportFail'));
    } finally {
        setIsProcessing(false);
    }
  };

  const openSettings = () => {
      setTempPrompt(prompt);
      setShowSettings(true);
  };

  const saveSettings = () => {
      setPrompt(tempPrompt);
      localStorage.setItem('prompt_web_sum', tempPrompt);
      setShowSettings(false);
  };

  return (
    <div className="p-6 lg:p-12 max-w-[1440px] mx-auto min-h-full flex flex-col">
       <div className="text-center mb-10">
        <h2 className="text-3xl font-extrabold text-slate-900 mb-2">{t('webSum.title')}</h2>
        <p className="text-slate-500">{t('webSum.subtitle')}</p>
      </div>

      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
         <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
             <div className="flex gap-4 mb-4">
                 <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                    </div>
                    <input 
                        type="text" 
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder={t('webSum.inputPlaceholder')}
                        className="w-full pl-10 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-700"
                    />
                 </div>
                 <button
                    onClick={openSettings}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-colors"
                    title={t('webSum.settings.title')}
                 >
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                 </button>
             </div>

             <button
                onClick={handleSummarize}
                disabled={!url || isProcessing}
                className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-all ${!url || isProcessing ? 'bg-slate-300' : 'bg-blue-600 hover:bg-blue-700'}`}
             >
                {isProcessing ? t('webSum.action.generating') : t('webSum.action.generate')}
             </button>

             {error && (
                 <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 flex items-start">
                     <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                     {error}
                 </div>
             )}
         </div>

         {report && (
             <div className="mt-8 bg-white p-8 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4">
                 <div className="prose prose-slate max-w-none">
                     <ReactMarkdown>{report}</ReactMarkdown>
                 </div>
                 <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                     <button 
                        onClick={() => navigator.clipboard.writeText(report)}
                        className="text-slate-500 hover:text-blue-600 font-bold text-sm flex items-center"
                     >
                         <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                         {t('webSum.action.copyReport')}
                     </button>
                 </div>
             </div>
         )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-lg">
                        {t('webSum.settings.title')}
                    </h3>
                    <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6">
                    <p className="text-xs text-slate-500 mb-2">{t('webSum.settings.desc')}</p>
                    <textarea 
                        className="w-full h-64 p-4 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none font-mono bg-slate-50 text-slate-700 leading-relaxed shadow-inner"
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
                            className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg"
                        >
                            {t('common.save')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default WebSummarizer;
