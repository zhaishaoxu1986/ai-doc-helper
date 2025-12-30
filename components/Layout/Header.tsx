
import React, { useState } from 'react';
import { AppView } from '../../types';
import UserCenter from './UserCenter';
import AboutModal from './AboutModal';
import { getModelConfig } from '../../utils/settings';

interface HeaderProps {
  currentView: AppView;
  setView: (view: AppView) => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, setView }) => {
  const [showAbout, setShowAbout] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const activeConfig = getModelConfig(currentView === AppView.AI_VISION ? 'ocr' : 'text');

  const tabs = [
    { id: AppView.EDITOR, name: '编辑器 (Editor)', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
    { id: AppView.AI_VISION, name: 'AI 视觉 (Vision)', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
    { id: AppView.MULTI_DOC, name: '多文档处理', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: AppView.AI_RESEARCH, name: 'AI 调研 (Research)', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  ];

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm relative">
        <div className="flex items-center space-x-3 group cursor-pointer z-10" onClick={() => window.location.reload()}>
          {/* Logo 区域 */}
          <div className="w-8 h-8 relative flex items-center justify-center">
            {!logoError ? (
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="w-full h-full object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm transition-transform group-hover:scale-105" style={{ background: 'linear-gradient(to top right, var(--primary-color), var(--primary-hover))' }}>
                 <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                 </svg>
              </div>
            )}
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-800 hidden md:block hover:text-[var(--primary-color)] transition-colors font-mono">AI Doc Helper</h1>
        </div>

        {/* 居中导航栏 - 使用绝对定位确保完美居中 */}
        <nav className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex space-x-1 bg-slate-50 p-1 rounded-xl border border-slate-200 overflow-x-auto custom-scrollbar max-w-[60vw]">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                currentView === tab.id 
                  ? 'bg-white shadow-sm text-[var(--primary-color)] ring-1 ring-slate-100' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
              }`}
            >
              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>

        <div className="flex items-center space-x-3 z-10">
          <div className="hidden lg:flex items-center px-3 py-1 bg-[var(--primary-50)] border border-[var(--primary-50)] rounded-full mr-1">
             <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-color)] mr-2 animate-pulse"></span>
             <span className="text-[10px] font-bold text-[var(--primary-color)] whitespace-nowrap">当前引擎: {activeConfig.modelName}</span>
          </div>

          <button 
            onClick={() => setShowAbout(true)}
            className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 text-slate-400 hover:text-[var(--primary-color)] hover:border-[var(--primary-50)] hover:bg-[var(--primary-50)] flex items-center justify-center transition-all font-bold text-sm"
            title="关于我们 & 帮助"
          >
            ?
          </button>
          <div className="h-6 w-[1px] bg-slate-200"></div>
          <UserCenter />
        </div>
      </header>

      <AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />
    </>
  );
};

export default Header;
