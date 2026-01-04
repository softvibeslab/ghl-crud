"use client"

import { useState, useCallback, useEffect } from "react"
import { useContacts } from "@/hooks/use-contacts"
import type { GHLContact } from "@/types/database"
import { Header } from "@/components/dashboard/header"
import { ContactTable, ContactTablePagination } from "@/components/dashboard/contact-table"
import { ContactForm, ContactDetailsSheet } from "@/components/dashboard/contact-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Plus, Search, X } from "lucide-react"
import { toast } from "sonner"
import { useDebounce } from "@/hooks/use-debounce"

export default function ContactsPage() {
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // Debounce search input
  const debouncedSearch = useDebounce(searchInput, 300)

  const { data: contacts, loading, error, meta, refetch } = useContacts({
    page,
    limit: 20,
    searchQuery: debouncedSearch || undefined,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
  })

  // Reset page when search/filters change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, selectedTags])

  // Selected contacts for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Form states
  const [formOpen, setFormOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<GHLContact | null>(null)
  const [viewingContact, setViewingContact] = useState<GHLContact | null>(null)

  // Delete confirmation
  const [deleteContact, setDeleteContact] = useState<GHLContact | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleAddContact = () => {
    setEditingContact(null)
    setFormOpen(true)
  }

  const handleEditContact = (contact: GHLContact) => {
    setEditingContact(contact)
    setDetailsOpen(false)
    setFormOpen(true)
  }

  const handleViewContact = (contact: GHLContact) => {
    setViewingContact(contact)
    setDetailsOpen(true)
  }

  const handleDeleteContact = async () => {
    if (!deleteContact) return

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/contacts/${deleteContact.id}`, {
        method: "DELETE",
      })

      const result = await response.json()

      if (result.success) {
        toast.success("Contact deleted")
        refetch()
      } else {
        toast.error(result.error?.message || "Failed to delete contact")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setIsDeleting(false)
      setDeleteContact(null)
    }
  }

  const handleFormSuccess = () => {
    refetch()
    setSelectedIds([])
  }

  const clearFilters = () => {
    setSearchInput("")
    setSelectedTags([])
    setPage(1)
  }

  const hasFilters = searchInput || selectedTags.length > 0

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Contacts"
        description="Manage your contacts and customer relationships"
        actions={
          <Button onClick={handleAddContact}>
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-4">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={selectedTags.join(",") || "all"}
            onValueChange={(value) => {
              if (value === "all") {
                setSelectedTags([])
              } else {
                setSelectedTags(value.split(","))
              }
            }}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              <SelectItem value="lead">Lead</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="vip">VIP</SelectItem>
              <SelectItem value="newsletter">Newsletter</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="icon" onClick={clearFilters}>
              <X className="h-4 w-4" />
              <span className="sr-only">Clear filters</span>
            </Button>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Selected Actions */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">
              {selectedIds.length} selected
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds([])}
            >
              Clear selection
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                // For simplicity, just delete the first selected one
                const contact = contacts.find((c) => c.id === selectedIds[0])
                if (contact) setDeleteContact(contact)
              }}
            >
              Delete selected
            </Button>
          </div>
        )}

        {/* Contacts Table */}
        <ContactTable
          contacts={contacts}
          loading={loading}
          onEdit={handleEditContact}
          onDelete={setDeleteContact}
          onView={handleViewContact}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />

        {/* Pagination */}
        {!loading && contacts.length > 0 && (
          <ContactTablePagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={meta.limit}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Contact Form Sheet */}
      <ContactForm
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editingContact}
        onSuccess={handleFormSuccess}
      />

      {/* Contact Details Sheet */}
      <ContactDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        contact={viewingContact}
        onEdit={handleEditContact}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteContact}
        onOpenChange={(open) => !open && setDeleteContact(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this contact? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContact}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
