"use client"

import { useState } from "react"
import type { GHLOpportunity, GHLPipelineStage } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface OpportunityFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  opportunity?: GHLOpportunity | null
  pipelineId: string
  stages: GHLPipelineStage[]
  defaultStageId?: string
  onSuccess?: () => void
}

interface FormData {
  name: string
  monetary_value: string
  status: "open" | "won" | "lost" | "abandoned"
  pipeline_stage_id: string
  notes: string
}

export function OpportunityForm({
  open,
  onOpenChange,
  opportunity,
  pipelineId,
  stages,
  defaultStageId,
  onSuccess,
}: OpportunityFormProps) {
  const isEditing = !!opportunity

  const [formData, setFormData] = useState<FormData>(() => ({
    name: opportunity?.name || "",
    monetary_value: opportunity?.monetary_value?.toString() || "",
    status: opportunity?.status || "open",
    pipeline_stage_id: opportunity?.pipeline_stage_id || defaultStageId || stages[0]?.id || "",
    notes: opportunity?.notes || "",
  }))
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error("Name is required")
      return
    }

    if (!formData.pipeline_stage_id) {
      toast.error("Pipeline stage is required")
      return
    }

    setLoading(true)

    try {
      const payload = {
        name: formData.name,
        monetary_value: parseFloat(formData.monetary_value) || 0,
        status: formData.status,
        pipeline_id: pipelineId,
        pipeline_stage_id: formData.pipeline_stage_id,
        notes: formData.notes || null,
      }

      const url = isEditing ? `/api/opportunities/${opportunity.id}` : "/api/opportunities"
      const method = isEditing ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (result.success) {
        toast.success(isEditing ? "Opportunity updated" : "Opportunity created")
        onSuccess?.()
        onOpenChange(false)
        // Reset form
        setFormData({
          name: "",
          monetary_value: "",
          status: "open",
          pipeline_stage_id: defaultStageId || stages[0]?.id || "",
          notes: "",
        })
      } else {
        toast.error(result.error?.message || "Failed to save opportunity")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <SheetHeader>
            <SheetTitle>
              {isEditing ? "Edit Opportunity" : "Add Opportunity"}
            </SheetTitle>
            <SheetDescription>
              {isEditing
                ? "Update the opportunity details below."
                : "Fill in the details to create a new opportunity."}
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="New deal with Acme Corp"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="monetary_value">Value ($)</Label>
              <Input
                id="monetary_value"
                name="monetary_value"
                type="number"
                min="0"
                step="0.01"
                value={formData.monetary_value}
                onChange={handleChange}
                placeholder="10000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pipeline_stage_id">Stage *</Label>
              <Select
                value={formData.pipeline_stage_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, pipeline_stage_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: "open" | "won" | "lost" | "abandoned") =>
                  setFormData((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                  <SelectItem value="abandoned">Abandoned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Additional details..."
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Opportunity"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

interface OpportunityDetailsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  opportunity: GHLOpportunity | null
  onEdit?: (opportunity: GHLOpportunity) => void
}

export function OpportunityDetailsSheet({
  open,
  onOpenChange,
  opportunity,
  onEdit,
}: OpportunityDetailsSheetProps) {
  if (!opportunity) return null

  const formatCurrency = (value: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(value)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{opportunity.name}</SheetTitle>
          <SheetDescription>Opportunity details</SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">Details</h4>
            <div className="grid gap-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Value</span>
                <span className="text-sm font-medium">
                  {formatCurrency(opportunity.monetary_value, opportunity.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className="text-sm font-medium capitalize">
                  {opportunity.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Source</span>
                <span className="text-sm font-medium">
                  {opportunity.source || "-"}
                </span>
              </div>
              {opportunity.assigned_to && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Assigned To</span>
                  <span className="text-sm font-medium">{opportunity.assigned_to}</span>
                </div>
              )}
            </div>
          </div>

          {opportunity.notes && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Notes</h4>
              <p className="text-sm">{opportunity.notes}</p>
            </div>
          )}

          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">Timeline</h4>
            <div className="grid gap-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Created</span>
                <span className="text-sm font-medium">
                  {new Date(opportunity.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Last Updated</span>
                <span className="text-sm font-medium">
                  {new Date(opportunity.updated_at).toLocaleDateString()}
                </span>
              </div>
              {opportunity.closed_at && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Closed</span>
                  <span className="text-sm font-medium">
                    {new Date(opportunity.closed_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => onEdit?.(opportunity)}>Edit Opportunity</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
