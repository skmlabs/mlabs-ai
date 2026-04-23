"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { X, Loader2, CheckCircle2 } from "lucide-react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Status = "idle" | "submitting" | "success" | "error";

export function ContactSalesModal({ open, onClose }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState<string | undefined>();
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email && !email) setEmail(user.email);
    });
  }, [open, email]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/contact-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone ?? "",
          company: company.trim(),
          source_page: window.location.pathname,
          referrer: document.referrer || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Submission failed");
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function handleClose() {
    onClose();
    setTimeout(() => {
      if (status === "success") {
        setName(""); setEmail(""); setPhone(undefined); setCompany("");
        setStatus("idle"); setErrorMsg(null);
      }
    }, 300);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={handleClose}>
      <div className="relative w-full max-w-md bg-bg-card border border-bg-border rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={handleClose} className="absolute top-4 right-4 text-muted hover:text-white" aria-label="Close">
          <X className="h-5 w-5" />
        </button>

        {status === "success" ? (
          <div className="p-8 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto" />
            <h2 className="text-xl font-bold">Thanks — we&apos;ll be in touch.</h2>
            <p className="text-sm text-muted">We&apos;ll reach out within 24 hours to schedule your demo.</p>
            <button onClick={handleClose} className="mt-2 text-sm text-brand-indigo hover:underline">Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-brand-indigo mb-1">Contact Sales</div>
              <h2 className="text-xl font-bold">Let&apos;s talk.</h2>
              <p className="text-xs text-muted mt-1">Tell us a bit about you — we&apos;ll get back within 24 hours.</p>
            </div>

            <label className="block text-xs text-muted">
              Name
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                required minLength={2}
                className="mt-1 w-full bg-bg border border-bg-border rounded-lg px-3 py-2 text-sm text-white focus:border-brand-indigo focus:outline-none"
                placeholder="Your full name"
              />
            </label>

            <label className="block text-xs text-muted">
              Email
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required
                className="mt-1 w-full bg-bg border border-bg-border rounded-lg px-3 py-2 text-sm text-white focus:border-brand-indigo focus:outline-none"
                placeholder="you@company.com"
              />
            </label>

            <label className="block text-xs text-muted">
              Phone
              <div className="mt-1 bg-bg border border-bg-border rounded-lg px-3 py-2 focus-within:border-brand-indigo">
                <PhoneInput
                  international defaultCountry="IN" value={phone} onChange={setPhone}
                  className="phone-input-custom"
                  placeholder="Enter phone number"
                />
              </div>
            </label>

            <label className="block text-xs text-muted">
              Company
              <input
                type="text" value={company} onChange={e => setCompany(e.target.value)}
                required minLength={1}
                className="mt-1 w-full bg-bg border border-bg-border rounded-lg px-3 py-2 text-sm text-white focus:border-brand-indigo focus:outline-none"
                placeholder="Your company name"
              />
            </label>

            {status === "error" && errorMsg ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400">{errorMsg}</div>
            ) : null}

            <button
              type="submit"
              disabled={status === "submitting" || !name || !email || !phone || !company}
              className="w-full inline-flex items-center justify-center gap-2 bg-brand-indigo hover:bg-indigo-600 px-6 py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "submitting" ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : "Submit"}
            </button>

            <p className="text-[11px] text-muted text-center">
              We respect your privacy. We&apos;ll only use this to reach out about Local AI.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
