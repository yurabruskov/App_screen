"use client"

import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

interface NumberInputWithSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  className?: string;
}

export function NumberInputWithSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  className = "",
}: NumberInputWithSliderProps) {
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
    </div>
  );
}
