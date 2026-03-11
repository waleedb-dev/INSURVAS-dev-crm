import { redirect } from "next/navigation";

// All traffic now goes to the flat /dashboard route
export default function RoleDashboardPage() {
  redirect("/dashboard");
}
