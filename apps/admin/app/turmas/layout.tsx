import type { ReactNode } from "react";
import { AutoShell } from "@/components/shell/AutoShell";

export default function Layout({ children }: { children: ReactNode }) {
  return <AutoShell>{children}</AutoShell>;
}
