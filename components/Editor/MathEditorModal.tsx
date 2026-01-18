import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export type MathDisplayMode = 'block' | 'inline';

export interface MathSnippet {
  label: string;
  latex: string;
  cursorOffset?: number;
}

export interface MathSnippetGroup {
  title: string;
  items: MathSnippet[];
}

export interface MathEditorModalLabels {
  title: string;
  inputLabel: string;
  modeLabel: string;
  inlineMode: string;
  blockMode: string;
  placeholder: string;
  previewLabel: string;
  previewEmpty: string;
  clear: string;
  cancel: string;
  insert: string;
}

interface MathEditorModalProps {
  isOpen: boolean;
  initialLatex: string;
  initialDisplayMode: MathDisplayMode;
  onClose: () => void;
  onInsert: (latex: string, displayMode: MathDisplayMode) => void;
  labels: MathEditorModalLabels;
  snippetGroups: MathSnippetGroup[];
}

const MathEditorModal: React.FC<MathEditorModalProps> = ({
  isOpen,
  initialLatex,
  initialDisplayMode,
  onClose,
  onInsert,
  labels,
  snippetGroups
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [latex, setLatex] = useState(initialLatex);
  const [displayMode, setDisplayMode] = useState<MathDisplayMode>(initialDisplayMode);

  useEffect(() => {
    if (!isOpen) return;
    setLatex(initialLatex);
    setDisplayMode(initialDisplayMode);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [isOpen, initialLatex, initialDisplayMode]);

  const insertMathSnippet = (snippet: MathSnippet) => {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const currentValue = input.value ?? latex;
    const nextValue = currentValue.substring(0, start) + snippet.latex + currentValue.substring(end);

    setLatex(nextValue);
    const cursorPosition = start + (snippet.cursorOffset ?? snippet.latex.length);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(cursorPosition, cursorPosition);
    });
  };

  const handleInsert = () => {
    const trimmed = latex.trim();
    if (!trimmed) return;
    onInsert(trimmed, displayMode);
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/10 backdrop-blur-[2px]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">{labels.title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{labels.inputLabel}</label>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400">{labels.modeLabel}</span>
                  <button
                    onClick={() => setDisplayMode('inline')}
                    className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors ${
                      displayMode === 'inline'
                        ? 'bg-[var(--primary-50)] text-[var(--primary-color)] border-[var(--primary-50)]'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]'
                    }`}
                  >
                    {labels.inlineMode}
                  </button>
                  <button
                    onClick={() => setDisplayMode('block')}
                    className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors ${
                      displayMode === 'block'
                        ? 'bg-[var(--primary-50)] text-[var(--primary-color)] border-[var(--primary-50)]'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]'
                    }`}
                  >
                    {labels.blockMode}
                  </button>
                </div>
              </div>
              <textarea
                ref={inputRef}
                className="w-full h-32 p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none resize-none font-mono bg-slate-50 text-slate-700"
                placeholder={labels.placeholder}
                value={latex}
                onChange={(e) => setLatex(e.target.value)}
              ></textarea>
              <div className="mt-3 space-y-3">
                {snippetGroups.map((group) => (
                  <div key={group.title}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{group.title}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {group.items.map((item) => (
                        <button
                          key={`${group.title}-${item.label}`}
                          onClick={() => insertMathSnippet(item)}
                          className="px-2.5 py-1 text-xs rounded border border-slate-200 bg-white text-slate-600 hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] transition-colors"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{labels.previewLabel}</label>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 min-h-[220px]">
                {latex.trim() ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {displayMode === 'block' ? `$$${latex}$$` : `$${latex}$`}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">{labels.previewEmpty}</div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <button
              onClick={() => setLatex('')}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              {labels.clear}
            </button>
            <div className="space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {labels.cancel}
              </button>
              <button
                onClick={handleInsert}
                disabled={!latex.trim()}
                className="px-4 py-2 text-xs font-bold text-white bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {labels.insert}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MathEditorModal;
