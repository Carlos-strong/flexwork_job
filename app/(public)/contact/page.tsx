export const revalidate = 86400;

import { ContactForm } from "@/components/forms/contact-form";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight">Contact</h1>
        <p className="mt-4 text-[#5A5750]">
          Une question ? Une suggestion ? Écrivez-nous.
        </p>
        <div className="mt-8">
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
