
export const AVAILABLE_MODELS = [
  { 
    id: 'Qwen/Qwen3-VL-30B-A3B-Instruct', 
    name: 'Qwen3 VL 30B (Instruct)', 
    type: 'multimodal',
    baseUrl: 'https://api.siliconflow.cn/v1/chat/completions',
    defaultKey: 'sk-xydsgjjthlqvghekjgvzdvuekglilifehtodefbxaszptliw'
  },
  { 
    id: 'Qwen/Qwen3-VL-8B-Thinking', 
    name: 'Qwen3 VL 8B (Thinking)', 
    type: 'multimodal',
    baseUrl: 'https://api.siliconflow.cn/v1/chat/completions',
    defaultKey: 'sk-xydsgjjthlqvghekjgvzdvuekglilifehtodefbxaszptliw'
  },
  { 
    id: 'zai-org/GLM-4.6V', 
    name: 'GLM 4.6V', 
    type: 'multimodal',
    baseUrl: 'https://api.siliconflow.cn/v1/chat/completions',
    defaultKey: 'sk-xydsgjjthlqvghekjgvzdvuekglilifehtodefbxaszptliw'
  }
];

export const THEME_PRESETS = [
  { id: 'blue', name: '科技蓝', color: '#2563eb', hover: '#1d4ed8', light: '#eff6ff' },
  { id: 'indigo', name: '深邃紫', color: '#4f46e5', hover: '#4338ca', light: '#eef2ff' },
  { id: 'violet', name: '梦幻紫', color: '#7c3aed', hover: '#6d28d9', light: '#f5f3ff' },
  { id: 'emerald', name: '自然绿', color: '#059669', hover: '#047857', light: '#ecfdf5' },
  { id: 'rose', name: '活力红', color: '#e11d48', hover: '#be123c', light: '#fff1f2' },
  { id: 'amber', name: '琥珀黄', color: '#d97706', hover: '#b45309', light: '#fffbeb' },
];

export const getEffectiveModel = (taskType: 'ocr' | 'text' = 'text'): string => {
  if (taskType === 'ocr') {
    const ocrModel = localStorage.getItem('user_model_ocr');
    if (ocrModel && ocrModel.trim() !== '') return ocrModel;
  }
  const userModel = localStorage.getItem('user_model');
  if (userModel) return userModel;
  return AVAILABLE_MODELS[0].id;
};

export const getModelConfig = (taskType: 'ocr' | 'text' = 'text') => {
  const modelId = getEffectiveModel(taskType);
  const preset = AVAILABLE_MODELS.find(m => m.id === modelId) || AVAILABLE_MODELS[0];
  const userKey = localStorage.getItem('user_api_key');
  const userUrl = localStorage.getItem('user_base_url');
  
  let apiKey = userKey || '';
  let baseUrl = userUrl || '';
  
  if (preset) {
    if (!apiKey && preset.defaultKey) apiKey = preset.defaultKey;
    if (!baseUrl && preset.baseUrl) baseUrl = preset.baseUrl;
  }
  
  if (!apiKey) apiKey = process.env.API_KEY || '';
  
  return {
    model: modelId,
    apiKey,
    baseUrl,
    isPreset: !!preset,
    modelName: preset ? preset.name : modelId
  };
};

export const saveUserSettings = (
  apiKey: string, 
  textModel: string, 
  ocrModel: string,
  baseUrl: string = ''
) => {
  if (apiKey && apiKey.trim() !== '') {
    localStorage.setItem('user_api_key', apiKey.trim());
  } else {
    localStorage.removeItem('user_api_key');
  }
  if (textModel) {
    localStorage.setItem('user_model', textModel);
  } else {
    localStorage.removeItem('user_model');
  }
  if (ocrModel) {
    localStorage.setItem('user_model_ocr', ocrModel);
  } else {
    localStorage.removeItem('user_model_ocr');
  }
  if (baseUrl && baseUrl.trim() !== '') {
    localStorage.setItem('user_base_url', baseUrl.trim());
  } else {
    localStorage.removeItem('user_base_url');
  }
};

export const saveTheme = (themeId: string) => {
  localStorage.setItem('user_theme', themeId);
};

export const getTheme = () => {
  const stored = localStorage.getItem('user_theme');
  return THEME_PRESETS.find(t => t.id === stored) || THEME_PRESETS[0];
};

export const DEFAULT_SERPER_KEY = '1b4c94cbc459cbc57aaab46340f6dfcd6edcadde';

export const getUserSettings = () => {
  return {
    apiKey: localStorage.getItem('user_api_key') || '',
    model: localStorage.getItem('user_model') || AVAILABLE_MODELS[0].id,
    ocrModel: localStorage.getItem('user_model_ocr') || '',
    baseUrl: localStorage.getItem('user_base_url') || '',
    theme: localStorage.getItem('user_theme') || 'blue',
    serperKey: localStorage.getItem('serper_api_key') || ''
  };
};

export const getSerperKey = () => localStorage.getItem('serper_api_key') || DEFAULT_SERPER_KEY;

export const saveSerperKey = (key: string) => {
    if (key && key.trim()) {
        localStorage.setItem('serper_api_key', key.trim());
    } else {
        localStorage.removeItem('serper_api_key');
    }
};

export const getEffectiveApiKey = () => getModelConfig('text').apiKey;
export const getEffectiveBaseUrl = () => getModelConfig('text').baseUrl;
