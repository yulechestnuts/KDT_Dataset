"use client";

import React from "react";
import { GlobalFilterProvider } from "@/contexts/FilterContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <GlobalFilterProvider>{children}</GlobalFilterProvider>;
}
