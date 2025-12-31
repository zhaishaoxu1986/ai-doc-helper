import React, { useState, useEffect } from 'react';
import { 
  getAllHistory, 
  deleteHistoryItem, 
  clearAllHistory, 
  getHistoryByModule,
  getHistoryStats,
  formatHistoryTime,
  HistoryModule,
  UnifiedHistoryItem
} from '../../utils/historyManager';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onItemClick?: (item: UnifiedHistoryItem) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ isOpen, onClose, onItemClick }) => {
  const [history, setHistory] = useState<UnifiedHistoryItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<HistoryModule | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState(getHistoryStats());

  // 加载历史记录
  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, activeFilter]);

  const loadHistory = () => {
    const allHistory = getAllHistory();
    let filtered = activeFilter === 'all' 
      ? allHistory 
      : getHistoryByModule(activeFilter);
    
    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(query) ||
        item.preview.toLowerCase().includes(query)
      );
    }
    
    setHistory(sortHistory(filtered));
    setStats(getHistoryStats());
  };

  // 监听搜索变化
  useEffect(() => {
    loadHistory();
  }, [searchQuery]);

  // 排序历史记录（最新的在前）
  const sortHistory = (items: UnifiedHistoryItem[]) => {
    return [...items].sort((a, b) => b.timestamp - a.timestamp);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定要删除这条历史记录吗？')) {
      deleteHistoryItem(id);
      loadHistory();
    }
  };

  const handleClearAll = () => {
    if (confirm('确定要清空所有历史记录吗？此操作不可恢复。')) {
      clearAllHistory();
      loadHistory();
    }
  };

  const getModuleIcon = (module: HistoryModule) => {
    switch (module) {
      case 'ocr':
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
      case 'multidoc':
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
      case 'research':
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
    }
  };

  const getModuleName = (module: HistoryModule) => {
    switch (module) {
      case 'ocr': return 'AI 视觉';
      case 'multidoc': return '多文档';
      case 'research': return 'AI 调研';
    }
  };

  const getStatusBadge = (status: UnifiedHistoryItem['status']) => {
    switch (status) {
      case 'success':
        return <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">成功</span>;
      case 'error':
        return <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">失败</span>;
      case 'processing':
        return <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">处理中</span>;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="fixed left-0 top-16 bottom-0 w-[420px] bg-white shadow-2xl z-50 overflow-hidden flex flex-col animate-in slide-in-from-left duration-300">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-slate-900 flex items-center">
              <svg className="w-6 h-6 mr-2 text-[var(--primary-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              历史记录
            </h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 统计信息 */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="text-center p-2 bg-white rounded-lg border border-slate-200">
              <div className="text-lg font-black text-slate-900">{stats.total}</div>
              <div className="text-[10px] text-slate-500 font-bold">总计</div>
            </div>
            <div className="text-center p-2 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
              <div className="text-lg font-black text-purple-700">{stats.ocr}</div>
              <div className="text-[10px] text-purple-600 font-bold">视觉</div>
            </div>
            <div className="text-center p-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
              <div className="text-lg font-black text-blue-700">{stats.multidoc}</div>
              <div className="text-[10px] text-blue-600 font-bold">多文档</div>
            </div>
            <div className="text-center p-2 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200">
              <div className="text-lg font-black text-emerald-700">{stats.research}</div>
              <div className="text-[10px] text-emerald-600 font-bold">调研</div>
            </div>
          </div>

          {/* 搜索框 */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="搜索历史记录..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-50)] transition-all"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeFilter === 'all'
                  ? 'bg-white text-[var(--primary-color)] shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:bg-slate-200'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setActiveFilter('ocr')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center ${
                activeFilter === 'ocr'
                  ? 'bg-purple-100 text-purple-700 shadow-sm ring-1 ring-purple-200'
                  : 'text-slate-500 hover:bg-slate-200'
              }`}
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              AI 视觉
            </button>
            <button
              onClick={() => setActiveFilter('multidoc')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center ${
                activeFilter === 'multidoc'
                  ? 'bg-blue-100 text-blue-700 shadow-sm ring-1 ring-blue-200'
                  : 'text-slate-500 hover:bg-slate-200'
              }`}
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              多文档
            </button>
            <button
              onClick={() => setActiveFilter('research')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center ${
                activeFilter === 'research'
                  ? 'bg-emerald-100 text-emerald-700 shadow-sm ring-1 ring-emerald-200'
                  : 'text-slate-500 hover:bg-slate-200'
              }`}
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              AI 调研
            </button>
          </div>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20">
              <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm font-medium">暂无历史记录</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onItemClick?.(item)}
                  className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className={`p-1.5 rounded-lg ${
                        item.module === 'ocr' ? 'bg-purple-100 text-purple-600' :
                        item.module === 'multidoc' ? 'bg-blue-100 text-blue-600' :
                        'bg-emerald-100 text-emerald-600'
                      }`}>
                        {getModuleIcon(item.module)}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 line-clamp-1">{item.title}</h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-[10px] text-slate-500">{getModuleName(item.module)}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-[10px] text-slate-500">{formatHistoryTime(item.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(item.status)}
                      <button
                        onClick={(e) => handleDelete(e, item.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {/* Metadata */}
                  <div className="flex items-center space-x-3 mb-2 text-[10px] text-slate-500">
                    {item.metadata.ocrMode && (
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded font-medium">
                        {item.metadata.ocrMode}
                      </span>
                    )}
                    {item.metadata.docMode && (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">
                        {item.metadata.docMode}
                      </span>
                    )}
                    {item.metadata.fileCount && (
                      <span>{item.metadata.fileCount} 个文件</span>
                    )}
                    {item.metadata.extractedCount && (
                      <span>{item.metadata.extractedCount} 个公式</span>
                    )}
                    {item.metadata.duration && (
                      <span>耗时 {item.metadata.duration}s</span>
                    )}
                  </div>

                  {/* Preview */}
                  <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 rounded-lg p-2 font-medium">
                    {item.preview}
                  </p>

                  {/* Error Message */}
                  {item.status === 'error' && item.metadata.errorMessage && (
                    <p className="text-xs text-red-600 mt-2 bg-red-50 rounded-lg p-2">
                      {item.metadata.errorMessage}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <button
              onClick={handleClearAll}
              className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-bold hover:bg-red-50 transition-colors"
            >
              清空所有历史记录
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default HistoryPanel;