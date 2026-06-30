"use client";

import { useState } from "react";

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 p-8 text-center">
        <p className="text-lg font-semibold text-green-700 dark:text-green-400">
          ✅ Message envoyé !
        </p>
        <p className="mt-2 text-sm text-green-600 dark:text-green-500">
          Nous vous répondrons dans les plus brefs délais.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="block text-sm font-medium mb-1">
            Nom
          </label>
          <input
            id="contact-name"
            type="text"
            required
            className="w-full rounded-md border border-[#E2E0D9] bg-white px-3 py-2 text-sm"
            placeholder="Votre nom"
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="contact-email"
            type="email"
            required
            className="w-full rounded-md border border-[#E2E0D9] bg-white px-3 py-2 text-sm"
            placeholder="votre@email.com"
          />
        </div>
      </div>
      <div>
        <label htmlFor="contact-subject" className="block text-sm font-medium mb-1">
          Sujet
        </label>
        <input
          id="contact-subject"
          type="text"
          required
          className="w-full rounded-md border border-[#E2E0D9] bg-white px-3 py-2 text-sm"
          placeholder="Sujet de votre message"
        />
      </div>
      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium mb-1">
          Message
        </label>
        <textarea
          id="contact-message"
          rows={6}
          required
          className="w-full rounded-md border border-[#E2E0D9] bg-white px-3 py-2 text-sm"
          placeholder="Votre message..."
        />
      </div>
      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-md bg-[#2D5BE3] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors"
      >
        Envoyer
      </button>
    </form>
  );
}
