"use client"

import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

// Sweeping gradient-text shimmer for pending/running labels (adopted from
// Coder's Shimmer). Animates backgroundPosition via framer-motion, which is
// already a project dependency, so no extra CSS keyframes are needed.
export function Shimmer({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  return (
    <motion.span
      className={cn(
        "inline-block bg-clip-text bg-[length:200%_100%] text-transparent",
        "bg-[linear-gradient(90deg,currentColor_35%,color-mix(in_oklab,currentColor,white_70%)_50%,currentColor_65%)]",
        className
      )}
      animate={{ backgroundPosition: ["150% 0%", "-50% 0%"] }}
      transition={{ duration: 1.4, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
    >
      {children}
    </motion.span>
  )
}
