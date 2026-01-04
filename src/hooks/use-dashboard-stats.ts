"use client"

import { useState, useEffect, useCallback } from "react"

interface DashboardStats {
  totalContacts: number
  pipelineValue: number
  upcomingAppointments: number
  unreadConversations: number
  overdueInvoices: number
}

interface UseDashboardStatsReturn {
  stats: DashboardStats
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useDashboardStats(locationId?: string): UseDashboardStatsReturn {
  const [stats, setStats] = useState<DashboardStats>({
    totalContacts: 0,
    pipelineValue: 0,
    upcomingAppointments: 0,
    unreadConversations: 0,
    overdueInvoices: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch all stats in parallel
      const locationParam = locationId ? `?location_id=${locationId}` : ""

      const [
        contactsRes,
        pipelineValueRes,
        appointmentsRes,
        conversationsRes,
        invoicesRes,
      ] = await Promise.all([
        fetch(`/api/contacts?page=1&limit=1`),
        fetch(`/api/opportunities/total-value${locationParam}`),
        fetch(`/api/appointments?upcoming=true&days=7`),
        fetch(`/api/conversations?unread=true`),
        fetch(`/api/invoices?overdue=true`),
      ])

      const [
        contactsData,
        pipelineValueData,
        appointmentsData,
        conversationsData,
        invoicesData,
      ] = await Promise.all([
        contactsRes.json(),
        pipelineValueRes.json(),
        appointmentsRes.json(),
        conversationsRes.json(),
        invoicesRes.json(),
      ])

      setStats({
        totalContacts: contactsData.success ? (contactsData.meta?.total || 0) : 0,
        pipelineValue: pipelineValueData.success ? (pipelineValueData.data?.totalValue || 0) : 0,
        upcomingAppointments: appointmentsData.success ? (appointmentsData.data?.length || 0) : 0,
        unreadConversations: conversationsData.success ? (conversationsData.data?.length || 0) : 0,
        overdueInvoices: invoicesData.success ? (invoicesData.data?.length || 0) : 0,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch dashboard stats")
    } finally {
      setLoading(false)
    }
  }, [locationId])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return { stats, loading, error, refetch: fetchStats }
}

interface RecentActivity {
  recentContacts: Array<{
    id: string
    name: string | null
    email: string | null
    date_added: string
  }>
  recentOpportunities: Array<{
    id: string
    name: string
    monetary_value: number
    status: string
    created_at: string
  }>
}

interface UseRecentActivityReturn {
  activity: RecentActivity
  loading: boolean
  error: string | null
}

export function useRecentActivity(): UseRecentActivityReturn {
  const [activity, setActivity] = useState<RecentActivity>({
    recentContacts: [],
    recentOpportunities: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchActivity = async () => {
      setLoading(true)
      setError(null)

      try {
        const [contactsRes, opportunitiesRes] = await Promise.all([
          fetch("/api/contacts?page=1&limit=5"),
          fetch("/api/opportunities?page=1&limit=5"),
        ])

        const [contactsData, opportunitiesData] = await Promise.all([
          contactsRes.json(),
          opportunitiesRes.json(),
        ])

        setActivity({
          recentContacts: contactsData.success
            ? contactsData.data.map((c: { id: string; name: string | null; first_name: string | null; last_name: string | null; email: string | null; date_added: string }) => ({
                id: c.id,
                name: c.name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Unknown",
                email: c.email,
                date_added: c.date_added,
              }))
            : [],
          recentOpportunities: opportunitiesData.success
            ? opportunitiesData.data.map((o: { id: string; name: string; monetary_value: number; status: string; created_at: string }) => ({
                id: o.id,
                name: o.name,
                monetary_value: o.monetary_value,
                status: o.status,
                created_at: o.created_at,
              }))
            : [],
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch recent activity")
      } finally {
        setLoading(false)
      }
    }

    fetchActivity()
  }, [])

  return { activity, loading, error }
}
