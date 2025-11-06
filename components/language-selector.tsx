"use client"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, ChevronsUpDown, Plus } from "lucide-react"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface LanguageSelectorProps {
  languages: { code: string; name: string }[]
  activeLanguage: string
  onChange: (language: string) => void
}

export function LanguageSelector({ languages, activeLanguage, onChange }: LanguageSelectorProps) {
  const [open, setOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newLanguageCode, setNewLanguageCode] = useState("")
  const [newLanguageName, setNewLanguageName] = useState("")

  const activeLanguageName = languages.find((lang) => lang.code === activeLanguage)?.name || activeLanguage

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[200px] justify-between bg-[#3D3D3D] border-[#4D4D4D] text-gray-300 hover:bg-[#4D4D4D] hover:text-white h-9"
          >
            {activeLanguageName}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput placeholder="Search language..." />
            <CommandList>
              <CommandEmpty>No language found.</CommandEmpty>
              <CommandGroup>
                {languages.map((language) => (
                  <CommandItem
                    key={language.code}
                    value={language.code}
                    onSelect={() => {
                      onChange(language.code)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${activeLanguage === language.code ? "opacity-100" : "opacity-0"}`}
                    />
                    {language.name}
                  </CommandItem>
                ))}
                <CommandItem
                  onSelect={() => {
                    setDialogOpen(true)
                    setOpen(false)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Language
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Language</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="code" className="text-right">
                Code
              </Label>
              <Input
                id="code"
                value={newLanguageCode}
                onChange={(e) => setNewLanguageCode(e.target.value)}
                placeholder="en"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={newLanguageName}
                onChange={(e) => setNewLanguageName(e.target.value)}
                placeholder="English"
                className="col-span-3"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => {
                // This would typically add the language to your state/database
                // For now, we'll just close the dialog
                setDialogOpen(false)
                setNewLanguageCode("")
                setNewLanguageName("")
              }}
            >
              Add Language
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

