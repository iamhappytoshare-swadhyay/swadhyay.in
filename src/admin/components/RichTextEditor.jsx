import { useEffect, useMemo, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import { TableKit } from '@tiptap/extension-table'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Eraser,
  Eye,
  FileCode,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Languages,
  Link as LinkIcon,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Minus,
  Omega,
  Palette,
  PlusSquare,
  Quote,
  Redo2,
  Search,
  Scissors,
  Sigma,
  SpellCheck,
  Strikethrough,
  Table as TableIcon,
  Trash2,
  Underline,
  Undo2,
  Video,
} from 'lucide-react'
import { renderLatexPreview, renderMathInHtml } from '../../utils/renderMathHtml.js'
import MediaLibrary from '../MediaLibrary.jsx'
import { JumpBreak, StyledText, VideoEmbed, resolveVideoEmbed } from './tiptapExtensions.js'

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: '100%',
        parseHTML: (element) => element.style.width || element.getAttribute('width') || '100%',
        renderHTML: (attributes) =>
          attributes.width
            ? { style: `width: ${attributes.width}; max-width: 100%; height: auto;` }
            : {},
      },
    }
  },
})

const FONT_FAMILIES = [
  { label: 'Default Font', value: '' },
  { label: 'Noto Sans Devanagari', value: '"Noto Sans Devanagari", sans-serif' },
  { label: 'Inter / Sans', value: 'Inter, system-ui, sans-serif' },
  { label: 'Georgia (Serif)', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Courier New (Mono)', value: '"Courier New", monospace' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
]

const FONT_SIZES = [
  { label: 'Font Size', value: '' },
  { label: 'Small (12px)', value: '12px' },
  { label: 'Normal (15px)', value: '15px' },
  { label: 'Medium (18px)', value: '18px' },
  { label: 'Large (22px)', value: '22px' },
  { label: 'X-Large (28px)', value: '28px' },
  { label: 'Huge (34px)', value: '34px' },
]

const TEXT_COLORS = [
  '#111827',
  '#374151',
  '#b91c1c',
  '#ea580c',
  '#d97706',
  '#15803d',
  '#0369a1',
  '#1d4ed8',
  '#6d28d9',
  '#be185d',
]

const HIGHLIGHT_COLORS = [
  '#fef08a',
  '#fed7aa',
  '#fecaca',
  '#bbf7d0',
  '#bae6fd',
  '#ddd6fe',
  '#fbcfe8',
  '#e5e7eb',
]

const SPECIAL_CHAR_GROUPS = [
  {
    label: 'Hindi / Devanagari',
    chars: ['ॐ', '₹', '।', '॥', 'ं', 'ः', 'ँ', 'ऽ', '॰', '–', '—', '‘', '’', '“', '”'],
  },
  {
    label: 'Math & Science',
    chars: ['±', '×', '÷', '√', '∑', '∏', '∫', '∞', 'π', '≈', '≠', '≤', '≥', '°', '∆', 'θ', 'α', 'β'],
  },
  {
    label: 'Arrows & Symbols',
    chars: ['→', '←', '↑', '↓', '↔', '⇒', '⇔', '✓', '✗', '★', '☆', '•', '©', '®', '™', '§'],
  },
]

const MATH_SAMPLES = [
  { label: 'Fraction', latex: '\\frac{a}{b}' },
  { label: 'Quadratic', latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
  { label: 'Integral', latex: '\\int_{a}^{b} f(x)\\,dx' },
  { label: 'Sum', latex: '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}' },
]

function stripHtmlText(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write your page or article content…',
  showTopModeTabs = true,
}) {
  const [mode, setMode] = useState('visual') // 'visual' | 'html' | 'preview'
  const [modal, setModal] = useState(null) // null | 'link' | 'image' | 'video' | 'chars' | 'math' | 'find'
  const [colorMenu, setColorMenu] = useState(null) // null | 'text' | 'highlight'
  const [spellcheck, setSpellcheck] = useState(true)
  const [inputLang, setInputLang] = useState('en-hi')
  const [fullscreen, setFullscreen] = useState(false)

  const [linkUrl, setLinkUrl] = useState('https://')
  const [imageUrl, setImageUrl] = useState('')
  const [imageAlt, setImageAlt] = useState('')
  const [imageCaption, setImageCaption] = useState('')
  const [imageWidth, setImageWidth] = useState('100%')
  const [videoUrl, setVideoUrl] = useState('')
  const [mathExpr, setMathExpr] = useState('')
  const [mathDisplay, setMathDisplay] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        link: { openOnClick: false },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ResizableImage.configure({ inline: false, allowBase64: false }),
      TableKit.configure({ table: { resizable: true } }),
      StyledText,
      VideoEmbed,
      JumpBreak,
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'rte-prosemirror',
        'data-placeholder': placeholder,
        spellcheck: spellcheck ? 'true' : 'false',
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      onChange(activeEditor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor?.view?.dom) return
    editor.view.dom.setAttribute('spellcheck', spellcheck ? 'true' : 'false')
    editor.view.dom.setAttribute('lang', inputLang === 'hi' ? 'hi' : 'en')
  }, [editor, spellcheck, inputLang])

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const next = value || ''
    if (current !== next) {
      editor.commands.setContent(next, { emitUpdate: false })
    }
  }, [editor, value])

  const previewHtml = useMemo(() => {
    if (mode !== 'preview') return ''
    return renderMathInHtml(value || '')
  }, [mode, value])

  const mathPreviewHtml = useMemo(() => {
    if (modal !== 'math' || !mathExpr.trim()) return ''
    return renderLatexPreview(mathExpr, mathDisplay)
  }, [modal, mathExpr, mathDisplay])

  const stats = useMemo(() => {
    const plain = stripHtmlText(value)
    const words = plain ? plain.split(/\s+/).filter(Boolean).length : 0
    const chars = plain.length
    const minutes = Math.max(1, Math.ceil(words / 180))
    return { words, chars, minutes }
  }, [value])

  function switchMode(nextMode) {
    if (nextMode === 'visual' && editor && mode === 'html') {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
    setMode(nextMode)
  }

  function applyStyledAttr(attrKey, attrValue) {
    if (!editor) return
    const currentAttrs = editor.getAttributes('styledText') || {}
    const nextAttrs = { ...currentAttrs, [attrKey]: attrValue || null }
    if (!nextAttrs.fontFamily && !nextAttrs.fontSize && !nextAttrs.color && !nextAttrs.backgroundColor) {
      editor.chain().focus().unsetMark('styledText').run()
    } else {
      editor.chain().focus().setMark('styledText', nextAttrs).run()
    }
  }

  function applyLink(event) {
    event.preventDefault()
    if (!editor) return
    const trimmed = linkUrl.trim()
    if (!trimmed) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run()
    }
    setModal(null)
  }

  function applyImage(event) {
    event.preventDefault()
    if (!editor || !imageUrl.trim()) return
    editor
      .chain()
      .focus()
      .setImage({
        src: imageUrl.trim(),
        alt: imageAlt.trim(),
        title: imageCaption.trim() || imageAlt.trim(),
        width: imageWidth,
      })
      .run()
    if (imageCaption.trim()) {
      editor.chain().focus().insertContent(`<p><em>${imageCaption.trim()}</em></p>`).run()
    }
    setImageUrl('')
    setImageAlt('')
    setImageCaption('')
    setImageWidth('100%')
    setModal(null)
  }

  function applyVideo(event) {
    event.preventDefault()
    if (!editor || !videoUrl.trim()) return
    const resolved = resolveVideoEmbed(videoUrl)
    if (!resolved) return
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'videoEmbed',
        attrs: { src: resolved.src, kind: resolved.kind },
      })
      .run()
    setVideoUrl('')
    setModal(null)
  }

  function applyMath(event) {
    event.preventDefault()
    if (!editor || !mathExpr.trim()) return
    const token = mathDisplay ? `$$${mathExpr.trim()}$$` : `$${mathExpr.trim()}$`
    editor.chain().focus().insertContent(token).run()
    setMathExpr('')
    setModal(null)
  }

  function handleFindReplaceAll(event) {
    event.preventDefault()
    if (!findQuery) return
    const currentHtml = value || ''
    const escaped = findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const updated = currentHtml.replace(new RegExp(escaped, 'g'), replaceQuery)
    onChange(updated)
    if (editor) {
      editor.commands.setContent(updated, { emitUpdate: false })
    }
    setModal(null)
  }

  const currentHeading = editor
    ? [1, 2, 3, 4, 5, 6].find((lvl) => editor.isActive('heading', { level: lvl })) || 0
    : 0
  const activeStyled = editor ? editor.getAttributes('styledText') : {}

  return (
    <div className={fullscreen ? 'rte-wrap is-fullscreen' : 'rte-wrap'}>
      <div className="rte-toolbar">
        {showTopModeTabs ? (
          <div className="rte-mode-tabs" role="tablist" aria-label="Editor mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'visual'}
              className={mode === 'visual' ? 'rte-mode-btn is-active' : 'rte-mode-btn'}
              onClick={() => switchMode('visual')}
            >
              Compose
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'html'}
              className={mode === 'html' ? 'rte-mode-btn is-active' : 'rte-mode-btn'}
              onClick={() => switchMode('html')}
            >
              <FileCode size={14} />
              <span>HTML</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'preview'}
              className={mode === 'preview' ? 'rte-mode-btn is-active' : 'rte-mode-btn'}
              onClick={() => switchMode('preview')}
            >
              <Eye size={14} />
              <span>Inline Preview</span>
            </button>
          </div>
        ) : null}

        {mode === 'visual' && editor ? (
          <div className="rte-tools">
            {/* 1. Undo / Redo */}
            <button
              type="button"
              className="rte-tool-btn"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              <Undo2 size={15} />
            </button>
            <button
              type="button"
              className="rte-tool-btn"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              title="Redo (Ctrl+Y)"
              aria-label="Redo"
            >
              <Redo2 size={15} />
            </button>

            <span className="rte-divider" aria-hidden="true" />

            {/* 2. Font Formatting: Font Family, Font Size, Headings */}
            <select
              className="rte-select"
              aria-label="Font family"
              title="Font Family"
              value={activeStyled.fontFamily || ''}
              onChange={(event) => applyStyledAttr('fontFamily', event.target.value)}
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>

            <select
              className="rte-select"
              aria-label="Font size"
              title="Font Size"
              value={activeStyled.fontSize || ''}
              onChange={(event) => applyStyledAttr('fontSize', event.target.value)}
            >
              {FONT_SIZES.map((s) => (
                <option key={s.label} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <select
              className="rte-select"
              aria-label="Heading level"
              title="Paragraph / Heading"
              value={currentHeading}
              onChange={(event) => {
                const lvl = Number(event.target.value)
                if (lvl === 0) editor.chain().focus().setParagraph().run()
                else editor.chain().focus().toggleHeading({ level: lvl }).run()
              }}
            >
              <option value={0}>Normal</option>
              <option value={1}>Heading 1</option>
              <option value={2}>Heading 2</option>
              <option value={3}>Heading 3</option>
              <option value={4}>Heading 4</option>
              <option value={5}>Heading 5</option>
              <option value={6}>Heading 6</option>
            </select>

            <span className="rte-divider" aria-hidden="true" />

            {/* 3. Text Styling: Bold, Italic, Underline, Strikethrough, Text Color, Highlight */}
            <button
              type="button"
              className={editor.isActive('bold') ? 'rte-tool-btn is-active' : 'rte-tool-btn'}
              onClick={() => editor.chain().focus().toggleBold().run()}
              title="Bold (Ctrl+B)"
              aria-label="Bold"
            >
              <Bold size={15} />
            </button>
            <button
              type="button"
              className={editor.isActive('italic') ? 'rte-tool-btn is-active' : 'rte-tool-btn'}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              title="Italic (Ctrl+I)"
              aria-label="Italic"
            >
              <Italic size={15} />
            </button>
            <button
              type="button"
              className={editor.isActive('underline') ? 'rte-tool-btn is-active' : 'rte-tool-btn'}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              title="Underline (Ctrl+U)"
              aria-label="Underline"
            >
              <Underline size={15} />
            </button>
            <button
              type="button"
              className={editor.isActive('strike') ? 'rte-tool-btn is-active' : 'rte-tool-btn'}
              onClick={() => editor.chain().focus().toggleStrike().run()}
              title="Strikethrough"
              aria-label="Strikethrough"
            >
              <Strikethrough size={15} />
            </button>

            <div className="rte-color-wrap">
              <button
                type="button"
                className={colorMenu === 'text' ? 'rte-tool-btn is-active' : 'rte-tool-btn'}
                onClick={() => setColorMenu((prev) => (prev === 'text' ? null : 'text'))}
                title="Text Color"
                aria-label="Text Color"
              >
                <Palette size={15} />
              </button>
              {colorMenu === 'text' ? (
                <div className="rte-color-popover" role="dialog" aria-label="Text color palette">
                  <div className="rte-swatch-grid">
                    {TEXT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="rte-swatch"
                        style={{ backgroundColor: c }}
                        onClick={() => {
                          applyStyledAttr('color', c)
                          setColorMenu(null)
                        }}
                        aria-label={`Text color ${c}`}
                      />
                    ))}
                  </div>
                  <div className="rte-color-footer">
                    <input
                      type="color"
                      value={activeStyled.color || '#111827'}
                      onChange={(e) => applyStyledAttr('color', e.target.value)}
                      aria-label="Custom text color"
                    />
                    <button
                      type="button"
                      className="cms-chip-btn"
                      onClick={() => {
                        applyStyledAttr('color', null)
                        setColorMenu(null)
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rte-color-wrap">
              <button
                type="button"
                className={colorMenu === 'highlight' ? 'rte-tool-btn is-active' : 'rte-tool-btn'}
                onClick={() => setColorMenu((prev) => (prev === 'highlight' ? null : 'highlight'))}
                title="Text Background Highlight Color"
                aria-label="Text Background Highlight Color"
              >
                <Highlighter size={15} />
              </button>
              {colorMenu === 'highlight' ? (
                <div className="rte-color-popover" role="dialog" aria-label="Highlight color palette">
                  <div className="rte-swatch-grid">
                    {HIGHLIGHT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="rte-swatch"
                        style={{ backgroundColor: c }}
                        onClick={() => {
                          applyStyledAttr('backgroundColor', c)
                          setColorMenu(null)
                        }}
                        aria-label={`Highlight color ${c}`}
                      />
                    ))}
                  </div>
                  <div className="rte-color-footer">
                    <input
                      type="color"
                      value={activeStyled.backgroundColor || '#fef08a'}
                      onChange={(e) => applyStyledAttr('backgroundColor', e.target.value)}
                      aria-label="Custom highlight color"
                    />
                    <button
                      type="button"
                      className="cms-chip-btn"
                      onClick={() => {
                        applyStyledAttr('backgroundColor', null)
                        setColorMenu(null)
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <span className="rte-divider" aria-hidden="true" />

            {/* 4. Links, Images, Video, Special Characters, Code blocks, Jump Break */}
            <button
              type="button"
              className={editor.isActive('link') ? 'rte-tool-btn is-active' : 'rte-tool-btn'}
              onClick={() => {
                setLinkUrl(editor.getAttributes('link').href || 'https://')
                setModal(modal === 'link' ? null : 'link')
              }}
              title="Insert / Edit Link"
              aria-label="Insert Link"
            >
              <LinkIcon size={15} />
            </button>
            <button
              type="button"
              className="rte-tool-btn"
              onClick={() => setModal(modal === 'image' ? null : 'image')}
              title="Insert Image"
              aria-label="Insert Image"
            >
              <ImageIcon size={15} />
            </button>
            <button
              type="button"
              className="rte-tool-btn"
              onClick={() => setModal(modal === 'video' ? null : 'video')}
              title="Insert Video (YouTube / Vimeo / MP4)"
              aria-label="Insert Video"
            >
              <Video size={15} />
            </button>
            <button
              type="button"
              className={modal === 'chars' ? 'rte-tool-btn is-active' : 'rte-tool-btn'}
              onClick={() => setModal(modal === 'chars' ? null : 'chars')}
              title="Insert Special Characters"
              aria-label="Special Characters"
            >
              <Omega size={15} />
            </button>
            <button
              type="button"
              className={editor.isActive('codeBlock') ? 'rte-tool-btn is-active' : 'rte-tool-btn'}
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              title="Code Block"
              aria-label="Code Block"
            >
              <Code size={15} />
            </button>
            <button
              type="button"
              className="rte-tool-btn"
              onClick={() => editor.chain().focus().insertContent({ type: 'jumpBreak' }).run()}
              title="Insert Jump Break (Read More)"
              aria-label="Insert Jump Break"
            >
              <Scissors size={15} />
            </button>

            <span className="rte-divider" aria-hidden="true" />

            {/* 5. Alignment & Lists */}
            <button
              type="button"
              className={editor.isActive({ textAlign: 'left' }) ? 'rte-tool-btn is-active' : 'rte-tool-btn'}
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              title="Align Left"
              aria-label="Align Left"
            >
              <AlignLeft size={15} />
            </button>
            <button
              type="button"
              className={editor.isActive({ textAlign: 'center' }) ? 'rte-tool-btn is-active' : 'rte-tool-btn'}
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              title="Align Center"
              aria-label="Align Center"
            >
              <AlignCenter size={15} />
            </button>
            <button
              type="button"
              className={editor.isActive({ textAlign: 'right' }) ? 'rte-tool-btn is-active' : 'rte-tool-btn'}
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              title="Align Right"
              aria-label="Align Right"
            >
              <AlignRight size={15} />
            </button>
            <button
              type="button"
              className={editor.isActive({ textAlign: 'justify' }) ? 'rte-tool-btn is-active' : 'rte-tool-btn'}
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
              title="Justify"
              aria-label="Justify"
            >
              <AlignJustify size={15} />
            </button>
            <button
              type="button"
              className={editor.isActive('bulletList') ? 'rte-tool-btn is-active' : 'rte-tool-btn'}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title="Bulleted List"
              aria-label="Bulleted List"
            >
              <List size={15} />
            </button>
            <button
              type="button"
              className={editor.isActive('orderedList') ? 'rte-tool-btn is-active' : 'rte-tool-btn'}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              title="Numbered List"
              aria-label="Numbered List"
            >
              <ListOrdered size={15} />
            </button>

            <span className="rte-divider" aria-hidden="true" />

            {/* 6. Blockquote, Horizontal line, Clear formatting, Input tools / Spellcheck */}
            <button
              type="button"
              className={editor.isActive('blockquote') ? 'rte-tool-btn is-active' : 'rte-tool-btn'}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              title="Blockquote"
              aria-label="Blockquote"
            >
              <Quote size={15} />
            </button>
            <button
              type="button"
              className="rte-tool-btn"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              title="Insert Horizontal Line"
              aria-label="Horizontal Line"
            >
              <Minus size={15} />
            </button>
            <button
              type="button"
              className="rte-tool-btn"
              onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
              title="Clear Formatting"
              aria-label="Clear Formatting"
            >
              <Eraser size={15} />
            </button>
            <button
              type="button"
              className={spellcheck ? 'rte-tool-btn is-active' : 'rte-tool-btn'}
              onClick={() => setSpellcheck((prev) => !prev)}
              title={`Spellcheck: ${spellcheck ? 'On' : 'Off'}`}
              aria-label="Toggle Spellcheck"
            >
              <SpellCheck size={15} />
            </button>
            <button
              type="button"
              className={inputLang === 'hi' ? 'rte-tool-btn is-active' : 'rte-tool-btn'}
              onClick={() => setInputLang((prev) => (prev === 'hi' ? 'en-hi' : 'hi'))}
              title={`Input Language Hint: ${inputLang === 'hi' ? 'Hindi (hi)' : 'English + Hindi'}`}
              aria-label="Input Tools Language"
            >
              <Languages size={15} />
            </button>

            <span className="rte-divider" aria-hidden="true" />

            {/* 7. Latest Tools: Table, Math/LaTeX, Find & Replace, Fullscreen */}
            <button
              type="button"
              className="rte-tool-btn"
              onClick={() =>
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
              }
              title="Insert 3x3 Table"
              aria-label="Insert Table"
            >
              <TableIcon size={15} />
            </button>
            {editor.isActive('table') ? (
              <>
                <button
                  type="button"
                  className="rte-tool-btn"
                  onClick={() => editor.chain().focus().addRowAfter().run()}
                  title="Add Table Row"
                  aria-label="Add Table Row"
                >
                  <PlusSquare size={15} />
                </button>
                <button
                  type="button"
                  className="rte-tool-btn"
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  title="Delete Table"
                  aria-label="Delete Table"
                >
                  <Trash2 size={15} />
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="rte-tool-btn"
              onClick={() => setModal(modal === 'math' ? null : 'math')}
              title="Insert LaTeX Math Formula"
              aria-label="Insert Math Formula"
            >
              <Sigma size={15} />
            </button>
            <button
              type="button"
              className={modal === 'find' ? 'rte-tool-btn is-active' : 'rte-tool-btn'}
              onClick={() => setModal(modal === 'find' ? null : 'find')}
              title="Find & Replace"
              aria-label="Find and Replace"
            >
              <Search size={15} />
            </button>
            <button
              type="button"
              className={fullscreen ? 'rte-tool-btn is-active' : 'rte-tool-btn'}
              onClick={() => setFullscreen((prev) => !prev)}
              title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen Focus Mode'}
              aria-label="Toggle Fullscreen"
            >
              {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </div>
        ) : null}
      </div>

      {/* Inline Modals */}
      {modal === 'link' ? (
        <form className="rte-inline-modal" onSubmit={applyLink}>
          <input
            type="url"
            placeholder="https://swadhyay.in/#/..."
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            autoFocus
          />
          <button type="submit" className="admin-pill-link is-primary">
            Apply Link
          </button>
          <button type="button" className="admin-pill-link" onClick={() => setModal(null)}>
            Cancel
          </button>
        </form>
      ) : null}

      {modal === 'image' ? (
        <form className="rte-inline-modal is-stacked" onSubmit={applyImage}>
          <div className="rte-modal-row">
            <input
              type="url"
              required
              placeholder="Image URL (from Cloudflare R2 or external)"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              autoFocus
            />
            <button
              type="button"
              className="admin-pill-link"
              onClick={() => setMediaPickerOpen(true)}
            >
              Choose from Media Library
            </button>
          </div>
          <div className="rte-modal-row">
            <input
              type="text"
              placeholder="Alt text (accessibility & SEO)"
              value={imageAlt}
              onChange={(event) => setImageAlt(event.target.value)}
            />
            <input
              type="text"
              placeholder="Optional caption"
              value={imageCaption}
              onChange={(event) => setImageCaption(event.target.value)}
            />
            <select value={imageWidth} onChange={(event) => setImageWidth(event.target.value)}>
              <option value="100%">Full Width (100%)</option>
              <option value="75%">Large (75%)</option>
              <option value="50%">Medium (50%)</option>
              <option value="320px">Compact (320px)</option>
            </select>
          </div>
          <div className="rte-modal-actions">
            <button type="submit" className="admin-pill-link is-primary">
              Insert Image
            </button>
            <button type="button" className="admin-pill-link" onClick={() => setModal(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {modal === 'video' ? (
        <form className="rte-inline-modal" onSubmit={applyVideo}>
          <input
            type="url"
            required
            placeholder="Paste YouTube, Vimeo, or MP4 video URL..."
            value={videoUrl}
            onChange={(event) => setVideoUrl(event.target.value)}
            autoFocus
          />
          <button type="submit" className="admin-pill-link is-primary">
            Insert Video
          </button>
          <button type="button" className="admin-pill-link" onClick={() => setModal(null)}>
            Cancel
          </button>
        </form>
      ) : null}

      {modal === 'chars' ? (
        <div className="rte-inline-modal is-stacked">
          {SPECIAL_CHAR_GROUPS.map((group) => (
            <div key={group.label} className="rte-chars-group">
              <span className="rte-chars-label">{group.label}</span>
              <div className="rte-chars-grid">
                {group.chars.map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    className="rte-char-btn"
                    onClick={() => {
                      editor?.chain().focus().insertContent(ch).run()
                    }}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="rte-modal-actions">
            <button type="button" className="admin-pill-link" onClick={() => setModal(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {mediaPickerOpen ? (
        <div className="media-modal-backdrop" role="dialog" aria-modal="true">
          <div className="media-modal-card is-wide">
            <div className="cms-card-head">
              <h2>Select Media from Cloudflare R2</h2>
              <button
                type="button"
                className="admin-pill-link"
                onClick={() => setMediaPickerOpen(false)}
              >
                Close
              </button>
            </div>
            <MediaLibrary
              compact
              onSelectMedia={(item) => {
                setImageUrl(item.url)
                if (!imageAlt) setImageAlt(item.name || '')
                setMediaPickerOpen(false)
              }}
            />
          </div>
        </div>
      ) : null}

      {modal === 'math' ? (
        <form className="rte-inline-modal is-stacked" onSubmit={applyMath}>
          <div className="rte-modal-row">
            <input
              type="text"
              required
              placeholder="LaTeX expression (e.g. E = mc^2 or \frac{a}{b})"
              value={mathExpr}
              onChange={(event) => setMathExpr(event.target.value)}
              autoFocus
            />
            <label className="cms-checkbox">
              <input
                type="checkbox"
                checked={mathDisplay}
                onChange={(event) => setMathDisplay(event.target.checked)}
              />
              <span>Block equation ($$...$$)</span>
            </label>
          </div>
          <div className="rte-math-samples">
            {MATH_SAMPLES.map((sample) => (
              <button
                key={sample.label}
                type="button"
                className="cms-chip-btn"
                onClick={() => setMathExpr(sample.latex)}
              >
                {sample.label}
              </button>
            ))}
          </div>
          {mathPreviewHtml ? (
            <div
              className="rte-math-preview"
              dangerouslySetInnerHTML={{ __html: mathPreviewHtml }}
            />
          ) : null}
          <div className="rte-modal-actions">
            <button type="submit" className="admin-pill-link is-primary">
              Insert Equation
            </button>
            <button type="button" className="admin-pill-link" onClick={() => setModal(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {modal === 'find' ? (
        <form className="rte-inline-modal" onSubmit={handleFindReplaceAll}>
          <input
            type="text"
            required
            placeholder="Find text..."
            value={findQuery}
            onChange={(event) => setFindQuery(event.target.value)}
            autoFocus
          />
          <input
            type="text"
            placeholder="Replace with..."
            value={replaceQuery}
            onChange={(event) => setReplaceQuery(event.target.value)}
          />
          <button type="submit" className="admin-pill-link is-primary">
            Replace All
          </button>
          <button type="button" className="admin-pill-link" onClick={() => setModal(null)}>
            Close
          </button>
        </form>
      ) : null}

      <div className="rte-body">
        {mode === 'visual' ? (
          <EditorContent editor={editor} className="rte-editor-surface" />
        ) : null}
        {mode === 'html' ? (
          <textarea
            className="rte-html-source"
            value={value || ''}
            onChange={(event) => onChange(event.target.value)}
            spellCheck={false}
          />
        ) : null}
        {mode === 'preview' ? (
          <div
            className="rte-preview-surface article-prose"
            dangerouslySetInnerHTML={{ __html: previewHtml || '<p>Nothing to preview yet.</p>' }}
          />
        ) : null}
      </div>

      <div className="rte-statusbar">
        <span>{stats.words} words</span>
        <span>·</span>
        <span>{stats.chars} characters</span>
        <span>·</span>
        <span>~{stats.minutes} min read</span>
        <span className="rte-status-right">
          Spellcheck: {spellcheck ? 'On' : 'Off'} · Input: {inputLang === 'hi' ? 'Hindi (hi)' : 'EN/HI'}
        </span>
      </div>
    </div>
  )
}
