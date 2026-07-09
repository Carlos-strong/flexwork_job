import React from "react";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-lg border border-[#DADFDD] bg-white px-3 py-2 text-[13.5px] text-[#14213D] outline-none focus:border-[#1F7A5C] focus:ring-1 focus:ring-[#1F7A5C]/30 placeholder:text-[#9CA3AF] resize-none disabled:opacity-50 ${className ?? ""}`}
      {...props}
    />
  );
}
