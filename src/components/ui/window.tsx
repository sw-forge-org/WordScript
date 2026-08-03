import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface WindowProps {
  children: React.ReactNode;
  title: string;
  onClose?: () => void;
  className?: string;
}

/* The `glass` variant is gone (plan §5.3, ADR 0051): `backdrop-blur-2xl` is
   inert in the shipped WebKitGTK while `@supports` reports it as available, so
   it rendered nothing on Linux and no feature guard could tell. */
export function Window({
  children,
  title,
  onClose,
  className,
}: WindowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={cn(
        "flex h-full w-full flex-col rounded-[var(--radius-lg)] border overflow-hidden",
        "bg-[var(--surface-2)] border-[var(--hairline)] shadow-[inset_0_1px_0_var(--specular-strong),inset_0_-1px_0_var(--pressed-strong),0_20px_60px_rgba(0,0,0,0.40)]",
        className
      )}
    >
      <div className="relative flex items-center justify-center border-b border-[var(--hairline)] px-4 py-2 bg-[var(--surface-3)]">
        {onClose && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-3 h-3 rounded-full bg-[#ff5f57] hover:brightness-90 transition-all shadow-sm"
              aria-label="Close"
            />
            <span className="w-3 h-3 rounded-full bg-[#febc2e] opacity-60" />
            <span className="w-3 h-3 rounded-full bg-[#28c840] opacity-60" />
          </div>
        )}
        <div className="text-[12px] font-medium text-[var(--fg-dim)] tracking-wide">
          {title}
        </div>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col relative">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.3 }}
          className="h-full flex flex-col overflow-auto"
        >
          {children}
        </motion.div>
      </div>
    </motion.div>
  );
}
