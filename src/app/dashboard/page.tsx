"use client"

import { useDashboardStats, useRecentActivity } from "@/hooks/use-dashboard-stats"
import { Header } from "@/components/dashboard/header"
import { StatsCard, StatsCardGrid } from "@/components/dashboard/stats-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Users,
  DollarSign,
  Calendar,
  MessageSquare,
  FileText,
  TrendingUp,
  Clock,
} from "lucide-react"

export default function DashboardPage() {
  const { stats, loading: statsLoading } = useDashboardStats()
  const { activity, loading: activityLoading } = useRecentActivity()

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return "Today"
    } else if (diffDays === 1) {
      return "Yesterday"
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    }
  }

  const statusColors: Record<string, string> = {
    open: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    won: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    lost: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    abandoned: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Overview"
        description="Welcome back! Here's what's happening with your CRM."
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Stats Cards */}
        <StatsCardGrid>
          <StatsCard
            title="Total Contacts"
            value={statsLoading ? "..." : stats.totalContacts.toLocaleString()}
            icon={Users}
            loading={statsLoading}
          />
          <StatsCard
            title="Pipeline Value"
            value={statsLoading ? "..." : formatCurrency(stats.pipelineValue)}
            icon={DollarSign}
            loading={statsLoading}
          />
          <StatsCard
            title="Upcoming Appointments"
            value={statsLoading ? "..." : stats.upcomingAppointments}
            description="Next 7 days"
            icon={Calendar}
            loading={statsLoading}
          />
          <StatsCard
            title="Unread Conversations"
            value={statsLoading ? "..." : stats.unreadConversations}
            icon={MessageSquare}
            loading={statsLoading}
          />
          <StatsCard
            title="Overdue Invoices"
            value={statsLoading ? "..." : stats.overdueInvoices}
            icon={FileText}
            loading={statsLoading}
          />
        </StatsCardGrid>

        {/* Recent Activity */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Recent Contacts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                Recent Contacts
              </CardTitle>
              <CardDescription>Latest contacts added to your CRM</CardDescription>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              ) : activity.recentContacts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No recent contacts</p>
                </div>
              ) : (
                <ScrollArea className="h-[280px]">
                  <div className="space-y-4 pr-4">
                    {activity.recentContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {contact.name || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {contact.email || "No email"}
                          </p>
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatDate(contact.date_added)}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Recent Opportunities */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                Recent Opportunities
              </CardTitle>
              <CardDescription>Latest deals in your pipeline</CardDescription>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-5 w-16" />
                    </div>
                  ))}
                </div>
              ) : activity.recentOpportunities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No recent opportunities</p>
                </div>
              ) : (
                <ScrollArea className="h-[280px]">
                  <div className="space-y-4 pr-4">
                    {activity.recentOpportunities.map((opportunity) => (
                      <div
                        key={opportunity.id}
                        className="flex items-center justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {opportunity.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(opportunity.monetary_value)}
                          </p>
                        </div>
                        <Badge
                          variant="secondary"
                          className={statusColors[opportunity.status] || ""}
                        >
                          {opportunity.status.charAt(0).toUpperCase() +
                            opportunity.status.slice(1)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
