"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Filter, X, Download, Check } from "lucide-react"

interface FilterOption {
  key: string
  label: string
  values: string[]
}

interface InteractiveSearchProps {
  data: any[]
  onFilteredData: (filteredData: any[]) => void
  searchFields: string[]
  filterOptions: FilterOption[]
  placeholder?: string
  onExport?: () => void
}

export function InteractiveSearch({
  data,
  onFilteredData,
  searchFields,
  filterOptions,
  placeholder = "Search...",
  onExport,
}: InteractiveSearchProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({})
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 })

  // Filter and search data
  const filteredData = useMemo(() => {
    let filtered = data

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((item) =>
        searchFields.some((field) => {
          const value = getNestedValue(item, field)
          return value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        }),
      )
    }

    // Apply active filters
    Object.entries(activeFilters).forEach(([filterKey, filterValues]) => {
      if (filterValues.length > 0) {
        filtered = filtered.filter((item) => {
          const value = getNestedValue(item, filterKey)
          return filterValues.includes(value?.toString() || "")
        })
      }
    })

    return filtered
  }, [data, searchTerm, activeFilters, searchFields])

  useEffect(() => {
    onFilteredData(filteredData)
  }, [filteredData, onFilteredData])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false)
      }
    }

    const updateDropdownPosition = () => {
      if (buttonRef.current && isFilterOpen) {
        const rect = buttonRef.current.getBoundingClientRect()
        setDropdownPosition({
          top: rect.bottom + 8,
          right: window.innerWidth - rect.right,
        })
      }
    }

    if (isFilterOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      updateDropdownPosition()
      window.addEventListener("resize", updateDropdownPosition)
      window.addEventListener("scroll", updateDropdownPosition)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      window.removeEventListener("resize", updateDropdownPosition)
      window.removeEventListener("scroll", updateDropdownPosition)
    }
  }, [isFilterOpen])

  // Helper function to get nested object values
  function getNestedValue(obj: any, path: string) {
    return path.split(".").reduce((current, key) => current?.[key], obj)
  }

  // Handle filter changes
  const handleFilterChange = (filterKey: string, value: string, checked: boolean) => {
    console.log("-> Filter change:", { filterKey, value, checked })
    setActiveFilters((prev) => {
      const currentValues = prev[filterKey] || []
      if (checked) {
        return { ...prev, [filterKey]: [...currentValues, value] }
      } else {
        return { ...prev, [filterKey]: currentValues.filter((v) => v !== value) }
      }
    })
  }

  // Clear all filters
  const clearFilters = () => {
    console.log("-> Clearing all filters")
    setActiveFilters({})
    setSearchTerm("")
    setIsFilterOpen(false)
  }

  const toggleFilterDropdown = () => {
    console.log("-> Toggling filter dropdown:", !isFilterOpen)
    setIsFilterOpen(!isFilterOpen)
  }

  // Get active filter count
  const activeFilterCount = Object.values(activeFilters).flat().length

  const DropdownPortal = () => {
    if (!isFilterOpen) return null

    return createPortal(
      <div
        ref={dropdownRef}
        className="fixed w-56 bg-white border border-gray-200 rounded-md shadow-xl z-[99999] max-h-96 overflow-y-auto"
        style={{
          top: `${dropdownPosition.top}px`,
          left: `${window.innerWidth - dropdownPosition.right - 224}px`, // 224px = w-56 width
        }}
      >
        <div className="p-3 border-b border-gray-100">
          <h4 className="font-medium text-sm">Filter Options</h4>
        </div>

        {filterOptions.map((option) => (
          <div key={option.key} className="border-b border-gray-100 last:border-b-0">
            <div className="px-3 py-2 bg-gray-50">
              <h5 className="text-xs font-medium text-gray-600 uppercase tracking-wide">{option.label}</h5>
            </div>
            {option.values.map((value) => {
              const isChecked = activeFilters[option.key]?.includes(value) || false
              return (
                <div
                  key={value}
                  className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleFilterChange(option.key, value, !isChecked)}
                >
                  <div className="flex items-center justify-center w-4 h-4 mr-3 border border-gray-300 rounded">
                    {isChecked && <Check className="h-3 w-3 text-blue-600" />}
                  </div>
                  <span className="text-sm">{value}</span>
                </div>
              )
            })}
          </div>
        ))}

        {activeFilterCount > 0 && (
          <>
            <div className="border-t border-gray-200" />
            <div
              className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer text-red-600"
              onClick={clearFilters}
            >
              <X className="h-4 w-4 mr-2" />
              <span className="text-sm">Clear Filters</span>
            </div>
          </>
        )}
      </div>,
      document.body,
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="relative">
          <Button ref={buttonRef} variant="outline" className="relative bg-transparent" onClick={toggleFilterDropdown}>
            <Filter className="h-4 w-4 mr-2" />
            Filter
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          <DropdownPortal />
        </div>

        {onExport && (
          <Button variant="outline" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </div>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(activeFilters).map(([filterKey, values]) =>
            values.map((value) => (
              <Badge key={`${filterKey}-${value}`} variant="secondary" className="gap-1">
                {value}
                <X className="h-3 w-3 cursor-pointer" onClick={() => handleFilterChange(filterKey, value, false)} />
              </Badge>
            )),
          )}
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 px-2 text-xs">
            Clear All
          </Button>
        </div>
      )}

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredData.length} of {data.length} results
        {searchTerm && ` for "${searchTerm}"`}
      </div>
    </div>
  )
}
