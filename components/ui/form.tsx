import React from "react";

interface FormFieldProps {
  name: string;
  control?: any;
  render: (props: { field: { value: any; onChange: (...e: any[]) => void; onBlur: () => void; name: string; ref: React.Ref<any> } }) => React.ReactNode;
}
interface FormItemProps { children: React.ReactNode; className?: string }
interface FormLabelProps { children: React.ReactNode; className?: string }
interface FormControlProps { children: React.ReactNode }
interface FormMessageProps { children?: React.ReactNode; className?: string }
interface FormDescriptionProps { children?: React.ReactNode; className?: string }

export function Form({ children, className, ...props }: { children?: React.ReactNode; className?: string; [key: string]: any }) {
  return <form className={className} {...props}>{children}</form>;
}

export function FormField({ name, render }: FormFieldProps) {
  return <>{render({ field: { value: "", onChange: () => {}, onBlur: () => {}, name, ref: React.createRef() } })}</>;
}
export function FormItem({ children, className }: FormItemProps) {
  return <div className={`space-y-1.5 ${className ?? ""}`}>{children}</div>;
}
export function FormLabel({ children, className }: FormLabelProps) {
  return <label className={`text-[12.5px] font-semibold text-[#6B7280] ${className ?? ""}`}>{children}</label>;
}
export function FormControl({ children }: FormControlProps) {
  return <>{children}</>;
}
export function FormMessage({ children, className }: FormMessageProps) {
  return children ? <p className={`text-[11.5px] text-red-600 ${className ?? ""}`}>{children}</p> : null;
}
export function FormDescription({ children, className }: FormDescriptionProps) {
  return children ? <p className={`text-[11.5px] text-[#6B7280] ${className ?? ""}`}>{children}</p> : null;
}
