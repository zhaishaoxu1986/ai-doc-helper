
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Type } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import { getModelConfig } from '../../utils/settings';
import { generateContent, generateContentStream } from '../../utils/aiHelper';
import { downloadDocx } from '../../utils/converter';
import { WordTemplate } from '../../types';
import { addHistoryItem } from '../../utils/historyManager';

// Declare globals for PDF/Excel support
declare const pdfjsLib: any;

interface FormulaOCRProps {
  onResult: (text: string) => void;
}

interface FormulaData {
  inline: string;
  block: string;
  raw: string;
}

interface FormulaResult {
  data: FormulaData[];
  count: number;
}

interface TableResult {
  markdown: string;
  html: string;
}

interface HandwritingResult {
  markdown: string;
  html: string;
}

// PDF Types
interface ExtractedImage {
  data: string;
  width: number;
  height: number;
  pageNumber: number;
}

interface PDFResult {
  markdown: string;
  extractedImages: ExtractedImage[];
}

type OCRMode = 'formula' | 'table' | 'handwriting' | 'pdf';

const FormulaOCR: React.FC<FormulaOCRProps> = ({ onResult }) => {
  const [mode, setMode] = useState<OCRMode>('formula');
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Results State
  const [formulaResult, setFormulaResult] = useState<FormulaResult | null>(null);
  const [tableResult, setTableResult] = useState<TableResult | null>(null);
  const [handwritingResult, setHandwritingResult] = useState<HandwritingResult | null>(null);
  
  // PDF State
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [pdfResult, setPdfResult] = useState<PDFResult | null>(null);
  const [pdfActiveTab, setPdfActiveTab] = useState<'markdown' | 'word'>('markdown');
  const [pdfProgress, setPdfProgress] = useState<string>(''); // For streaming status
  const [streamingMarkdown, setStreamingMarkdown] = useState<string>(''); // Accumulate streaming content
  
  // Streaming State for Table and Handwriting
  const [streamingText, setStreamingText] = useState<string>(''); // For table/handwriting streaming
  
  // Debug State - 存储 AI 原始输出
  const [rawAiOutput, setRawAiOutput] = useState<string>('');
  
  // UI State
  const [activeFormulaTab, setActiveFormulaTab] = useState<'block' | 'inline' | 'raw' | 'json'>('block');
  const [activeTableTab, setActiveTableTab] = useState<'preview' | 'markdown' | 'raw'>('preview');
  const [activeHandwritingTab, setActiveHandwritingTab] = useState<'preview' | 'markdown' | 'raw'>('preview');
  const [copiedItem, setCopiedItem] = useState<string>('');  // 跟踪最近复制的项，用内容作为标识
  
  // Settings State
  const [showPromptSettings, setShowPromptSettings] = useState(false);
  const [formulaPrompt, setFormulaPrompt] = useState(() => localStorage.getItem('prompt_formula') || `Identify ALL mathematical formulas in the image.

CRITICAL OUTPUT FORMAT:
- You MUST output JSON with exactly this structure: { "formulas": [array of formula objects] }
- EACH formula object MUST contain exactly 1 field: "raw"

KEY RULES (VERY IMPORTANT):
- Output ONLY the "raw" field for each formula (Plain LaTeX WITHOUT any delimiters)
- DO NOT include $, $$, \\[ or \\] delimiters in the output
- DO NOT create "inline", "block", or "html" fields - the system will add them automatically
- Provide clean, pure LaTeX code

Example output:
{
  "formulas": [
    {
      "raw": "E=mc^2"
    },
    {
      "raw": "\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}"
    }
  ]
}

If no formulas found, return: { "formulas": [] }`);
  const [tablePrompt, setTablePrompt] = useState(() => localStorage.getItem('prompt_table') || 'Analyze image containing table. Output strictly content in Markdown format. Use standard Markdown tables.');
  const [handwritingPrompt, setHandwritingPrompt] = useState(() => localStorage.getItem('prompt_handwriting') || 'Transcribe handwritten text to Markdown. Preserve lists, headings. Do not wrap in JSON.');
  const [tempPrompt, setTempPrompt] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      // Clear PDF data on mount or when mode changes to keep clean state
      if (mode !== 'pdf') {
          setPdfFile(null);
          setPdfDataUrl(null);
          setPdfResult(null);
          setPdfProgress('');
          setStreamingMarkdown('');
      }
  }, [mode]);

  // Image Processing (Common)
  const processImage = (file: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_DIMENSION = 1600;
                if (width > height) {
                    if (width > MAX_DIMENSION) {
                        height *= MAX_DIMENSION / width;
                        width = MAX_DIMENSION;
                    }
                } else {
                    if (height > MAX_DIMENSION) {
                        width *= MAX_DIMENSION / height;
                        height = MAX_DIMENSION;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) { reject(new Error("Could not get canvas context")); return; }
                // Fill white background for transparency
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                resolve(compressedDataUrl);
            };
            img.onerror = (e) => reject(e);
            img.src = event.target?.result as string;
        };
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    });
  };

  // --- Sample Generators (Canvas) ---
  
  const createFormulaSampleImage = (): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 600, 300);

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 20px Helvetica, Arial, sans-serif';
    ctx.fillText('Sample: Quadratic Formula', 20, 40);

    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;

    ctx.font = 'italic 40px "Times New Roman", serif';
    ctx.fillText('x =', 60, 160);

    ctx.beginPath();
    ctx.moveTo(130, 148);
    ctx.lineTo(440, 148);
    ctx.stroke();

    ctx.font = 'italic 36px "Times New Roman", serif';
    ctx.fillText('-b ±', 145, 125);

    ctx.beginPath();
    ctx.moveTo(235, 105);
    ctx.lineTo(250, 135); 
    ctx.lineTo(265, 85);  
    ctx.lineTo(430, 85);  
    ctx.stroke();

    ctx.fillText('b', 280, 125);
    ctx.font = 'italic 22px "Times New Roman", serif';
    ctx.fillText('2', 300, 105);
    ctx.font = 'italic 36px "Times New Roman", serif';
    ctx.fillText('- 4ac', 320, 125);

    ctx.fillText('2a', 265, 200);

    return canvas.toDataURL('image/png');
  };

  const createTableSampleImage = (): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 600, 500);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 32px Helvetica, Arial, sans-serif';
    ctx.fillText('Nutrition Facts', 20, 50);
    ctx.font = '24px "Noto Sans SC", sans-serif';
    ctx.fillText('营养成分表', 20, 85);

    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(20, 100);
    ctx.lineTo(580, 100);
    ctx.stroke();

    ctx.lineWidth = 1;
    let y = 140;
    const drawRow = (label: string, value: string, bold = false) => {
        ctx.font = bold ? 'bold 20px sans-serif' : '20px sans-serif';
        ctx.fillText(label, 20, y);
        ctx.fillText(value, 450, y);
        
        ctx.beginPath();
        ctx.moveTo(20, y + 10);
        ctx.lineTo(580, y + 10);
        ctx.strokeStyle = '#cccccc';
        ctx.stroke();
        y += 40;
    };

    drawRow('Serving Size (食用分量)', '100g', true);
    drawRow('Calories (能量)', '2000 kJ', true);
    
    y -= 25;
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(20, y + 10);
    ctx.lineTo(580, y + 10);
    ctx.stroke();
    y += 40;

    drawRow('Total Fat (脂肪)', '15 g', true);
    drawRow('   Saturated Fat (饱和脂肪)', '2 g');
    drawRow('Cholesterol (胆固醇)', '0 mg', true);
    drawRow('Sodium (钠)', '160 mg', true);
    drawRow('Total Carbohydrate (碳水)', '45 g', true);

    y += 20;
    ctx.font = '14px sans-serif';
    ctx.fillText('* The % Daily Value (DV) tells you how much a nutrient in', 20, y);
    ctx.fillText('a serving of food contributes to a daily diet.', 20, y + 20);

    return canvas.toDataURL('image/png');
  };

  const createHandwritingSampleImage = (): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Yellow note background
    ctx.fillStyle = '#fef3c7'; 
    ctx.fillRect(0, 0, 500, 500);

    // Lines
    ctx.strokeStyle = '#d4d4d8';
    ctx.lineWidth = 1;
    for (let i = 80; i < 500; i += 40) {
        ctx.beginPath();
        ctx.moveTo(20, i);
        ctx.lineTo(480, i);
        ctx.stroke();
    }

    ctx.fillStyle = '#1e3a8a'; 
    ctx.font = '28px "Comic Sans MS", "Chalkboard SE", "Marker Felt", sans-serif'; 
    
    const lines = [
        "Meeting Notes - 10/24",
        "",
        "1. Finalize the UI design for",
        "   the mobile app.",
        "2. Review API endpoints with",
        "   the backend team.",
        "3. Buy coffee beans!! ☕",
        "",
        "- John"
    ];

    let startY = 70;
    lines.forEach(line => {
        ctx.fillText(line, 40, startY);
        startY += 40;
    });

    return canvas.toDataURL('image/png');
  };

  // Load Sample Logic
  const handleLoadSample = async () => {
      if (mode === 'pdf') {
          alert('PDF 模式暂不支持加载示例，请手动上传 PDF 文件。');
          return;
      }
      
      let sampleDataUrl = '';
      try {
          // Try to load from file first for all modes
          let filePath = '';
          if (mode === 'formula') {
              filePath = '/ocr/latex.png';
          } else if (mode === 'table') {
              filePath = '/ocr/table.jpg';
          } else if (mode === 'handwriting') {
              filePath = '/ocr/handwrite.jpg';
          }
          
          if (filePath) {
              try {
                  const response = await fetch(filePath);
                  if (response.ok) {
                      const blob = await response.blob();
                      sampleDataUrl = await processImage(blob);
                  } else {
                      // Fallback to canvas generation if file not found
                      console.warn(`Failed to load ${filePath}, using canvas generation`);
                      if (mode === 'formula') {
                          sampleDataUrl = createFormulaSampleImage();
                      } else if (mode === 'table') {
                          sampleDataUrl = createTableSampleImage();
                      } else if (mode === 'handwriting') {
                          sampleDataUrl = createHandwritingSampleImage();
                      }
                  }
              } catch (err) {
                  // Fallback to canvas generation if fetch fails
                  console.warn(`Failed to load ${filePath}, using canvas generation`);
                  if (mode === 'formula') {
                      sampleDataUrl = createFormulaSampleImage();
                  } else if (mode === 'table') {
                      sampleDataUrl = createTableSampleImage();
                  } else if (mode === 'handwriting') {
                      sampleDataUrl = createHandwritingSampleImage();
                  }
              }
          }
          
          if (sampleDataUrl) {
              setImage(sampleDataUrl);
              resetResults();
          }
      } catch (e) {
          console.error("Sample generation failed", e);
          alert("无法加载示例图片");
      }
  };

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    if (mode === 'pdf') return; // Disable paste for PDF mode for now
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          try {
            const compressedImage = await processImage(blob);
            setImage(compressedImage);
            resetResults();
          } catch (err) {
            console.error("Image processing failed", err);
            alert("图片处理失败");
          }
        }
      }
    }
  }, [mode]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };
  
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && mode !== 'pdf') {
      const file = e.dataTransfer.files[0];
      try {
        const compressedImage = await processImage(file);
        setImage(compressedImage);
        resetResults();
      } catch (err) {
        console.error("Image processing failed", err);
        alert("图片处理失败");
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        try {
            const compressedImage = await processImage(file);
            setImage(compressedImage);
            resetResults();
        } catch (err) {
            console.error("Image processing failed", err);
            alert("图片处理失败");
        }
    }
    if (e.target) e.target.value = '';
  };

  const handlePdfFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
        setPdfFile(file);
        const reader = new FileReader();
        reader.onload = (event) => {
            setPdfDataUrl(event.target?.result as string);
        };
        reader.readAsDataURL(file);
        setPdfResult(null);
        setStreamingMarkdown('');
        setPdfProgress('');
    } else {
        alert('请选择有效的 PDF 文件');
    }
    if (e.target) e.target.value = '';
  };

  const resetResults = () => {
    setFormulaResult(null);
    setTableResult(null);
    setHandwritingResult(null);
  };

  const parseJsonSafe = (text: string) => {
      let clean = text.trim();
      const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)(?:```|$)/;
      const match = clean.match(codeBlockRegex);
      if (match && match[1]) clean = match[1].trim();
      const start = clean.indexOf('{');
      const end = clean.lastIndexOf('}');
      if (start !== -1 && end !== -1) clean = clean.substring(start, end + 1);
      try { return JSON.parse(clean); } catch (e) { throw new Error("Invalid JSON structure in response."); }
  };

  const parseFormulaJsonSafe = (text: string): FormulaResult => {
      let clean = text.trim();
      const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)(?:```|$)/;
      const match = clean.match(codeBlockRegex);
      if (match && match[1]) clean = match[1].trim();
      const start = clean.indexOf('{');
      const end = clean.lastIndexOf('}');
      if (start !== -1 && end !== -1) clean = clean.substring(start, end + 1);
      
      try {
          const parsed = JSON.parse(clean);
          
          let formulaData: any[] = [];
          
          // 处理新格式：{ formulas: [{ raw: "..." }] }
          if (parsed.formulas && Array.isArray(parsed.formulas)) {
              formulaData = parsed.formulas.map((item: any) => {
                  let raw = item.raw || '';
                  // 清理可能的分隔符
                  raw = raw.replace(/^\$\$/, '').replace(/\$\$$/, '');  // 移除 $$
                  raw = raw.replace(/^\$/, '').replace(/\$$/, '');      // 移除 $
                  raw = raw.replace(/^\\\[/, '').replace(/\\\]$/, ''); // 移除 \[
                  raw = raw.replace(/^\\\(/, '').replace(/\\\)$/, ''); // 移除 \(
                  
                  return {
                      inline: `$${raw}$`,
                      block: `$$${raw}$$`,
                      raw: raw
                  };
              });
          }
          // 处理旧格式（单个公式）向后兼容
          else if (parsed.inline || parsed.block || parsed.raw || parsed.html) {
              formulaData = [parsed];
          }
          // 处理数组格式直接返回的情况
          else if (Array.isArray(parsed)) {
              formulaData = parsed;
          } else {
              throw new Error("Invalid JSON structure in response.");
          }
          
          return {
              data: formulaData,
              count: formulaData.length
          };
      } catch (e) {
          console.error('JSON Parse Error:', e);
          throw new Error("无法解析识别结果，请重试或检查图片。");
      }
  };

  // --- PDF Helpers ---
  const convertPdfToImages = async (file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);
          const pdfjsLib = (window as any).pdfjsLib;
          if (!pdfjsLib) { reject(new Error('PDF.js library not loaded')); return; }
          const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
          const images: string[] = [];
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: context!, viewport: viewport }).promise;
            const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            images.push(imageDataUrl.split(',')[1]);
          }
          resolve(images);
        } catch (error) { reject(error); }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const extractImagesFromPdf = async (file: File): Promise<Map<number, ExtractedImage[]>> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);
          const pdfjsLib = (window as any).pdfjsLib;
          if (!pdfjsLib) { reject(new Error('PDF.js library not loaded')); return; }
          const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
          const pageImagesMap = new Map<number, ExtractedImage[]>();
          
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const pageImages: ExtractedImage[] = [];
            try {
              const ops = await page.getOperatorList();
              const imagePromises: Promise<void>[] = [];
              for (let i = 0; i < ops.fnArray.length; i++) {
                const fn = ops.fnArray[i];
                if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintInlineImageXObject || fn === pdfjsLib.OPS.paintJpegXObject) {
                  const imageName = ops.argsArray[i][0];
                  imagePromises.push(new Promise<void>((resolveImg) => {
                    page.objs.get(imageName, async (image: any) => {
                      if (image && image.width && image.height) {
                        const canvas = document.createElement('canvas');
                        canvas.width = image.width;
                        canvas.height = image.height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            if (image.bitmap) ctx.drawImage(image.bitmap, 0, 0);
                            else if (image.data) {
                                const imgData = ctx.createImageData(image.width, image.height);
                                image.data.length === imgData.data.length ? imgData.data.set(image.data) : null; 
                                ctx.putImageData(imgData, 0, 0);
                            }
                            const base64Data = canvas.toDataURL('image/png', 0.95).split(',')[1];
                            if (base64Data.length > 200) {
                                pageImages.push({ data: base64Data, width: image.width, height: image.height, pageNumber: pageNum });
                            }
                        }
                      }
                      resolveImg();
                    });
                  }));
                }
              }
              await Promise.all(imagePromises);
            } catch (opsErr) { console.warn(`Ops error page ${pageNum}`, opsErr); }
            if (pageImages.length > 0) pageImagesMap.set(pageNum, pageImages);
          }
          resolve(pageImagesMap);
        } catch (error) { reject(error); }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const detectImagesInPages = async (pageImages: string[]): Promise<number[]> => {
    const config = getModelConfig('ocr');
    const imageCounts: number[] = [];
    for (let i = 0; i < pageImages.length; i++) {
        try {
            const prompt = `Analyze this PDF page. Count ONLY the distinct images/figures/charts (exclude logos). Respond with ONLY a single number.`;
            const response = await generateContent({ apiKey: config.apiKey, model: config.model, baseUrl: config.baseUrl, image: pageImages[i], mimeType: 'image/jpeg', prompt });
            const match = (response as string).match(/\d+/);
            imageCounts.push(match ? parseInt(match[0]) : 0);
        } catch { imageCounts.push(0); }
    }
    return imageCounts;
  };

  // Main Analysis Logic
  const analyzeImage = async () => {
    const config = getModelConfig('ocr');
    if (!config.apiKey) { alert('请先在右上角用户中心配置 API Key'); return; }

    setIsAnalyzing(true);
    
    // PDF Handling
    if (mode === 'pdf') {
        if (!pdfFile) return;
        setPdfResult(null);
        setStreamingMarkdown('');
        setPdfProgress('正在解析 PDF...');
        
        try {
            const images = await convertPdfToImages(pdfFile);
            setPdfProgress(`已转换 ${images.length} 页 PDF，正在提取原生图片...`);
            const pageImagesMap = await extractImagesFromPdf(pdfFile);
            
            setPdfProgress('正在智能检测图片布局...');
            const imageCounts = await detectImagesInPages(images);
            
            let fullMarkdown = '';
            let imageCounter = 0;
            const pageMarkdowns: string[] = [];

            for (let i = 0; i < images.length; i++) {
                const pageNum = i + 1;
                setPdfProgress(`正在 AI 识别第 ${pageNum} / ${images.length} 页 (流式生成中)...`);
                
                const nativeImages = pageImagesMap.get(pageNum) || [];
                const pageImageCount = Math.max(imageCounts[i], nativeImages.length);
                let imagePromptPart = '';
                if (pageImageCount > 0) {
                    imagePromptPart = `\n\nIMPORTANT: This page contains ${pageImageCount} image(s). Insert ONLY placeholder ![图片X] where images appear. DO NOT describe images.`;
                }

                const prompt = `Analyze this PDF page image. Convert to Markdown. Preserve structure, tables, and latex formulas ($...$).${imagePromptPart}\nOutput clean Markdown.`;

                // Use generateContentStream for PDF pages too to show progress
                let pageMarkdown = '';
                const stream = generateContentStream({
                    apiKey: config.apiKey,
                    model: config.model,
                    baseUrl: config.baseUrl,
                    image: images[i],
                    mimeType: 'image/jpeg',
                    prompt: prompt
                });

                for await (const chunk of stream) {
                    pageMarkdown += chunk;
                    // Update streaming display
                    setStreamingMarkdown(prev => prev); 
                }

                // Post-process page markdown
                let processed = pageMarkdown.trim();
                
                // Replace placeholders with valid markdown syntax containing IDs we can track
                // Using ![图片X](pdf_image_X) so ReactMarkdown treats it as an image node
                processed = processed.replace(/!\[图片\d+\]/g, () => {
                    const id = ++imageCounter;
                    return `![图片${id}](pdf_image_${id})`;
                });
                
                // Cleanup descriptions
                const descPatterns = [
                    /(?:图片?|图像|插图|Figure|Image|图表|Fig\.)\s*\d*[:：]?[^\n]*(?=!\[图片\d+\])/gi,
                    /!\[图片\d+\][^\n]*描述[^\n]*/gi,
                    /[^\n]*(?:显示|展示|说明|描述)[^\n]*(?=!\[图片\d+\])/gi
                ];
                descPatterns.forEach(p => processed = processed.replace(p, ''));
                
                // Force placeholders if missed
                const actualPlaceholders = (processed.match(/!\[图片\d+\]/g) || []).length;
                if (pageImageCount > 0 && actualPlaceholders === 0) {
                    processed += '\n\n';
                    for(let k=0; k<pageImageCount; k++) {
                        const id = ++imageCounter;
                        processed += `![图片${id}](pdf_image_${id})\n\n`;
                    }
                }

                processed = processed.replace(/\n{3,}/g, '\n\n');
                pageMarkdowns.push(processed);
                fullMarkdown += processed + '\n\n---\n\n';
                
                // Update live markdown view with valid image syntax
                setStreamingMarkdown(fullMarkdown);
            }

            // Consolidate images
            const extractedImages: ExtractedImage[] = [];
            for (let i = 0; i < images.length; i++) {
                const pageNum = i + 1;
                const native = pageImagesMap.get(pageNum) || [];
                const md = pageMarkdowns[i];
                // Match our modified placeholders to align indices
                const placeholders = md.match(/!\[图片\d+\]/g) || [];
                
                for (let k = 0; k < placeholders.length; k++) {
                    if (k < native.length) extractedImages.push(native[k]);
                }
            }

            setPdfResult({ markdown: fullMarkdown, extractedImages });
            setPdfProgress('转换完成！');
            
            // 保存到统一历史记录
            addHistoryItem({
                module: 'ocr',
                status: 'success',
                title: `PDF 转换 - ${pdfFile?.name}`,
                preview: fullMarkdown.slice(0, 200) + (fullMarkdown.length > 200 ? '...' : ''),
                fullResult: fullMarkdown,
                metadata: {
                    ocrMode: 'pdf',
                    fileCount: images.length,
                    extractedCount: extractedImages.length
                }
            });

        } catch (err: any) {
            console.error('PDF Error:', err);
            alert('PDF 转换失败: ' + err.message);
            setPdfProgress('转换出错');
        } finally {
            setIsAnalyzing(false);
        }
        return;
    }

    // Normal Image Modes
    if (!image) return;
    resetResults();

    try {
      const split = image.split(',');
      const meta = split[0];
      const base64Data = split[1];
      let mimeType = 'image/png';
      const mimeMatch = meta.match(/data:([^;]+);/);
      if (mimeMatch) mimeType = mimeMatch[1];

      if (mode === 'formula') {
          const responseText = await generateContent({
            apiKey: config.apiKey,
            model: config.model,
            baseUrl: config.baseUrl,
            image: base64Data,
            mimeType: mimeType,
            prompt: formulaPrompt,
            jsonSchema: { type: Type.OBJECT, properties: { formulas: {type:Type.ARRAY, items: {type:Type.OBJECT, properties: { raw: {type:Type.STRING} }}}} }
          });
          // 保存原始输出用于调试
          setRawAiOutput(responseText);
          const result = parseFormulaJsonSafe(responseText);
          setFormulaResult(result);
          setActiveFormulaTab('block');
          
          // 保存到统一历史记录
          addHistoryItem({
              module: 'ocr',
              status: 'success',
              title: `公式识别 - 检测到 ${result.count} 个公式`,
              preview: result.data.map(f => f.block).join('\n').slice(0, 200) + (result.data.map(f => f.block).join('\n').length > 200 ? '...' : ''),
              fullResult: JSON.stringify(result),
              metadata: {
                  ocrMode: 'formula',
                  extractedCount: result.count
              }
          });
      } else if (mode === 'table') {
          // 表格识别使用流式输出
          setStreamingText('');
          let tableResponseText = '';
          try {
              const stream = generateContentStream({
                  apiKey: config.apiKey,
                  model: config.model,
                  baseUrl: config.baseUrl,
                  image: base64Data,
                  mimeType: mimeType,
                  prompt: tablePrompt
              });
              
              for await (const chunk of stream) {
                  tableResponseText += chunk;
                  setStreamingText(tableResponseText);
                  setRawAiOutput(tableResponseText);
              }
              
              setTableResult({ markdown: tableResponseText, html: tableResponseText });
              setActiveTableTab('preview');
              
              // 保存到统一历史记录
              addHistoryItem({
                  module: 'ocr',
                  status: 'success',
                  title: `表格识别 - ${tableResponseText.slice(0, 30).replace(/\n/g, '')}...`,
                  preview: tableResponseText.slice(0, 200) + (tableResponseText.length > 200 ? '...' : ''),
                  fullResult: tableResponseText,
                  metadata: {
                      ocrMode: 'table'
                  }
              });
          } catch (streamError) {
              console.error('Streaming error, falling back to non-streaming:', streamError);
              // 降级到非流式
              const responseText = await generateContent({
                  apiKey: config.apiKey,
                  model: config.model,
                  baseUrl: config.baseUrl,
                  image: base64Data,
                  mimeType: mimeType,
                  prompt: tablePrompt
              });
              setTableResult({ markdown: responseText, html: responseText });
              setActiveTableTab('preview');
              
              addHistoryItem({
                  module: 'ocr',
                  status: 'success',
                  title: `表格识别 - ${responseText.slice(0, 30).replace(/\n/g, '')}...`,
                  preview: responseText.slice(0, 200) + (responseText.length > 200 ? '...' : ''),
                  fullResult: responseText,
                  metadata: { ocrMode: 'table' }
              });
          }
      } else if (mode === 'handwriting') {
          // 手写识别使用流式输出
          setStreamingText('');
          let handwritingResponseText = '';
          try {
              const stream = generateContentStream({
                  apiKey: config.apiKey,
                  model: config.model,
                  baseUrl: config.baseUrl,
                  image: base64Data,
                  mimeType: mimeType,
                  prompt: handwritingPrompt
              });
              
              for await (const chunk of stream) {
                  handwritingResponseText += chunk;
                  setStreamingText(handwritingResponseText);
                  setRawAiOutput(handwritingResponseText);
              }
              
              setHandwritingResult({ markdown: handwritingResponseText, html: handwritingResponseText });
              setActiveHandwritingTab('preview');
              
              // 保存到统一历史记录
              addHistoryItem({
                  module: 'ocr',
                  status: 'success',
                  title: `手写体识别 - ${handwritingResponseText.slice(0, 30).replace(/\n/g, '')}...`,
                  preview: handwritingResponseText.slice(0, 200) + (handwritingResponseText.length > 200 ? '...' : ''),
                  fullResult: handwritingResponseText,
                  metadata: {
                      ocrMode: 'handwriting'
                  }
              });
          } catch (streamError) {
              console.error('Streaming error, falling back to non-streaming:', streamError);
              // 降级到非流式
              const responseText = await generateContent({
                  apiKey: config.apiKey,
                  model: config.model,
                  baseUrl: config.baseUrl,
                  image: base64Data,
                  mimeType: mimeType,
                  prompt: handwritingPrompt
              });
              setHandwritingResult({ markdown: responseText, html: responseText });
              setActiveHandwritingTab('preview');
              
              addHistoryItem({
                  module: 'ocr',
                  status: 'success',
                  title: `手写体识别 - ${responseText.slice(0, 30).replace(/\n/g, '')}...`,
                  preview: responseText.slice(0, 200) + (responseText.length > 200 ? '...' : ''),
                  fullResult: responseText,
                  metadata: { ocrMode: 'handwriting' }
              });
          }
      }
    } catch (err: any) {
      console.error('OCR Error:', err);
      alert('识别失败，请检查图片或 API 配置。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopy = (text: string, identifier?: string) => {
    navigator.clipboard.writeText(text).then(() => {
        // 如果提供了标识符，记录这个标识符；否则记录文本内容
        const id = identifier || text;
        setCopiedItem(id);
        setTimeout(() => setCopiedItem(''), 2000);
    });
  };

  const openPromptSettings = () => {
      setTempPrompt(mode === 'formula' ? formulaPrompt : mode === 'table' ? tablePrompt : handwritingPrompt);
      setShowPromptSettings(true);
  };

  const savePromptSettings = () => {
      if (mode === 'formula') {
          setFormulaPrompt(tempPrompt);
          localStorage.setItem('prompt_formula', tempPrompt);
      } else if (mode === 'table') {
          setTablePrompt(tempPrompt);
          localStorage.setItem('prompt_table', tempPrompt);
      } else if (mode === 'handwriting') {
          setHandwritingPrompt(tempPrompt);
          localStorage.setItem('prompt_handwriting', tempPrompt);
      }
      setShowPromptSettings(false);
  };

  const insertContent = () => {
      if (mode === 'formula' && formulaResult) {
          // 如果有多个公式，插入所有公式的指定格式；如果只有一个，只插入第一个
          let content = '';
          if (formulaResult.count > 1) {
              content = formulaResult.data.map(f => f[activeFormulaTab]).join('\n\n');
          } else {
              content = formulaResult.data[0][activeFormulaTab];
          }
          onResult(content);
      }
      else if (mode === 'table' && tableResult) onResult(tableResult.markdown);
      else if (mode === 'handwriting' && handwritingResult) onResult(handwritingResult.markdown);
      else if (mode === 'pdf' && pdfResult) {
          // Replace image placeholders with actual base64 data for the editor
          let finalMarkdown = pdfResult.markdown;
          const imgRegex = /!\[(.*?)\]\(pdf_image_(\d+)\)/g;
          finalMarkdown = finalMarkdown.replace(imgRegex, (match, alt, id) => {
              const idx = parseInt(id) - 1;
              if (pdfResult.extractedImages[idx]) {
                  return `![${alt}](data:image/png;base64,${pdfResult.extractedImages[idx].data})`;
              }
              return match; // Keep original if no image found
          });
          onResult(finalMarkdown);
      }
  };

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto min-h-full flex flex-col" onPaste={handlePaste}>
      <div className="text-center mb-6">
        <h2 className="text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">AI 视觉识别中心 (AI Vision)</h2>
        
        <div className="flex justify-center mb-4">
            <div className="bg-slate-100 p-1 rounded-xl inline-flex shadow-inner">
                <button onClick={() => setMode('formula')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'formula' ? 'bg-white text-[var(--primary-color)] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Σ 公式识别</button>
                <button onClick={() => setMode('table')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'table' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>📋 表格识别</button>
                <button onClick={() => setMode('handwriting')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'handwriting' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>✍️ 手写体识别</button>
                <button onClick={() => setMode('pdf')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center ${mode === 'pdf' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    PDF 智能转换
                </button>
            </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[500px]">
        {/* LEFT COLUMN */}
        <div className="space-y-4 flex flex-col">
          {mode === 'pdf' ? (
              // PDF Uploader / Viewer
              !pdfDataUrl ? (
                <div className="bg-white border-2 border-dashed border-slate-300 rounded-3xl flex-1 flex flex-col items-center justify-center relative overflow-hidden group hover:border-rose-500 hover:bg-rose-50 transition-all duration-300 shadow-sm min-h-[400px]">
                    <div className="text-center cursor-pointer p-10" onClick={() => pdfInputRef.current?.click()}>
                        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-4 text-rose-600 mx-auto group-hover:scale-110 transition-transform">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        </div>
                        <h4 className="text-slate-800 font-bold text-xl mb-2">点击上传 PDF 文档</h4>
                        <p className="text-slate-400 text-sm">支持多页 PDF 批量处理与图片提取</p>
                        <input type="file" ref={pdfInputRef} onChange={handlePdfFileChange} className="hidden" accept="application/pdf" />
                    </div>
                </div>
              ) : (
                <div className="flex-1 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-[500px]">
                    <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-slate-50">
                        <span className="text-sm font-bold text-slate-700 truncate max-w-[200px]">{pdfFile?.name}</span>
                        <button onClick={() => { setPdfFile(null); setPdfDataUrl(null); }} className="text-slate-400 hover:text-red-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                    <iframe src={pdfDataUrl} className="w-full flex-1 border-0" title="PDF Preview" />
                </div>
              )
          ) : (
              // Image Uploader with Drag & Drop
              <div
                className={`bg-white border-2 rounded-3xl flex-1 flex flex-col items-center justify-center relative overflow-hidden shadow-sm min-h-[400px] transition-all ${
                  isDragOver
                      ? 'border-solid border-[var(--primary-color)] bg-[var(--primary-50)]'
                      : 'border-dashed border-slate-300 group hover:border-[var(--primary-color)] hover:bg-[var(--primary-50)] duration-300'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {image ? (
                  <>
                    <img src={image} alt="Preview" className="max-h-full max-w-full object-contain p-6" />
                    <div className="absolute top-4 right-4">
                      <button onClick={() => { setImage(null); resetResults(); setIsDragOver(false); }} className="bg-red-500 text-white p-2 rounded-full shadow-lg hover:bg-red-600 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                  </>
                ) : (
                  <div className="text-center cursor-pointer p-10" onClick={() => fileInputRef.current?.click()}>
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform ${mode === 'table' ? 'bg-green-50 text-green-600' : mode === 'handwriting' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400 group-hover:text-[var(--primary-color)] group-hover:bg-[var(--primary-50)]'}`}>
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <h4 className="text-slate-800 font-bold text-xl mb-2">粘贴截图、点击或拖拽上传</h4>
                    <p className="text-slate-400 text-sm">支持 PNG/JPG (自动压缩)</p>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                    
                    {isDragOver && (
                      <div className="absolute inset-0 flex items-center justify-center bg-[var(--primary-color)]/10 backdrop-blur-sm z-10">
                        <span className="text-2xl font-bold text-[var(--primary-color)] animate-pulse">释放即可上传图片 📥</span>
                      </div>
                    )}
                    
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleLoadSample(); }}
                        className={`mt-4 px-3 py-1 text-xs border rounded-full transition-all ${
                            mode === 'table' 
                            ? 'text-green-600 border-green-600 bg-white hover:bg-green-600 hover:text-white' 
                            : mode === 'handwriting'
                            ? 'text-amber-600 border-amber-600 bg-white hover:bg-amber-600 hover:text-white'
                            : 'text-[var(--primary-color)] border-[var(--primary-color)] bg-white hover:bg-[var(--primary-color)] hover:text-white'
                        }`}
                    >
                        加载测试图片 (Sample)
                    </button>
                  </div>
                )}
              </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
              <button
                onClick={openPromptSettings}
                className="flex-1 py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center bg-slate-100 text-slate-600 hover:bg-slate-200 shadow-sm"
              >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  配置 Prompt
              </button>
              <button
                onClick={analyzeImage}
                disabled={(!image && !pdfFile) || isAnalyzing}
                className={`flex-1 py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center text-white shadow-xl ${
                    (!image && !pdfFile) || isAnalyzing ? 'bg-slate-300 cursor-not-allowed' :
                    mode === 'pdf' ? 'bg-rose-600 hover:bg-rose-700' :
                    mode === 'table' ? 'bg-green-600 hover:bg-green-700' :
                    mode === 'handwriting' ? 'bg-amber-500 hover:bg-amber-600' :
                    'bg-[var(--primary-color)] hover:bg-[var(--primary-hover)]'
                }`}
              >
                {isAnalyzing ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        {mode === 'pdf' ? pdfProgress || 'AI 处理中...' : 'AI 识别中...'}
                    </>
                ) : (mode === 'pdf' ? '开始 PDF 全文转换' : '开始识别')}
              </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Results */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col overflow-hidden h-[600px] lg:h-auto">
          {/* PDF MODE RESULTS */}
          {mode === 'pdf' && (
              <div className="flex flex-col h-full">
                  <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
                      <div className="flex space-x-2">
                          <button onClick={() => setPdfActiveTab('markdown')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${pdfActiveTab === 'markdown' ? 'bg-rose-50 text-rose-600' : 'text-slate-500 hover:bg-slate-50'}`}>Markdown</button>
                          <button onClick={() => setPdfActiveTab('word')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${pdfActiveTab === 'word' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}>Word 预览</button>
                      </div>
                      {pdfResult && (
                          <button onClick={() => downloadDocx(pdfResult.markdown, WordTemplate.STANDARD)} className="text-xs flex items-center text-slate-500 hover:text-[var(--primary-color)]">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                              下载 Word
                          </button>
                      )}
                  </div>
                  
                  <div className="flex-1 overflow-auto bg-slate-50 rounded-xl border border-slate-200 p-4 custom-scrollbar">
                      {isAnalyzing && !pdfResult && (
                          <div className="animate-pulse space-y-4">
                              <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                              <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                              <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                              <div className="text-xs text-slate-400 pt-4 font-mono whitespace-pre-wrap">{streamingMarkdown}</div>
                          </div>
                      )}
                      
                      {pdfResult ? (
                          pdfActiveTab === 'markdown' ? (
                              <div className="prose prose-sm max-w-none">
                                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{pdfResult.markdown}</ReactMarkdown>
                              </div>
                          ) : (
                              <div className="bg-white p-8 shadow-sm min-h-full">
                                  <ReactMarkdown 
                                    remarkPlugins={[remarkGfm, remarkMath]} 
                                    rehypePlugins={[rehypeKatex]}
                                    components={{
                                        img: ({node, ...props}) => {
                                            // The generated markdown uses syntax: ![alt](pdf_image_ID)
                                            // We check if src contains 'pdf_image_'
                                            const src = props.src || '';
                                            const match = src.match(/pdf_image_(\d+)/);
                                            if (match) {
                                                const id = parseInt(match[1]);
                                                const idx = id - 1;
                                                if (pdfResult.extractedImages[idx]) {
                                                    return <img src={`data:image/png;base64,${pdfResult.extractedImages[idx].data}`} className="max-w-full h-auto my-4 rounded shadow-md" alt={props.alt} />;
                                                }
                                            }
                                            return <span className="text-red-400 text-xs bg-red-50 p-1 rounded border border-red-100 block my-2">[图片显示失败: {props.alt || 'Unknown'}]</span>;
                                        }
                                    }}
                                  >{pdfResult.markdown}</ReactMarkdown>
                              </div>
                          )
                      ) : !isAnalyzing && (
                          <div className="h-full flex flex-col items-center justify-center text-slate-300">
                              <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                              <p className="text-sm">转换结果将显示在这里</p>
                          </div>
                      )}
                  </div>
              </div>
          )}

          {/* OTHER MODES RESULTS (Formula, Table, Handwriting) */}
          {mode !== 'pdf' && (
              <>
                {/* Result Tabs & Content - simplified for brevity, kept logic same as original */}
                {((mode === 'formula' && formulaResult) || (mode === 'table' && tableResult) || (mode === 'handwriting' && handwritingResult)) ? (
                    <div className="flex flex-col h-full">
                        {/* Tabs */}
                        <div className="flex bg-slate-100 p-1 rounded-xl w-fit mb-4">
                            {mode === 'formula' && ['block', 'inline', 'raw', 'json'].map(t => (
                                <button key={t} onClick={() => setActiveFormulaTab(t as any)} className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize ${activeFormulaTab === t ? 'bg-white shadow-sm' : 'text-slate-500'}`}>{t === 'json' ? '原始JSON' : t}</button>
                            ))}
                            {mode === 'table' && ['preview', 'markdown', 'raw'].map(t => (
                                <button key={t} onClick={() => setActiveTableTab(t as any)} className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize ${activeTableTab === t ? 'bg-white shadow-sm' : 'text-slate-500'}`}>{t === 'raw' ? '原始输出' : t}</button>
                            ))}
                            {mode === 'handwriting' && ['preview', 'markdown', 'raw'].map(t => (
                                <button key={t} onClick={() => setActiveHandwritingTab(t as any)} className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize ${activeHandwritingTab === t ? 'bg-white shadow-sm' : 'text-slate-500'}`}>{t === 'raw' ? '原始输出' : t}</button>
                            ))}
                        </div>
                        
                        {/* Content Area */}
                        <div className="flex-1 overflow-auto bg-slate-50 rounded-xl border border-slate-200 p-4 custom-scrollbar">
                            {/* Loading state with streaming for table and handwriting */}
                            {isAnalyzing && !formulaResult && !tableResult && !handwritingResult && (
                                <div className="animate-pulse space-y-4">
                                    <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                                    <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                                    <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                                    <div className="text-xs text-slate-400 pt-4 font-mono whitespace-pre-wrap">{streamingText}</div>
                                </div>
                            )}
                            
                            {mode === 'formula' && formulaResult && (
                                <div className="flex flex-col gap-4">
                                    {/* 原始JSON输出 */}
                                    {activeFormulaTab === 'json' && rawAiOutput && (
                                        <div className="bg-slate-800 text-slate-200 p-4 rounded-xl font-mono text-xs break-all overflow-auto max-h-[500px]">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold text-amber-400">AI 原始 JSON 输出</span>
                                                <button onClick={() => handleCopy(rawAiOutput, 'raw-json')} className="text-xs text-slate-400 hover:text-amber-400 transition-colors">
                                                    {copiedItem === 'raw-json' ? '✓ 已复制' : '复制'}
                                                </button>
                                            </div>
                                            <pre className="whitespace-pre-wrap">{rawAiOutput}</pre>
                                        </div>
                                    )}
                                    
                                    {/* 非JSON标签下显示每个公式的框 */}
                                    {activeFormulaTab !== 'json' && (
                                        <>
                                            {/* 显示公式数量 */}
                                            <div className="text-center text-xs text-slate-500 bg-slate-100 py-2 rounded-lg">
                                                共识别到 {formulaResult.count} 个公式
                                            </div>
                                            
                                            {/* 遍历显示所有公式 */}
                                            {formulaResult.data.map((formulaData, index) => (
                                                <div key={index} className="flex flex-col gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold text-[var(--primary-color)]">公式 #{index + 1}</span>
                                                        <button onClick={() => handleCopy(formulaData[activeFormulaTab], `formula-${index}-${activeFormulaTab}`)} className="text-xs text-slate-400 hover:text-[var(--primary-color)] transition-colors">
                                                            {copiedItem === `formula-${index}-${activeFormulaTab}` ? '✓ 已复制' : '复制'}
                                                        </button>
                                                    </div>
                                                    
                                                    {/* 显示原始代码 */}
                                                    <div className="bg-slate-800 text-slate-200 p-3 rounded-lg font-mono text-xs break-all">
                                                        {formulaData[activeFormulaTab]}
                                                    </div>
                                                    
                                                    {/* 显示渲染结果 */}
                                                    {activeFormulaTab !== 'raw' && (
                                                        <div className={` overflow-x-auto p-4 bg-slate-50 rounded-lg ${activeFormulaTab === 'block' ? 'py-6' : ''}`}>
                                                            <ReactMarkdown
                                                                remarkPlugins={[remarkMath]}
                                                                rehypePlugins={[rehypeKatex]}
                                                                className="w-full"
                                                            >
                                                                {formulaData[activeFormulaTab]}
                                                            </ReactMarkdown>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                    </>
                                )}
                                
                                {/* 底部批量操作 */}
                                {activeFormulaTab !== 'json' && formulaResult.count > 1 && (
                                    <div className="flex justify-center gap-2 mt-2">
                                        <button
                                            onClick={() => {
                                                const allFormulas = formulaResult.data.map((f, i) => `公式 ${i + 1}:\n${f[activeFormulaTab]}`).join('\n\n');
                                                handleCopy(allFormulas, 'all-formulas');
                                            }}
                                            className="px-4 py-2 bg-[var(--primary-color)] text-white text-xs font-bold rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
                                        >
                                            复制全部公式
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                            {mode === 'table' && tableResult && (
                                activeTableTab === 'preview' ? <div className="prose prose-sm max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{tableResult.markdown}</ReactMarkdown></div> : activeTableTab === 'raw' ? <pre className="text-xs font-mono bg-slate-800 text-slate-200 p-3 rounded-lg overflow-auto max-h-full">{rawAiOutput}</pre> : <pre className="text-xs font-mono">{tableResult.markdown}</pre>
                            )}
                            {mode === 'handwriting' && handwritingResult && (
                                activeHandwritingTab === 'preview' ? <div className="prose prose-sm max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]}>{handwritingResult.markdown}</ReactMarkdown></div> : activeHandwritingTab === 'raw' ? <pre className="text-xs font-mono bg-slate-800 text-slate-200 p-3 rounded-lg overflow-auto max-h-full">{rawAiOutput}</pre> : <pre className="text-xs font-mono">{handwritingResult.markdown}</pre>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300">
                        <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <p>上传图片以开始识别</p>
                    </div>
                )}
              </>
          )}

          {/* Footer Actions */}
          {(formulaResult || tableResult || handwritingResult || pdfResult) && (
             <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end space-x-3">
                <button 
                    onClick={() => {
                        let txt = '';
                        if (mode === 'formula' && formulaResult) txt = formulaResult[activeFormulaTab];
                        if (mode === 'table' && tableResult) txt = tableResult.markdown;
                        if (mode === 'handwriting' && handwritingResult) txt = handwritingResult.markdown;
                        if (mode === 'pdf' && pdfResult) txt = pdfResult.markdown;
                        handleCopy(txt);
                    }}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${copiedItem === `copy-content-${mode}` ? 'bg-green-50 text-green-600 border-green-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                >
                    {copiedItem === `copy-content-${mode}` ? '已复制' : '复制内容'}
                </button>
                <button 
                    onClick={insertContent} 
                    className="bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg transition-colors flex items-center"
                >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    插入编辑器
                </button>
             </div>
         )}
       </div>
     </div>

     {/* Prompt Settings Modal */}
     {showPromptSettings && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
                 <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                     <h3 className="font-bold text-slate-800 text-lg flex items-center">
                         <svg className="w-5 h-5 mr-2 text-[var(--primary-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                         配置 {mode === 'formula' ? '公式识别' : mode === 'table' ? '表格识别' : '手写体识别'} Prompt
                     </h3>
                     <button onClick={() => setShowPromptSettings(false)} className="text-slate-400 hover:text-slate-600">
                         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                     </button>
                 </div>
                 <div className="p-6">
                     <p className="text-xs text-slate-500 mb-4">自定义 AI 识别指令，调整识别效果。支持标准的提示词格式。</p>
                     <textarea
                         className="w-full h-64 p-4 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[var(--primary-color)] outline-none resize-none font-mono bg-slate-50 text-slate-700 leading-relaxed shadow-inner"
                         value={tempPrompt}
                         onChange={(e) => setTempPrompt(e.target.value)}
                         placeholder="输入自定义 Prompt..."
                     ></textarea>
                 
                     <div className="mt-6 flex justify-end space-x-3">
                         <button
                             onClick={() => setShowPromptSettings(false)}
                             className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                         >
                             取消
                         </button>
                         <button
                             onClick={savePromptSettings}
                             className="px-6 py-2.5 text-sm font-bold text-white bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] rounded-xl shadow-lg"
                         >
                             保存配置
                         </button>
                     </div>
                 </div>
             </div>
         </div>
     )}
   </div>
 );
};

export default FormulaOCR;
