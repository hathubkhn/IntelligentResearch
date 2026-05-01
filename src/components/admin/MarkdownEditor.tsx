'use client'

import { useState, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Bold, Italic, Heading1, Heading2, Heading3,
  Code, Quote, List, ListOrdered, Link2, ImageIcon, Minus,
} from 'lucide-react'

interface Props {
  value: string
  onChange: (v: string) => void
  minRows?: number
}

export function MarkdownEditor({ value, onChange, minRows = 24 }: Props) {
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const ref = useRef<HTMLTextAreaElement>(null)

  const insert = useCallback((before: string, after = '', placeholder = '') => {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const sel = el.value.slice(start, end)
    const text = sel || placeholder
    const next = el.value.slice(0, start) + before + text + after + el.value.slice(end)
    onChange(next)
    setTimeout(() => {
      el.focus()
      el.selectionStart = start + before.length
      el.selectionEnd = start + before.length + text.length
    }, 0)
  }, [onChange])

  const wordCount = value.split(/\s+/).filter(Boolean).length
  const readTime = Math.max(1, Math.ceil(wordCount / 200))

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b border-white/10 px-3 py-2 flex-wrap bg-white/[0.01]">
        <TabBtn active={tab === 'write'} onClick={() => setTab('write')}>Write</TabBtn>
        <TabBtn active={tab === 'preview'} onClick={() => setTab('preview')}>Preview</TabBtn>

        {tab === 'write' && (
          <>
            <div className="w-px h-4 bg-white/10 mx-1.5" />
            <Btn title="Bold" onClick={() => insert('**', '**', 'bold text')}><Bold className="h-3.5 w-3.5" /></Btn>
            <Btn title="Italic" onClick={() => insert('*', '*', 'italic text')}><Italic className="h-3.5 w-3.5" /></Btn>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <Btn title="Heading 1" onClick={() => insert('\n# ', '', 'Heading')}><Heading1 className="h-3.5 w-3.5" /></Btn>
            <Btn title="Heading 2" onClick={() => insert('\n## ', '', 'Heading')}><Heading2 className="h-3.5 w-3.5" /></Btn>
            <Btn title="Heading 3" onClick={() => insert('\n### ', '', 'Heading')}><Heading3 className="h-3.5 w-3.5" /></Btn>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <Btn title="Inline code" onClick={() => insert('`', '`', 'code')}><Code className="h-3.5 w-3.5" /></Btn>
            <Btn title="Blockquote" onClick={() => insert('\n> ', '', 'quote')}><Quote className="h-3.5 w-3.5" /></Btn>
            <Btn title="Bullet list" onClick={() => insert('\n- ', '', 'item')}><List className="h-3.5 w-3.5" /></Btn>
            <Btn title="Numbered list" onClick={() => insert('\n1. ', '', 'item')}><ListOrdered className="h-3.5 w-3.5" /></Btn>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <Btn title="Link" onClick={() => insert('[', '](url)', 'link text')}><Link2 className="h-3.5 w-3.5" /></Btn>
            <Btn title="Image" onClick={() => insert('![', '](url)', 'alt text')}><ImageIcon className="h-3.5 w-3.5" /></Btn>
            <Btn title="Divider" onClick={() => insert('\n\n---\n\n')}><Minus className="h-3.5 w-3.5" /></Btn>
          </>
        )}

        <span className="ml-auto text-[10px] text-white/20 pr-1">
          {wordCount} words · {readTime} min
        </span>
      </div>

      {tab === 'write' ? (
        <textarea
          ref={ref}
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={minRows}
          placeholder="Write your post here using Markdown…

# Use headings to structure
Write paragraphs naturally. **Bold** and *italic* for emphasis.

- Bullet lists
- Work great

> Blockquotes for notable quotes or callouts

```js
// Code blocks with syntax
const x = 1
```"
          className="w-full bg-transparent px-5 py-4 text-sm text-white/80 placeholder:text-white/15 focus:outline-none resize-y font-mono leading-relaxed"
        />
      ) : (
        <div className="px-6 py-6 min-h-[400px] blog-prose">
          {value.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          ) : (
            <p className="text-white/20 text-sm italic">Nothing to preview yet…</p>
          )}
        </div>
      )}
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 text-xs rounded-md transition-colors ${active ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
    >
      {children}
    </button>
  )
}

function Btn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
    >
      {children}
    </button>
  )
}
