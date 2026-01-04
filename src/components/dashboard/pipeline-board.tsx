"use client"

import { useState, useCallback } from "react"
import type { GHLOpportunity, GHLPipelineStage } from "@/types/database"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { OpportunityCard } from "./opportunity-card"
import { Plus } from "lucide-react"
import { toast } from "sonner"

interface PipelineBoardProps {
  stages: GHLPipelineStage[]
  opportunities: GHLOpportunity[]
  loading?: boolean
  onOpportunityClick?: (opportunity: GHLOpportunity) => void
  onAddOpportunity?: (stageId: string) => void
  onOpportunityMoved?: () => void
}

export function PipelineBoard({
  stages,
  opportunities,
  loading,
  onOpportunityClick,
  onAddOpportunity,
  onOpportunityMoved,
}: PipelineBoardProps) {
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null)
  const [isMoving, setIsMoving] = useState(false)

  const getOpportunitiesForStage = (stageId: string) => {
    return opportunities.filter((opp) => opp.pipeline_stage_id === stageId)
  }

  const getStageValue = (stageId: string) => {
    return getOpportunitiesForStage(stageId).reduce(
      (sum, opp) => sum + opp.monetary_value,
      0
    )
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const handleDragOver = useCallback((e: React.DragEvent, stageId: string) => {
    e.preventDefault()
    setDragOverStageId(stageId)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverStageId(null)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetStageId: string) => {
      e.preventDefault()
      setDragOverStageId(null)

      const opportunityId = e.dataTransfer.getData("opportunityId")
      const currentStageId = e.dataTransfer.getData("currentStageId")

      if (!opportunityId || currentStageId === targetStageId) {
        return
      }

      setIsMoving(true)

      try {
        const response = await fetch(`/api/opportunities/${opportunityId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pipeline_stage_id: targetStageId }),
        })

        const result = await response.json()

        if (result.success) {
          toast.success("Opportunity moved successfully")
          onOpportunityMoved?.()
        } else {
          toast.error(result.error?.message || "Failed to move opportunity")
        }
      } catch (error) {
        toast.error("Failed to move opportunity")
      } finally {
        setIsMoving(false)
      }
    },
    [onOpportunityMoved]
  )

  if (loading) {
    return (
      <div className="flex gap-4 p-4 overflow-x-auto">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-72">
            <Card>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-16 mt-1" />
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className="h-24 w-full" />
                ))}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    )
  }

  if (stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-3 mb-4">
          <Plus className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">No pipeline stages</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Select a pipeline to view its stages and opportunities.
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 p-4 min-w-max">
        {stages.map((stage) => {
          const stageOpportunities = getOpportunitiesForStage(stage.id)
          const stageValue = getStageValue(stage.id)
          const isDropTarget = dragOverStageId === stage.id

          return (
            <div
              key={stage.id}
              className="flex-shrink-0 w-72"
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              <Card
                className={cn(
                  "transition-colors h-full",
                  isDropTarget && "ring-2 ring-primary bg-primary/5"
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      {stage.name}
                      <Badge variant="secondary" className="text-xs">
                        {stageOpportunities.length}
                      </Badge>
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onAddOpportunity?.(stage.id)}
                    >
                      <Plus className="h-4 w-4" />
                      <span className="sr-only">Add opportunity</span>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(stageValue)}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 min-h-[200px]">
                  {stageOpportunities.length === 0 ? (
                    <div
                      className={cn(
                        "flex items-center justify-center h-24 border-2 border-dashed rounded-lg text-sm text-muted-foreground",
                        isDropTarget && "border-primary bg-primary/10"
                      )}
                    >
                      Drop here
                    </div>
                  ) : (
                    stageOpportunities.map((opportunity) => (
                      <OpportunityCard
                        key={opportunity.id}
                        opportunity={opportunity}
                        onClick={() => onOpportunityClick?.(opportunity)}
                      />
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
