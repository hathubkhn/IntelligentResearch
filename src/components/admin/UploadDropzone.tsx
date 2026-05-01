'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileJson, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UploadDropzoneProps {
  onFileParsed: (data: unknown) => void
  collectionName: string
}

export function UploadDropzone({ onFileParsed, collectionName }: UploadDropzoneProps) {
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (!file) return
      setError(null)

      try {
        const text = await file.text()
        const data = JSON.parse(text)

        const res = await fetch('/api/upload/json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data, collectionName }),
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error ?? 'Upload failed')
        }

        const result = await res.json()
        onFileParsed(result)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to parse file')
      }
    },
    [collectionName, onFileParsed]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/json': ['.json'] },
    maxFiles: 1,
  })

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-white/20 hover:border-white/40 bg-white/5'
        )}
      >
        <input {...getInputProps()} />
        <FileJson className="h-10 w-10 mx-auto mb-3 text-white/30" />
        <p className="text-white/60">
          {isDragActive ? 'Drop the JSON file here' : 'Drag & drop a .json file, or click to browse'}
        </p>
        <p className="text-xs text-white/30 mt-1">
          Expected format: array of {'{ title, authors, venue, year, paperUrl, codeUrl, category }'}
        </p>
        <div className="flex items-center justify-center gap-1.5 mt-4 text-xs text-white/40">
          <Upload className="h-3.5 w-3.5" /> JSON files only
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  )
}
