"use client"

import * as React from "react"
import { Toggle } from "@/components/toggle"

function Switch({
  onCheckedChange,
  ...props
}: Omit<React.ComponentProps<typeof Toggle>, "onChange"> & {
  onCheckedChange?: (checked: boolean) => void
}) {
  return (
    <Toggle
      size="md"
      onChange={onCheckedChange}
      {...props}
    />
  )
}

export { Switch }
