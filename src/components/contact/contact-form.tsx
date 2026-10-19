"use client";

import { Check, Copy, LoaderCircle, Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CONTACT_EMAIL } from "@/lib/community";
import { ContactDeliveryError, sendContactMessage } from "@/lib/contact";

export function CopyContactEmail() {
  const [feedback, setFeedback] = useState("");
  const copied = feedback === "Email address copied.";
  async function copy() {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setFeedback("Email address copied.");
    } catch {
      setFeedback("Select the address above to copy it.");
    }
  }
  return <div className="sw-contact__email">
    <span>{CONTACT_EMAIL}</span>
    <button type="button" onClick={copy} aria-label="Copy contact email address">{copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{copied ? "Copied" : "Copy email"}</button>
    <span className="sr-only" role="status">{feedback}</span>
  </div>;
}

export function ContactForm({ configured }: { configured: boolean }) {
  const successRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (sent) successRef.current?.focus(); }, [sent]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    pendingRef.current = true;
    setSending(true);
    setError("");
    try {
      await sendContactMessage({
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
        message: String(data.get("message") ?? ""),
        botcheck: String(data.get("botcheck") ?? ""),
      });
      form.reset();
      setSent(true);
    } catch (cause) {
      setError(cause instanceof ContactDeliveryError ? cause.message : "We couldn’t confirm delivery. Please try again.");
    } finally {
      pendingRef.current = false;
      setSending(false);
    }
  }

  if (sent) return <div className="sw-contact__form sw-contact__success" ref={successRef} tabIndex={-1} role="status">
    <Check size={30} aria-hidden="true" />
    <h2>Message sent.</h2>
    <p>Thanks for getting in touch. Mashu will reply to the email address you provided.</p>
    <button className="sw-cta-ghost" type="button" onClick={() => { setSent(false); setError(""); }}>Send another message</button>
  </div>;

  return <form className="sw-contact__form" onSubmit={submit} aria-labelledby="contact-form-title" aria-busy={sending}>
    <h2 id="contact-form-title">Send a message</h2>
    <p>It goes straight to Mashu’s inbox.</p>
    {!configured && <p className="sw-contact__unavailable" role="status">The form is temporarily unavailable. You can copy the email address and write to Mashu directly.</p>}
    <fieldset className="sw-contact__fields" disabled={sending || !configured}>
      <div className="sw-contact__field">
        <label htmlFor="contact-name">Name <span>(optional)</span></label>
        <input id="contact-name" name="name" autoComplete="name" maxLength={80} disabled={sending} />
      </div>
      <div className="sw-contact__field">
        <label htmlFor="contact-email">Your email</label>
        <input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={254} aria-describedby="contact-email-hint" disabled={sending} />
        <p id="contact-email-hint" className="sw-contact__hint">Where you’d like a reply.</p>
      </div>
      <div className="sw-contact__field">
        <label htmlFor="contact-message">Message</label>
        <textarea id="contact-message" name="message" required maxLength={5000} rows={7} aria-describedby="contact-message-hint" disabled={sending} />
        <p id="contact-message-hint" className="sw-contact__hint">For a bug, include the page URL and what happened. Up to 5,000 characters.</p>
      </div>
    </fieldset>
    <div hidden aria-hidden="true"><label>Leave this field empty<input name="botcheck" tabIndex={-1} autoComplete="off" /></label></div>
    {error && <p role="alert" className="sw-contact__error">{error}</p>}
    <button className="sw-cta-primary" type="submit" disabled={sending || !configured}>
      {sending ? <LoaderCircle size={18} className="sw-contact__spinner" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
      {sending ? "Sending…" : "Send message"}
    </button>
    <p className="sw-contact__privacy">Your details are used to reply to your message. Please don’t include passwords or sensitive account information. <a href="/privacy">Privacy & cookies</a>.</p>
  </form>;
}
