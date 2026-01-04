"use client"

import { useState, useEffect } from "react"
import { usePipelines, usePipelineStages } from "@/hooks/use-pipelines"
import { useOpportunities } from "@/hooks/use-opportunities"
import type { GHLOpportunity } from "@/types/database"
import { Header } from "@/components/dashboard/header"
import { PipelineBoard } from "@/components/dashboard/pipeline-board"
import {
  OpportunityForm,
  OpportunityDetailsSheet,
} from "@/components/dashboard/opportunity-form"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Kanban } from "lucide-react"

export default function PipelinesPage() {
  // Pipeline selection
  const { data: pipelines, loading: pipelinesLoading } = usePipelines()
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)

  // Auto-select first pipeline
  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
      setSelectedPipelineId(pipelines[0].id)
    }
  }, [pipelines, selectedPipelineId])

  // Fetch stages and opportunities for selected pipeline
  const { data: stages, loading: stagesLoading } = usePipelineStages(selectedPipelineId)
  const {
    data: opportunities,
    loading: opportunitiesLoading,
    refetch: refetchOpportunities,
  } = useOpportunities({ pipelineId: selectedPipelineId })

  // Form states
  const [formOpen, setFormOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [editingOpportunity, setEditingOpportunity] = useState<GHLOpportunity | null>(null)
  const [viewingOpportunity, setViewingOpportunity] = useState<GHLOpportunity | null>(null)
  const [defaultStageId, setDefaultStageId] = useState<string | undefined>()

  const handleAddOpportunity = (stageId?: string) => {
    setEditingOpportunity(null)
    setDefaultStageId(stageId)
    setFormOpen(true)
  }

  const handleEditOpportunity = (opportunity: GHLOpportunity) => {
    setEditingOpportunity(opportunity)
    setDefaultStageId(undefined)
    setDetailsOpen(false)
    setFormOpen(true)
  }

  const handleViewOpportunity = (opportunity: GHLOpportunity) => {
    setViewingOpportunity(opportunity)
    setDetailsOpen(true)
  }

  const handleFormSuccess = () => {
    refetchOpportunities()
  }

  const handleOpportunityMoved = () => {
    refetchOpportunities()
  }

  const isLoading = pipelinesLoading || stagesLoading || opportunitiesLoading

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Pipelines"
        description="Manage your sales pipeline and opportunities"
        actions={
          <Button onClick={() => handleAddOpportunity()} disabled={!selectedPipelineId}>
            <Plus className="mr-2 h-4 w-4" />
            Add Opportunity
          </Button>
        }
      />

      <div className="flex-1 flex flex-col">
        {/* Pipeline Selector */}
        <div className="border-b bg-card px-6 py-3">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-muted-foreground">
              Pipeline:
            </label>
            {pipelinesLoading ? (
              <Skeleton className="h-9 w-[200px]" />
            ) : pipelines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pipelines available</p>
            ) : (
              <Select
                value={selectedPipelineId || ""}
                onValueChange={setSelectedPipelineId}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Pipeline Board */}
        <div className="flex-1 overflow-hidden">
          {!selectedPipelineId ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Kanban className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No pipeline selected</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Select a pipeline from the dropdown above to view and manage your
                opportunities.
              </p>
            </div>
          ) : (
            <PipelineBoard
              stages={stages}
              opportunities={opportunities}
              loading={isLoading}
              onOpportunityClick={handleViewOpportunity}
              onAddOpportunity={handleAddOpportunity}
              onOpportunityMoved={handleOpportunityMoved}
            />
          )}
        </div>
      </div>

      {/* Opportunity Form Sheet */}
      {selectedPipelineId && (
        <OpportunityForm
          open={formOpen}
          onOpenChange={setFormOpen}
          opportunity={editingOpportunity}
          pipelineId={selectedPipelineId}
          stages={stages}
          defaultStageId={defaultStageId}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Opportunity Details Sheet */}
      <OpportunityDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        opportunity={viewingOpportunity}
        onEdit={handleEditOpportunity}
      />
    </div>
  )
}
