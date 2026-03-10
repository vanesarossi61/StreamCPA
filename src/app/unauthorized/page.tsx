/**
 * Unauthorized access page
 */
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <ShieldAlert className="h-16 w-16 text-destructive" />
      <h1 className="mt-6 text-3xl font-bold">Access Denied</h1>
      <p className="mt-2 text-muted-foreground">
        You don&apos;t have permission to access this page.
      </p>
      <Link href="/" className="mt-6">
        <Button>Go to Home</Button>
      </Link>
    </div>
  );
}
