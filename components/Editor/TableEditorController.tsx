import React, { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import TableEditorModal, { type TableAlignment, type TableConfig, type TableEditorModalLabels } from './TableEditorModal';
import { useI18n } from '../../utils/i18n';

export interface TableEditorHandle {
  open: () => void;
}

interface TableEditorControllerProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  updateHistory: (value: string) => void;
  isLocked: boolean;
}

const createEmptyConfig = (columns: number, rows: number, alignments: TableAlignment[]): TableConfig => ({
  columns,
  rows,
  alignments,
  header: Array.from({ length: columns }, () => ''),
  body: Array.from({ length: rows }, () => Array.from({ length: columns }, () => ''))
});

const DEFAULT_COLUMNS = 2;
const DEFAULT_ROWS = 2;
const DEFAULT_ALIGNMENTS: TableAlignment[] = ['left', 'left'];

const TableEditorController = forwardRef<TableEditorHandle, TableEditorControllerProps>(
  ({ textareaRef, updateHistory, isLocked }, ref) => {
    const { t } = useI18n();
    const [isOpen, setIsOpen] = useState(false);
    const [initialConfig, setInitialConfig] = useState<TableConfig>(
      createEmptyConfig(DEFAULT_COLUMNS, DEFAULT_ROWS, DEFAULT_ALIGNMENTS)
    );
    const labels = useMemo<TableEditorModalLabels>(() => ({
      title: t('tableEditor.title'),
      columns: t('tableEditor.columns'),
      rows: t('tableEditor.rows'),
      alignment: t('tableEditor.alignment'),
      header: t('tableEditor.header'),
      body: t('tableEditor.body'),
      clear: t('tableEditor.clear'),
      cancel: t('tableEditor.cancel'),
      insert: t('tableEditor.insert')
    }), [t]);

    const open = () => {
      if (isLocked) return;
      setInitialConfig(createEmptyConfig(DEFAULT_COLUMNS, DEFAULT_ROWS, DEFAULT_ALIGNMENTS));
      setIsOpen(true);
    };

    useImperativeHandle(ref, () => ({ open }));

    const close = () => {
      setIsOpen(false);
    };

    const insertMarkdown = (markdown: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const current = textarea.value;
      const before = current.substring(0, start);
      const after = current.substring(end);

      const needsLeadingNewline = before.length > 0 && !before.endsWith('\n');
      const needsTrailingNewline = after.length > 0 && !after.startsWith('\n');
      const insertion = `${needsLeadingNewline ? '\n' : ''}${markdown}${needsTrailingNewline ? '\n' : ''}`;
      const nextValue = before + insertion + after;

      updateHistory(nextValue);
      setIsOpen(false);

      setTimeout(() => {
        textarea.focus();
        const cursorPosition = before.length + insertion.length;
        textarea.setSelectionRange(cursorPosition, cursorPosition);
      }, 0);
    };

    const handleInsert = (markdown: string, _config: TableConfig) => {
      insertMarkdown(markdown);
    };

    return (
      <TableEditorModal
        isOpen={isOpen}
        initialConfig={initialConfig}
        labels={labels}
        onClose={close}
        onInsert={handleInsert}
      />
    );
  }
);

TableEditorController.displayName = 'TableEditorController';

export default TableEditorController;
