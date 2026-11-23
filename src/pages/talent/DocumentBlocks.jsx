import React, { useEffect, useRef, useState } from 'react';
import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import { Node, mergeAttributes, generateJSON } from '@tiptap/core';
import * as Toolbar from '@radix-ui/react-toolbar';
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, IndentIncrease, IndentDecrease, Code, FilePlus, Quote, Minus, AlignLeft, AlignCenter, AlignRight, AlignJustify, RemoveFormatting, Undo, Redo, Link, Image as ImageIcon } from 'lucide-react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { fieldLabel, safeLink, safeImage } from '../../../shared/lifecycleDocuments.mjs';
import { readLetterImage } from '../../lib/letterImages';

const LetterField = Node.create({
  name: 'field', group: 'inline', inline: true, atom: true,
  addAttributes() { return { key: { default: '', parseHTML: el => el.getAttribute('data-key') }, value: { default: '', parseHTML: el => el.getAttribute('data-value') || '' }, label: { default: '' } }; },
  parseHTML() { return [{ tag: 'span[data-letter-field]' }]; },
  renderHTML({ node, HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes, { 'data-letter-field': '', 'data-key': node.attrs.key, 'data-value': node.attrs.value, class: `letter-field ${node.attrs.value ? 'is-filled' : ''}` }), node.attrs.value || fieldLabel(node.attrs.key)]; }
});
const PageBreak = Node.create({ name: 'pageBreak', group: 'block', atom: true, parseHTML: () => [{ tag: 'div[data-page-break]' }], renderHTML: () => ['div', { 'data-page-break': 'true', class: 'document-page-break' }] });
const UploadedImage = Image.extend({ parseHTML() { return [{ tag: 'img[src]', getAttrs: element => safeImage(element.getAttribute('src')) ? { src: element.getAttribute('src'), alt: element.getAttribute('alt') || '', width: Math.min(640, Math.max(1, Number(element.getAttribute('width')) || 140)), height: Math.min(900, Math.max(1, Number(element.getAttribute('height')) || 80)) } : false }]; } });
const letterExtensions = () => [StarterKit.configure({ heading: { levels: [1, 2, 3] }, trailingNode: false, link: { openOnClick: false } }), LetterField, PageBreak, TableKit, UploadedImage.configure({ allowBase64: true }), TextAlign.configure({ types: ['heading', 'paragraph'] }), TextStyleKit.configure({ lineHeight: false })];
export function letterFromHtml(html) { return generateJSON(html, letterExtensions()); }

const toolIcons = { Bold, Italic, Underline, Strike:Strikethrough, Bullets:List, Numbers:ListOrdered, Indent:IndentIncrease, Outdent:IndentDecrease, 'Code block':Code, 'Page break':FilePlus, Quote, Divider:Minus, Left:AlignLeft, Center:AlignCenter, Right:AlignRight, Justify:AlignJustify, 'Clear format':RemoveFormatting, Undo, Redo };
const toolMarks = {Bold:'bold',Italic:'italic',Underline:'underline',Strike:'strike',Bullets:'bulletList',Numbers:'orderedList','Code block':'codeBlock',Quote:'blockquote'};
const toolAlignments = {Left:'left',Center:'center',Right:'right',Justify:'justify'};
export function DocumentBlocks({ label, content, onChange, readOnly, custom = false, onError }) {
  const change = useRef(onChange); change.current = onChange;
  const fileInput = useRef(null), [source, setSource] = useState(null);
  const editor = useEditor({
    extensions: letterExtensions(),
    content, editable: !readOnly, editorProps: { attributes: { 'aria-label': label, role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor }) => change.current(editor.getJSON())
  });
  useEffect(() => { editor?.setEditable(!readOnly); }, [editor, readOnly]);
  useEffect(() => { if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(content)) editor.commands.setContent(content, { emitUpdate: false }); }, [editor, content]);
  const toolbarState = useEditorState({editor,selector:({editor:e})=>({
    active: e ? Object.keys(toolIcons).filter(name=>toolMarks[name]?e.isActive(toolMarks[name]):toolAlignments[name]?e.isActive({textAlign:toolAlignments[name]}):false) : [],
    undo: e?.can().undo() || false, redo:e?.can().redo() || false
  })});
  const run = action => editor && action(editor.chain().focus());
  async function imageFile(file) { try { const asset = await readLetterImage(file, 480); editor?.chain().focus().setImage({ ...asset, alt: file.name }).run(); } catch (error) { onError?.(error.message); } }
  function link() { const href = window.prompt('Link address (https:// or mailto:)', 'https://'); if (href === null) return; if (!href) editor?.chain().focus().unsetLink().run(); else if (safeLink(href)) editor?.chain().focus().setLink({ href }).run(); else onError?.('Enter a valid HTTP, HTTPS, or mailto link.'); }
  return <section className="document-block"><h3>{label}</h3>{!readOnly && <Toolbar.Root className="document-toolbar" aria-label={`${label} formatting`}>
    <select aria-label={`${label} block style`} defaultValue="" onChange={e => { const value = e.target.value; run(c => value === 'paragraph' ? c.setParagraph().run() : c.toggleHeading({ level: Number(value) }).run()); e.target.value = ''; }}><option value="" disabled>Text style</option><option value="paragraph">Paragraph</option>{[1,2,3].map(level => <option key={level} value={level}>Heading {level}</option>)}</select>
    <select aria-label={`${label} font`} defaultValue="" onChange={e => run(c => c.setFontFamily(e.target.value).run())}><option value="" disabled>Font</option>{['Arial','Georgia','Times New Roman','Verdana','Courier New'].map(font => <option key={font}>{font}</option>)}</select>
    <select aria-label={`${label} font size`} defaultValue="" onChange={e => run(c => c.setFontSize(e.target.value).run())}><option value="" disabled>Size</option>{[10,12,14,16,18,20,24,32,48].map(size => <option key={size} value={`${size}px`}>{size}</option>)}</select>
    {[
      ['Bold', c => c.toggleBold()], ['Italic', c => c.toggleItalic()], ['Underline', c => c.toggleUnderline()], ['Strike', c => c.toggleStrike()], ['Bullets', c => c.toggleBulletList()], ['Numbers', c => c.toggleOrderedList()], ['Indent', c => c.sinkListItem('listItem')], ['Outdent', c => c.liftListItem('listItem')], ['Code block', c => c.toggleCodeBlock()], ['Page break', c => c.insertContent({type:'pageBreak'})], ['Quote', c => c.toggleBlockquote()], ['Divider', c => c.setHorizontalRule()], ['Left', c => c.setTextAlign('left')], ['Center', c => c.setTextAlign('center')], ['Right', c => c.setTextAlign('right')], ['Justify', c => c.setTextAlign('justify')], ['Clear format', c => c.unsetAllMarks().clearNodes()], ['Undo', c => c.undo()], ['Redo', c => c.redo()]
    ].map(([name, action]) => {const Icon=toolIcons[name];return <Toolbar.Button type="button" key={name} title={name} aria-label={name} aria-pressed={toolMarks[name]||toolAlignments[name]?toolbarState?.active.includes(name):undefined} disabled={!editor||(name==='Undo'&&!toolbarState?.undo)||(name==='Redo'&&!toolbarState?.redo)} onMouseDown={e=>e.preventDefault()} onClick={() => run(c => action(c).run())}><Icon size={16}/></Toolbar.Button>;})}
    <label>Color<input type="color" aria-label={`${label} text color`} onChange={e => run(c => c.setColor(e.target.value).run())} /></label><label>Highlight<input type="color" defaultValue="#fff3bf" aria-label={`${label} highlight color`} onChange={e => run(c => c.setBackgroundColor(e.target.value).run())} /></label>
    <Toolbar.Button type="button" onClick={link} title="Link" aria-label="Link"><Link size={16}/></Toolbar.Button><Toolbar.Button type="button" onClick={() => fileInput.current.click()} title="Image" aria-label="Image"><ImageIcon size={16}/></Toolbar.Button><input ref={fileInput} type="file" hidden accept="image/png,image/jpeg" onChange={e => { if (e.target.files[0]) imageFile(e.target.files[0]); e.target.value = ''; }} />
    <select aria-label={`${label} table tools`} value="" onChange={e => { const action = { insert: c => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }), row: c => c.addRowAfter(), column: c => c.addColumnAfter(), removeRow: c => c.deleteRow(), removeColumn: c => c.deleteColumn(), merge: c => c.mergeCells(), split: c => c.splitCell(), remove: c => c.deleteTable() }[e.target.value]; if (action) run(c => action(c).run()); }}><option value="">Table tools</option><option value="insert">Insert table</option><option value="row">Add row</option><option value="column">Add column</option><option value="removeRow">Delete row</option><option value="removeColumn">Delete column</option><option value="merge">Merge cells</option><option value="split">Split cell</option><option value="remove">Delete table</option></select>
    {custom && <Toolbar.Button type="button" onClick={() => { if (source !== null) { editor?.commands.setContent(source); setSource(null); } else setSource(editor?.getHTML() || ''); }}>{source !== null ? 'Apply HTML' : 'HTML source'}</Toolbar.Button>}
  </Toolbar.Root>}{source !== null ? <div className="document-source"><p>Document HTML supports paragraphs, tables, images and formatting. Scripts and unsupported elements are removed.</p><textarea aria-label={`${label} HTML source`} rows={12} value={source} disabled={readOnly} onChange={e => { setSource(e.target.value); editor?.commands.setContent(e.target.value); }} /></div> : <EditorContent editor={editor} />}</section>;
}
