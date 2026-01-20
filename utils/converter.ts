import { 
  Document, Packer, Paragraph, TextRun, HeadingLevel, 
  AlignmentType, Table, TableRow, TableCell, WidthType, 
  BorderStyle, ShadingType, VerticalAlign,
  Math as DocxMath, MathRun, ImageRun
} from 'docx';
import { WordTemplate, DocumentStyle } from '../types';
import { UI_STRINGS } from './i18n-resources/uiStrings';
import { getInitialLocale } from './i18n';

const getUiString = (key: string, vars?: Record<string, string | number>): string => {
  const locale = getInitialLocale();
  const template = UI_STRINGS[locale]?.[key] || UI_STRINGS.zh[key] || key;
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => String(vars[name] ?? ''));
};

/**
 * 简单的 HTML 转 Markdown 工具 (浏览器端实现，无需 Pandoc)
 */
export function htmlToMarkdown(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  let md = '';

  // 递归处理节点
  function processNode(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      md += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      switch (el.tagName.toLowerCase()) {
        case 'h1': md += '\n# '; break;
        case 'h2': md += '\n## '; break;
        case 'h3': md += '\n### '; break;
        case 'p': md += '\n\n'; break;
        case 'strong': 
        case 'b': md += '**'; break;
        case 'em': 
        case 'i': md += '*'; break;
        case 'li': md += '\n- '; break;
        case 'br': md += '\n'; break;
        case 'code': md += '`'; break;
        case 'pre': md += '\n```\n'; break;
      }

      el.childNodes.forEach(child => processNode(child));

      switch (el.tagName.toLowerCase()) {
        case 'h1': case 'h2': case 'h3': md += '\n'; break;
        case 'p': md += '\n'; break;
        case 'strong': case 'b': md += '**'; break;
        case 'em': case 'i': md += '*'; break;
        case 'code': md += '`'; break;
        case 'pre': md += '\n```\n'; break;
      }
    }
  }

  processNode(doc.body);
  // 简单的清理
  return md.replace(/\n\n\n+/g, '\n\n').trim();
}

/**
 * 将文本解析为带有样式的 TextRun 数组
 */
function parseInlineStyles(text: string, font: string, fontSize: number, color: string): (TextRun | DocxMath)[] {
  const runs: (TextRun | DocxMath)[] = [];
  // 匹配：加粗 (**), 斜体 (*), 行内代码 (`), 公式 ($)
  // 注意：需要避免匹配到图片标记 ![...](...)
  // 简单的处理：先不处理图片内的文本。  
  const regex = /(\*\*\*?|__?|`|\$)(.*?)\1/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // 添加匹配前的纯文本
        if (match.index > lastIndex) {
          runs.push(new TextRun({ text: text.substring(lastIndex, match.index), font, size: fontSize * 2, color }));
        }

        const marker = match[1];
        const content = match[2];

        if (marker === '***') {
          runs.push(new TextRun({ text: content, font, size: fontSize * 2, bold: true, italics: true, color }));
        } else if (marker === '**' || marker === '__') {
          runs.push(new TextRun({ text: content, font, size: fontSize * 2, bold: true, color }));
        } else if (marker === '*' || marker === '_') {
          runs.push(new TextRun({ text: content, font, size: fontSize * 2, italics: true, color }));
        } else if (marker === '`') {
          runs.push(new TextRun({ 
            text: content, 
            font: "JetBrains Mono", 
            size: (fontSize - 1) * 2, 
            shading: { type: ShadingType.SOLID, color: "F1F5F9" },
            color: "E11D48" 
          }));
        } else if (marker === '$') {
          // 使用 DocxMath 和 MathRun 包裹行内公式 (Docx 原生支持)
          runs.push(new DocxMath({
            children: [new MathRun(content)]
          }));
        }

    lastIndex = regex.lastIndex;
  }

  // 添加剩余文本
  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.substring(lastIndex), font, size: fontSize * 2, color }));
  }

  return runs;
}

const DEFAULT_STYLES: Record<string, DocumentStyle> = {
  [WordTemplate.STANDARD]: {
    fontFace: "SimSun",
    fontSize: 12,
    lineSpacing: 1.5,
    textColor: "000000",
    alignment: "justify",
    paragraphSpacing: {
      before: 0,
      after: 6
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
  },
  [WordTemplate.ACADEMIC]: {
    fontFace: "Times New Roman",
    fontSize: 10.5,
    lineSpacing: 1.5,
    textColor: "000000",
    alignment: "justify",
    paragraphSpacing: {
      before: 0,
      after: 100
    },
    firstLineIndent: 0,
    heading1: {
      fontSize: 18,
      fontFace: "Times New Roman",
      color: "000000",
      alignment: "center",
      lineSpacing: 1.5,
      spacing: {
        before: 350,
        after: 250
      }
    },
    heading2: {
      fontSize: 16,
      fontFace: "Times New Roman",
      color: "000000",
      alignment: "left",
      lineSpacing: 1.5,
      spacing: {
        before: 300,
        after: 200
      }
    },
    heading3: {
      fontSize: 14,
      fontFace: "Times New Roman",
      color: "000000",
      alignment: "left",
      lineSpacing: 1.5,
      spacing: {
        before: 250,
        after: 150
      }
    },
    table: {
      isThreeLineTable: true
    }
  },
  [WordTemplate.NOTE]: {
    fontFace: "Microsoft YaHei",
    fontSize: 11,
    lineSpacing: 1.5,
    textColor: "374151",
    alignment: "left",
    paragraphSpacing: {
      before: 0,
      after: 300
    },
    firstLineIndent: 0,
    heading1: {
      fontSize: 20,
      fontFace: "Microsoft YaHei",
      color: "2563EB",
      alignment: "center",
      lineSpacing: 1.5,
      spacing: {
        before: 400,
        after: 300
      }
    },
    heading2: {
      fontSize: 18,
      fontFace: "Microsoft YaHei",
      color: "2563EB",
      alignment: "left",
      lineSpacing: 1.5,
      spacing: {
        before: 350,
        after: 250
      }
    },
    heading3: {
      fontSize: 16,
      fontFace: "Microsoft YaHei",
      color: "2563EB",
      alignment: "left",
      lineSpacing: 1.5,
      spacing: {
        before: 300,
        after: 200
      }
    },
    table: {
      isThreeLineTable: false
    }
  }
};

const ALIGN_MARKER_TRAILING_RE = /\s*\{\:align=(left|center|right|justify)\}\s*$/;
const ALIGN_MARKER_LEADING_RE = /^\s*\{\:align=(left|center|right|justify)\}\s*/;
const MARKDOWN_PREFIX_RE = /^(\s*(?:#{1,6}\s+|>+\s+|(?:[-+*]|\d+\.)\s+)?)(.*)$/;

const mapAlignment = (value: string): AlignmentType => {
  if (value === 'center') return AlignmentType.CENTER;
  if (value === 'right') return AlignmentType.RIGHT;
  if (value === 'justify') return AlignmentType.JUSTIFIED;
  return AlignmentType.LEFT;
};

const parseAlignmentMarker = (line: string): { line: string; alignment?: AlignmentType } => {
  const prefixMatch = line.match(MARKDOWN_PREFIX_RE);
  const prefix = prefixMatch ? prefixMatch[1] : '';
  let rest = prefixMatch ? prefixMatch[2] : line;
  let alignment: AlignmentType | undefined;

  const leadingMatch = rest.match(ALIGN_MARKER_LEADING_RE);
  if (leadingMatch) {
    alignment = mapAlignment(leadingMatch[1]);
    rest = rest.replace(ALIGN_MARKER_LEADING_RE, '');
  }

  const trailingMatch = rest.match(ALIGN_MARKER_TRAILING_RE);
  if (trailingMatch) {
    if (!alignment) alignment = mapAlignment(trailingMatch[1]);
    rest = rest.replace(ALIGN_MARKER_TRAILING_RE, '').trimEnd();
  }

  return { line: `${prefix}${rest}`, alignment };
};

/**
 * Helper to fetch image data as ArrayBuffer and detect its natural dimensions
 */
async function fetchImageBuffer(url: string): Promise<{ data: ArrayBuffer, width: number, height: number } | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();
        
        // Detect dimensions using HTML Image object
        const dimensions = await new Promise<{ width: number, height: number }>((resolve) => {
            const img = new Image();
            img.onload = () => {
                const dims = { width: (img as any).naturalWidth, height: (img as any).naturalHeight };
                URL.revokeObjectURL(img.src);
                resolve(dims);
            };
            img.onerror = () => {
                 URL.revokeObjectURL(img.src);
                 resolve({ width: 600, height: 400 }); // Fallback defaults
            };
            img.src = URL.createObjectURL(blob);
        });
        
        return { data: buffer, width: dimensions.width, height: dimensions.height }; 
    } catch (e) {
        console.warn("Failed to fetch image for docx:", url);
        return null;
    }
}

export async function downloadDocx(markdown: string, template: WordTemplate, customStyle?: DocumentStyle) {
  try {
    const lines = markdown.split('\n');
    const sections: any[] = [];
  // 决定使用哪种样式配置
  const style = (template === WordTemplate.CUSTOM && customStyle) ? customStyle : (DEFAULT_STYLES[template] || DEFAULT_STYLES[WordTemplate.STANDARD]);  
  // mapping alignment string to enum
  // Fix TS2322: use 'any' to avoid strict enum type checking issues in build
  let align: any = AlignmentType.LEFT;
  if (style.alignment === 'center') align = AlignmentType.CENTER;
  if (style.alignment === 'justify') align = AlignmentType.JUSTIFIED;
  if (style.alignment === 'right') align = AlignmentType.RIGHT;

  // 表格计数，用于生成表号
  let tableCount = 0;

  let i = 0;
  while (i < lines.length) {
    let line = lines[i].trim();
    const { line: cleanedLine, alignment: lineAlignment } = parseAlignmentMarker(line);
    line = cleanedLine;
    if (line === '') {
      i++;
      continue;
    }

    // 1. 处理标题
    if (line.startsWith('#')) {
      const level = line.match(/^#+/)?.[0].length || 1;
      const content = line.replace(/^#+\s*/, '');
      
      // 使用自定义的标题样式配置
      const headingMap = {
        1: style.heading1,
        2: style.heading2,
        3: style.heading3
      };
      
      const headingConfig = headingMap[level as keyof typeof headingMap] || headingMap[3];
      
      const alignment = lineAlignment ?? (headingConfig.alignment === 'center' ? AlignmentType.CENTER : 
                       headingConfig.alignment === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT);
      
      const headingParagraph = new Paragraph({
        children: parseInlineStyles(content, headingConfig.fontFace, headingConfig.fontSize, headingConfig.color) as any,
        spacing: { 
          before: headingConfig.spacing.before * 20, // 转换为twips (1磅 = 20 twips)
          after: headingConfig.spacing.after * 20,  // 转换为twips (1磅 = 20 twips)
          line: headingConfig.lineSpacing * 240
        },
        alignment: alignment
      });
      
      sections.push(headingParagraph);
      i++;
    } 
    // 2. 处理图片 ![alt](url)
    else if (line.match(/^!\[(.*?)\]\((.*?)\)/)) {
        const match = line.match(/^!\[(.*?)\]\((.*?)\)/);
        if (match) {
            const alt = match[1];
            const url = match[2];
            
            // Try to fetch image
            const imgData = await fetchImageBuffer(url);
            
            if (imgData) {
                // Smart Scaling: Preserve aspect ratio, but fit within page margins
                // A4 content width is roughly 600px (depends on margins)
                const MAX_WIDTH = 600; 
                let finalWidth = imgData.width;
                let finalHeight = imgData.height;

                if (finalWidth > MAX_WIDTH) {
                    const ratio = MAX_WIDTH / finalWidth;
                    finalWidth = MAX_WIDTH;
                    finalHeight = Math.round(finalHeight * ratio);
                }

                sections.push(new Paragraph({
                    children: [
                        new ImageRun({
                            data: imgData.data,
                            transformation: {
                                width: finalWidth,
                                height: finalHeight,
                            },
                            altText: {
                                title: alt,
                                description: alt,
                                name: alt,
                            }
                        } as any),
                        new TextRun({
                             text: `\n${getUiString('converter.figureCaption', { alt })}`,
                             font: style.fontFace,
                             size: (style.fontSize - 2) * 2,
                             color: "666666",
                             italics: true
                        })
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { 
                        before: 300, // 15px
                        after: 300 // 15px
                    }
                }));
            } else {
                // Fallback text if image fails
                sections.push(new Paragraph({
                    children: [new TextRun({ text: `[Image: ${alt} - Download Failed]`, color: "FF0000" })],
                    alignment: AlignmentType.CENTER,
                    spacing: { 
                        before: 300, // 15px
                        after: 300 // 15px
                    }
                }));
            }
        }
        i++;
    }
    // 3. 处理代码块
    else if (line.startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // 跳过结束符号
      
      sections.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: codeLines.map(cl => new Paragraph({
                  children: [new TextRun({ text: cl, font: "JetBrains Mono", size: 20, color: "334155" })],                  spacing: { before: 20, after: 20 }
                })),
                shading: { fill: "F8FAFC", type: ShadingType.CLEAR },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                  left: { style: BorderStyle.SINGLE, size: 6, color: "3B82F6" },
                  right: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                },
                margins: { top: 200, bottom: 200, left: 200, right: 200 }
              })
            ]
          })
        ],
      }));
    }
    // 4. 处理表格（融合apply_format.py的三线表思想）
    else if (line.startsWith('|')) {
      tableCount++;
      const tableRows = [];
      
      // 读取表格行
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const rawRow = lines[i].trim();
        if (!rawRow.match(/^\|[:\s-]+\|/)) {
          const cells = rawRow.split('|').filter(c => c.trim() !== '' || rawRow.indexOf('|' + c + '|') !== -1).map(c => c.trim());
          if (cells.length > 0) {
            // 检查是否是表头行（第一个非分隔行）
            const isHeaderRow = tableRows.length === 0;
            
            tableRows.push(new TableRow({
              children: cells.map(cell => new TableCell({
                  children: [new Paragraph({
                  children: isHeaderRow 
                    ? [new TextRun({ 
                        text: cell, 
                        font: style.fontFace, 
                        size: (style.fontSize - 1) * 2, 
                        color: style.textColor, 
                        bold: true 
                      })]
                    : parseInlineStyles(cell, style.fontFace, style.fontSize - 1, style.textColor) as any,
                  alignment: isHeaderRow ? AlignmentType.CENTER : undefined
                })],
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 150, bottom: 150, left: 150, right: 150 }
              }))
            }));
          }
        }
        i++;
      }
      
      // 应用表格样式（根据用户选择的三线表或普通表格）
      if (style.table.isThreeLineTable && tableRows.length > 0) {
        // 三线表样式
        // 粗线（1.2pt = 24 dxa）和细线（0.6pt = 12 dxa）
        const thickBorder = 24;
        const thinBorder = 12;
        
        // 遍历所有单元格，设置三线表样式
        for (let rowIndex = 0; rowIndex < tableRows.length; rowIndex++) {
          const row = tableRows[rowIndex];
          const cells = Array.isArray(row.children) ? row.children : [];
          for (const cell of cells) {
            // 初始边框配置
            const borders: any = {
              top: { style: BorderStyle.NONE, size: 0, color: "000000" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "000000" },
              left: { style: BorderStyle.NONE, size: 0, color: "000000" },
              right: { style: BorderStyle.NONE, size: 0, color: "000000" }
            };
            
            // 第一行（表头）：上边框粗线，下边框细线
            if (rowIndex === 0) {
              borders.top = { style: BorderStyle.SINGLE, size: thickBorder, color: "000000" };
              borders.bottom = { style: BorderStyle.SINGLE, size: thinBorder, color: "000000" };
            }
            // 最后一行：下边框粗线
            else if (rowIndex === tableRows.length - 1) {
              borders.bottom = { style: BorderStyle.SINGLE, size: thickBorder, color: "000000" };
            }
            
            cell.borders = borders;
          }
        }
      } else {
        // 普通表格样式：所有单元格显示边框
        for (let rowIndex = 0; rowIndex < tableRows.length; rowIndex++) {
          const row = tableRows[rowIndex];
          const cells = Array.isArray(row.children) ? row.children : [];
          for (const cell of cells) {
            // 普通表格：显示所有边框
            cell.borders = {
              top: { style: BorderStyle.SINGLE, size: 1, color: "94A3B8" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "94A3B8" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "94A3B8" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "94A3B8" },
            };
          }
        }
      }
      
      // 创建表格
      const table = new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        alignment: AlignmentType.CENTER
      });
      
      // 添加表号和标题
      const tableCaption = new Paragraph({
        children: [new TextRun({ 
          text: `${getUiString('converter.tableLabel', { count: tableCount })} `,
          font: style.fontFace, 
          size: (style.fontSize - 1) * 2, 
          color: "000000",
          bold: true
        })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 100 }
      });
      
      sections.push(tableCaption);
      sections.push(table);
    }
    // 5. 处理块级公式
    else if (line.startsWith('$$')) {
      let formula = line.replace(/\$\$/g, '');
      if (formula === '') {
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('$$')) {
          formula += lines[i] + ' ';
          i++;
        }
      }
      // 使用 DocxMath 和 MathRun，让 Word 识别这是公式区域
      sections.push(new Paragraph({
        children: [
            new DocxMath({
                children: [new MathRun(formula.trim())]
            })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { 
          before: 350, // 17.5px
          after: 350, // 17.5px
          line: style.lineSpacing * 240
        }
      }));
      i++;
    }
    // 6. 处理引用
    else if (line.startsWith('>')) {
      sections.push(new Paragraph({
        children: parseInlineStyles(line.replace(/^>\s*/, ''), style.fontFace, style.fontSize, "555555") as any,
        indent: { left: 720 }, // 36px
        spacing: { 
          before: 150, // 7.5px
          after: 150, // 7.5px
          line: style.lineSpacing * 240
        },
        alignment: lineAlignment ?? align,
        shading: { fill: "F1F5F9", type: ShadingType.CLEAR }
      }));
      i++;
    }
    // 7. 普通段落
    else {
      if (line !== '') {
        const paragraphAlignment = lineAlignment ?? align;
        const allowIndent = paragraphAlignment === AlignmentType.LEFT || paragraphAlignment === AlignmentType.JUSTIFIED;
        const paragraphConfig = {
          children: parseInlineStyles(line, style.fontFace, style.fontSize, style.textColor) as any,
          alignment: paragraphAlignment,
          spacing: { 
              before: style.paragraphSpacing.before * 20, // 转换为twips (1磅 = 20 twips)
              after: style.paragraphSpacing.after * 20,  // 转换为twips (1磅 = 20 twips)
              line: style.lineSpacing * 240, // docx uses 240 for 1 line
              lineRule: "atLeast" as const
          },
          indent: {
            firstLine: allowIndent ? (style.firstLineIndent || 0) * 180 : 0 // 1字符 = 180 twips
          }
        };
        
        sections.push(new Paragraph(paragraphConfig));
      }
      i++;
    }
  }

  // 文档配置，融合apply_format.py的思想
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: "2.54cm", bottom: "2.54cm", left: "3.18cm", right: "3.18cm" }
        }
      },
      children: sections,
    }],
  });

    const blob = await Packer.toBlob(doc);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI_Doc_${template}_${new Date().getTime()}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error(getUiString('converter.error.wordDocFail', { message: error instanceof Error ? error.message : JSON.stringify(error) }));
    throw new Error(getUiString('converter.error.wordDocFail', { message: error instanceof Error ? error.message : JSON.stringify(error) }));
  }
}
