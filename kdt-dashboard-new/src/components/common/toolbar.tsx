'use client';

import Link from "next/link";
import { Home as HomeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Toolbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md p-4 flex items-center justify-between">
      <Link href="/">
        <Button variant="ghost" size="icon" className="text-gray-700 hover:bg-gray-100">
          <HomeIcon className="h-6 w-6" />
        </Button>
      </Link>
      <span className="text-xl font-semibold text-gray-800">KDT 대시보드</span>
      <div>{/* Add more toolbar items here if needed */}</div>
    </nav>
  );
} 