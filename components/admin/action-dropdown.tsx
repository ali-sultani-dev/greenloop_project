"use client"
import { useState, useRef, useEffect } from "react"
import type React from "react"

import { Button } from "@/components/ui/button"
import { MoreHorizontal, Edit, Trash2, Eye, UserPlus, Users, Settings, Ban, CheckCircle, UserMinus } from "lucide-react"

interface ActionDropdownProps {
  onEdit?: () => void
  onDelete?: () => void
  onView?: () => void
  onPromote?: () => void
  onManageMembers?: () => void
  onToggleStatus?: () => void
  onSettings?: () => void
  isActive?: boolean
  isAdmin?: boolean
  type?: "user" | "team" | "challenge" | "content"
}

export function ActionDropdown({
  onEdit,
  onDelete,
  onView,
  onPromote,
  onManageMembers,
  onToggleStatus,
  onSettings,
  isActive = true,
  isAdmin = false,
  type = "user",
}: ActionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState<{
    top?: number
    bottom?: number
    left?: number
    right?: number
  }>({})
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  const toggleDropdown = (event: React.MouseEvent) => {
    if (isOpen) {
      setIsOpen(false)
      return
    }

    const rect = (event.target as HTMLElement).getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const dropdownWidth = 192 // w-48 = 12rem = 192px
    const dropdownHeight = 240 // approximate height of dropdown

    const position: { top?: number; bottom?: number; left?: number; right?: number } = {}

    // Position horizontally
    if (rect.right + dropdownWidth > viewportWidth) {
      position.right = viewportWidth - rect.left
    } else {
      position.left = rect.right
    }

    // Position vertically
    if (rect.bottom + dropdownHeight > viewportHeight) {
      position.bottom = viewportHeight - rect.top
    } else {
      position.top = rect.bottom
    }

    setDropdownPosition(position)
    setIsOpen(true)
  }

  const handleMenuItemClick = (action: () => void) => {
    action()
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 hover:bg-gray-100 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        onClick={toggleDropdown}
      >
        <span className="sr-only">Open menu</span>
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div
            className="fixed w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50"
            style={{
              top: dropdownPosition.top,
              bottom: dropdownPosition.bottom,
              left: dropdownPosition.left,
              right: dropdownPosition.right,
            }}
          >
            <div className="py-1">
              <div className="px-4 py-2 text-sm font-semibold text-gray-900 border-b border-gray-100">Actions</div>

              {onView && (
                <button
                  onClick={() => handleMenuItemClick(onView)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Eye className="h-4 w-4" />
                  View Details
                </button>
              )}

              {onEdit && (
                <button
                  onClick={() => handleMenuItemClick(onEdit)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Edit className="h-4 w-4" />
                  Edit{" "}
                  {type === "user" ? "User" : type === "team" ? "Team" : type === "challenge" ? "Challenge" : "Content"}
                </button>
              )}

              {type === "user" && onPromote && (
                <button
                  onClick={() => handleMenuItemClick(onPromote)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  {isAdmin ? (
                    <>
                      <UserMinus className="h-4 w-4" />
                      Remove Admin Role
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Promote to Admin
                    </>
                  )}
                </button>
              )}

              {type === "team" && onManageMembers && (
                <button
                  onClick={() => handleMenuItemClick(onManageMembers)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Users className="h-4 w-4" />
                  Manage Members
                </button>
              )}

              {onToggleStatus && type !== "content" && (
                <button
                  onClick={() => handleMenuItemClick(onToggleStatus)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  {isActive ? (
                    <>
                      <Ban className="h-4 w-4" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Activate
                    </>
                  )}
                </button>
              )}

              {onSettings && (
                <button
                  onClick={() => handleMenuItemClick(onSettings)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </button>
              )}

              <div className="border-t border-gray-100 my-1"></div>

              {onDelete && (
                <button
                  onClick={() => handleMenuItemClick(onDelete)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
