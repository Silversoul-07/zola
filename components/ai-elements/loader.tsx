"use client";

import { cn } from "@/lib/utils";
import { Loader2Icon } from "lucide-react";
import type { HTMLAttributes } from "react";

export type LoaderProps = HTMLAttributes<HTMLDivElement> & {
  size?: number;
};

export const Loader = ({ className, size = 16, ...props }: LoaderProps) => (
  <div
    className={cn("inline-flex animate-spin items-center justify-center", className)}
    {...props}
  >
    <Loader2Icon className="text-muted-foreground" size={size} />
  </div>
);
