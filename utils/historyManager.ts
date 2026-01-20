// Unified history manager for app modules.

export type HistoryModule = 'ocr' | 'multidoc' | 'research';
export type HistoryStatus = 'success' | 'error' | 'processing';

export interface UnifiedHistoryItem {
  id: string;
  module: HistoryModule;
  timestamp: number;
  status: HistoryStatus;
  title: string;
  preview: string;
  fullResult?: string;
  metadata: {
    // OCR-specific fields
    ocrMode?: 'formula' | 'table' | 'handwriting' | 'pdf';
    extractedCount?: number;
    
    // Multi-doc specific fields
    docMode?: 'deep_research' | 'report' | 'missing' | 'rename';
    fileCount?: number;
    
    // Research specific fields
    researchTopic?: string;
    logCount?: number;
    sourceCount?: number;
    
    // Rename stats
    renamedCount?: number;
    failedCount?: number;
    
    // Common fields
    duration?: number;
    errorMessage?: string;
  };
}

const STORAGE_KEY = 'unified_history';
const MAX_HISTORY_ITEMS = 200;

// Get all history items.
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

// Add a history item.
export const addHistoryItem = (item: Omit<UnifiedHistoryItem, 'id' | 'timestamp'>): void => {
  try {
    const allHistory = getAllHistory();
    
    const newItem: UnifiedHistoryItem = {
      ...item,
      id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };
    
    // Insert at beginning
    allHistory.unshift(newItem);
    
    // Limit size
    if (allHistory.length > MAX_HISTORY_ITEMS) {
      allHistory.length = MAX_HISTORY_ITEMS;
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allHistory));
  } catch (e) {
    console.error('Failed to add history item:', e);
  }
};

// Delete a single history item.
export const deleteHistoryItem = (id: string): void => {
  try {
    const allHistory = getAllHistory();
    const filtered = allHistory.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Failed to delete history item:', e);
  }
};

// Clear all history items.
export const clearAllHistory = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear history:', e);
  }
};

// Filter history by module.
export const getHistoryByModule = (module: HistoryModule): UnifiedHistoryItem[] => {
  const allHistory = getAllHistory();
  return allHistory.filter(item => item.module === module);
};

// Update history item status.
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

// Get history statistics.
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

// Format timestamp to readable string.
export type HistoryTimeLabels = {
  justNow: string;
  minutesAgo: (value: number) => string;
  hoursAgo: (value: number) => string;
  daysAgo: (value: number) => string;
  dateLocale: string;
};

export const formatHistoryTime = (timestamp: number, labels: HistoryTimeLabels): string => {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return labels.justNow;
  if (minutes < 60) return labels.minutesAgo(minutes);
  if (hours < 24) return labels.hoursAgo(hours);
  if (days < 7) return labels.daysAgo(days);
  
  const date = new Date(timestamp);
  return date.toLocaleDateString(labels.dateLocale, {
    month: 'short',
    day: 'numeric'
  });
};
