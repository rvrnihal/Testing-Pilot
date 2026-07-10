"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/button";

export function AdminActions({ userId }: { userId: string }) {
  const router = useRouter();

  async function run(action: "approve" | "reject") {
    await fetch(`/api/admin/users/${userId}/${action}`, { method: "POST" });
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="primary" onClick={() => run("approve")}>
        Approve
      </Button>
      <Button variant="danger" onClick={() => run("reject")}>
        Reject
      </Button>
    </div>
  );
}

