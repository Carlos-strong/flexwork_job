"use client";

/**
 * Stepper horizontal — navigation multi-step pour le workflow contractuel.
 * Affiche les 5 grandes étapes sous forme de barre de progression horizontale.
 */

import type { ContractPhase } from "@/lib/contract-workflow";
import { STEPPER_STEPS, getStepperIndex } from "./types";

interface WorkflowStepperProps {
  currentPhase: ContractPhase;
  isDisputeActive: boolean;
}

export function WorkflowStepper({ currentPhase, isDisputeActive }: WorkflowStepperProps) {
  const currentIdx = getStepperIndex(currentPhase);

  return (
    <div className="w-full px-6 py-4">
      <div className="flex items-center justify-between relative">
        {/* Ligne de fond */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-[#E2E0D9]">
          <div
            className="h-full bg-[#2D5BE3] transition-all duration-500 rounded-full"
            style={{
              width: `${Math.min(
                (currentIdx / (STEPPER_STEPS.length - 1)) * 100,
                isDisputeActive ? 80 : 100
              )}%`,
            }}
          />
        </div>

        {STEPPER_STEPS.map((step, idx) => {
          const isCompleted = idx < currentIdx || (currentPhase === "COMPLETED" && idx === STEPPER_STEPS.length - 1);
          const isActive = idx === currentIdx;
          const isDispute = idx === 4 && isDisputeActive;
          const isLast = idx === STEPPER_STEPS.length - 1;

          // Skip dispute step visually if not active
          if (isDispute && !isDisputeActive && !isCompleted) {
            return <div key={idx} className="flex flex-col items-center relative z-10 opacity-30">
              <div className="w-10 h-10 rounded-full border-2 border-[#E2E0D9] bg-white flex items-center justify-center text-sm">
                {step.icon}
              </div>
              <span className="mt-2 text-[11px] font-medium text-[#5A5750] whitespace-nowrap">
                {step.label}
              </span>
            </div>;
          }

          return (
            <div key={idx} className="flex flex-col items-center relative z-10">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm transition-all duration-300
                  ${isCompleted || (isLast && currentPhase === "COMPLETED")
                    ? "bg-green-500 border-2 border-green-500 text-white"
                    : isActive
                    ? "bg-[#2D5BE3] border-2 border-[#2D5BE3] text-white shadow-lg shadow-blue-200"
                    : isDispute
                    ? "bg-red-500 border-2 border-red-500 text-white shadow-lg shadow-red-200"
                    : "border-2 border-[#E2E0D9] bg-white text-[#5A5750]"
                  }
                `}
              >
                {isCompleted || (isLast && currentPhase === "COMPLETED") ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.icon
                )}
              </div>
              <span
                className={`
                  mt-2 text-[11px] font-semibold whitespace-nowrap transition-colors duration-300
                  ${isActive ? "text-[#2D5BE3]" : isCompleted ? "text-green-600" : isDispute ? "text-red-500" : "text-[#5A5750]"}
                `}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
