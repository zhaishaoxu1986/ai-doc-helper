import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { WordTemplate, DocumentStyle } from '../../types';
import { downloadDocx } from '../../utils/converter';

interface WordPreviewProps {
  markdown: string;
  isProcessing: boolean;
  progress: number;
}

const CodeBlock = ({ node, className, children, ...props }: any) => {
    const [copied, setCopied] = useState(false);
    const inline = props.inline;
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';

    if (inline) {
        return <code className="bg-slate-100 px-1.5 py-0.5 rounded text-pink-700 font-mono text-[0.9em]" {...props}>{children}</code>;
    }

    const handleCopy = () => {
        const text = String(children).replace(/\n$/, '');
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative group my-6">
            <pre className="bg-[#f8fafc] text-slate-800 p-5 rounded border border-slate-200 overflow-x-auto text-[0.85em] font-mono whitespace-pre-wrap break-all">
                <code className={className} {...props}>{children}</code>
            </pre>
            <div className="absolute top-2 right-2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                {language && <span className="text-[10px] uppercase text-slate-400 font-bold mr-2">{language}</span>}
                <button 
                    onClick={handleCopy}
                    className={`p-1.5 rounded-md text-xs font-bold flex items-center transition-all border ${copied ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-slate-500 border-slate-200 hover:text-[var(--primary-color)] hover:border-[var(--primary-color)]'}`}
                >
                    {copied ? (
                        <>
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Copied
                        </>
                    ) : (
                         <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                    )}
                </button>
            </div>
        </div>
    );
};

const WordPreview: React.FC<WordPreviewProps> = ({ markdown, isProcessing, progress }) => {
  const [template, setTemplate] = useState<WordTemplate>(WordTemplate.STANDARD);
  const [scale, setScale] = useState(1);
  const [copyStatus, setCopyStatus] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const wechatContentRef = useRef<HTMLDivElement>(null);
  const previewContentId = "word-preview-content";

  // Style Customization State
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [customStyle, setCustomStyle] = useState<DocumentStyle>({
      fontFace: "SimSun",
      fontSize: 12,
      lineSpacing: 1.5,
      textColor: "000000",
      alignment: "justify",
      paragraphSpacing: {
        before: 0,
        after: 20
      },
      firstLineIndent: 2,
      heading1: {
        fontSize: 22,
        fontFace: "SimHei",
        color: "000000",
        alignment: "center",
        lineSpacing: 1.2,
        spacing: {
          before: 18,
          after: 18
        }
      },
      heading2: {
        fontSize: 18,
        fontFace: "SimHei",
        color: "000000",
        alignment: "left",
        lineSpacing: 1.2,
        spacing: {
          before: 12,
          after: 12
        }
      },
      heading3: {
        fontSize: 14,
        fontFace: "SimHei",
        color: "000000",
        alignment: "left",
        lineSpacing: 1.2,
        spacing: {
          before: 8,
          after: 8
        }
      },
      table: {
        isThreeLineTable: true
      }
  });

  // 动态计算缩放比例，确保 A4 纸张完整显示
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && paperRef.current) {
        const containerWidth = containerRef.current.offsetWidth - 64; // 减去 padding
        const paperWidth = 794; // 210mm 约为 794px (96dpi)
        if (containerWidth < paperWidth) {
          setScale(containerWidth / paperWidth);
        } else {
          setScale(1);
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(handleResize, 100); 
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [markdown]);

  const getTemplateStyles = () => {
    // If Custom template selected, use inline styles roughly approximating the docx settings for preview
    if (template === WordTemplate.CUSTOM) {
        // Note: Tailwind classes won't perfectly match arbitrary user values, 
        // so we use inline styles on the container for some props.
        return "max-w-none px-[25mm] py-[30mm] bg-white shadow-2xl mx-auto border border-slate-200";
    }

    switch(template) {
      case WordTemplate.ACADEMIC:
        return "prose-academic text-[10.5pt] leading-[1.6] px-[25mm] py-[30mm] bg-white shadow-2xl mx-auto border border-slate-200";
      case WordTemplate.NOTE:
        return "max-w-none text-[11pt] leading-relaxed px-[20mm] py-[25mm] bg-white shadow-lg mx-auto rounded-lg border border-slate-100";
      default:
        return "max-w-none text-[12pt] leading-normal px-[25mm] py-[30mm] bg-white shadow-2xl mx-auto border border-slate-200";
    }
  };

  const getCustomPreviewStyle = () => {
      if (template !== WordTemplate.CUSTOM) return {};
      return {
          fontFamily: customStyle.fontFace === 'SimSun' ? '"SimSun", serif' : customStyle.fontFace,
          fontSize: `${customStyle.fontSize}pt`,
          lineHeight: customStyle.lineSpacing,
          color: `#${customStyle.textColor}`,
          textAlign: customStyle.alignment as any,
          marginTop: `${customStyle.paragraphSpacing.before}pt`,
          marginBottom: `${customStyle.paragraphSpacing.after}pt`
      };
  };

  const handleDownload = async () => {
    await downloadDocx(markdown, template, template === WordTemplate.CUSTOM ? customStyle : undefined);
  };
  
  const handleExportPDF = () => {
      const content = document.getElementById(previewContentId);
      if (!content) {
          alert('无法获取预览内容，请刷新重试');
          return;
      }

      // 1. Create a hidden iframe
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.zIndex = '1000';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) return;

      // 2. Prepare resources (reuse current document styles to avoid CDN usage)
      const styleTags = Array.from(
        document.querySelectorAll('style, link[rel="stylesheet"]')
      )
        .map((el) => el.outerHTML)
        .join('\n');
      
      // 3. Get the HTML content
      const contentHtml = content.outerHTML;

      // 4. Write to iframe
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>AI Doc Helper - Export PDF</title>
            ${styleTags}
            <style>
               body { background: white; margin: 0; padding: 0; }
               /* Ensure printer prints background colors */
               * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
               @page { margin: 0; }
               /* Force A4 size visualization if needed, but @page handles printer size */
            </style>
          </head>
          <body>
            <div style="width: 210mm; margin: 0 auto; overflow: hidden; padding-top: 20px; padding-bottom: 20px;">
              ${contentHtml}
            </div>
            <script>
              // Wait for Tailwind to parse classes
              window.onload = () => {
                  setTimeout(() => {
                      try {
                        window.focus();
                        window.print();
                      } catch(e) {
                        console.error('Print failed', e);
                      }
                      // Clean up handled by parent usually, or leave it hidden
                  }, 800); // 800ms delay to ensure styles render
              };
            </script>
          </body>
        </html>
      `);
      doc.close();

      // Cleanup iframe after 1 minute (to allow print dialog to finish)
      setTimeout(() => {
          if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
          }
      }, 60000);
  };

  // 复制为微信公众号格式
  const copyToWeChat = () => {
    if (!wechatContentRef.current) return;
    
    const content = wechatContentRef.current;
    
    // 创建选区
    const range = document.createRange();
    range.selectNode(content);
    
    const selection = window.getSelection();
    if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
        
        try {
            document.execCommand('copy');
            setCopyStatus(true);
            setTimeout(() => setCopyStatus(false), 2000);
        } catch (err) {
            alert('复制失败，请尝试手动复制');
        }
        
        selection.removeAllRanges();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#8E97A4] overflow-hidden" ref={containerRef}>
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-300 shadow-md z-20 space-x-2 relative">
        <div className="flex items-center space-x-2 flex-1 overflow-hidden">
          <div className="flex items-center whitespace-nowrap">
            <div className="relative">
              <input
                type="number"
                min="10"
                max="200"
                step="5"
                value={Math.round(scale * 100)}
                onChange={(e) => {
                  const newScale = Number(e.target.value) / 100;
                  setScale(newScale);
                }}
                className="w-[80px] text-xs border border-slate-300 rounded-md px-2 py-1 pr-8 focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)]"
                placeholder="缩放"
              />
              <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs font-semibold text-[var(--primary-color)]">
                %
              </span>
            </div>
          </div>
          <div className="h-4 w-[1px] bg-slate-200"></div>
          
          <div className="flex items-center space-x-2">
              <select 
                value={template} 
                onChange={(e) => setTemplate(e.target.value as WordTemplate)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)] font-medium text-slate-700 w-full max-w-[150px]"
              >
                <option value={WordTemplate.STANDARD}>📄 标准公文</option>
                <option value={WordTemplate.ACADEMIC}>🎓 学术论文</option>
                <option value={WordTemplate.NOTE}>📝 简洁笔记</option>
                <option value={WordTemplate.CUSTOM}>⚙️ 自定义...</option>
              </select>

              {template === WordTemplate.CUSTOM && (
                  <button 
                    onClick={() => setShowStylePanel(!showStylePanel)}
                    className={`p-1.5 rounded-md border ${showStylePanel ? 'bg-slate-100 border-slate-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                  >
                      <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                  </button>
              )}
          </div>
        </div>
        
        {/* Style Panel Popover */}
        {showStylePanel && template === WordTemplate.CUSTOM && (
            <div className="absolute top-full left-10 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50 w-[420px] animate-in fade-in slide-in-from-top-2 max-h-[70vh] overflow-y-auto">
                <h4 className="text-xs font-bold text-slate-500 mb-3 uppercase">Word 导出样式配置</h4>
                
                {/* 字体大小换算说明 */}
                <div className="mb-4 p-2 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-[10px] text-blue-700">
                        <strong>字体大小换算：</strong>
                        小二 = 18pt, 小三 = 15pt，小四 = 12pt，五号 = 10.5pt，小五号 = 9pt，六号 = 7.5pt
                    </p>
                </div>
                
                {/* 一级标题样式 */}
                <div className="mb-4 pb-3 border-b border-slate-100">
                    <h5 className="text-xs font-bold text-[var(--primary-color)] mb-2">一级标题</h5>
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs text-slate-700 font-medium block mb-1">字体 (Font)</label>
                                <select 
                                    value={customStyle.heading1.fontFace}
                                    onChange={(e) => {
                                        setCustomStyle({...customStyle, heading1: {...customStyle.heading1, fontFace: e.target.value}});
                                        setTemplate(WordTemplate.CUSTOM);
                                    }}
                                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                                >
                                    <option value="SimSun">宋体 (SimSun)</option>
                                    <option value="Microsoft YaHei">微软雅黑</option>
                                    <option value="Times New Roman">Times New Roman</option>
                                    <option value="KaiTi">楷体</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-slate-700 font-medium block mb-1">字号 (pt)</label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="number"
                                        min="6"
                                        max="72"
                                        step="0.5"
                                        value={customStyle.heading1.fontSize}
                                        onChange={(e) => {
                                            setCustomStyle({...customStyle, heading1: {...customStyle.heading1, fontSize: Number(e.target.value)}});
                                            setTemplate(WordTemplate.CUSTOM);
                                        }}
                                        className="flex-1 text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                                        placeholder="字号 (pt)"
                                    />
                                    <span className="text-xs text-slate-500">pt</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-700 font-medium block mb-1">对齐方式</label>
                            <select 
                                value={customStyle.heading1.alignment}
                                onChange={(e) => {
                                    setCustomStyle({...customStyle, heading1: {...customStyle.heading1, alignment: e.target.value}});
                                    setTemplate(WordTemplate.CUSTOM);
                                }}
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                            >
                                <option value="center">居中对齐</option>
                                <option value="left">左对齐</option>
                                <option value="right">右对齐</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs text-slate-700 font-medium block mb-1">段前间距 (磅)</label>
                                <input 
                                    type="number"
                                    value={customStyle.heading1.spacing.before}
                                    onChange={(e) => {
                                        setCustomStyle({...customStyle, heading1: {...customStyle.heading1, spacing: {...customStyle.heading1.spacing, before: Number(e.target.value)}}});
                                        setTemplate(WordTemplate.CUSTOM);
                                    }}
                                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-700 font-medium block mb-1">段后间距 (磅)</label>
                                <input 
                                    type="number"
                                    value={customStyle.heading1.spacing.after}
                                    onChange={(e) => {
                                        setCustomStyle({...customStyle, heading1: {...customStyle.heading1, spacing: {...customStyle.heading1.spacing, after: Number(e.target.value)}}});
                                        setTemplate(WordTemplate.CUSTOM);
                                    }}
                                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-700 font-medium block mb-1">标题颜色</label>
                            <input 
                                    type="color"
                                    value={`#${customStyle.heading1.color}`}
                                    onChange={(e) => {
                                        setCustomStyle({...customStyle, heading1: {...customStyle.heading1, color: e.target.value.replace('#', '')}});
                                        setTemplate(WordTemplate.CUSTOM);
                                    }}
                                    className="w-full h-8 p-0 border border-slate-300 rounded-lg cursor-pointer focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                                />
                        </div>
                    </div>
                </div>
                
                {/* 二级标题样式 */}
                <div className="mb-4 pb-3 border-b border-slate-100">
                    <h5 className="text-xs font-bold text-[var(--primary-color)] mb-2">二级标题</h5>
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs text-slate-700 font-medium block mb-1">字体 (Font)</label>
                                <select 
                                    value={customStyle.heading2.fontFace}
                                    onChange={(e) => {
                                        setCustomStyle({...customStyle, heading2: {...customStyle.heading2, fontFace: e.target.value}});
                                        setTemplate(WordTemplate.CUSTOM);
                                    }}
                                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                                >
                                    <option value="SimSun">宋体 (SimSun)</option>
                                    <option value="Microsoft YaHei">微软雅黑</option>
                                    <option value="Times New Roman">Times New Roman</option>
                                    <option value="KaiTi">楷体</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-slate-700 font-medium block mb-1">字号 (pt)</label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="number"
                                        min="6"
                                        max="72"
                                        step="0.5"
                                        value={customStyle.heading2.fontSize}
                                        onChange={(e) => {
                                            setCustomStyle({...customStyle, heading2: {...customStyle.heading2, fontSize: Number(e.target.value)}});
                                            setTemplate(WordTemplate.CUSTOM);
                                        }}
                                        className="flex-1 text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                                        placeholder="字号 (pt)"
                                    />
                                    <span className="text-xs text-slate-500">pt</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-700 font-medium block mb-1">对齐方式</label>
                            <select 
                                value={customStyle.heading2.alignment}
                                onChange={(e) => {
                                    setCustomStyle({...customStyle, heading2: {...customStyle.heading2, alignment: e.target.value}});
                                    setTemplate(WordTemplate.CUSTOM);
                                }}
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                            >
                                <option value="left">左对齐</option>
                                <option value="center">居中对齐</option>
                                <option value="right">右对齐</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs text-slate-700 font-medium block mb-1">段前间距 (磅)</label>
                                <input 
                                    type="number"
                                    value={customStyle.heading2.spacing.before}
                                    onChange={(e) => {
                                        setCustomStyle({...customStyle, heading2: {...customStyle.heading2, spacing: {...customStyle.heading2.spacing, before: Number(e.target.value)}}});
                                        setTemplate(WordTemplate.CUSTOM);
                                    }}
                                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-700 font-medium block mb-1">段后间距 (磅)</label>
                                <input 
                                    type="number"
                                    value={customStyle.heading2.spacing.after}
                                    onChange={(e) => {
                                        setCustomStyle({...customStyle, heading2: {...customStyle.heading2, spacing: {...customStyle.heading2.spacing, after: Number(e.target.value)}}});
                                        setTemplate(WordTemplate.CUSTOM);
                                    }}
                                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-700 font-medium block mb-1">标题颜色</label>
                            <input 
                                    type="color"
                                    value={`#${customStyle.heading2.color}`}
                                    onChange={(e) => {
                                        setCustomStyle({...customStyle, heading2: {...customStyle.heading2, color: e.target.value.replace('#', '')}});
                                        setTemplate(WordTemplate.CUSTOM);
                                    }}
                                    className="w-full h-8 p-0 border border-slate-300 rounded-lg cursor-pointer focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                                />
                        </div>
                    </div>
                </div>
                
                {/* 三级标题样式 */}
                <div className="mb-4 pb-3 border-b border-slate-100">
                    <h5 className="text-xs font-bold text-[var(--primary-color)] mb-2">三级标题</h5>
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs text-slate-700 font-medium block mb-1">字体 (Font)</label>
                                <select 
                                    value={customStyle.heading3.fontFace}
                                    onChange={(e) => {
                                        setCustomStyle({...customStyle, heading3: {...customStyle.heading3, fontFace: e.target.value}});
                                        setTemplate(WordTemplate.CUSTOM);
                                    }}
                                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                                >
                                    <option value="SimSun">宋体 (SimSun)</option>
                                    <option value="Microsoft YaHei">微软雅黑</option>
                                    <option value="Times New Roman">Times New Roman</option>
                                    <option value="KaiTi">楷体</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-slate-700 font-medium block mb-1">字号 (pt)</label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="number"
                                        min="6"
                                        max="72"
                                        step="0.5"
                                        value={customStyle.heading3.fontSize}
                                        onChange={(e) => {
                                            setCustomStyle({...customStyle, heading3: {...customStyle.heading3, fontSize: Number(e.target.value)}});
                                            setTemplate(WordTemplate.CUSTOM);
                                        }}
                                        className="flex-1 text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                                        placeholder="字号 (pt)"
                                    />
                                    <span className="text-xs text-slate-500">pt</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-700 font-medium block mb-1">对齐方式</label>
                            <select 
                                value={customStyle.heading3.alignment}
                                onChange={(e) => {
                                    setCustomStyle({...customStyle, heading3: {...customStyle.heading3, alignment: e.target.value}});
                                    setTemplate(WordTemplate.CUSTOM);
                                }}
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                            >
                                <option value="left">左对齐</option>
                                <option value="center">居中对齐</option>
                                <option value="right">右对齐</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs text-slate-700 font-medium block mb-1">段前间距 (磅)</label>
                                <input 
                                    type="number"
                                    value={customStyle.heading3.spacing.before}
                                    onChange={(e) => {
                                        setCustomStyle({...customStyle, heading3: {...customStyle.heading3, spacing: {...customStyle.heading3.spacing, before: Number(e.target.value)}}});
                                        setTemplate(WordTemplate.CUSTOM);
                                    }}
                                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-700 font-medium block mb-1">段后间距 (磅)</label>
                                <input 
                                    type="number"
                                    value={customStyle.heading3.spacing.after}
                                    onChange={(e) => {
                                        setCustomStyle({...customStyle, heading3: {...customStyle.heading3, spacing: {...customStyle.heading3.spacing, after: Number(e.target.value)}}});
                                        setTemplate(WordTemplate.CUSTOM);
                                    }}
                                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-700 font-medium block mb-1">标题颜色</label>
                            <input 
                                    type="color"
                                    value={`#${customStyle.heading3.color}`}
                                    onChange={(e) => {
                                        setCustomStyle({...customStyle, heading3: {...customStyle.heading3, color: e.target.value.replace('#', '')}});
                                        setTemplate(WordTemplate.CUSTOM);
                                    }}
                                    className="w-full h-8 p-0 border border-slate-300 rounded-lg cursor-pointer focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                                />
                        </div>
                    </div>
                </div>
                
                {/* 正文样式 */}
                <div className="mb-4 pb-3 border-b border-slate-100">
                    <h5 className="text-xs font-bold text-[var(--primary-color)] mb-2">正文样式</h5>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-slate-700 font-medium block mb-1">字体 (Font)</label>
                            <select 
                                    value={customStyle.fontFace}
                                    onChange={(e) => {
                                        setCustomStyle({...customStyle, fontFace: e.target.value});
                                        setTemplate(WordTemplate.CUSTOM);
                                    }}
                                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                                >
                                <option value="SimSun">宋体 (SimSun)</option>
                                <option value="Microsoft YaHei">微软雅黑</option>
                                <option value="Times New Roman">Times New Roman</option>
                                <option value="KaiTi">楷体</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs text-slate-700 font-medium block mb-1">字号 (pt)</label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="number"
                                        min="6"
                                        max="72"
                                        step="0.5"
                                        value={customStyle.fontSize}
                                        onChange={(e) => {
                                            setCustomStyle({...customStyle, fontSize: Number(e.target.value)});
                                            setTemplate(WordTemplate.CUSTOM);
                                        }}
                                        className="flex-1 text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                                        placeholder="字号 (pt)"
                                    />
                                    <span className="text-xs text-slate-500">pt</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-slate-700 font-medium block mb-1">行距</label>
                                <input 
                                    type="number"
                                    step="0.1"
                                    value={customStyle.lineSpacing}
                                    onChange={(e) => {
                                        setCustomStyle({...customStyle, lineSpacing: Number(e.target.value)});
                                        setTemplate(WordTemplate.CUSTOM);
                                    }}
                                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-700 font-medium block mb-1">对齐方式</label>
                            <select 
                                    value={customStyle.alignment}
                                    onChange={(e) => {
                                        setCustomStyle({...customStyle, alignment: e.target.value});
                                        setTemplate(WordTemplate.CUSTOM);
                                    }}
                                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                                >
                                <option value="justify">两端对齐</option>
                                <option value="left">左对齐</option>
                                <option value="center">居中对齐</option>
                                <option value="right">右对齐</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs text-slate-700 font-medium block mb-1">段前间距 (磅)</label>
                                <input 
                                    type="number"
                                    value={customStyle.paragraphSpacing.before}
                                    onChange={(e) => {
                                        setCustomStyle({...customStyle, paragraphSpacing: {...customStyle.paragraphSpacing, before: Number(e.target.value)}});
                                        setTemplate(WordTemplate.CUSTOM);
                                    }}
                                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-700 font-medium block mb-1">段后间距 (磅)</label>
                                <input 
                                    type="number"
                                    value={customStyle.paragraphSpacing.after}
                                    onChange={(e) => {
                                        setCustomStyle({...customStyle, paragraphSpacing: {...customStyle.paragraphSpacing, after: Number(e.target.value)}});
                                        setTemplate(WordTemplate.CUSTOM);
                                    }}
                                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-700 font-medium block mb-1">首行缩进 (字符)</label>
                            <input 
                                type="number"
                                min="0"
                                max="10"
                                step="0.5"
                                value={customStyle.firstLineIndent}
                                onChange={(e) => {
                                    setCustomStyle({...customStyle, firstLineIndent: Number(e.target.value)});
                                    setTemplate(WordTemplate.CUSTOM);
                                }}
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-700 font-medium block mb-1">正文颜色</label>
                            <input 
                                    type="color"
                                    value={`#${customStyle.textColor}`}
                                    onChange={(e) => {
                                        setCustomStyle({...customStyle, textColor: e.target.value.replace('#', '')});
                                        setTemplate(WordTemplate.CUSTOM);
                                    }}
                                    className="w-full h-8 p-0 border border-slate-300 rounded-lg cursor-pointer focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none"
                                />
                        </div>
                    </div>
                </div>
                
                {/* 表格样式 */}
                <div className="mb-4">
                    <h5 className="text-xs font-bold text-[var(--primary-color)] mb-2">表格样式</h5>
                    <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                            <input
                                type="radio"
                                id="threeLineTable"
                                name="tableType"
                                value="threeLine"
                                checked={customStyle.table.isThreeLineTable}
                                onChange={(e) => {
                                    setCustomStyle({...customStyle, table: {...customStyle.table, isThreeLineTable: true}});
                                    setTemplate(WordTemplate.CUSTOM);
                                }}
                                className="text-[var(--primary-color)] focus:ring-[var(--primary-color)]"
                            />
                            <label htmlFor="threeLineTable" className="text-xs text-slate-700 font-medium">三线表</label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <input
                                type="radio"
                                id="normalTable"
                                name="tableType"
                                value="normal"
                                checked={!customStyle.table.isThreeLineTable}
                                onChange={(e) => {
                                    setCustomStyle({...customStyle, table: {...customStyle.table, isThreeLineTable: false}});
                                    setTemplate(WordTemplate.CUSTOM);
                                }}
                                className="text-[var(--primary-color)] focus:ring-[var(--primary-color)]"
                            />
                            <label htmlFor="normalTable" className="text-xs text-slate-700 font-medium">普通表格</label>
                        </div>
                    </div>
                </div>
            </div>
        )}

        <div className="flex space-x-2">
            <button
                onClick={copyToWeChat}
                className={`text-xs font-bold px-3 py-1.5 rounded shadow-sm border flex items-center transition-all ${
                    copyStatus 
                    ? 'bg-green-100 text-green-700 border-green-200' 
                    : 'bg-white text-green-600 border-green-200 hover:bg-green-50'
                }`}
                title="复制带有样式的 HTML 到微信公众号后台"
            >
                <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8.5 13.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm6.5 0c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm5.9-6c0-3.31-3.13-6-7-6s-7 2.69-7 6c0 1.77.89 3.37 2.34 4.5.21.16.27.42.15.66l-.59 1.83c-.09.28.21.53.46.39l2.12-1.2c.19-.11.41-.12.61-.04.62.24 1.28.36 1.95.36 3.87 0 7-2.69 7-6zm-16.7 8.35c-2.38-.63-4.14-2.5-4.14-4.7 0-2.88 2.87-5.2 6.4-5.2 3.53 0 6.4 2.32 6.4 5.2 0 .54-.08 1.06-.23 1.55-.38-.03-.77-.05-1.17-.05-4.32 0-7.83 2.87-7.83 6.4 0 .28.02.55.07.82-.17.06-.34.1-.51.1-1.07 0-2.07-.31-2.92-.84l-1.63.92-.45-1.41.69-1.92c-.41-.56-.68-1.22-.68-1.92z"/></svg>
                {copyStatus ? '已复制！' : '复制公众号格式'}
            </button>
            <button 
                onClick={handleExportPDF}
                className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold px-3 py-1.5 rounded shadow-sm flex items-center transition-all"
                title="导出为矢量 PDF (需在打印预览中选择 '另存为 PDF')"
            >
                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                PDF
            </button>
            <button 
                onClick={handleDownload}
                className="bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold px-3 py-1.5 rounded shadow-sm flex items-center transform transition-all active:scale-95"
            >
                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Word
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 lg:p-8 flex justify-center items-start scroll-smooth custom-scrollbar">
        {/* 
            Container for Preview. 
            NOTE: The ID 'word-preview-wrapper' helps identify this container in styles if needed,
            but 'paperRef' is used for scaling.
        */}
        <div 
          id="word-preview-wrapper"
          ref={paperRef}
          className="relative transition-transform duration-300 ease-out origin-top mb-20"
          style={{ transform: `scale(${scale})` }}
        >
          {/* Main Word Preview Area */}
          <div 
            id={previewContentId}
            className={`w-[210mm] min-h-[297mm] transition-all duration-500 ${getTemplateStyles()} prose prose-slate break-words`}
            style={getCustomPreviewStyle()}
          >
            <ReactMarkdown 
              remarkPlugins={[remarkGfm, remarkMath]} 
              rehypePlugins={[[rehypeKatex, { output: 'html' }]]}
              components={{
                h1: ({node, ...props}) => <h1 
                  style={{
                    fontFamily: customStyle.heading1.fontFace,
                    fontSize: `${customStyle.heading1.fontSize}pt`,
                    color: `#${customStyle.heading1.color}`,
                    textAlign: customStyle.heading1.alignment as any,
                    lineHeight: customStyle.heading1.lineSpacing,
                    marginTop: `${customStyle.heading1.spacing.before}pt`,
                    marginBottom: `${customStyle.heading1.spacing.after}pt`,
                    textIndent: 0
                  }}
                  {...props} 
                />,
                h2: ({node, ...props}) => <h2 
                  style={{
                    fontFamily: customStyle.heading2.fontFace,
                    fontSize: `${customStyle.heading2.fontSize}pt`,
                    color: `#${customStyle.heading2.color}`,
                    textAlign: customStyle.heading2.alignment as any,
                    lineHeight: customStyle.heading2.lineSpacing,
                    marginTop: `${customStyle.heading2.spacing.before}pt`,
                    marginBottom: `${customStyle.heading2.spacing.after}pt`,
                    textIndent: 0
                  }}
                  {...props} 
                />,
                h3: ({node, ...props}) => <h3 
                  style={{
                    fontFamily: customStyle.heading3.fontFace,
                    fontSize: `${customStyle.heading3.fontSize}pt`,
                    color: `#${customStyle.heading3.color}`,
                    textAlign: customStyle.heading3.alignment as any,
                    lineHeight: customStyle.heading3.lineSpacing,
                    marginTop: `${customStyle.heading3.spacing.before}pt`,
                    marginBottom: `${customStyle.heading3.spacing.after}pt`,
                    textIndent: 0
                  }}
                  {...props} 
                />,
                p: ({node, ...props}) => <p 
                  style={{
                    fontFamily: customStyle.fontFace,
                    fontSize: `${customStyle.fontSize}pt`,
                    color: `#${customStyle.textColor}`,
                    textAlign: customStyle.alignment as any,
                    lineHeight: customStyle.lineSpacing,
                    marginTop: `${customStyle.paragraphSpacing.before}pt`,
                    marginBottom: `${customStyle.paragraphSpacing.after}pt`,
                    textIndent: `${customStyle.firstLineIndent}em`
                  }}
                  {...props} 
                />,
                img: ({node, ...props}) => <img className="mx-auto rounded-lg shadow-md max-h-[500px]" {...props} />,
                table: ({node, ...props}) => (
                  <div className="overflow-x-auto my-6">
                    <table className={`min-w-full border-collapse ${customStyle.table.isThreeLineTable ? 'border-t-2 border-b-2 border-slate-900' : 'border border-slate-400'}`} {...props} />
                  </div>
                ),
                thead: ({node, ...props}) => <thead className={customStyle.table.isThreeLineTable ? 'bg-white' : 'bg-slate-100'} {...props} />,
                th: ({node, ...props}) => <th 
                  style={{
                    fontFamily: customStyle.fontFace,
                    fontSize: `${customStyle.fontSize - 1}pt`,
                    color: `#${customStyle.textColor}`
                  }}
                  className={`px-4 py-2 font-bold ${customStyle.table.isThreeLineTable ? 'border-b border-slate-900' : 'border border-slate-400'}`} 
                  {...props} 
                />,
                td: ({node, ...props}) => <td 
                  style={{
                    fontFamily: customStyle.fontFace,
                    fontSize: `${customStyle.fontSize - 1}pt`,
                    color: `#${customStyle.textColor}`
                  }}
                  className={`px-4 py-2 ${customStyle.table.isThreeLineTable ? 'border-b border-slate-300' : 'border border-slate-400'}`} 
                  {...props} 
                />,
                ul: ({node, ...props}) => <ul 
                  style={{
                    fontFamily: customStyle.fontFace,
                    fontSize: `${customStyle.fontSize}pt`,
                    color: `#${customStyle.textColor}`
                  }}
                  className="list-disc pl-8 mb-4" 
                  {...props} 
                />,
                ol: ({node, ...props}) => <ol 
                  style={{
                    fontFamily: customStyle.fontFace,
                    fontSize: `${customStyle.fontSize}pt`,
                    color: `#${customStyle.textColor}`
                  }}
                  className="list-decimal pl-8 mb-4" 
                  {...props} 
                />,
                // Updated Code Block Component
                code: CodeBlock,
                // Explicitly handle math nodes to avoid object rendering errors
                math: ({value, children}: any) => <div className="my-4 text-center">{children || value}</div>,
                inlineMath: ({value, children}: any) => <span className="mx-1">{children || value}</span>
              } as any}
            >
              {markdown}
            </ReactMarkdown>
          </div>
          
          {/* 
            Hidden Area for WeChat Styles
            CRITICAL FIX: Do not use "hidden" or display:none, as clipboard APIs often fail to copy hidden elements.
            Instead, position it off-screen but make it "visible" to the browser.
          */}
          <div style={{ position: 'absolute', top: 0, left: '-9999px', width: '640px', background: '#fff', zIndex: -1 }}>
             <div ref={wechatContentRef} style={{ width: '100%', fontFamily: '-apple-system-font, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif' }}>
                <ReactMarkdown 
                    remarkPlugins={[remarkGfm, remarkMath]} 
                    rehypePlugins={[[rehypeKatex, { output: 'html' }]]}
                    components={{
                        h1: ({node, ...props}) => <h1 style={{ fontSize: '22px', fontWeight: 'bold', borderBottom: '2px solid var(--primary-color, #2563eb)', paddingBottom: '10px', marginBottom: '20px', marginTop: '30px', textAlign: 'center', color: '#333' }} {...props} />,
                        h2: ({node, ...props}) => <h2 style={{ fontSize: '18px', fontWeight: 'bold', borderLeft: '4px solid var(--primary-color, #2563eb)', paddingLeft: '10px', marginBottom: '16px', marginTop: '24px', backgroundColor: '#f3f4f6', padding: '5px 10px', color: '#333' }} {...props} />,
                        h3: ({node, ...props}) => <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', marginTop: '20px', color: '#333' }} {...props} />,
                        p: ({node, ...props}) => <p style={{ fontSize: '15px', lineHeight: '1.8', marginBottom: '14px', textAlign: 'justify', color: '#3f3f3f' }} {...props} />,
                        li: ({node, ...props}) => <li style={{ fontSize: '15px', lineHeight: '1.8', marginBottom: '8px', color: '#3f3f3f' }} {...props} />,
                        strong: ({node, ...props}) => <strong style={{ color: 'var(--primary-color, #2563eb)', fontWeight: 'bold' }} {...props} />,
                        blockquote: ({node, ...props}) => <blockquote style={{ borderLeft: '4px solid #d1d5db', paddingLeft: '14px', color: '#6b7280', fontSize: '14px', fontStyle: 'italic', margin: '20px 0', backgroundColor: '#f9fafb', padding: '10px 14px' }} {...props} />,
                        img: ({node, ...props}) => <img style={{ borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', maxWidth: '100%', margin: '20px auto', display: 'block' }} {...props} />,
                        code: ({node, className, children, ...props}: any) => {
                            const inline = props.inline;
                            if (inline) return <code style={{ backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', color: '#d63384', fontFamily: 'monospace', fontSize: '14px' }} {...props}>{children}</code>;
                            return <pre style={{ backgroundColor: '#1e1e1e', color: '#d4d4d4', padding: '15px', borderRadius: '8px', overflowX: 'auto', margin: '20px 0', fontSize: '13px', lineHeight: '1.5' }}><code {...props}>{children}</code></pre>;
                        },
                        // Explicitly handle math nodes for WeChat view as well
                        math: ({value, children}: any) => <div style={{margin: '16px 0', textAlign: 'center'}}>{children || value}</div>,
                        inlineMath: ({value, children}: any) => <span style={{margin: '0 4px'}}>{children || value}</span>
                    } as any}
                >
                    {markdown}
                </ReactMarkdown>
             </div>
          </div>

          {/* 堆叠效果 - 模拟真实纸张 */}
          <div className="absolute top-1 left-1 -z-10 w-full h-full bg-slate-400 opacity-20 shadow-sm"></div>
          <div className="absolute top-2 left-2 -z-20 w-full h-full bg-slate-500 opacity-10 shadow-sm"></div>
        </div>
      </div>
    </div>
  );
};

export default WordPreview;
