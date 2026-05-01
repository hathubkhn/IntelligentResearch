'use client'

import { WORKSPACES, type Workspace, type SubTopic } from '@/lib/discover-config'
import { ArrowRight } from 'lucide-react'

interface Props {
  onSelectWorkspace: (workspace: Workspace, subtopic?: SubTopic) => void
}

export function WorkspaceGrid({ onSelectWorkspace }: Props) {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-lg font-bold text-white mb-1">Domain Workspaces</h2>
        <p className="text-sm text-white/40">
          Pre-configured search environments for specific research domains.
          Select a workspace or a specific subtopic to start discovering.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {WORKSPACES.map(workspace => (
          <div
            key={workspace.id}
            className={`rounded-2xl border bg-gradient-to-br p-5 ${workspace.color}`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xl">{workspace.icon}</span>
                  <h3 className="text-sm font-bold text-white">{workspace.title}</h3>
                </div>
                <p className="text-[11px] text-white/45 leading-relaxed">{workspace.tagline}</p>
              </div>
              <button
                onClick={() => onSelectWorkspace(workspace)}
                className="flex-shrink-0 ml-3 flex items-center gap-1 text-[10px] text-white/50 hover:text-white border border-white/15 hover:border-white/30 px-2.5 py-1 rounded-full transition-colors"
              >
                All topics <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            {/* Subtopics */}
            <div className="flex flex-wrap gap-1.5">
              {workspace.subtopics.map(sub => (
                <button
                  key={sub.label}
                  onClick={() => onSelectWorkspace(workspace, sub)}
                  className="text-[10px] px-2.5 py-1 rounded-full bg-white/8 border border-white/12 text-white/60 hover:bg-white/15 hover:text-white hover:border-white/25 transition-colors"
                >
                  {sub.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
