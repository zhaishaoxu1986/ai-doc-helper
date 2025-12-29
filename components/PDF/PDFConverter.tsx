
import React, { useState, useRef, useEffect } from 'react';
import { getModelConfig } from '../../utils/settings';
import { generateContent } from '../../utils/aiHelper';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun } from 'docx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { downloadDocx } from '../../utils/converter';
import { WordTemplate } from '../../types';

interface PDFConverterProps {
  onResult?: (markdown: string) => void;
}

interface ConversionResult {
  markdown: string;
  wordBlob: Blob | null;
  pdfDataUrl: string;
  extractedImages: ExtractedImage[];
}

interface ExtractedImage {
  data: string;
  width: number;
  height: number;
  pageNumber: number;
}

const PDFConverter: React.FC<PDFConverterProps> = ({ onResult }) => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [result, setResult] = useState<ConversionResult | null>(() => {
    const saved = sessionStorage.getItem('pdfConversionResult');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState<'markdown' | 'word'>('markdown');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedPdfUrl = sessionStorage.getItem('pdfDataUrl');
    if (savedPdfUrl && !pdfDataUrl) {
      setPdfDataUrl(savedPdfUrl);
    }
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setPdfDataUrl(dataUrl);
        sessionStorage.setItem('pdfDataUrl', dataUrl);
      };
      reader.readAsDataURL(file);
      setResult(null);
      sessionStorage.removeItem('pdfConversionResult');
    } else {
      alert('请选择有效的 PDF 文件');
    }
    if (e.target) e.target.value = '';
  };

  const convertPdfToImages = async (file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);
          const pdfjsLib = (window as any).pdfjsLib;
          
          if (!pdfjsLib) {
            reject(new Error('PDF.js library not loaded'));
            return;
          }

          const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
          const images: string[] = [];

          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
              canvasContext: context!,
              viewport: viewport
            }).promise;

            const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            const base64Data = imageDataUrl.split(',')[1];
            images.push(base64Data);
          }

          resolve(images);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
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
          
          if (!pdfjsLib) {
            reject(new Error('PDF.js library not loaded'));
            return;
          }

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
                if (fn === pdfjsLib.OPS.paintImageXObject || 
                    fn === pdfjsLib.OPS.paintInlineImageXObject ||
                    fn === pdfjsLib.OPS.paintJpegXObject) {
                  
                  const imageName = ops.argsArray[i][0];
                  
                  const imagePromise = new Promise<void>((resolveImg) => {
                    page.objs.get(imageName, async (image: any) => {
                      try {
                        if (!image || !image.width || !image.height) {
                          resolveImg();
                          return;
                        }

                        const canvas = document.createElement('canvas');
                        canvas.width = image.width;
                        canvas.height = image.height;
                        const ctx = canvas.getContext('2d', { willReadFrequently: true });
                        
                        if (!ctx) {
                          resolveImg();
                          return;
                        }

                        if (image.bitmap) {
                          ctx.drawImage(image.bitmap, 0, 0);
                        } else if (image.data) {
                          const imgData = ctx.createImageData(image.width, image.height);
                          const data = new Uint8ClampedArray(image.data.buffer || image.data);
                          
                          if (data.length === imgData.data.length) {
                            imgData.data.set(data);
                          } else if (data.length === image.width * image.height * 3) {
                            for (let j = 0, k = 0; j < data.length; j += 3, k += 4) {
                              imgData.data[k] = data[j];
                              imgData.data[k + 1] = data[j + 1];
                              imgData.data[k + 2] = data[j + 2];
                              imgData.data[k + 3] = 255;
                            }
                          } else if (data.length === image.width * image.height) {
                            for (let j = 0, k = 0; j < data.length; j++, k += 4) {
                              imgData.data[k] = data[j];
                              imgData.data[k + 1] = data[j];
                              imgData.data[k + 2] = data[j];
                              imgData.data[k + 3] = 255;
                            }
                          }
                          
                          ctx.putImageData(imgData, 0, 0);
                        }
                        
                        const base64Data = canvas.toDataURL('image/png', 0.95).split(',')[1];
                        
                        if (base64Data && base64Data.length > 200) {
                          pageImages.push({
                            data: base64Data,
                            width: image.width,
                            height: image.height,
                            pageNumber: pageNum
                          });
                          console.log(`✓ Extracted native image from page ${pageNum}: ${image.width}x${image.height}px`);
                        }
                      } catch (err) {
                        console.warn(`Failed to process image on page ${pageNum}:`, err);
                      }
                      resolveImg();
                    });
                  });
                  
                  imagePromises.push(imagePromise);
                }
              }
              
              await Promise.all(imagePromises);
              
            } catch (opsErr) {
              console.warn(`Failed to get operator list for page ${pageNum}:`, opsErr);
            }
            
            if (pageImages.length > 0) {
              pageImagesMap.set(pageNum, pageImages);
              console.log(`Page ${pageNum}: extracted ${pageImages.length} native image(s)`);
            }
          }

          const totalImages = Array.from(pageImagesMap.values()).reduce((sum, imgs) => sum + imgs.length, 0);
          console.log(`Total native images extracted: ${totalImages}`);
          resolve(pageImagesMap);
        } catch (error) {
          console.error('PDF image extraction error:', error);
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const detectImagesInPages = async (pageImages: string[]): Promise<number[]> => {
    const config = getModelConfig('ocr');
    const imageCounts: number[] = [];
    
    for (let i = 0; i < pageImages.length; i++) {
      try {
        const prompt = `Analyze this PDF page. Count ONLY the distinct images, figures, charts, diagrams, or photos that are embedded in the document content (exclude logos, headers, footers, page decorations).

Respond with ONLY a single number (0, 1, 2, 3, etc.). Examples:
- If the page has only text: 0
- If the page has one chart: 1
- If the page has two photos: 2

Your response:`;
        
        const response = await generateContent({
          apiKey: config.apiKey,
          model: config.model,
          baseUrl: config.baseUrl,
          image: pageImages[i],
          mimeType: 'image/jpeg',
          prompt: prompt
        });
        
        const match = response.match(/\d+/);
        const count = match ? parseInt(match[0]) : 0;
        imageCounts.push(count);
        console.log(`Page ${i + 1}: detected ${count} image(s)`);
      } catch (err) {
        console.warn(`Failed to detect images on page ${i + 1}:`, err);
        imageCounts.push(0);
      }
    }
    
    return imageCounts;
  };

  const markdownToDocx = async (markdown: string, images: ExtractedImage[]): Promise<Blob> => {
    const lines = markdown.split('\n');
    const children: any[] = [];
    let imageIndex = 0;

    for (const line of lines) {
      if (line.match(/!\[图片\d+\]/)) {
        if (imageIndex < images.length) {
          const img = images[imageIndex];
          const buffer = Uint8Array.from(atob(img.data), c => c.charCodeAt(0));
          
          const maxWidth = 600;
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          children.push(new Paragraph({
            children: [
              new ImageRun({
                data: buffer,
                transformation: {
                  width: width,
                  height: height
                }
              } as any)
            ],
            spacing: { before: 200, after: 200 }
          }));
          imageIndex++;
        }
      } else if (line.startsWith('# ')) {
        children.push(new Paragraph({
          text: line.substring(2),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 }
        }));
      } else if (line.startsWith('## ')) {
        children.push(new Paragraph({
          text: line.substring(3),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        }));
      } else if (line.startsWith('### ')) {
        children.push(new Paragraph({
          text: line.substring(4),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160, after: 80 }
        }));
      } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        children.push(new Paragraph({
          text: line.trim().substring(2),
          bullet: { level: 0 },
          spacing: { before: 60, after: 60 }
        }));
      } else if (line.trim()) {
        children.push(new Paragraph({
          children: [new TextRun(line)],
          spacing: { before: 100, after: 100 }
        }));
      } else {
        children.push(new Paragraph({ text: '' }));
      }
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children: children
      }]
    });

    return await Packer.toBlob(doc);
  };

  const convertPdf = async () => {
    if (!pdfFile) return;

    const config = getModelConfig('ocr');
    if (!config.apiKey) {
      alert('请先在右上角用户中心配置 API Key');
      return;
    }

    setIsConverting(true);
    setResult(null);

    try {
      const images = await convertPdfToImages(pdfFile);
      console.log(`Converted PDF to ${images.length} page images`);
      
      const pageImagesMap = await extractImagesFromPdf(pdfFile);
      const totalExtractedImages = Array.from(pageImagesMap.values()).reduce((sum, imgs) => sum + imgs.length, 0);
      console.log(`Extracted ${totalExtractedImages} native images from PDF`);
      
      const imageCounts = await detectImagesInPages(images);
      console.log(`AI detected image counts per page:`, imageCounts);
      
      let fullMarkdown = '';
      let imageCounter = 0;
      const pageMarkdowns: string[] = [];
      
      for (let i = 0; i < images.length; i++) {
        const pageNum = i + 1;
        const nativeImages = pageImagesMap.get(pageNum) || [];
        const pageImageCount = Math.max(imageCounts[i], nativeImages.length);
        
        let imagePromptPart = '';
        if (pageImageCount > 0) {
          imagePromptPart = `\n\nIMPORTANT: This page contains ${pageImageCount} image(s). When you encounter an image/figure/chart, insert ONLY the placeholder ![图片X] at that position. DO NOT describe the image content. DO NOT write any text about the image. Just insert the placeholder and continue with other text.`;
        }
        
        const prompt = `Analyze this PDF page image and convert it to Markdown format.
        
Instructions:
- Extract all text content accurately
- Preserve document structure (headings, paragraphs, lists)
- Convert tables to Markdown table format
- Preserve formatting like bold, italic, code blocks
- If there are mathematical formulas, use LaTeX notation with $ or $$
- DO NOT describe images. Just insert the placeholder ![图片X] where the image appears
- Output clean Markdown only, no explanations${imagePromptPart}

Page ${pageNum} of ${images.length}:`;

        const pageMarkdown = await generateContent({
          apiKey: config.apiKey,
          model: config.model,
          baseUrl: config.baseUrl,
          image: images[i],
          mimeType: 'image/jpeg',
          prompt: prompt
        });

        let processedMarkdown = pageMarkdown.trim();
        
        processedMarkdown = processedMarkdown.replace(/!\[图片\d+\]/g, (match) => {
          const placeholder = `![图片${imageCounter + 1}]`;
          imageCounter++;
          return placeholder;
        });
        
        const actualPlaceholders = (processedMarkdown.match(/!\[图片\d+\]/g) || []).length;
        
        if (pageImageCount > 0 && actualPlaceholders === 0) {
          processedMarkdown += '\n\n';
          for (let j = 0; j < pageImageCount; j++) {
            processedMarkdown += `![图片${imageCounter + 1}]\n\n`;
            imageCounter++;
          }
          console.log(`Added ${pageImageCount} image placeholder(s) to page ${pageNum}`);
        } else if (actualPlaceholders > 0) {
          console.log(`Page ${pageNum}: normalized ${actualPlaceholders} image placeholder(s)`);
        }
        
        const imageDescPatterns = [
          /(?:图片?|图像|插图|Figure|Image|图表|Fig\.)\s*\d*[:：]?[^\n]*(?=!\[图片\d+\])/gi,
          /(?:如图|见图|参见图|下图|上图|图中)[^\n]*(?=!\[图片\d+\])/gi,
          /!\[图片\d+\][^\n]*描述[^\n]*/gi,
          /(?:这是|这张|该|以下是|下面是)[^\n]*(?:图片|图像|插图|图表|示意图)[^\n]*(?=!\[图片\d+\])/gi,
          /[^\n]*(?:显示|展示|说明|描述)[^\n]*(?=!\[图片\d+\])/gi,
          /.*?(?:is|shows|displays|illustrates).*?(?=!\[图片\d+\])/gi,
          /(?:^|\n)([^\n]*(?:图|figure|image|chart)[^\n]*?)(?=\n*!\[图片\d+\])/gim
        ];
        
        for (const pattern of imageDescPatterns) {
          processedMarkdown = processedMarkdown.replace(pattern, '');
        }
        
        processedMarkdown = processedMarkdown.replace(/([^\n]+)\s*!\[图片\d+\]/g, (match, textBefore) => {
          if (textBefore && textBefore.length < 100 && /图|image|figure|chart|显示|展示|说明|描述|如下|below|above/i.test(textBefore)) {
            return match.replace(textBefore, '');
          }
          return match;
        });
        
        processedMarkdown = processedMarkdown.replace(/\n{3,}/g, '\n\n');

        pageMarkdowns.push(processedMarkdown);
        fullMarkdown += processedMarkdown + '\n\n';
      }
      
      console.log(`Generated markdown with ${imageCounter} total image placeholders`);
      
      const extractedImages: ExtractedImage[] = [];
      
      for (let pageIdx = 0; pageIdx < images.length; pageIdx++) {
        const pageNum = pageIdx + 1;
        const nativeImages = pageImagesMap.get(pageNum) || [];
        const pageMarkdown = pageMarkdowns[pageIdx];
        const imagePlaceholders = pageMarkdown.match(/!\[图片\d+\]/g) || [];
        
        for (let imgIdx = 0; imgIdx < imagePlaceholders.length; imgIdx++) {
          if (imgIdx < nativeImages.length && nativeImages[imgIdx].data) {
            extractedImages.push(nativeImages[imgIdx]);
            console.log(`✓ Using native image ${imgIdx + 1} from page ${pageNum}`);
          } else {
            console.error(`✗ No native image found for placeholder ${imgIdx + 1} on page ${pageNum}`);
            console.log(`Available native images on page ${pageNum}: ${nativeImages.length}`);
            console.log(`Required placeholders: ${imagePlaceholders.length}`);
          }
        }
      }
      
      console.log(`Final extracted images count: ${extractedImages.length} (native images only)`);

      const wordBlob = await markdownToDocx(fullMarkdown, extractedImages);

      const conversionResult = {
        markdown: fullMarkdown,
        wordBlob: wordBlob,
        pdfDataUrl: pdfDataUrl!,
        extractedImages: extractedImages
      };
      
      setResult(conversionResult);
      sessionStorage.setItem('pdfConversionResult', JSON.stringify({
        markdown: fullMarkdown,
        wordBlob: null,
        pdfDataUrl: pdfDataUrl!,
        extractedImages: extractedImages
      }));

      setActiveTab('markdown');

    } catch (err: any) {
      console.error('PDF Conversion Error:', err);
      alert('PDF 转换失败：' + (err.message || '未知错误'));
    } finally {
      setIsConverting(false);
    }
  };

  const downloadWord = async () => {
    if (!result?.markdown) return;
    await downloadDocx(result.markdown, WordTemplate.STANDARD);
  };

  const copyMarkdown = () => {
    if (!result?.markdown) return;
    navigator.clipboard.writeText(result.markdown).then(() => {
      alert('Markdown 已复制到剪贴板');
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="text-center py-4 px-6 border-b border-slate-200 bg-white">
        <h2 className="text-2xl font-extrabold text-slate-900 mb-1 tracking-tight">PDF 智能转换 (PDF Converter)</h2>
        <p className="text-slate-500 text-xs">使用 AI 将 PDF 文档转换为 Markdown 和 Word 格式</p>
      </div>

      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Left Column: PDF Preview */}
        <div className="w-1/2 flex flex-col space-y-4">
          {!pdfDataUrl ? (
            <div className="flex-1 bg-white border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group hover:border-blue-500 hover:bg-blue-50 transition-all duration-300 shadow-sm">
              <div className="text-center cursor-pointer p-10 w-full h-full flex flex-col items-center justify-center" onClick={() => fileInputRef.current?.click()}>
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-blue-600 group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h4 className="text-slate-800 font-bold text-xl mb-2">点击上传 PDF 文件</h4>
                <p className="text-slate-400 text-sm">支持 PDF 格式文档</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept="application/pdf" 
                />
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-slate-50">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{pdfFile?.name || 'PDF 预览'}</h4>
                      <p className="text-xs text-slate-500">{pdfFile ? (pdfFile.size / 1024 / 1024).toFixed(2) + ' MB' : ''}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setPdfFile(null); setPdfDataUrl(null); setResult(null); sessionStorage.clear(); }} 
                    className="text-red-500 hover:text-red-700 p-1"
                    title="移除文件"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-auto">
                  <iframe 
                    src={pdfDataUrl} 
                    className="w-full h-full border-0"
                    title="PDF Preview"
                  />
                </div>
              </div>
              <button 
                onClick={convertPdf}
                disabled={isConverting || !!result}
                className={`py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center ${
                  isConverting || result
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
                }`}
              >
                {isConverting ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    正在 AI 转换中...
                  </span>
                ) : result ? '已转换完成' : '开始转换 (Convert)'}
              </button>
            </>
          )}
        </div>

        {/* Right Column: Results */}
        <div className="w-1/2 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
          {result ? (
            <>
              <div className="flex bg-slate-100 p-1 m-3 rounded-xl">
                <button 
                  onClick={() => setActiveTab('markdown')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'markdown' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  📝 Markdown
                </button>
                <button 
                  onClick={() => setActiveTab('word')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'word' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  📘 Word 预览
                </button>
              </div>

              <div className="flex-1 overflow-auto bg-slate-50 mx-3 mb-3 rounded-xl border border-slate-200">
                {activeTab === 'markdown' && (
                  <div className="p-4">
                    <div className="mb-2 text-xs text-slate-500 bg-slate-100 p-2 rounded">
                      提取到 {result.extractedImages.length} 张图片
                    </div>
                    <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap">
                      {result.markdown}
                    </pre>
                  </div>
                )}

                {activeTab === 'word' && (
                  <div className="p-4">
                    <div className="mb-2 text-xs text-slate-500 bg-slate-100 p-2 rounded">
                      Word 预览 - 包含 {result.extractedImages.length} 张图片
                    </div>
                    <div className="prose prose-sm prose-slate max-w-none">
                      <div className="bg-white p-6 shadow-sm rounded-lg">
                        {(() => {
                          let imageIndex = 0;
                          const lines = result.markdown.split('\n');
                          const elements: React.ReactElement[] = [];
                          let textBuffer: string[] = [];
                          
                          const flushTextBuffer = (key: number) => {
                            if (textBuffer.length > 0) {
                              const text = textBuffer.join('\n');
                              elements.push(
                                <div key={`text-${key}`}>
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm, remarkMath]}
                                    rehypePlugins={[rehypeKatex]}
                                    components={{
                                      h1: ({node, ...props}) => <h1 className="text-3xl font-bold mb-4 mt-6" {...props} />,
                                      h2: ({node, ...props}) => <h2 className="text-2xl font-bold mb-3 mt-5" {...props} />,
                                      h3: ({node, ...props}) => <h3 className="text-xl font-bold mb-2 mt-4" {...props} />,
                                      p: ({node, ...props}) => <p className="mb-2 leading-relaxed" {...props} />,
                                      code: ({node, inline, ...props}: any) => {
                                        if (inline) {
                                          return <code className="bg-slate-100 px-1.5 py-0.5 rounded text-pink-700 font-mono text-sm" {...props} />;
                                        }
                                        return <code className="block bg-slate-100 p-3 rounded font-mono text-sm overflow-x-auto" {...props} />;
                                      }
                                    } as any}
                                  >
                                    {text}
                                  </ReactMarkdown>
                                </div>
                              );
                              textBuffer = [];
                            }
                          };
                          
                          lines.forEach((line, idx) => {
                            const imageMatch = line.match(/!\[图片(\d+)\]/);
                            if (imageMatch) {
                              flushTextBuffer(idx);
                              if (imageIndex < result.extractedImages.length) {
                                const img = result.extractedImages[imageIndex];
                                const imgNum = imageIndex + 1;
                                imageIndex++;
                                elements.push(
                                  <div key={`img-${idx}`} className="my-4 flex flex-col items-center">
                                    <img 
                                      src={`data:image/png;base64,${img.data}`} 
                                      alt={`图片${imgNum}`}
                                      className="max-w-full h-auto rounded shadow-md border border-slate-200"
                                      style={{ maxWidth: '600px' }}
                                    />
                                    <span className="text-xs text-slate-400 mt-2">图片{imgNum}</span>
                                  </div>
                                );
                              }
                            } else {
                              textBuffer.push(line);
                            }
                          });
                          
                          flushTextBuffer(lines.length);
                          return elements;
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 px-3 pb-3 pt-2 border-t border-slate-100">
                {activeTab === 'markdown' && (
                  <button 
                    onClick={copyMarkdown}
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all"
                  >
                    复制 Markdown
                  </button>
                )}
                {activeTab === 'word' && (
                  <button 
                    onClick={downloadWord}
                    className="px-6 py-2 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-700 transition-all shadow-lg flex items-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    下载 Word 文件
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
              <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>上传 PDF 文件开始转换</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFConverter;
