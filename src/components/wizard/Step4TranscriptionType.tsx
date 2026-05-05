"use client";
import { useState } from "react";
import { Music, Shuffle, ArrowRight } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { WizardData } from "@/types";

const INSTRUMENTS = ["Piano","Guitar","Bass","Violin","Cello","Saxophone","Trumpet","Drums","Voice","Other"];

interface Props {
  data: Partial<WizardData>;
  onNext: (data: Partial<WizardData>) => void;
  onBack: () => void;
}

export function Step4TranscriptionType({ data, onNext, onBack }: Props) {
  const [type, setType] = useState<"direct" | "arrangement">(data.transcription_type ?? "direct");
  const [targetInstrument, setTargetInstrument] = useState(data.target_instrument ?? "");

  const cards = [
    {
      id: "direct" as const,
      icon: <Music size={28} className="text-accent" />,
      title: "Direct Transcription",
      desc: "Transcribing exactly what's played in the original recording",
    },
    {
      id: "arrangement" as const,
      icon: <Shuffle size={28} className="text-accent" />,
      title: "Arrangement",
      desc: "Adapting the piece for a different instrument or context",
    },
  ];

  return (
    <div className="p-8">
      <p className="text-center text-sm text-muted mb-6">How are you transcribing this piece?</p>

      <div className="grid grid-cols-2 gap-4 mb-5">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => setType(card.id)}
            className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 text-center transition-all ${
              type === card.id
                ? "border-accent bg-accent-muted"
                : "border-border hover:border-accent/40 hover:bg-card-hover"
            }`}
          >
            {card.icon}
            <p className="text-sm font-semibold text-text">{card.title}</p>
            <p className="text-xs text-muted leading-relaxed">{card.desc}</p>
          </button>
        ))}
      </div>

      {type === "arrangement" && (
        <div className="mb-5 animate-fade-in">
          <p className="text-sm font-medium text-text mb-2">Target instrument</p>
          <Select value={targetInstrument || "__none"} onValueChange={(v) => setTargetInstrument(v === "__none" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select target instrument" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">— Select —</SelectItem>
              {INSTRUMENTS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-muted hover:text-text transition-colors">← Back</button>
        <button
          onClick={() => onNext({ transcription_type: type, target_instrument: targetInstrument })}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          Continue <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
