import { redirect } from "next/navigation";

// Old address of the Brand Hub; kept so bookmarks and links keep working.
export default function ProfilePage() {
  redirect("/brand-hub");
}
