import React from 'react';
import { TextSlideElement, TextAlign, TextTransform, TextListStyle } from '../../../../types.ts';
import {
  RibbonButton,
  RibbonColorSwatch,
  RibbonGlyph,
  RibbonGroup,
  RibbonNumber,
  RibbonPicker,
  RibbonRow,
} from './RibbonPrimitives';

const FONT_FAMILY_OPTIONS = [
  { label: 'Aptos', value: '"Aptos", "Segoe UI", system-ui, sans-serif' },
  { label: 'Aptos Display', value: '"Aptos Display", "Aptos", "Segoe UI", system-ui, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Helvetica', value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: 'Inter', value: '"Inter", "Segoe UI", system-ui, sans-serif' },
  { label: 'Montserrat', value: '"Montserrat", Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Garamond', value: 'Garamond, Georgia, serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", Verdana, sans-serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
];

const TEXT_TRANSFORM_OPTIONS: ReadonlyArray<{ value: TextTransform; label: string }> = [
  { value: 'none', label: 'Aa' },
  { value: 'uppercase', label: 'AA' },
  { value: 'lowercase', label: 'aa' },
  { value: 'capitalize', label: 'Abc' },
];

const LINE_HEIGHT_OPTIONS = [
  { value: 1, label: '1.0' },
  { value: 1.15, label: '1.15' },
  { value: 1.25, label: '1.25' },
  { value: 1.4, label: '1.4' },
  { value: 1.5, label: '1.5' },
  { value: 1.75, label: '1.75' },
  { value: 2, label: '2.0' },
];

export interface RibbonFormatProps {
  selectedElement: TextSlideElement | null;
  onUpdateElement: (elementId: string, updater: (element: TextSlideElement) => TextSlideElement) => void;
  groupsOnly?: boolean;
}

function mutateStyle(
  selectedElement: TextSlideElement | null,
  onUpdateElement: RibbonFormatProps['onUpdateElement'],
  patch: (style: TextSlideElement['style']) => TextSlideElement['style'],
) {
  if (!selectedElement) return;
  onUpdateElement(selectedElement.id, (current) => ({ ...current, style: patch(current.style) }));
}

function toggleTextDecoration(style: TextSlideElement['style'], flag: 'underline' | 'line-through'): string {
  const current = (style.textDecoration || '').toLowerCase();
  const parts = current.split(/\s+/).filter(Boolean);
  if (parts.includes(flag)) {
    return parts.filter((token) => token !== flag).join(' ');
  }
  return [...parts, flag].join(' ');
}

export const RibbonFormat: React.FC<RibbonFormatProps> = ({ selectedElement, onUpdateElement, groupsOnly = false }) => {
  const style = selectedElement?.style ?? {};
  const enabled = !!selectedElement;

  const fontFamilyValue = style.fontFamily || FONT_FAMILY_OPTIONS[0].value;
  const fontSizeValue = typeof style.fontSize === 'number' ? style.fontSize : 48;
  const weightValue = typeof style.fontWeight === 'number' ? style.fontWeight : Number(style.fontWeight ?? 600);
  const isBold = weightValue >= 600;
  const isItalic = style.fontStyle === 'italic';
  const decoration = (style.textDecoration || '').toLowerCase();
  const isUnderline = decoration.includes('underline');
  const isStrikethrough = decoration.includes('line-through');
  const alignValue: TextAlign = (style.textAlign as TextAlign) || 'left';
  const listValue: TextListStyle = (style.listStyleType as TextListStyle) || 'none';
  const transformValue: TextTransform = (style.textTransform as TextTransform) || 'none';
  const lineHeightValue = typeof style.lineHeight === 'number' ? style.lineHeight : 1.25;

  const groups = (
    <>
      <RibbonGroup title="Font">
        <RibbonPicker
          value={fontFamilyValue}
          options={FONT_FAMILY_OPTIONS}
          onChange={(value) =>
            mutateStyle(selectedElement, onUpdateElement, (current) => ({ ...current, fontFamily: value }))
          }
          disabled={!enabled}
          title="Font family"
          width="7.5rem"
        />
        <RibbonNumber
          value={fontSizeValue}
          min={6}
          max={480}
          step={1}
          disabled={!enabled}
          title="Font size (px)"
          width="2.25rem"
          onChange={(value) =>
            mutateStyle(selectedElement, onUpdateElement, (current) => ({ ...current, fontSize: value }))
          }
        />
        <RibbonButton
          active={isBold}
          disabled={!enabled}
          onClick={() =>
            mutateStyle(selectedElement, onUpdateElement, (current) => ({
              ...current,
              fontWeight: isBold ? 400 : 700,
            }))
          }
          title="Bold"
          shortcut="Ctrl+B"
          size="sm"
          aria-label="Bold"
        >
          <span className="font-black">B</span>
        </RibbonButton>
        <RibbonButton
          active={isItalic}
          disabled={!enabled}
          onClick={() =>
            mutateStyle(selectedElement, onUpdateElement, (current) => ({
              ...current,
              fontStyle: isItalic ? 'normal' : 'italic',
            }))
          }
          title="Italic"
          shortcut="Ctrl+I"
          size="sm"
          aria-label="Italic"
        >
          <span className="italic">I</span>
        </RibbonButton>
        <RibbonButton
          active={isUnderline}
          disabled={!enabled}
          onClick={() =>
            mutateStyle(selectedElement, onUpdateElement, (current) => ({
              ...current,
              textDecoration: toggleTextDecoration(current, 'underline'),
            }))
          }
          title="Underline"
          shortcut="Ctrl+U"
          size="sm"
          aria-label="Underline"
        >
          <span className="underline">U</span>
        </RibbonButton>
        <RibbonButton
          active={isStrikethrough}
          disabled={!enabled}
          onClick={() =>
            mutateStyle(selectedElement, onUpdateElement, (current) => ({
              ...current,
              textDecoration: toggleTextDecoration(current, 'line-through'),
            }))
          }
          title="Strikethrough"
          size="sm"
          aria-label="Strikethrough"
        >
          <span className="line-through">S</span>
        </RibbonButton>
        <RibbonPicker
          value={transformValue}
          options={TEXT_TRANSFORM_OPTIONS}
          onChange={(value) =>
            mutateStyle(selectedElement, onUpdateElement, (current) => ({ ...current, textTransform: value }))
          }
          disabled={!enabled}
          title="Letter case"
          width="3.25rem"
        />
      </RibbonGroup>

      <RibbonGroup title="Paragraph">
        <RibbonButton
          active={alignValue === 'left'}
          disabled={!enabled}
          onClick={() =>
            mutateStyle(selectedElement, onUpdateElement, (current) => ({ ...current, textAlign: 'left' }))
          }
          title="Align text left"
          shortcut="Ctrl+L"
          icon={<RibbonGlyph>L</RibbonGlyph>}
          size="sm"
          aria-label="Align left"
        />
        <RibbonButton
          active={alignValue === 'center'}
          disabled={!enabled}
          onClick={() =>
            mutateStyle(selectedElement, onUpdateElement, (current) => ({ ...current, textAlign: 'center' }))
          }
          title="Align text center"
          shortcut="Ctrl+E"
          icon={<RibbonGlyph>C</RibbonGlyph>}
          size="sm"
          aria-label="Align center"
        />
        <RibbonButton
          active={alignValue === 'right'}
          disabled={!enabled}
          onClick={() =>
            mutateStyle(selectedElement, onUpdateElement, (current) => ({ ...current, textAlign: 'right' }))
          }
          title="Align text right"
          shortcut="Ctrl+R"
          icon={<RibbonGlyph>R</RibbonGlyph>}
          size="sm"
          aria-label="Align right"
        />
        <RibbonButton
          active={listValue === 'disc'}
          disabled={!enabled}
          onClick={() =>
            mutateStyle(selectedElement, onUpdateElement, (current) => ({
              ...current,
              listStyleType: listValue === 'disc' ? 'none' : 'disc',
            }))
          }
          title="Bulleted list"
          shortcut="Ctrl+Shift+L"
          size="sm"
          aria-label="Bulleted list"
        >
          •
        </RibbonButton>
        <RibbonButton
          active={listValue === 'decimal'}
          disabled={!enabled}
          onClick={() =>
            mutateStyle(selectedElement, onUpdateElement, (current) => ({
              ...current,
              listStyleType: listValue === 'decimal' ? 'none' : 'decimal',
            }))
          }
          title="Numbered list"
          size="sm"
          aria-label="Numbered list"
        >
          1.
        </RibbonButton>
        <RibbonButton
          disabled={!enabled}
          onClick={() =>
            mutateStyle(selectedElement, onUpdateElement, (current) => ({
              ...current,
              listIndent: Math.max(0, (current.listIndent ?? 0) - 1),
            }))
          }
          title="Decrease indent"
          size="sm"
          aria-label="Decrease indent"
        >
          ←
        </RibbonButton>
        <RibbonButton
          disabled={!enabled}
          onClick={() =>
            mutateStyle(selectedElement, onUpdateElement, (current) => ({
              ...current,
              listIndent: Math.min(6, (current.listIndent ?? 0) + 1),
            }))
          }
          title="Increase indent"
          size="sm"
          aria-label="Increase indent"
        >
          →
        </RibbonButton>
        <RibbonPicker
          value={lineHeightValue}
          options={LINE_HEIGHT_OPTIONS}
          onChange={(value) =>
            mutateStyle(selectedElement, onUpdateElement, (current) => ({ ...current, lineHeight: value }))
          }
          disabled={!enabled}
          title="Line spacing"
          width="3.5rem"
        />
      </RibbonGroup>

      <RibbonGroup title="Color">
        <RibbonColorSwatch
          value={style.color || '#ffffff'}
          onChange={(value) =>
            mutateStyle(selectedElement, onUpdateElement, (current) => ({ ...current, color: value }))
          }
          disabled={!enabled}
          title="Text color"
        />
        <RibbonColorSwatch
          value={style.backgroundColor || '#00000000'}
          onChange={(value) =>
            mutateStyle(selectedElement, onUpdateElement, (current) => ({ ...current, backgroundColor: value }))
          }
          disabled={!enabled}
          title="Text background highlight"
        />
        <RibbonColorSwatch
          value={style.outlineColor || '#000000'}
          onChange={(value) =>
            mutateStyle(selectedElement, onUpdateElement, (current) => ({ ...current, outlineColor: value }))
          }
          disabled={!enabled}
          title="Text outline color"
        />
        <RibbonNumber
          value={typeof style.outlineWidth === 'number' ? style.outlineWidth : 0}
          min={0}
          max={12}
          step={0.5}
          disabled={!enabled}
          title="Outline width (px)"
          width="1.75rem"
          onChange={(value) =>
            mutateStyle(selectedElement, onUpdateElement, (current) => ({ ...current, outlineWidth: value }))
          }
        />
        <RibbonButton
          active={!!style.shadow}
          disabled={!enabled}
          onClick={() =>
            mutateStyle(selectedElement, onUpdateElement, (current) => ({
              ...current,
              shadow: current.shadow ? '' : '0 2px 8px rgba(0,0,0,0.65)',
            }))
          }
          title="Toggle drop shadow on text"
          size="sm"
        >
          Shadow
        </RibbonButton>
        <RibbonButton
          disabled={!enabled}
          onClick={() =>
            mutateStyle(selectedElement, onUpdateElement, () => ({}))
          }
          title="Reset all text styling on this block"
          size="sm"
          tone="danger"
        >
          Reset
        </RibbonButton>
      </RibbonGroup>
    </>
  );

  if (groupsOnly) return groups;

  return (
    <RibbonRow dense>
      {groups}
      {!enabled ? (
        <div className="inline-flex items-center px-2 text-[10px] uppercase tracking-[0.18em] text-zinc-600">
          Select a text block to format
        </div>
      ) : null}
    </RibbonRow>
  );
};
