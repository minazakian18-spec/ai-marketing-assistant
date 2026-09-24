import { PageHeading } from "@/components/ui";
import { ContactsManager } from "@/components/contacts/contacts-manager";
export default function ContactsPage() {
  return (
    <>
      <PageHeading
        eyebrow="KLANTEN & RESULTATEN"
        title="Contacten"
        description="Beheer je contacten, groepen en e-mailstatus voor Email AI."
      />
      <ContactsManager />
    </>
  );
}
