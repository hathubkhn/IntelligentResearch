'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import {
  AI_METHODS, APPLICATION_DOMAINS, RESEARCH_TASKS,
  type FilterOption,
} from '@/lib/discover-config'

interface Props {
  selectedMethods: string[]
  selectedDomains: string[]
  selectedTasks: string[]
  customKeywords: string
  onMethodsChange: (v: string[]) => void
  onDomainsChange: (v: string[]) => void
  onTasksChange: (v: string[]) => void
  onCustomKeywordsChange: (v: string) => void
}

function TagSelector({
  label,
  options,
  selected,
  onChange,
  accent,
}: {
  label: string
  options: FilterOption[]
  selected: string[]
  onChange: (v: string[]) => void
  accent: string
}) {
  const [expanded, setExpanded] = useState(true)

  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt])
  }

  return (
    <div className="border border-white/8 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
      >
        <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">{label}</span>
        <div className="flex items-center gap-1.5">
          {selected.length > 0 && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${accent}`}>
              {selected.length}
            </span>
          )}
          {expanded
            ? <ChevronUp className="h-3 w-3 text-white/30" />
            : <ChevronDown className="h-3 w-3 text-white/30" />}
        </div>
      </button>
      {expanded && (
        <div className="p-2.5 flex flex-wrap gap-1.5">
          {options.map(opt => (
            <button
              key={opt.label}
              type="button"
              onClick={() => toggle(opt.label)}
              className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                selected.includes(opt.label)
                  ? `${accent} border-current`
                  : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function DiscoverFilterPanel({
  selectedMethods, selectedDomains, selectedTasks, customKeywords,
  onMethodsChange, onDomainsChange, onTasksChange, onCustomKeywordsChange,
}: Props) {
  const totalSelected = selectedMethods.length + selectedDomains.length + selectedTasks.length
  const hasSelections = totalSelected > 0

  const clearAll = () => {
    onMethodsChange([])
    onDomainsChange([])
    onTasksChange([])
    onCustomKeywordsChange('')
  }

  return (
    <div className="space-y-2">
      {/* Clear all button */}
      {hasSelections && (
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[10px] text-white/30">{totalSelected} filter{totalSelected !== 1 ? 's' : ''} active</span>
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors"
          >
            <X className="h-3 w-3" /> Clear all
          </button>
        </div>
      )}

      <TagSelector
        label="AI Method"
        options={AI_METHODS}
        selected={selectedMethods}
        onChange={onMethodsChange}
        accent="bg-blue-500/15 text-blue-300 border-blue-500/30"
      />
      <TagSelector
        label="Application Domain"
        options={APPLICATION_DOMAINS}
        selected={selectedDomains}
        onChange={onDomainsChange}
        accent="bg-violet-500/15 text-violet-300 border-violet-500/30"
      />
      <TagSelector
        label="Research Task"
        options={RESEARCH_TASKS}
        selected={selectedTasks}
        onChange={onTasksChange}
        accent="bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      />

      <div>
        <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1.5 mt-1 px-0.5">
          Additional Keywords <span className="text-white/20 font-normal normal-case">(optional)</span>
        </label>
        <textarea
          value={customKeywords}
          onChange={e => onCustomKeywordsChange(e.target.value)}
          rows={2}
          placeholder="Add custom terms or override with your own query…"
          className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 resize-none"
        />
      </div>
    </div>
  )
}
