// 统一历史记录管理系统
// 对应功能模块：AI 视觉、多文档处理、AI 调研

export type HistoryModule = 'ocr' | 'multidoc' | 'research';
export type HistoryStatus = 'success' | 'error' | 'processing';

export interface UnifiedHistoryItem {
  id: string;
  module: HistoryModule;
  timestamp: number;
  status: HistoryStatus;
  title: string;
  preview: string; // 显示在列表中的简短预览
  fullResult?: string; // 完整结果数据（可能较大）
  metadata: {
    // OCR 特定字段
    ocrMode?: 'formula' | 'table' | 'handwriting' | 'pdf';
    extractedCount?: number;
    
    // 多文档特定字段
    docMode?: 'deep_research' | 'report' | 'missing' | 'rename';
    fileCount?: number;
    
    // 调研特定字段
    researchTopic?: string;
    logCount?: number;
    sourceCount?: number;
    
    // 通用字段
    duration?: number; // 处理耗时（秒）
    errorMessage?: string;
  };
}

const STORAGE_KEY = 'unified_history';
const MAX_HISTORY_ITEMS = 200;

/**
 * 获取所有历史记录
 */
export const getAllHistory = (): UnifiedHistoryItem[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load history:', e);
  }
  return [];
};

/**
 * 添加历史记录
 */
export const addHistoryItem = (item: Omit<UnifiedHistoryItem, 'id' | 'timestamp'>): void => {
  try {
    const allHistory = getAllHistory();
    
    const newItem: UnifiedHistoryItem = {
      ...item,
      id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };
    
    // 添加到开头
    allHistory.unshift(newItem);
    
    // 限制数量
    if (allHistory.length > MAX_HISTORY_ITEMS) {
      allHistory.length = MAX_HISTORY_ITEMS;
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allHistory));
  } catch (e) {
    console.error('Failed to add history item:', e);
  }
};

/**
 * 删除单条历史记录
 */
export const deleteHistoryItem = (id: string): void => {
  try {
    const allHistory = getAllHistory();
    const filtered = allHistory.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Failed to delete history item:', e);
  }
};

/**
 * 清空所有历史记录
 */
export const clearAllHistory = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear history:', e);
  }
};

/**
 * 按模块过滤历史记录
 */
export const getHistoryByModule = (module: HistoryModule): UnifiedHistoryItem[] => {
  const allHistory = getAllHistory();
  return allHistory.filter(item => item.module === module);
};

/**
 * 更新历史记录状态
 */
export const updateHistoryStatus = (id: string, status: HistoryStatus, errorMessage?: string): void => {
  try {
    const allHistory = getAllHistory();
    const index = allHistory.findIndex(item => item.id === id);
    if (index !== -1) {
      allHistory[index].status = status;
      if (errorMessage) {
        allHistory[index].metadata.errorMessage = errorMessage;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allHistory));
    }
  } catch (e) {
    console.error('Failed to update history status:', e);
  }
};

/**
 * 获取历史记录统计信息
 */
export const getHistoryStats = () => {
  const allHistory = getAllHistory();
  return {
    total: allHistory.length,
    ocr: allHistory.filter(item => item.module === 'ocr').length,
    multidoc: allHistory.filter(item => item.module === 'multidoc').length,
    research: allHistory.filter(item => item.module === 'research').length,
    success: allHistory.filter(item => item.status === 'success').length,
    error: allHistory.filter(item => item.status === 'error').length
  };
};

/**
 * 格式化时间戳为可读字符串
 */
export const formatHistoryTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};