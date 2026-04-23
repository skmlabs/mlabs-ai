"use client";
import { useState } from "react";
import { ContactSalesModal } from "./ContactSalesModal";

type Variant = "primary" | "outline" | "link";
type Size = "sm" | "md" | "lg";

interface Props {
  label: string;
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-brand-indigo hover:bg-indigo-600 text-white shadow-lg shadow-brand-indigo/30",
  outline: "border border-bg-border hover:border-brand-indigo text-white",
  link: "text-muted hover:text-white underline underline-offset-2",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-sm px-3 py-1.5",
  md: "text-sm px-4 py-2",
  lg: "text-base px-6 py-3",
};

export function ContactSalesTrigger({ label, variant = "primary", size = "md" }: Props) {
  const [open, setOpen] = useState(false);
  const isLink = variant === "link";
  const className = isLink
    ? variantClasses.link
    : `inline-flex items-center justify-center gap-2 rounded-lg font-medium transition ${variantClasses[variant]} ${sizeClasses[size]}`;

  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>{label}</button>
      <ContactSalesModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
