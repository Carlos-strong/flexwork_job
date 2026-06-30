"use client";

import { useState } from "react";

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
}

export function FaqAccordion({ items }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div
          key={index}
          className="rounded-lg border border-[#E2E0D9] overflow-hidden"
        >
          <button
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-medium hover:bg-[#EEF2FD]/50 transition-colors"
          >
            {item.question}
            <span className="ml-4 text-[#5A5750]">
              {openIndex === index ? "−" : "+"}
            </span>
          </button>
          {openIndex === index && (
            <div className="px-6 pb-4 text-sm text-[#5A5750]">
              {item.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
