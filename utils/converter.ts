
import { 
  Document, Packer, Paragraph, TextRun, HeadingLevel, 
  AlignmentType, Table, TableRow, TableCell, WidthType, 
  BorderStyle, ShadingType, VerticalAlign,
  Math, MathRun
} from 'docx';
import { WordTemplate, DocumentStyle } from '../types';

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
function parseInlineStyles(text: string, font: string, fontSize: number, color: string): (TextRun | Math)[] {
  const runs: (TextRun | Math)[] = [];
  // 匹配：加粗 (**), 斜体 (*), 行内代码 (`), 公式 ($)
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
      // 使用 Math 和 MathRun 包裹行内公式
      runs.push(new Math({
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
    lineSpacing: 1.2,
    headingColor: "000000",
    textColor: "000000",
    alignment: "justify",
    paragraphSpacing: 200
  },
  [WordTemplate.ACADEMIC]: {
    fontFace: "Times New Roman",
    fontSize: 10.5,
    lineSpacing: 1.5,
    headingColor: "000000",
    textColor: "000000",
    alignment: "justify",
    paragraphSpacing: 100
  },
  [WordTemplate.NOTE]: {
    fontFace: "Microsoft YaHei",
    fontSize: 11,
    lineSpacing: 1.5,
    headingColor: "2563EB",
    textColor: "374151",
    alignment: "left",
    paragraphSpacing: 300
  }
};

export async function downloadDocx(markdown: string, template: WordTemplate, customStyle?: DocumentStyle) {
  const lines = markdown.split('\n');
  const sections: any[] = [];
  
  // 决定使用哪种样式配置
  const style = (template === WordTemplate.CUSTOM && customStyle) ? customStyle : (DEFAULT_STYLES[template] || DEFAULT_STYLES[WordTemplate.STANDARD]);
  
  const font = style.fontFace;
  const fontSize = style.fontSize; 
  const headingColor = style.headingColor;
  
  // mapping alignment string to enum
  let align = AlignmentType.LEFT;
  if (style.alignment === 'center') align = AlignmentType.CENTER;
  if (style.alignment === 'justify') align = AlignmentType.JUSTIFIED;
  if (style.alignment === 'right') align = AlignmentType.RIGHT;

  let i = 0;
  while (i < lines.length) {
    let line = lines[i].trim();

    // 1. 处理标题
    if (line.startsWith('#')) {
      const level = line.match(/^#+/)?.[0].length || 1;
      const content = line.replace(/^#+\s*/, '');
      sections.push(new Paragraph({
        children: parseInlineStyles(content, font, fontSize + (4-level)*2, headingColor) as any,
        heading: level === 1 ? HeadingLevel.HEADING_1 : (level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3),
        spacing: { before: 400, after: 200 },
        alignment: level === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
      }));
      i++;
    } 
    // 2. 处理代码块
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
                  children: [new TextRun({ text: cl, font: "JetBrains Mono", size: 20, color: "334155" })], // Code size usually fixed
                  spacing: { before: 20, after: 20 }
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
    // 3. 处理表格
    else if (line.startsWith('|')) {
      const tableRows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const rawRow = lines[i].trim();
        if (!rawRow.match(/^\|[:\s-]+\|/)) {
          const cells = rawRow.split('|').filter(c => c.trim() !== '' || rawRow.indexOf('|' + c + '|') !== -1).map(c => c.trim());
          if (cells.length > 0) {
            tableRows.push(new TableRow({
              children: cells.map(cell => new TableCell({
                children: [new Paragraph({ children: parseInlineStyles(cell, font, fontSize - 1, style.textColor) as any })],
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: "94A3B8" },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: "94A3B8" },
                  left: { style: BorderStyle.SINGLE, size: 1, color: "94A3B8" },
                  right: { style: BorderStyle.SINGLE, size: 1, color: "94A3B8" },
                },
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 100, bottom: 100, left: 100, right: 100 }
              }))
            }));
          }
        }
        i++;
      }
      sections.push(new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      }));
    }
    // 4. 处理块级公式
    else if (line.startsWith('$$')) {
      let formula = line.replace(/\$\$/g, '');
      if (formula === '') {
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('$$')) {
          formula += lines[i] + ' ';
          i++;
        }
      }
      // 使用 Math 和 MathRun，让 Word 识别这是公式区域
      sections.push(new Paragraph({
        children: [
            new Math({
                children: [new MathRun(formula.trim())]
            })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 300, after: 300 }
      }));
      i++;
    }
    // 5. 处理引用
    else if (line.startsWith('>')) {
      sections.push(new Paragraph({
        children: parseInlineStyles(line.replace(/^>\s*/, ''), font, fontSize, "555555") as any,
        indent: { left: 720 },
        spacing: { after: 200 },
        shading: { fill: "F1F5F9", type: ShadingType.CLEAR }
      }));
      i++;
    }
    // 6. 普通段落
    else {
      if (line !== '') {
        sections.push(new Paragraph({
          children: parseInlineStyles(line, font, fontSize, style.textColor) as any,
          alignment: align,
          spacing: { 
              after: style.paragraphSpacing, 
              line: style.lineSpacing * 240, // docx uses 240 for 1 line
              lineRule: "auto"
          }
        }));
      }
      i++;
    }
  }

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
  a.click();
  window.URL.revokeObjectURL(url);
}
