"use client"

import { useState } from "react"
import type { GHLContact } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

interface ContactFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact?: GHLContact | null
  onSuccess?: () => void
}

interface FormData {
  first_name: string
  last_name: string
  email: string
  phone: string
  company_name: string
  tags: string
}

export function ContactForm({
  open,
  onOpenChange,
  contact,
  onSuccess,
}: ContactFormProps) {
  const isEditing = !!contact

  const [formData, setFormData] = useState<FormData>(() => ({
    first_name: contact?.first_name || "",
    last_name: contact?.last_name || "",
    email: contact?.email || "",
    phone: contact?.phone || "",
    company_name: contact?.company_name || "",
    tags: contact?.tags?.join(", ") || "",
  }))
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const payload = {
        first_name: formData.first_name || null,
        last_name: formData.last_name || null,
        email: formData.email || null,
        phone: formData.phone || null,
        company_name: formData.company_name || null,
        tags: formData.tags
          ? formData.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : [],
      }

      const url = isEditing ? `/api/contacts/${contact.id}` : "/api/contacts"
      const method = isEditing ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (result.success) {
        toast.success(isEditing ? "Contact updated" : "Contact created")
        onSuccess?.()
        onOpenChange(false)
        // Reset form
        setFormData({
          first_name: "",
          last_name: "",
          email: "",
          phone: "",
          company_name: "",
          tags: "",
        })
      } else {
        toast.error(result.error?.message || "Failed to save contact")
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
            <SheetTitle>{isEditing ? "Edit Contact" : "Add Contact"}</SheetTitle>
            <SheetDescription>
              {isEditing
                ? "Update the contact information below."
                : "Fill in the details to create a new contact."}
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-4 py-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="john@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_name">Company</Label>
              <Input
                id="company_name"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                placeholder="Acme Inc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                name="tags"
                value={formData.tags}
                onChange={handleChange}
                placeholder="lead, newsletter, vip"
              />
              <p className="text-xs text-muted-foreground">
                Separate tags with commas
              </p>
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
              {isEditing ? "Save Changes" : "Create Contact"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

interface ContactDetailsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact: GHLContact | null
  onEdit?: (contact: GHLContact) => void
}

export function ContactDetailsSheet({
  open,
  onOpenChange,
  contact,
  onEdit,
}: ContactDetailsSheetProps) {
  if (!contact) return null

  const getContactName = () => {
    if (contact.name) return contact.name
    const fullName = `${contact.first_name || ""} ${contact.last_name || ""}`.trim()
    return fullName || "Unknown"
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{getContactName()}</SheetTitle>
          <SheetDescription>Contact details and information</SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">Contact Information</h4>
            <div className="grid gap-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="text-sm font-medium">{contact.email || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Phone</span>
                <span className="text-sm font-medium">{contact.phone || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Company</span>
                <span className="text-sm font-medium">{contact.company_name || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Source</span>
                <span className="text-sm font-medium">{contact.source || "-"}</span>
              </div>
            </div>
          </div>

          {contact.tags && contact.tags.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Tags</h4>
              <div className="flex flex-wrap gap-1">
                {contact.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">Activity</h4>
            <div className="grid gap-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Added</span>
                <span className="text-sm font-medium">
                  {new Date(contact.date_added).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Last Updated</span>
                <span className="text-sm font-medium">
                  {new Date(contact.date_updated).toLocaleDateString()}
                </span>
              </div>
              {contact.last_activity && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Last Activity</span>
                  <span className="text-sm font-medium">
                    {new Date(contact.last_activity).toLocaleDateString()}
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
          <Button onClick={() => onEdit?.(contact)}>Edit Contact</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
