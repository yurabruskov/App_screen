"use client"

import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExportAllButtonProps {
  isExporting: boolean;
  exportProgress: number;
  onClick: () => void;
}

export function ExportAllButton({ isExporting, exportProgress, onClick }: ExportAllButtonProps) {
  return (
    <Button
      variant="default"
      onClick={onClick}
      disabled={isExporting}
    >
      {isExporting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Exporting {Math.round(exportProgress)}%
        </>
      ) : (
        <>
          <Download className="mr-2 h-4 w-4" />
          Export All Images
        </>
      )}
    </Button>
  );
}
