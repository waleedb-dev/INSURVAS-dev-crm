"use client";
import React, { useEffect, useState } from "react";
import { T } from "@/lib/theme";
import { IconCheck, IconX, IconInfoCircle, IconAlertTriangle } from "@tabler/icons-react";

export type ToastType = "success" | "error" | "info" | "warning";

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type = "success", duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for fade-out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const config = {
    success: {
      icon: <IconCheck size={18} />,
      bg: "#ecfdf5",
      border: "#10b981",
      color: "#065f46"
    },
    error: {
      icon: <IconX size={18} />,
      bg: "#fef2f2",
      border: "#ef4444",
      color: "#991b1b"
    },
    info: {
      icon: <IconInfoCircle size={18} />,
      bg: "#eff6ff",
      border: "#3b82f6",
      color: "#1e40af"
    },
    warning: {
      icon: <IconAlertTriangle size={18} />,
      bg: "#fffbeb",
      border: "#f59e0b",
      color: "#92400e"
    }
  }[type];

  return (
    <div
      style={{
        position: "fixed",
        top: 24,
        right: 24,
        zIndex: 9999,
        padding: "16px 20px",
        borderRadius: "12px",
        backgroundColor: config.bg,
        border: `1.5px solid ${config.border}`,
        color: config.color,
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
        transform: isVisible ? "translateX(0)" : "translateX(120%)",
        opacity: isVisible ? 1 : 0,
        transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        fontFamily: T.font,
        fontWeight: 700,
        fontSize: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        {config.icon}
      </div>
      <span>{message}</span>
      <button 
        onClick={() => { setIsVisible(false); setTimeout(onClose, 300); }}
        style={{ 
          background: "none", 
          border: "none", 
          cursor: "pointer", 
          padding: 4, 
          marginLeft: 8, 
          color: "inherit", 
          opacity: 0.6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <IconX size={14} />
      </button>
    </div>
  );
}
