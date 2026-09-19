"use client";

import { useState } from "react";
import { API_URL } from "@/lib/api";

type FormState = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export function ContactClient() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormState>({
    name: "",
    email: "",
    subject: "general",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.detail ?? `Submission failed (${res.status}). Please try again.`
        );
      }

      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-10">
        <header className="text-center">
          <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-accent)]">Get in Touch</span>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Contact &amp; Support</h1>
          <p className="mt-2 text-sm text-[#A1A1AA]">
            Have questions, feedback, or DMCA copyright inquiries? Send us a message and our team will get back to you promptly.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Contact Details */}
          <div className="space-y-6 md:col-span-1">
            <div className="rounded-2xl border border-white/10 bg-[#121215]/60 p-6 backdrop-blur-xl space-y-3">
              <h2 className="text-base font-bold text-white">General Inquiries</h2>
              <p className="text-xs text-[#A1A1AA]">
                For questions regarding Apollo AI recommendations, site features, or partnerships.
              </p>
              <p className="text-xs font-semibold text-[var(--brand-accent)]">support@missapollo.me</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#121215]/60 p-6 backdrop-blur-xl space-y-3">
              <h2 className="text-base font-bold text-white">DMCA &amp; Legal</h2>
              <p className="text-xs text-[#A1A1AA]">
                For copyright infringement notices or legal correspondence under the DMCA.
              </p>
              <p className="text-xs font-semibold text-[var(--brand-accent)]">dmca@missapollo.me</p>
            </div>
          </div>

          {/* Form */}
          <div className="rounded-2xl border border-white/10 bg-[#121215]/60 p-6 sm:p-8 backdrop-blur-xl md:col-span-2">
            {submitted ? (
              <div className="py-12 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-accent)]/20 text-[var(--brand-accent)]">
                  <svg className="h-8 w-8 text-[var(--brand-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                </div>
                <h3 className="text-2xl font-black text-white">Message Received!</h3>
                <p className="text-sm text-[#A1A1AA]">
                  Thank you for reaching out. A member of our support team will respond to your inquiry shortly.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setFormData({ name: "", email: "", subject: "general", message: "" });
                  }}
                  className="rounded-full bg-[var(--brand-accent)] px-6 py-2 text-sm font-extrabold text-[var(--brand-accent-text)] shadow-brand-glow transition hover:bg-[var(--brand-accent-hover)]"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="name" className="block text-xs font-bold uppercase tracking-[0.12em] text-[#A1A1AA] mb-1.5">
                    Your Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Jane Doe"
                    className="w-full rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none focus:border-[var(--brand-accent)]/50 transition placeholder:text-[#A1A1AA]"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-xs font-bold uppercase tracking-[0.12em] text-[#A1A1AA] mb-1.5">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="jane@example.com"
                    className="w-full rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none focus:border-[var(--brand-accent)]/50 transition placeholder:text-[#A1A1AA]"
                  />
                </div>

                <div>
                  <label htmlFor="subject" className="block text-xs font-bold uppercase tracking-[0.12em] text-[#A1A1AA] mb-1.5">
                    Subject / Category
                  </label>
                  <select
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-[#121215] px-4 py-2.5 text-sm text-white outline-none focus:border-[var(--brand-accent)]/50 transition"
                  >
                    <option value="general" className="bg-[#09090B]">General Support</option>
                    <option value="dmca" className="bg-[#09090B]">DMCA / Copyright Takedown</option>
                    <option value="editorial" className="bg-[#09090B]">Editorial &amp; Review Feedback</option>
                    <option value="bug" className="bg-[#09090B]">Report a Bug / Issue</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="block text-xs font-bold uppercase tracking-[0.12em] text-[#A1A1AA] mb-1.5">
                    Message
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="How can we help you today?"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none focus:border-[var(--brand-accent)]/50 transition placeholder:text-[#A1A1AA] resize-none"
                  />
                </div>

                {error && (
                  <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-400">
                    {error}
                  </p>
                )}

                <button
                  id="contact-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-[var(--brand-accent)] py-3 text-sm font-extrabold text-[var(--brand-accent-text)] shadow-brand-glow hover:bg-[var(--brand-accent-hover)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
                >
                  {loading ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
                      </svg>
                      Sending…
                    </>
                  ) : (
                    "Submit Inquiry"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
