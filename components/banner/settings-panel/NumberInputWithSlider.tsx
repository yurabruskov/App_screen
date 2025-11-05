"use client"

import { RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

interface NumberInputWithSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  defaultValue?: number;
  className?: string;
}

export function NumberInputWithSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  defaultValue,
  className = "",
}: NumberInputWithSliderProps) {
  const handleReset = () => {
    if (defaultValue !== undefined) {
      onChange(defaultValue);
    }
  };

  const showResetButton = defaultValue !== undefined && value !== defaultValue;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1">
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={([v]) => onChange(v)}
          className="w-full"
        />
      </div>
      <div className="flex items-center gap-1 min-w-[90px]">
        <Input
          type="number"
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!isNaN(v)) {
              onChange(Math.min(Math.max(v, min), max));
            }
          }}
          className="w-[60px] h-6 px-2 text-[10px] font-mono"
          min={min}
          max={max}
          step={step}
        />
        {unit && (
          <span className="text-[10px] font-mono text-gray-500">{unit}</span>
        )}
      </div>
      {showResetButton && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="h-6 w-6 p-0 hover:bg-gray-100 opacity-60 hover:opacity-100 transition-opacity"
          title="Reset to default"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
