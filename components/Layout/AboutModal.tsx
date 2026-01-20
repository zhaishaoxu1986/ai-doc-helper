
import React, { useState } from 'react';
import { useI18n } from '../../utils/i18n';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'about' | 'privacy' | 'terms' | 'faq'>('about');
  const [logoError, setLogoError] = useState(false);

  if (!isOpen) return null;

  const renderContent = () => {
    switch (activeTab) {
      case 'about':
        return (
          <div className="space-y-4 animate-in fade-in duration-300 h-[540px] overflow-y-auto custom-scrollbar pr-2">
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 mb-4 flex items-center justify-center">
                {!logoError ? (
                  <img 
                    src="/logo.png" 
                    alt={t('about.logoAlt')} 
                    className="w-full h-full object-contain"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-3xl font-bold">A</span>
                  </div>
                )}
              </div>
              <h3 className="text-xl font-bold text-slate-900">AI Doc Helper</h3>
              <p className="text-slate-500 text-sm">{t('about.version')}</p>
            </div>
            <p className="text-slate-600 leading-relaxed text-sm">
              {t('about.description')}
            </p>
            
            <div className="mt-6 space-y-3">
              <h4 className="font-bold text-slate-800 text-sm">{t('about.features.title')}</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-lg border border-slate-100 hover:border-[var(--primary-color)] transition-colors">
                  <div className="flex items-center mb-1">
                    <span className="text-[var(--primary-color)] mr-2">📝</span>
                    <span className="font-bold text-slate-700 text-xs">{t('about.features.editor.title')}</span>
                  </div>
                  <p className="text-slate-500 text-xs">{t('about.features.editor.desc')}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-100 hover:border-[var(--primary-color)] transition-colors">
                  <div className="flex items-center mb-1">
                    <span className="text-[var(--primary-color)] mr-2">👁️</span>
                    <span className="font-bold text-slate-700 text-xs">{t('about.features.vision.title')}</span>
                  </div>
                  <p className="text-slate-500 text-xs">{t('about.features.vision.desc')}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-100 hover:border-[var(--primary-color)] transition-colors">
                  <div className="flex items-center mb-1">
                    <span className="text-[var(--primary-color)] mr-2">📚</span>
                    <span className="font-bold text-slate-700 text-xs">{t('about.features.multidoc.title')}</span>
                  </div>
                  <p className="text-slate-500 text-xs">{t('about.features.multidoc.desc')}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-100 hover:border-[var(--primary-color)] transition-colors">
                  <div className="flex items-center mb-1">
                    <span className="text-[var(--primary-color)] mr-2">🔍</span>
                    <span className="font-bold text-slate-700 text-xs">{t('about.features.research.title')}</span>
                  </div>
                  <p className="text-slate-500 text-xs">{t('about.features.research.desc')}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-100 hover:border-[var(--primary-color)] transition-colors">
                  <div className="flex items-center mb-1">
                    <span className="text-[var(--primary-color)] mr-2">📄</span>
                    <span className="font-bold text-slate-700 text-xs">{t('about.features.word.title')}</span>
                  </div>
                  <p className="text-slate-500 text-xs">{t('about.features.word.desc')}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-100 hover:border-[var(--primary-color)] transition-colors">
                  <div className="flex items-center mb-1">
                    <span className="text-[var(--primary-color)] mr-2">⚙️</span>
                    <span className="font-bold text-slate-700 text-xs">{t('about.features.prompt.title')}</span>
                  </div>
                  <p className="text-slate-500 text-xs">{t('about.features.prompt.desc')}</p>
                </div>
                
              </div>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-4">
              <h4 className="font-bold text-slate-800 text-sm mb-2">{t('about.note.title')}</h4>
              <p className="text-slate-500 text-xs italic">
                {t('about.note.quote')}
              </p>
            </div>
            
            <div className="mt-6 border-t border-slate-100 pt-4 flex flex-col items-center">
                <a 
                    href="https://github.com/cenzihan/ai-doc-helper.git" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center text-xs font-bold text-[var(--primary-color)] hover:text-[var(--primary-hover)] transition-colors mb-1"
                >
                    <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                    {t('about.links.github')}
                </a>
                <p className="text-[10px] text-slate-400">{t('about.links.team')}</p>
                <a href="mailto:cenzh3@mail2.sysu.edu.cn" className="text-[10px] text-slate-400 mt-1 hover:text-[var(--primary-color)] transition-colors">
                    {t('about.links.email')}
                </a>
            </div>
          </div>
        );
      case 'privacy':
        return (
          <div className="space-y-4 animate-in fade-in duration-300 h-[540px] overflow-y-auto custom-scrollbar pr-2">
            <h3 className="text-lg font-bold text-slate-900">{t('about.privacy.title')}</h3>
            <p className="text-xs text-slate-500 mb-4">{t('about.privacy.effectiveDate')}</p>
            
            <div className="text-sm text-slate-600 space-y-4">
              <section>
                <h4 className="font-bold text-slate-800 mb-1">{t('about.privacy.section1.title')}</h4>
                <p>{t('about.privacy.section1.desc')}</p>
              </section>

              <section>
                <h4 className="font-bold text-slate-800 mb-1">{t('about.privacy.section2.title')}</h4>
                <p>{t('about.privacy.section2.desc')}</p>
              </section>

              <section>
                <h4 className="font-bold text-slate-800 mb-1">{t('about.privacy.section3.title')}</h4>
                <p>{t('about.privacy.section3.desc')}</p>
              </section>
              
              <section>
                 <h4 className="font-bold text-slate-800 mb-1">{t('about.privacy.section4.title')}</h4>
                 <p>{t('about.privacy.section4.desc')}</p>
              </section>
            </div>
          </div>
        );
      case 'terms':
        return (
          <div className="space-y-4 animate-in fade-in duration-300 h-[540px] overflow-y-auto custom-scrollbar pr-2">
            <h3 className="text-lg font-bold text-slate-900">{t('about.terms.title')}</h3>
            
            <div className="text-sm text-slate-600 space-y-4">
              <section>
                  <h4 className="font-bold text-slate-800 mb-1">{t('about.terms.section1.title')}</h4>
                  <p>{t('about.terms.section1.desc')}</p>
              </section>

              <section>
                  <h4 className="font-bold text-slate-800 mb-1">{t('about.terms.section2.title')}</h4>
                  <p>{t('about.terms.section2.desc')}</p>
              </section>

              <section>
                  <h4 className="font-bold text-slate-800 mb-1">{t('about.terms.section3.title')}</h4>
                  <p>{t('about.terms.section3.desc')}</p>
              </section>

              <section>
                  <h4 className="font-bold text-slate-800 mb-1">{t('about.terms.section4.title')}</h4>
                  <p>{t('about.terms.section4.desc')}</p>
              </section>
            </div>
          </div>
        );
      case 'faq':
        return (
          <div className="space-y-4 animate-in fade-in duration-300 h-[540px] overflow-y-auto custom-scrollbar pr-2">
            <h3 className="text-lg font-bold text-slate-900">{t('about.faq.title')}</h3>
            <div className="space-y-3">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="font-bold text-slate-800 text-xs mb-1">{t('about.faq.apiGet.q')}</p>
                <p className="text-slate-500 text-xs leading-relaxed">
                  {t('about.faq.apiGet.a')}
                  <br />
                  <a href="https://www.siliconflow.cn/" target="_blank" rel="noopener noreferrer" className="text-[var(--primary-color)] hover:underline font-medium">
                    {t('about.faq.apiGet.link1')}
                  </a>
                  <br />
                  <a href="https://bailian.console.aliyun.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--primary-color)] hover:underline font-medium">
                    {t('about.faq.apiGet.link2')}
                  </a>
                  <br />
                  <a href="https://www.aliyun.com/product/dashscope" target="_blank" rel="noopener noreferrer" className="text-[var(--primary-color)] hover:underline font-medium">
                    {t('about.faq.apiGet.link3')}
                  </a>
                  <br />
                  
                  <span className="font-bold text-slate-600">{t('about.faq.apiGet.tipLabel')}</span>
                  <span className="text-slate-500">{t('about.faq.apiGet.tip')}</span>
                </p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="font-bold text-slate-800 text-xs mb-1">{t('about.faq.apiConfig.q')}</p>
                <p className="text-slate-500 text-xs leading-relaxed">
                  {t('about.faq.apiConfig.a')}
                  
                  <span className="block mt-2 font-medium text-slate-600">{t('about.faq.apiConfig.item1')}</span>
                  <span className="block font-medium text-slate-600">{t('about.faq.apiConfig.item2')}</span>
                  <span className="block font-medium text-slate-600">{t('about.faq.apiConfig.item3')}</span>
                  
                  <span className="block mt-2 text-slate-600">{t('about.faq.apiConfig.tip')}</span>
                </p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="font-bold text-slate-800 text-xs mb-1">{t('about.faq.cost.q')}</p>
                <p className="text-slate-500 text-xs leading-relaxed">
                  {t('about.faq.cost.a')}
                  <br />
                  <span className="block mt-2 font-medium text-slate-600">{t('about.faq.cost.item1')}</span>
                  <span className="block font-medium text-slate-600">{t('about.faq.cost.item2')}</span>
                  <span className="block font-medium text-slate-600">{t('about.faq.cost.item3')}</span>
                  <span className="block font-medium text-slate-600">{t('about.faq.cost.item4')}</span>
                </p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="font-bold text-slate-800 text-xs mb-1">{t('about.faq.exportImages.q')}</p>
                <p className="text-slate-500 text-xs">{t('about.faq.exportImages.a')}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="font-bold text-slate-800 text-xs mb-1">{t('about.faq.wechatImages.q')}</p>
                <p className="text-slate-500 text-xs">{t('about.faq.wechatImages.a')}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="font-bold text-slate-800 text-xs mb-1">{t('about.faq.formulaToImage.q')}</p>
                <p className="text-slate-500 text-xs">{t('about.faq.formulaToImage.a')}</p>
              </div>
            </div>
          </div>
        );
    }
  };

  const tabs = [
    { id: 'about', label: t('about.tabs.about') },
    { id: 'faq', label: t('about.tabs.faq') },
    { id: 'privacy', label: t('about.tabs.privacy') },
    { id: 'terms', label: t('about.tabs.terms') },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl relative z-10 flex overflow-hidden h-[600px]">
        
        {/* Sidebar */}
        <div className="w-48 bg-slate-50 border-r border-slate-200 p-4 flex flex-col">
          <div className="mb-6 px-2">
             <span className="text-xs font-black text-slate-400 uppercase tracking-wider">{t('about.sidebar.title')}</span>
          </div>
          <nav className="space-y-1 flex-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-[var(--primary-color)] shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:bg-slate-200/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="text-[10px] text-slate-300 px-2 mt-auto">
            © 2025 AI Doc Helper
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 relative">
           <button 
             onClick={onClose}
             className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
           {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default AboutModal;
