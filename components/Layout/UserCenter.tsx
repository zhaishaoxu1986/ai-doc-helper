
import React, { useState, useEffect } from 'react';
import { saveUserSettings, getUserSettings, AVAILABLE_MODELS, getModelConfig, THEME_PRESETS, saveTheme, getTheme, saveSerperKey } from '../../utils/settings';

const UserCenter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Settings State
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [serperKey, setSerperKey] = useState(''); // New state for Serper Key
  
  // Text Model State
  const [textModel, setTextModel] = useState('');
  const [useCustomTextModel, setUseCustomTextModel] = useState(false);
  const [customTextModelName, setCustomTextModelName] = useState('');

  // OCR Model State
  const [ocrModel, setOcrModel] = useState(''); 
  const [separateOcr, setSeparateOcr] = useState(false);

  // Theme State
  const [activeTheme, setActiveTheme] = useState('blue');

  const [isSaved, setIsSaved] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // 当 refreshKey 变化时，重新获取配置
  const [textConfigState, setTextConfigState] = useState(() => getModelConfig('text'));

  useEffect(() => {
    if (showSettings) {
      const settings = getUserSettings();
      setApiKey(settings.apiKey);
      setBaseUrl(settings.baseUrl);
      setSerperKey(settings.serperKey); // Load Serper Key
      
      // Initialize Text Model
      const storedModel = settings.model;
      const isPreset = AVAILABLE_MODELS.some(m => m.id === storedModel);
      
      if (isPreset) {
        setTextModel(storedModel);
        setUseCustomTextModel(false);
        setCustomTextModelName('');
      } else if (storedModel) {
        setUseCustomTextModel(true);
        setCustomTextModelName(storedModel);
        setTextModel('');
      } else {
        setTextModel(AVAILABLE_MODELS[0].id);
        setUseCustomTextModel(false);
      }

      // Initialize OCR Model
      const storedOcr = settings.ocrModel;
      if (storedOcr && storedOcr !== storedModel) {
        setSeparateOcr(true);
        setOcrModel(storedOcr);
      } else {
        setSeparateOcr(false);
        setOcrModel(AVAILABLE_MODELS[0].id);
      }

      // Initialize Theme
      setActiveTheme(settings.theme);
    }
  }, [showSettings]);

  // 监听 refreshKey 变化，更新当前引擎显示
  useEffect(() => {
    setTextConfigState(getModelConfig('text'));
  }, [refreshKey]);

  const handleSave = () => {
    const finalTextModel = useCustomTextModel ? customTextModelName.trim() : textModel;
    const finalOcrModel = separateOcr ? ocrModel : ''; 
    
    if (useCustomTextModel && !finalTextModel) {
        alert("请输入自定义模型名称");
        return;
    }

    saveUserSettings(apiKey, finalTextModel, finalOcrModel, useCustomTextModel ? baseUrl.trim() : baseUrl.trim());
    saveTheme(activeTheme);
    saveSerperKey(serperKey); // Save Serper Key

    // 触发重新渲染以更新【当前引擎】显示
    setRefreshKey(prev => prev + 1);
    
    // Dispatch custom event to notify other components (like Header) to update
    window.dispatchEvent(new Event('user-settings-change'));
    
    // Dispatch custom event to notify App.tsx to reload theme immediately
    window.dispatchEvent(new Event('theme-change'));

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const textConfig = textConfigState;
  const hasKey = !!textConfig.apiKey;
  
  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 p-1.5 pr-3 rounded-full transition-all border group ${hasKey ? 'bg-white border-slate-200 hover:border-[var(--primary-color)]' : 'bg-red-50 border-red-200'}`}
      >
        <div 
            className={`w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm transition-transform ${hasKey ? 'bg-[var(--primary-color)]' : 'bg-red-500'}`}
            style={hasKey ? { background: 'linear-gradient(to top right, var(--primary-color), var(--primary-hover))' } : {}}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div className="flex flex-col items-start">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${hasKey ? 'text-slate-500' : 'text-red-500'}`}>
                {hasKey ? 'Pro User' : 'No Key'}
            </span>
        </div>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-3 w-80 bg-white rounded-[24px] shadow-2xl border border-slate-200 z-50 p-6 animate-in fade-in zoom-in duration-200 origin-top-right">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">用户中心</h3>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold">V2.0</span>
            </div>
            
            <div className="space-y-4">
              <div className={`p-4 rounded-2xl ${hasKey ? 'bg-[var(--primary-50)]' : 'bg-red-50'}`}>
                <p className={`text-xs font-bold uppercase mb-1 ${hasKey ? 'text-[var(--primary-color)]' : 'text-red-700'}`}>AI 引擎状态</p>
                <div className={`flex items-center ${hasKey ? 'text-[var(--primary-color)]' : 'text-red-600'}`}>
                  <div className={`w-2 h-2 rounded-full mr-2 animate-pulse ${hasKey ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm font-medium truncate">
                    {hasKey ? `当前: ${textConfig.modelName}` : '未配置有效 Key'}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button 
                  onClick={() => { setShowSettings(true); setIsOpen(false); }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors border border-slate-100"
                >
                    <div className="flex items-center">
                        <svg className="w-5 h-5 mr-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span className="font-bold text-sm">配置 API Key & 主题</span>
                    </div>
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowSettings(false)}></div>
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg relative z-10 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black text-slate-900">个性化配置</h2>
                        <p className="text-slate-500 text-xs mt-1">定制您的 AI 引擎与界面主题</p>
                    </div>
                    <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 space-y-8 overflow-y-auto">
                    {/* 0. 主题颜色配置 */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
                            <span className="bg-slate-200 text-slate-600 w-5 h-5 rounded flex items-center justify-center text-xs mr-2">1</span>
                            主题颜色 (Theme)
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                            {THEME_PRESETS.map(theme => (
                                <button
                                    key={theme.id}
                                    onClick={() => setActiveTheme(theme.id)}
                                    className={`flex items-center p-2 rounded-xl border transition-all ${activeTheme === theme.id ? 'bg-[var(--primary-50)] border-[var(--primary-color)] ring-1 ring-[var(--primary-color)]' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                >
                                    <div className="w-6 h-6 rounded-full shadow-sm mr-2" style={{ backgroundColor: theme.color }}></div>
                                    <span className="text-xs font-bold text-slate-700">{theme.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 1. 主模型配置 */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
                            <span className="bg-[var(--primary-50)] text-[var(--primary-color)] w-5 h-5 rounded flex items-center justify-center text-xs mr-2">2</span>
                            主模型 (Chat/Text)
                        </h3>
                        <div className="space-y-3">
                            {AVAILABLE_MODELS.map(model => (
                                <label key={model.id} className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${(!useCustomTextModel && textModel === model.id) ? 'bg-[var(--primary-50)] border-[var(--primary-color)] ring-1 ring-[var(--primary-color)]' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                    <input 
                                        type="radio" 
                                        name="text_model" 
                                        value={model.id}
                                        checked={!useCustomTextModel && textModel === model.id}
                                        onChange={() => {
                                            setUseCustomTextModel(false);
                                            setTextModel(model.id);
                                            setApiKey(''); 
                                            setBaseUrl('');
                                        }}
                                        className="w-4 h-4 text-[var(--primary-color)] focus:ring-[var(--primary-color)]"
                                    />
                                    <div className="ml-3">
                                        <span className="block text-sm font-bold text-slate-700">{model.name}</span>
                                    </div>
                                </label>
                            ))}
                            
                            {/* 自定义模型选项 */}
                            <div className={`rounded-xl border transition-all overflow-hidden ${useCustomTextModel ? 'bg-[var(--primary-50)] border-[var(--primary-color)] ring-1 ring-[var(--primary-color)]' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                <label className="flex items-center p-3 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="text_model" 
                                        value="custom"
                                        checked={useCustomTextModel}
                                        onChange={() => setUseCustomTextModel(true)}
                                        className="w-4 h-4 text-[var(--primary-color)] focus:ring-[var(--primary-color)]"
                                    />
                                    <div className="ml-3">
                                        <span className="block text-sm font-bold text-slate-700">自定义模型 (Custom)</span>
                                    </div>
                                </label>
                                {useCustomTextModel && (
                                    <div className="px-3 pb-3 pl-10">
                                        <input 
                                            type="text" 
                                            value={customTextModelName}
                                            onChange={(e) => setCustomTextModelName(e.target.value)}
                                            placeholder="输入模型 ID (如: deepseek-chat)"
                                            className="w-full px-3 py-2 rounded-lg border border-[var(--primary-color)] bg-white text-sm font-mono outline-none text-slate-900"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 2. OCR 模型配置 */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center">
                                <span className="bg-slate-100 text-slate-500 w-5 h-5 rounded flex items-center justify-center text-xs mr-2">3</span>
                                独立 OCR 模型 (Vision)
                            </h3>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={separateOcr} onChange={(e) => setSeparateOcr(e.target.checked)} />
                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--primary-color)]"></div>
                            </label>
                        </div>
                        
                        {separateOcr && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-200 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <p className="text-xs text-slate-500 mb-2">部分模型（如纯文本模型）不支持图片识别。您可以在此指定一个专门用于 OCR 的视觉模型。</p>
                                <select 
                                    value={ocrModel}
                                    onChange={(e) => setOcrModel(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-[var(--primary-color)] outline-none bg-white"
                                >
                                    {AVAILABLE_MODELS.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* 3. API Key & URL Overrides */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
                            <span className="bg-slate-200 text-slate-600 w-5 h-5 rounded flex items-center justify-center text-xs mr-2">4</span>
                            参数覆盖 (Global Overrides)
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">API Key</label>
                                <input 
                                    type="password" 
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder={(!apiKey && !useCustomTextModel) ? "使用预设模型的默认 Key" : "覆盖默认 Key (sk-...)"}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-mono placeholder:text-slate-400 focus:border-[var(--primary-color)] outline-none text-slate-900"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Base URL</label>
                                <input 
                                    type="text" 
                                    value={baseUrl}
                                    onChange={(e) => setBaseUrl(e.target.value)}
                                    placeholder={(!baseUrl && !useCustomTextModel) ? "使用预设模型的默认 URL" : "覆盖默认 URL"}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-mono placeholder:text-slate-400 focus:border-[var(--primary-color)] outline-none text-slate-900"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Serper API Key</label>
                                <input 
                                    type="password" 
                                    value={serperKey}
                                    onChange={(e) => setSerperKey(e.target.value)}
                                    placeholder="使用默认 Key"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-mono placeholder:text-slate-400 focus:border-[var(--primary-color)] outline-none text-slate-900"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end space-x-3 mt-auto">
                    <button onClick={() => setShowSettings(false)} className="px-5 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors">取消</button>
                    <button 
                        onClick={handleSave}
                        className={`px-6 py-2 rounded-lg font-bold text-white shadow-md transition-all text-sm flex items-center ${isSaved ? 'bg-green-500' : 'bg-[var(--primary-color)] hover:bg-[var(--primary-hover)]'}`}
                    >
                        {isSaved ? '已保存配置' : '保存更改'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default UserCenter;
