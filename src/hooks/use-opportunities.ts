"use client"

import { useState, useEffect, useCallback } from "react"
import type { GHLOpportunity } from "@/types/database"

interface UseOpportunitiesOptions {
  pipelineId?: string | null
  stageId?: string | null
}

interface UseOpportunitiesReturn {
  data: GHLOpportunity[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useOpportunities(options: UseOpportunitiesOptions = {}): UseOpportunitiesReturn {
  const { pipelineId, stageId } = options
  const [data, setData] = useState<GHLOpportunity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchOpportunities = useCallback(async () => {
    if (!pipelineId) {
      setData([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      let url = `/api/opportunities?pipeline_id=${pipelineId}`
      if (stageId) {
        url += `&stage_id=${stageId}`
      }

      const response = await fetch(url)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        setError(result.error?.message || "Failed to fetch opportunities")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [pipelineId, stageId])

  useEffect(() => {
    fetchOpportunities()
  }, [fetchOpportunities])

  return { data, loading, error, refetch: fetchOpportunities }
}

interface TotalValueReturn {
  totalValue: number
  loading: boolean
  error: string | null
}

export function useOpportunitiesTotalValue(locationId?: string): TotalValueReturn {
  const [totalValue, setTotalValue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTotalValue = async () => {
      setLoading(true)
      setError(null)

      try {
        let url = "/api/opportunities/total-value"
        if (locationId) {
          url += `?location_id=${locationId}`
        }

        const response = await fetch(url)
        const result = await response.json()

        if (result.success) {
          setTotalValue(result.data.totalValue || 0)
        } else {
          setError(result.error?.message || "Failed to fetch total value")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchTotalValue()
  }, [locationId])

  return { totalValue, loading, error }
}
