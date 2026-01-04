"use client"

import { useState, useEffect, useCallback } from "react"
import type { GHLContact } from "@/types/database"

interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface UseContactsOptions {
  page?: number
  limit?: number
  searchQuery?: string
  tags?: string[]
}

interface UseContactsReturn {
  data: GHLContact[]
  loading: boolean
  error: string | null
  meta: PaginationMeta
  refetch: () => void
}

export function useContacts(options: UseContactsOptions = {}): UseContactsReturn {
  const { page = 1, limit = 20, searchQuery, tags } = options
  const [data, setData] = useState<GHLContact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      let url: string

      if (searchQuery) {
        url = `/api/contacts/search?q=${encodeURIComponent(searchQuery)}`
      } else if (tags && tags.length > 0) {
        url = `/api/contacts/by-tags?tags=${encodeURIComponent(tags.join(","))}`
      } else {
        url = `/api/contacts?page=${page}&limit=${limit}`
      }

      const response = await fetch(url)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
        if (result.meta) {
          setMeta(result.meta)
        } else {
          setMeta({
            page: 1,
            limit: result.data.length,
            total: result.data.length,
            totalPages: 1,
          })
        }
      } else {
        setError(result.error?.message || "Failed to fetch contacts")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [page, limit, searchQuery, tags])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  return { data, loading, error, meta, refetch: fetchContacts }
}

export function useContact(id: string | null) {
  const [data, setData] = useState<GHLContact | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setData(null)
      return
    }

    const fetchContact = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/contacts/${id}`)
        const result = await response.json()

        if (result.success) {
          setData(result.data)
        } else {
          setError(result.error?.message || "Failed to fetch contact")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchContact()
  }, [id])

  return { data, loading, error }
}
