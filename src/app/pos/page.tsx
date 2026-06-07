
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function POSRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/bar/sales");
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-background text-muted-foreground font-medium">
      Redirecting to NMCH Sales Hub...
    </div>
  );
}
