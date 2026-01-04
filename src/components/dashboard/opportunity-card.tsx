"use client"

import type { GHLOpportunity } from "@/types/database"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DollarSign, User, GripVertical } from "lucide-react"

interface OpportunityCardProps {
  opportunity: GHLOpportunity
  onClick?: () => void
  isDragging?: boolean
  onDragStart?: () => void
  onDragEnd?: () => void
}

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  won: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  lost: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  abandoned: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
}

export function OpportunityCard({
  opportunity,
  onClick,
  isDragging,
  onDragStart,
  onDragEnd,
}: OpportunityCardProps) {
  const formatCurrency = (value: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        isDragging && "opacity-50 rotate-2 shadow-lg"
      )}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("opportunityId", opportunity.id)
        e.dataTransfer.setData("currentStageId", opportunity.pipeline_stage_id)
        onDragStart?.()
      }}
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 cursor-grab" />
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{opportunity.name}</h4>

            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center text-sm text-muted-foreground">
                <DollarSign className="h-3 w-3 mr-0.5" />
                <span className="font-medium text-foreground">
                  {formatCurrency(opportunity.monetary_value, opportunity.currency)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2">
              <Badge
                variant="secondary"
                className={cn("text-xs", statusColors[opportunity.status])}
              >
                {opportunity.status.charAt(0).toUpperCase() + opportunity.status.slice(1)}
              </Badge>
              {opportunity.assigned_to && (
                <div className="flex items-center text-xs text-muted-foreground">
                  <User className="h-3 w-3 mr-1" />
                  <span className="truncate max-w-[80px]">{opportunity.assigned_to}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
