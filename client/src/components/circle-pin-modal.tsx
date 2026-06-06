import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, Delete } from "lucide-react";

interface CirclePinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => void;
  title?: string;
  description?: string;
}

export function CirclePinModal({
  isOpen,
  onClose,
  onSubmit,
  title = "Circle Secure PIN",
  description = "Enter your 6-digit PIN to authorize this transaction."
}: CirclePinModalProps) {
  const [pin, setPin] = useState<string>("");

  useEffect(() => {
    if (!isOpen) {
      setPin("");
    }
  }, [isOpen]);

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 6) {
        // Automatically submit when 6 digits are entered
        setTimeout(() => {
          onSubmit(newPin);
          onClose();
        }, 300);
      }
    }
  };

  const handleBackspace = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm border border-violet-500/20 bg-slate-950/90 text-slate-100 backdrop-blur-xl md:max-w-md">
        <DialogHeader className="flex flex-col items-center justify-center space-y-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/30">
            <Lock className="h-6 w-6 animate-pulse" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-white">{title}</DialogTitle>
          <DialogDescription className="text-sm text-slate-400">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center space-y-8 py-6">
          {/* PIN Dot Indicators */}
          <div className="flex justify-center space-x-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className={`h-4.5 w-4.5 rounded-full border transition-all duration-200 ${
                  index < pin.length
                    ? "border-violet-500 bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)] scale-110"
                    : "border-slate-700 bg-slate-900"
                }`}
              />
            ))}
          </div>

          {/* Keypad */}
          <div className="grid w-full max-w-[280px] grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <Button
                key={num}
                variant="ghost"
                onClick={() => handleKeyPress(num)}
                className="h-14 rounded-xl text-lg font-semibold text-slate-300 transition-all hover:bg-violet-500/10 hover:text-white hover:scale-105 active:scale-95"
              >
                {num}
              </Button>
            ))}
            
            <Button
              variant="ghost"
              onClick={onClose}
              className="h-14 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-900 hover:text-slate-300"
            >
              Cancel
            </Button>
            
            <Button
              variant="ghost"
              onClick={() => handleKeyPress("0")}
              className="h-14 rounded-xl text-lg font-semibold text-slate-300 transition-all hover:bg-violet-500/10 hover:text-white hover:scale-105 active:scale-95"
            >
              0
            </Button>
            
            <Button
              variant="ghost"
              onClick={handleBackspace}
              className="h-14 rounded-xl text-slate-500 hover:bg-slate-900 hover:text-slate-300"
            >
              <Delete className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
