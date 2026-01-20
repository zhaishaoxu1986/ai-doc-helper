import React, { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import MathEditorModal, { type MathDisplayMode, type MathEditorModalLabels, type MathSnippetGroup } from './MathEditorModal';
import { useI18n } from '../../utils/i18n';

export interface MathEditorHandle {
  open: () => void;
}

interface MathEditorControllerProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  updateHistory: (value: string) => void;
  isLocked: boolean;
}

const MATH_SNIPPET_GROUPS: MathSnippetGroup[] = [
  {
    title: 'structure',
    items: [
      { label: 'a/b', latex: '\\frac{}{}', cursorOffset: 6 },
      { label: '√x', latex: '\\sqrt{}', cursorOffset: 6 },
      { label: '^□', latex: '^{}', cursorOffset: 2 },
      { label: '_□', latex: '_{}', cursorOffset: 2 },
      { label: 'x^{ }', latex: 'x^{}', cursorOffset: 3 },
      { label: 'x_{ }', latex: 'x_{}', cursorOffset: 3 },
      { label: '|x|', latex: '\\left| \\right|', cursorOffset: 8 },
      { label: '‖x‖', latex: '\\left\\| \\right\\|', cursorOffset: 10 },
      { label: '∑', latex: '\\sum_{}^{}', cursorOffset: 6 },
      { label: '∑ i=1..n', latex: '\\sum_{i=1}^{n}', cursorOffset: 14 },
      { label: '∫', latex: '\\int_{}^{}', cursorOffset: 6 },
      { label: '∫ dx', latex: '\\int \\mathrm{d}x', cursorOffset: 0 },
      { label: 'lim', latex: '\\lim_{}', cursorOffset: 5 },
      { label: '( )', latex: '\\left( \\right)', cursorOffset: 7 }
    ]
  },
  {
    title: 'advanced',
    items: [
      { label: '{cases}', latex: '\\begin{cases} \\\\ \\end{cases}', cursorOffset: 18 }
    ]
  },
  {
    title: 'text',
    items: [
      { label: 'text', latex: '\\text{}', cursorOffset: 6 },
      { label: 'rm', latex: '\\mathrm{}', cursorOffset: 8 },
      { label: 'bf', latex: '\\mathbf{}', cursorOffset: 8 },
      { label: 'bold', latex: '\\boldsymbol{}', cursorOffset: 12 },
      { label: 'cal', latex: '\\mathcal{}', cursorOffset: 10 },
      { label: 'bb', latex: '\\mathbb{}', cursorOffset: 9 },
      { label: 'op', latex: '\\operatorname{}', cursorOffset: 15 }
    ]
  },
  {
    title: 'operator',
    items: [
      { label: '±', latex: '\\pm' },
      { label: '×', latex: '\\times' },
      { label: '÷', latex: '\\div' },
      { label: '·', latex: '\\cdot' },
      { label: '≤', latex: '\\leq' },
      { label: '≥', latex: '\\geq' },
      { label: '≠', latex: '\\neq' },
      { label: '≈', latex: '\\approx' },
      { label: '∞', latex: '\\infty' }
    ]
  },
  {
    title: 'logic',
    items: [
      { label: '⇒', latex: '\\Rightarrow' },
      { label: '⇔', latex: '\\Leftrightarrow' },
      { label: '∧', latex: '\\land' },
      { label: '∨', latex: '\\lor' },
      { label: '¬', latex: '\\lnot' },
      { label: '∈', latex: '\\in' },
      { label: '⊂', latex: '\\subset' },
      { label: '∪', latex: '\\cup' },
      { label: '∩', latex: '\\cap' },
      { label: '∅', latex: '\\emptyset' }
    ]
  },
  {
    title: 'stats',
    items: [
      { label: 'P()', latex: '\\mathbb{P}()' },
      { label: 'E()', latex: '\\mathbb{E}[]', cursorOffset: 0 },
      { label: 'Var', latex: '\\operatorname{Var}()' },
      { label: 'argmax', latex: '\\operatorname{argmax}_{}', cursorOffset: 17 }
    ]
  },
  {
    title: 'greek',
    items: [
      { label: 'α', latex: '\\alpha' },
      { label: 'β', latex: '\\beta' },
      { label: 'γ', latex: '\\gamma' },
      { label: 'π', latex: '\\pi' },
      { label: 'θ', latex: '\\theta' },
      { label: 'λ', latex: '\\lambda' },
      { label: 'μ', latex: '\\mu' },
      { label: 'σ', latex: '\\sigma' },
      { label: 'ω', latex: '\\omega' },
      { label: 'Δ', latex: '\\Delta' }
    ]
  }
];

const MathEditorController = forwardRef<MathEditorHandle, MathEditorControllerProps>(
  ({ textareaRef, updateHistory, isLocked }, ref) => {
    const { t } = useI18n();
    const [isOpen, setIsOpen] = useState(false);
    const [initialLatex, setInitialLatex] = useState('');
    const [initialDisplayMode, setInitialDisplayMode] = useState<MathDisplayMode>('block');
    const [targetRange, setTargetRange] = useState<{ start: number; end: number } | null>(null);
    const labels = useMemo<MathEditorModalLabels>(() => ({
      title: t('mathEditor.title'),
      inputLabel: t('mathEditor.inputLabel'),
      modeLabel: t('mathEditor.modeLabel'),
      inlineMode: t('mathEditor.inlineMode'),
      blockMode: t('mathEditor.blockMode'),
      placeholder: t('mathEditor.placeholder'),
      previewLabel: t('mathEditor.previewLabel'),
      previewEmpty: t('mathEditor.previewEmpty'),
      clear: t('mathEditor.clear'),
      cancel: t('mathEditor.cancel'),
      insert: t('mathEditor.insert')
    }), [t]);
    const groups = useMemo<MathSnippetGroup[]>(() => (
      MATH_SNIPPET_GROUPS.map((group) => ({
        ...group,
        title: t(`mathEditor.group.${group.title}`)
      }))
    ), [t]);

    const parseMathSelection = (selected: string) => {
      const trimmed = selected.trim();
      if (trimmed.startsWith('$$') && trimmed.endsWith('$$')) {
        return { latex: trimmed.slice(2, -2).trim(), mode: 'block' as MathDisplayMode };
      }
      if (trimmed.startsWith('$') && trimmed.endsWith('$')) {
        return { latex: trimmed.slice(1, -1).trim(), mode: 'inline' as MathDisplayMode };
      }
      return { latex: trimmed, mode: null as MathDisplayMode | null };
    };

    const open = () => {
      if (isLocked) return;
      const textarea = textareaRef.current;
      let nextLatex = '';
      let nextMode: MathDisplayMode = 'block';

      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        setTargetRange({ start, end });

        const selected = textarea.value.substring(start, end);
        if (selected.trim()) {
          const parsed = parseMathSelection(selected);
          nextLatex = parsed.latex;
          if (parsed.mode) nextMode = parsed.mode;
        }
      }

      setInitialLatex(nextLatex);
      setInitialDisplayMode(nextMode);
      setIsOpen(true);
    };

    useImperativeHandle(ref, () => ({ open }));

    const close = () => {
      setIsOpen(false);
      setTargetRange(null);
    };

    const handleInsert = (latex: string, displayMode: MathDisplayMode) => {
      const trimmed = latex.trim();
      if (!trimmed) {
        alert(t('mathEditor.alert.missingFormula'));
        return;
      }
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = targetRange?.start ?? textarea.selectionStart;
      const end = targetRange?.end ?? textarea.selectionEnd;
      const current = textarea.value;
      const before = current.substring(0, start);
      const after = current.substring(end);

      let insertion = '';
      if (displayMode === 'block') {
        const needsLeadingNewline = before.length > 0 && !before.endsWith('\n');
        const needsTrailingNewline = after.length > 0 && !after.startsWith('\n');
        insertion = `${needsLeadingNewline ? '\n' : ''}$$\n${trimmed}\n$$${needsTrailingNewline ? '\n' : ''}`;
      } else {
        insertion = `$${trimmed}$`;
      }

      const nextValue = before + insertion + after;
      updateHistory(nextValue);
      setIsOpen(false);
      setTargetRange(null);

      setTimeout(() => {
        textarea.focus();
        const cursorPosition = before.length + insertion.length;
        textarea.setSelectionRange(cursorPosition, cursorPosition);
      }, 0);
    };

    return (
      <MathEditorModal
        isOpen={isOpen}
        initialLatex={initialLatex}
        initialDisplayMode={initialDisplayMode}
        onClose={close}
        onInsert={handleInsert}
        labels={labels}
        snippetGroups={groups}
      />
    );
  }
);

MathEditorController.displayName = 'MathEditorController';

export default MathEditorController;
