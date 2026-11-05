// lib/story-action.ts — where a story's button leads: "Book this" for an
// event story, "Go here" for a vendor's own story or a traveler story
// tagged with the place it was taken.

export interface StoryAction { kind: 'vendor' | 'event'; id: string; name: string }

export function storyAction(s: { eventId?: string | null; event?: { id: string; title: string } | null; vendorId?: string | null; vendor?: { name: string } | null; placeVendorId?: string | null; placeVendor?: { id: string; name: string } | null }): StoryAction | null {
  if (s.event) return { kind: 'event', id: s.event.id, name: s.event.title }
  if (s.vendorId && s.vendor) return { kind: 'vendor', id: s.vendorId, name: s.vendor.name }
  if (s.placeVendor) return { kind: 'vendor', id: s.placeVendor.id, name: s.placeVendor.name }
  return null
}
