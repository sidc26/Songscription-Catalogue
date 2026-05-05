"use client";
import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Step1Upload } from "./wizard/Step1Upload";
import { Step2Trim } from "./wizard/Step2Trim";
import { Step3Tag } from "./wizard/Step3Tag";
import { Step4TranscriptionType } from "./wizard/Step4TranscriptionType";
import { Step5Copyright } from "./wizard/Step5Copyright";
import type { WizardData, Song } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (song: Song) => void;
  initialStep?: number;
  initialData?: Partial<WizardData>;
  crates?: string[];
}

const STEP_LABELS = ["Upload", "Trim", "Tag", "Type", "Rights"];

export function UploadWizard({ open, onOpenChange, onComplete, initialStep = 0, initialData = {}, crates = [] }: Props) {
  const [step, setStep] = useState(initialStep);
  const [data, setData] = useState<Partial<WizardData>>(initialData);
  const touchStartX = useRef(0);

  // Sync if parent provides pre-loaded data (e.g. landing card upload)
  useEffect(() => {
    if (open) {
      setStep(initialStep);
      setData(initialData);
    }
  }, [open, initialStep]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = (newData: Partial<WizardData> = {}) => {
    setData((prev) => ({ ...prev, ...newData }));
    setStep((s) => s + 1);
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta > 60 && step > 0) back();
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) { setStep(0); setData({}); }
    onOpenChange(o);
  };

  const handleComplete = (song: Song) => {
    setStep(0);
    setData({});
    onOpenChange(false);
    onComplete(song);
  };

  const steps = [
    <Step1Upload key={0} onNext={next} />,
    <Step2Trim key={1} data={data} onNext={next} onBack={back} />,
    <Step3Tag key={2} data={data} onNext={next} onBack={back} crates={crates} />,
    <Step4TranscriptionType key={3} data={data} onNext={next} onBack={back} />,
    <Step5Copyright key={4} data={data} onComplete={handleComplete} onBack={back} onClose={() => handleOpenChange(false)} />,
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-xl w-full p-0 overflow-hidden"
        hideClose
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Visually hidden title for screen readers */}
        <span className="sr-only">Upload transcription — step {step + 1} of {STEP_LABELS.length}: {STEP_LABELS[step]}</span>

        {/* Step progress dots */}
        <div className="flex items-center justify-center gap-2 pt-5 pb-2 px-6">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`rounded-full transition-all duration-300 ${
                  i === step ? "w-6 h-2 bg-accent" :
                  i < step ? "w-2 h-2 bg-accent/50" :
                  "w-2 h-2 bg-border"
                }`}
              />
              {i === step && (
                <span className="text-[9px] text-accent font-semibold uppercase tracking-wider">{label}</span>
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="overflow-hidden" key={step}>
          {steps[step]}
        </div>
      </DialogContent>
    </Dialog>
  );
}
