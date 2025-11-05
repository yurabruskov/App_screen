"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"

interface ColorPickerProps {
  color: string
  onChange: (color: string) => void
}

export function ColorPicker({ color, onChange }: ColorPickerProps) {
  const [inputValue, setInputValue] = useState(color)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setInputValue(color)
  }, [color])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)

    // Validate if it's a proper hex color
    if (/^#[0-9A-F]{6}$/i.test(value)) {
      onChange(value)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="w-10 h-10 rounded-md border border-input"
            style={{ backgroundColor: color }}
            aria-label="Pick a color"
          />
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-6 gap-2">
              {[
                "#FF0000",
                "#FF7F00",
                "#FFFF00",
                "#00FF00",
                "#0000FF",
                "#4B0082",
                "#9400D3",
                "#FF1493",
                "#FF69B4",
                "#FFC0CB",
                "#FFFFFF",
                "#000000",
                "#808080",
                "#A52A2A",
                "#D2691E",
                "#FFD700",
                "#008000",
                "#00FFFF",
              ].map((presetColor) => (
                <button
                  key={presetColor}
                  className="w-8 h-8 rounded-md border border-input"
                  style={{ backgroundColor: presetColor }}
                  onClick={() => {
                    onChange(presetColor)
                    setInputValue(presetColor)
                  }}
                  aria-label={`Select color ${presetColor}`}
                />
              ))}
            </div>
            <input
              ref={inputRef}
              type="color"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value)
                onChange(e.target.value)
              }}
              className="w-full h-10"
            />
          </div>
        </PopoverContent>
      </Popover>
      <Input value={inputValue} onChange={handleInputChange} className="w-28" placeholder="#RRGGBB" />
    </div>
  )
}

