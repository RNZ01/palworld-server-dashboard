"use client"

import * as React from "react"
import { TextInput } from "@/components/text-input"

type InputProps = Omit<React.ComponentProps<"input">, "size">

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, type, ...props }, ref) {
    return (
      <TextInput
        ref={ref}
        type={type}
        size="md"
        inputOnly
        inputClassName={className}
        {...props}
      />
    )
  }
)

export { Input }
