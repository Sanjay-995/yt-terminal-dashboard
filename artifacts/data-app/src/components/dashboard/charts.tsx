import React from "react";
import { formatCompact, formatCurrency, formatPercent } from "@/lib/formatters";

export function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const isDark = document.documentElement.classList.contains("dark");

  return (
    <div
      style={{
        backgroundColor: isDark ? "#16181d" : "#ffffff",
        borderRadius: "6px",
        padding: "10px 14px",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#e0e0e0"}`,
        color: isDark ? "#f3f4f6" : "#1a1a1a",
        fontSize: "13px",
        boxShadow: isDark
          ? "0 4px 12px rgba(0,0,0,0.6)"
          : "0 4px 6px rgba(0,0,0,0.1)",
        minWidth: "160px",
      }}
    >
      <div
        style={{
          marginBottom: "6px",
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          color: isDark ? "#d1d5db" : "#374151",
        }}
      >
        {payload.length === 1 &&
          payload[0].color &&
          payload[0].color !== "#ffffff" && (
            <span
              style={{
                display: "inline-block",
                width: "10px",
                height: "10px",
                borderRadius: "2px",
                backgroundColor: payload[0].color,
                flexShrink: 0,
              }}
            />
          )}
        {label}
      </div>
      {payload.map((entry: any, index: number) => {
        let displayValue = entry.value;
        if (typeof entry.value === "number") {
          const nameLower = (entry.name ?? "").toLowerCase();
          if (nameLower.includes("revenue")) {
            displayValue = formatCurrency(entry.value);
          } else if (nameLower.includes("rate") || nameLower.includes("engagement")) {
            displayValue = formatPercent(entry.value);
          } else {
            displayValue = entry.value.toLocaleString();
          }
        }

        return (
          <div
            key={index}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "3px",
            }}
          >
            {payload.length > 1 &&
              entry.color &&
              entry.color !== "#ffffff" && (
                <span
                  style={{
                    display: "inline-block",
                    width: "10px",
                    height: "10px",
                    borderRadius: "2px",
                    backgroundColor: entry.color,
                    flexShrink: 0,
                  }}
                />
              )}
            <span style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
              {entry.name}
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontWeight: 600,
                paddingLeft: "12px",
                color: isDark ? "#f3f4f6" : "#111827",
              }}
            >
              {displayValue}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function CustomLegend({ payload }: any) {
  if (!payload || payload.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "8px 16px",
        fontSize: "13px",
        marginTop: "12px",
      }}
    >
      {payload.map((entry: any, index: number) => (
        <div
          key={index}
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <span
            style={{
              display: "inline-block",
              width: "10px",
              height: "10px",
              borderRadius: "2px",
              backgroundColor: entry.color,
              flexShrink: 0,
            }}
          />
          <span className="text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}
