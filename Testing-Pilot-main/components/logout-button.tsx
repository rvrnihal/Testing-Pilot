"use client";

import { useRouter } from "next/navigation";
import { Button } from "./button";
import { clearToken } from "../lib/client-api";

export function LogoutButton() {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      onClick={() => {
        clearToken();
        router.push("/login");
        router.refresh();
      }}
    >
      Logout
    </Button>
  );
}

