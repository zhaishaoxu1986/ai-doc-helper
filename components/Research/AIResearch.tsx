import React, { useState, useEffect, useRef } from 'react';
import { generateContent, generateContentStream } from '../../utils/aiHelper';
import { getModelConfig, getSerperKey, saveSerperKey } from '../../utils/settings';
import { LogEntry, SearchResult, ResearchState } from '../../types';
import { addHistoryItem } from '../../utils/historyManager';

interface AIResearchProps {
  state: ResearchState;
  onUpdateState: (updates: Partial<ResearchState> | ((prev: ResearchState) => ResearchState)) => void;
  onInsert: (text: string) => void;
  onReplace: (text: string) => void;
}

const MAX_STEPS = 30;
const DEFAULT_TOPIC = "最新开源多模态大模型对比分析";

const AIResearch: React.FC<AIResearchProps> = ({ state, onUpdateState, onInsert, onReplace }) => {
  const { topic, isRunning, logs, report, sources } = state;
  const [serperKey, setSerperKey] = useState('');
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSerperKey(getSerperKey());
  }, []);

  useEffect(() => {
    if (logsEndRef.current && isRunning) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isRunning]);

  const addLog = (type: LogEntry['type'], message: string, details?: string) => {
    onUpdateState(prev => ({
      ...prev,
      logs: [...prev.logs, {
        timestamp: new Date().toLocaleTimeString(),
        type,
        message,
        details
      }]
    }));
  };

  const handleImportReport = () => {
    if (!report) return;
    if (confirm('导入报告将清空编辑器当前内容，确认继续吗？')) {
      onReplace(report);
    }
  };

  const handleInsertReport = () => {
    if (!report) return;
    onInsert(report);
  };

  // --- Tools ---

  const searchTool = async (query: string): Promise<string> => {
    addLog('action', `正在搜索: "${query}"...`);
    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': serperKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ q: query, num: 6, gl: 'cn', hl: 'zh-cn' })
      });

      if (!response.ok) throw new Error(`Serper API Error: ${response.status}`);
      const data = await response.json();
      const organic = data.organic || [];
      
      if (organic.length === 0) {
        addLog('info', '搜索结束，未找到相关结果。');
        return "No results found.";
      }

      const resultsText = organic.map((s: any, i: number) => 
        `[${i+1}] Title: ${s.title}\nLink: ${s.link}\nSnippet: ${s.snippet}`
      ).join('\n\n');

      // Update UI sources list
      const newSources: SearchResult[] = organic.map((item: any) => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet
      }));

      // 统一合并日志和来源更新，防止并发下的状态竞争
      onUpdateState(prev => {
        const existingLinks = new Set(prev.sources.map(s => s.link.replace(/\/$/, '')));
        const uniqueNew = newSources.filter(s => !existingLinks.has(s.link.replace(/\/$/, '')));
        
        // 仅保留一条简洁的日志
        const newLogs = [...prev.logs, {
          timestamp: new Date().toLocaleTimeString(),
          type: 'success' as const,
          message: `搜索完成: 找到 ${organic.length} 条相关结果`,
          details: resultsText
        }];

        return {
          ...prev,
          logs: newLogs,
          sources: [...prev.sources, ...uniqueNew]
        };
      });

      return resultsText;
    } catch (e: any) {
      addLog('error', `搜索失败: ${e.message}`);
      return `Error searching: ${e.message}`;
    }
  };

  const visitTool = async (urlInput: string | string[]): Promise<string> => {
    const urls = Array.isArray(urlInput) ? urlInput : [urlInput.includes(',') ? urlInput.split(',').map(u => u.trim()) : [urlInput]].flat();
    const uniqueUrls = [...new Set(urls)].slice(0, 5); // Limit to 5 at once
    
    addLog('action', `正在访问 ${uniqueUrls.length} 个网页...`);

    const fetchUrl = async (url: string): Promise<string> => {
      // 1. Try Jina Reader
      try {
        const jinaController = new AbortController();
        const jinaTimeout = setTimeout(() => jinaController.abort(), 10000); // 10s for Jina
        
        const response = await fetch(`https://r.jina.ai/${url}`, {
          method: 'GET',
          headers: { 'Accept': 'text/plain' },
          signal: jinaController.signal
        });
        clearTimeout(jinaTimeout);

        if (response.ok) {
          const text = await response.text();
          const content = text.slice(0, 8000);
          
          // 合并日志和来源更新
          onUpdateState(prev => {
            const normalizedUrl = url.replace(/\/$/, '');
            const isNew = !prev.sources.some(s => s.link.replace(/\/$/, '') === normalizedUrl);
            
            let title = '';
            const h1Match = text.match(/^#\s+(.+)$/m);
            if (h1Match) {
              title = h1Match[1].trim();
            } else {
              try { title = new URL(url).hostname; } catch { title = url; }
            }

            const newLogs = [...prev.logs, {
              timestamp: new Date().toLocaleTimeString(),
              type: 'success' as const,
              message: `访问成功: ${url.slice(0, 30)}... (${Math.round(text.length / 100) / 10}k)`,
              details: text
            }];

            if (!isNew) return { ...prev, logs: newLogs };

            return {
              ...prev,
              logs: newLogs,
              sources: [...prev.sources, { 
                title: title || url, 
                link: url, 
                snippet: '深度调研访问来源' 
              }]
            };
          });

          return `[Source: ${url}]\n${content}`;
        }
        throw new Error(`Jina error: ${response.status}`);
      } catch (jinaErr: any) {
        const isTimeout = jinaErr.name === 'AbortError';
        addLog('info', `访问${isTimeout ? '超时' : '失败'} (${url.slice(0, 20)}...)，尝试抓取...`);
        
        // 2. Fallback to Serper Scrape
        if (serperKey) {
          try {
            const serperController = new AbortController();
            const serperTimeout = setTimeout(() => serperController.abort(), 15000); // 15s for Serper
            
            const serperResponse = await fetch('https://google.serper.dev/scrape', {
              method: 'POST',
              headers: {
                'X-API-KEY': serperKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ url }),
              signal: serperController.signal
            });
            clearTimeout(serperTimeout);
            
            if (serperResponse.ok) {
              const data = await serperResponse.json();
              const fullText = data.text || data.map || "";
              const content = fullText.slice(0, 8000);
              
              onUpdateState(prev => {
                const normalizedUrl = url.replace(/\/$/, '');
                const isNew = !prev.sources.some(s => s.link.replace(/\/$/, '') === normalizedUrl);
                
                let title = '';
                const h1Match = fullText.match(/^#\s+(.+)$/m);
                if (h1Match) {
                  title = h1Match[1].trim();
                } else {
                  try { title = new URL(url).hostname; } catch { title = url; }
                }

                const newLogs = [...prev.logs, {
                  timestamp: new Date().toLocaleTimeString(),
                  type: 'success' as const,
                  message: `抓取成功: ${url.slice(0, 30)}...`,
                  details: fullText
                }];

                if (!isNew) return { ...prev, logs: newLogs };

                return {
                  ...prev,
                  logs: newLogs,
                  sources: [...prev.sources, { 
                    title: title || url, 
                    link: url, 
                    snippet: '深度调研访问来源' 
                  }]
                };
              });

              return `[Source: ${url}]\n${content}`;
            }
          } catch (serperErr: any) {
            // Both failed
          }
        }
      }

      addLog('error', `网页访问失败: ${url.slice(0, 30)}...`);
      return `[Source: ${url}]\nError: Failed to fetch content after trying multiple methods.`;
    };

    const results = await Promise.all(uniqueUrls.map(u => fetchUrl(u)));
    return results.join('\n\n---\n\n');
  };

  // --- Agent Loop ---

  const runAgent = async () => {
    const activeTopic = topic.trim() || DEFAULT_TOPIC;
    if (!serperKey.trim()) {
      onUpdateState({
        logs: [{
          timestamp: new Date().toLocaleTimeString(),
          type: 'error',
          message: '请先在右上角配置 Serper API Key'
        }]
      });
      return;
    }

    onUpdateState({
        isRunning: true,
        report: '',
        logs: [{
          timestamp: new Date().toLocaleTimeString(),
          type: 'info',
          message: `开始研究："${activeTopic}"...`
        }],
        sources: []
    });

    const config = getModelConfig('text');
    if (!config.apiKey) {
      addLog('error', '请先配置 AI 模型 API Key');
      onUpdateState({ isRunning: false });
      return;
    }

    // 辅助函数：带重试机制的 LLM 流式调用
    const callLLMStreamingWithRetry = async (
      messages: any[], 
      onUpdateThought: (thought: string) => void,
      onUpdateReport?: (report: string) => void,
      maxRetries = 3, 
      retryDelay = 5000
    ): Promise<string> => {
      let lastError = null;
      for (let i = 0; i <= maxRetries; i++) {
        try {
          if (i > 0) {
            addLog('info', `正在进行第 ${i} 次重试...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }

          const stream = generateContentStream({
            apiKey: config.apiKey,
            model: config.model,
            baseUrl: config.baseUrl,
            prompt: '', 
            messages,
            jsonSchema: true 
          });

          let fullText = '';
          for await (const chunk of stream) {
            fullText += chunk;
            
            // 实时解析 Thought
            const thoughtMatch = fullText.match(/"thought":\s*"((?:[^"\\]|\\.)*)/);
            if (thoughtMatch && thoughtMatch[1]) {
              const currentThought = thoughtMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
              onUpdateThought(currentThought);
            }

            // 如果检测到工具是 finish，则流式解析 tool_input 进报告
            if (onUpdateReport && fullText.includes('"tool": "finish"')) {
              const inputMatch = fullText.match(/"tool_input":\s*"((?:[^"\\]|\\.)*)/);
              if (inputMatch && inputMatch[1]) {
                const currentReport = inputMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                onUpdateReport(currentReport);
              }
            }
          }
          return fullText;
        } catch (err: any) {
          lastError = err;
          const errorMsg = err.message || '';
          if (i < maxRetries && (errorMsg.includes('429') || errorMsg.includes('500') || errorMsg.includes('Failed to fetch'))) {
            addLog('info', `LLM 暂时不可用: ${errorMsg.slice(0, 50)}...`);
          } else {
            throw err;
          }
        }
      }
      throw lastError;
    };

    // System Prompt
    const systemPrompt = `
You are a Senior AI Research Assistant. Your goal is to produce extremely detailed and comprehensive research reports.

TOOLS AVAILABLE:
1. search(query): Search Google for information. Returns snippets. Add current date(Today is ${new Date().toLocaleDateString()}) if the topic requires NEWEST information.
2. visit(urls): Visit specific URLs to read the full content. 
   - 'urls' can be a single URL string or an ARRAY of URLs.
   - OPTIMIZATION: Always try to batch 3-5 URLs in a single 'visit' call to work faster.
3. finish(report): Submit the final markdown report.

PROTOCOL:
1. Analyze the topic from multiple perspectives.
2. Formulate different search queries initially. You can search multiple times in different languages to get more information.
3. IMPORTANT: You MUST use 'visit' tool at least 2-3 times on high-quality sources to gather deep technical details. Prefer batching multiple URLs.
4. If a 'visit' returns an error, do not keep retrying the same URL. Move on to other sources.
5. NEVER visit the same URL more than once. The system tracks your visited URLs.
6. You must think between your search queries and URL visits to make sure your queries are worthy.
7. Aim for a high-quality, long-form and comprehensive report (at least 1500 words if the topic allows). You can always formulate more search queries and visit more URLs to get more information.
8. "finish" MUST generate a professional Markdown report in the original topic's language.
   - Use H1, H2, H3 headers.
   - Include Abstract, Background, Analysis, Comparative insights, and Conclusion.
   - List cited sources at the end.

RESPONSE FORMAT:
You must strictly respond in JSON format with NO other text.
{
  "thought": "Reasoning about current progress and next steps...",
  "tool": "search" | "visit" | "finish",
  "tool_input": "query string" | ["url1", "url2", "url3"] | "final report markdown"
}
`;

    let currentMessages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Research Topic: "${activeTopic}"` }
    ];

    let step = 0;

    const visitedUrls = new Set<string>(); // 追踪已访问的 URL

    try {
      while (step < MAX_STEPS) {
        step++;
        
        // 动态更新已访问列表，注入到提示词中以防死循环
        const visitedListStr = visitedUrls.size > 0 
          ? `\n\nALREADY VISITED URLS (Do NOT visit again):\n${Array.from(visitedUrls).join('\n')}`
          : '';

        // Call LLM with Streaming
        let responseText = '';
        const logId = Date.now(); 

        try {
           responseText = await callLLMStreamingWithRetry(
             [
               ...currentMessages,
               { role: 'user', content: `System Reminder: Step ${step}/${MAX_STEPS}. ${visitedListStr}\n` }
             ], 
             (thought) => {
               // 实时更新思考日志
               onUpdateState(prev => {
                 const newLogs = [...prev.logs];
                 const existingLogIndex = newLogs.findIndex(l => (l as any)._id === logId);
                 const logContent = {
                   timestamp: new Date().toLocaleTimeString(),
                   type: 'info' as const,
                   message: `思考: ${thought}`,
                   _id: logId
                 };
                 if (existingLogIndex >= 0) {
                   newLogs[existingLogIndex] = logContent;
                 } else {
                   newLogs.push(logContent);
                 }
                 return { ...prev, logs: newLogs };
               });
             },
             (partialReport) => {
               // 实时更新报告预览
               onUpdateState({ report: partialReport });
             }
           );
        } catch (err: any) {
           addLog('error', `LLM 调用失败: ${err.message}`);
           onUpdateState({ isRunning: false });
           break;
        }

        // Parse JSON
        let action: any = null;
        try {
          const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
          action = JSON.parse(cleanJson);
        } catch (e) {
          currentMessages.push({ role: 'assistant', content: responseText });
          currentMessages.push({ role: 'user', content: "Error: Invalid JSON format. Please respond with valid JSON only." });
          continue;
        }

        if (!action || !action.tool) {
           currentMessages.push({ role: 'assistant', content: responseText });
           currentMessages.push({ role: 'user', content: "Error: Missing 'tool' field in JSON." });
           continue;
        }

        // Execute Tool
        if (action.tool === 'finish') {
          const finalReport = action.tool_input;
          onUpdateState({
            isRunning: false,
            report: finalReport
          });
          addLog('success', '调研完成，报告已生成。');
          
          // 保存到统一历史记录
          addHistoryItem({
            module: 'research',
            status: 'success',
            title: activeTopic,
            preview: finalReport.slice(0, 200) + (finalReport.length > 200 ? '...' : ''),
            fullResult: finalReport,
            metadata: {
              researchTopic: activeTopic,
              logCount: state.logs.length,
              sourceCount: state.sources.length
            }
          });
          break;
        } else if (action.tool === 'search') {
          const result = await searchTool(action.tool_input);
          currentMessages.push({ role: 'assistant', content: responseText });
          currentMessages.push({ role: 'user', content: `[Observation - Search Result]:\n${result}` });
        } else if (action.tool === 'visit') {
          // 检查并记录 URL 访问
          const rawUrls = Array.isArray(action.tool_input) ? action.tool_input : [action.tool_input];
          const newToVisit = rawUrls.filter(u => !visitedUrls.has(u));
          const alreadyVisited = rawUrls.filter(u => visitedUrls.has(u));
          
          let result = '';
          if (newToVisit.length > 0) {
            newToVisit.forEach(u => visitedUrls.add(u));
            result = await visitTool(newToVisit);
          }
          
          if (alreadyVisited.length > 0) {
            result += `\n\n[Warning]: You already visited ${alreadyVisited.join(', ')}. Do not repeat. Focus on NEW information or FINISH the report.`;
          }

          currentMessages.push({ role: 'assistant', content: responseText });
          currentMessages.push({ role: 'user', content: `[Observation - Page Content]:\n${result}` });
        } else {
          addLog('error', `未知工具: ${action.tool}`);
          currentMessages.push({ role: 'user', content: `Error: Unknown tool '${action.tool}'.` });
        }

        // If we reach the last step, force a finish
        if (step === MAX_STEPS && action.tool !== 'finish') {
          addLog('info', '已达到最大步骤限制，正在强制生成报告...');
          currentMessages.push({ 
            role: 'user', 
            content: "System: You have reached the maximum step limit. Please immediately use the 'finish' tool to generate the final report based on all information gathered so far." 
          });
          
          let finalResponse = '';
          const finalLogId = Date.now() + 1;
          try {
            finalResponse = await callLLMStreamingWithRetry(
              currentMessages,
              (thought) => {
                onUpdateState(prev => {
                  const newLogs = [...prev.logs];
                  const existingLogIndex = newLogs.findIndex(l => (l as any)._id === finalLogId);
                  const logContent = {
                    timestamp: new Date().toLocaleTimeString(),
                    type: 'info' as const,
                    message: `思考: ${thought}`,
                    _id: finalLogId
                  };
                  if (existingLogIndex >= 0) newLogs[existingLogIndex] = logContent;
                  else newLogs.push(logContent);
                  return { ...prev, logs: newLogs };
                });
              },
              (partialReport) => {
                onUpdateState({ report: partialReport });
              }
            );
          } catch (err: any) {
            addLog('error', `生成报告失败: ${err.message}`);
            onUpdateState({ isRunning: false });
            break;
          }
          
          try {
            const cleanJson = finalResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const finalAction = JSON.parse(cleanJson);
            const finalReport = finalAction.tool_input || finalResponse;
            onUpdateState({
              isRunning: false,
              report: finalReport
            });
            addLog('success', '调研结束。');
            
            // 保存到统一历史记录
            addHistoryItem({
              module: 'research',
              status: 'success',
              title: activeTopic + ' (达到步骤上限)',
              preview: finalReport.slice(0, 200) + (finalReport.length > 200 ? '...' : ''),
              fullResult: finalReport,
              metadata: {
                researchTopic: activeTopic,
                logCount: state.logs.length,
                sourceCount: state.sources.length
              }
            });
          } catch (e) {
            const finalReport = finalResponse;
            onUpdateState({ isRunning: false, report: finalReport });
            addLog('success', '调研结束。');
            
            // 保存到统一历史记录
            addHistoryItem({
              module: 'research',
              status: 'success',
              title: activeTopic + ' (异常结束)',
              preview: finalReport.slice(0, 200) + (finalReport.length > 200 ? '...' : ''),
              fullResult: finalReport,
              metadata: {
                researchTopic: activeTopic,
                logCount: state.logs.length,
                sourceCount: state.sources.length
              }
            });
          }
        }
      }

    } catch (err: any) {
        addLog('error', `运行时错误: ${err.message}`);
        onUpdateState({ isRunning: false });
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 h-full flex flex-col">
      {/* Config & Input */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex-none">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
          <svg className="w-6 h-6 mr-2 text-[var(--primary-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          AI 深度调研
        </h2>
        
        <div className="flex flex-col md:flex-row gap-4 mb-4">
           <div className="flex-1">
             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">调研主题</label>
             <input
                type="text"
                value={topic}
                onChange={(e) => onUpdateState({ topic: e.target.value })}
                placeholder={`默认主题：${DEFAULT_TOPIC}`}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                onKeyDown={(e) => e.key === 'Enter' && !isRunning && runAgent()}
              />
           </div>
        </div>
        
        <button
          onClick={runAgent}
          disabled={isRunning}
          className={`w-full py-3 rounded-lg font-bold text-white transition-all ${
            isRunning 
              ? 'bg-slate-400 cursor-not-allowed' 
              : 'bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] shadow-md'
          }`}
        >
          {isRunning ? '智能体正在运行中...' : '启动深度调研'}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        
        {/* Left: Process Log & Sources */}
        <div className="lg:w-1/3 flex flex-col gap-6 min-h-0">
          
          {/* Logs */}
          <div className="h-32 flex-none bg-slate-900 rounded-xl shadow-inner p-4 overflow-y-auto custom-scrollbar flex flex-col">
            <div className="text-xs font-bold text-slate-400 mb-2 border-b border-slate-800 pb-2">
              运行日志
            </div>
            <div className="space-y-3 font-mono text-xs flex-1">
              {logs.length === 0 && <div className="text-slate-600 italic">等待任务开始...</div>}
              {logs.map((log, i) => (
                <div 
                  key={i} 
                  onClick={() => log.details && setSelectedLog(log)}
                  className={`flex gap-2 p-1 rounded transition-colors ${log.details ? 'cursor-pointer hover:bg-slate-800' : ''} ${
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'success' ? 'text-green-400' :
                  log.type === 'action' ? 'text-blue-400' : 'text-slate-300'
                }`}>
                  <span className="text-slate-600 shrink-0">[{log.timestamp}]</span>
                  <span className="break-words">{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>

          {/* Sources List */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-4 overflow-y-auto flex flex-col">
            <h3 className="text-xs font-bold text-slate-500 uppercase mb-2 border-b border-slate-100 pb-2">已发现来源 ({sources.length})</h3>
            <div className="space-y-2 flex-1">
              {sources.map((s, i) => (
                <a 
                  key={i}
                  href={s.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2 rounded hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors group"
                >
                  <div className="text-sm font-medium text-[var(--primary-color)] truncate group-hover:underline">{s.title}</div>
                  <div className="text-xs text-slate-400 truncate mt-0.5">{s.link}</div>
                </a>
              ))}
              {sources.length === 0 && (
                <div className="text-slate-400 text-xs text-center mt-10">暂无来源</div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Report Output */}
        <div className="lg:w-2/3 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col min-h-0">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
             <h3 className="font-bold text-slate-700">调研报告预览</h3>
             {report && (
                <div className="space-x-2">
                  <button
                    onClick={handleInsertReport}
                    className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 font-bold transition-colors"
                  >
                    + 插入到文末
                  </button>
                  <button
                    onClick={handleImportReport}
                    className="text-xs px-3 py-1.5 bg-[var(--primary-50)] text-[var(--primary-color)] rounded-full hover:bg-[var(--primary-100)] font-bold transition-colors"
                  >
                    导入并覆盖
                  </button>
                </div>
             )}
          </div>
          <div className="flex-1 p-8 overflow-y-auto prose prose-slate max-w-none">
            {report ? (
              <div className="whitespace-pre-wrap">{report}</div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                {isRunning && (
                    <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-[var(--primary-color)] animate-spin"></div>
                )}
                <p>{isRunning ? '正在生成中...' : '报告将在此处显示'}</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedLog(null)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] relative z-10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-700 flex items-center text-sm">
                <span className="mr-2 px-2 py-0.5 bg-slate-200 rounded text-xs uppercase">详细信息</span>
                {selectedLog.message}
              </h3>
              <button onClick={() => setSelectedLog(null)} className="p-1 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 font-mono text-xs text-slate-800 bg-slate-50 custom-scrollbar select-text whitespace-pre-wrap">
              {selectedLog.details}
            </div>
            <div className="p-3 border-t border-slate-100 bg-white flex justify-end">
              <button onClick={() => setSelectedLog(null)} className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-xs font-bold transition-colors">关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIResearch;
