"use client"

import { useState, useEffect, useCallback } from "react"
import type { GHLPipeline, GHLPipelineStage } from "@/types/database"

interface UsePipelinesReturn {
  data: GHLPipeline[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function usePipelines(): UsePipelinesReturn {
  const [data, setData] = useState<GHLPipeline[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPipelines = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/pipelines")
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        setError(result.error?.message || "Failed to fetch pipelines")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPipelines()
  }, [fetchPipelines])

  return { data, loading, error, refetch: fetchPipelines }
}

interface UsePipelineStagesReturn {
  data: GHLPipelineStage[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function usePipelineStages(pipelineId: string | null): UsePipelineStagesReturn {
  const [data, setData] = useState<GHLPipelineStage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStages = useCallback(async () => {
    if (!pipelineId) {
      setData([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/pipeline-stages?pipeline_id=${pipelineId}`)
      const result = await response.json()

      if (result.success) {
        // Sort stages by position
        const sortedStages = [...result.data].sort((a, b) => a.position - b.position)
        setData(sortedStages)
      } else {
        setError(result.error?.message || "Failed to fetch pipeline stages")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [pipelineId])

  useEffect(() => {
    fetchStages()
  }, [fetchStages])

  return { data, loading, error, refetch: fetchStages }
}
