"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

interface SubmittingModalProps {
  isOpen: boolean;
  stage?: "submitting" | "generating" | "finalizing";
}

export default function SubmittingModal({
  isOpen,
  stage = "submitting",
}: SubmittingModalProps) {
  const isGenerating = stage === "generating";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
          {/* Subtle Dim Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 bg-[#020609]/75 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Minimal 3D Floating Modal */}
          <div
            className="relative z-10 w-full max-w-[380px]"
            style={{ perspective: "1000px" }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20, rotateX: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -10 }}
              transition={{
                type: "spring",
                damping: 26,
                stiffness: 260,
              }}
              className="relative overflow-hidden rounded-2xl border border-[rgba(200,168,107,0.22)] bg-[#070e14]/95 p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_30px_rgba(200,168,107,0.08)] backdrop-blur-xl"
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* Subtle top edge specular highlight */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-[1px] bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent opacity-60" />

              {/* Minimal 3D Floating Ring Core */}
              <div
                className="relative mx-auto w-24 h-24 flex items-center justify-center mb-6"
                style={{ perspective: "600px", transformStyle: "preserve-3d" }}
              >
                {/* 3D Tilted Orbiting Gold Ring */}
                <motion.div
                  animate={{
                    rotateZ: 360,
                    rotateX: [60, 68, 60],
                    rotateY: [15, -15, 15],
                  }}
                  transition={{
                    rotateZ: { duration: 6, repeat: Infinity, ease: "linear" },
                    rotateX: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                    rotateY: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                  }}
                  className="absolute inset-0 rounded-full border-[1.5px] border-[var(--gold-muted)]/50 border-t-[var(--gold-bright)] shadow-[0_0_16px_rgba(200,168,107,0.25)]"
                  style={{ transformStyle: "preserve-3d" }}
                />

                {/* Inner Counter-Spinning Subtle Ring */}
                <motion.div
                  animate={{
                    rotateZ: -360,
                    rotateX: [45, 35, 45],
                  }}
                  transition={{
                    rotateZ: { duration: 4.5, repeat: Infinity, ease: "linear" },
                    rotateX: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
                  }}
                  className="absolute inset-2.5 rounded-full border border-dashed border-[var(--gold)]/30"
                  style={{ transformStyle: "preserve-3d" }}
                />

                {/* Floating Centered Emblem */}
                <motion.div
                  animate={{
                    scale: [1, 1.08, 1],
                    y: [-2, 2, -2],
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="relative z-10 w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--gold-bright)]/20 to-[var(--gold)]/10 border border-[var(--gold)]/40 flex items-center justify-center shadow-[0_0_20px_rgba(200,168,107,0.3)] backdrop-blur-sm"
                  style={{ transform: "translateZ(18px)" }}
                >
                  <Sparkles className="w-5 h-5 text-[var(--gold-bright)]" />
                </motion.div>
              </div>

              {/* Minimal Text Content */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--gold-muted)] mb-1.5">
                  ORAH 2K26
                </p>

                <h3 className="text-xl font-bold tracking-tight text-stone-100 mb-2">
                  {isGenerating ? "Preparing Your Ticket" : "Securing Registration"}
                </h3>

                <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-6 max-w-[260px] mx-auto">
                  {isGenerating
                    ? "Generating your entry pass and high-resolution ticket..."
                    : "Please wait a moment while we save your details..."}
                </p>
              </motion.div>

              {/* Sleek Minimal Progress Line */}
              <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden relative">
                <motion.div
                  className="h-full bg-gradient-to-r from-[var(--gold-dim)] via-[var(--gold-bright)] to-[var(--gold)] rounded-full"
                  animate={{
                    x: ["-100%", "100%"],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.6,
                    ease: "easeInOut",
                  }}
                  style={{ width: "60%" }}
                />
              </div>

              <div className="mt-4 flex items-center justify-between text-[9.5px] font-mono text-stone-500 uppercase tracking-wider">
                <span>Jesus Youth Pala</span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-pulse" />
                  Processing
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
