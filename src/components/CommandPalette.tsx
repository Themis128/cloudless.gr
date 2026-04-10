"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";

const navItems = [
  { label: "Home", path: "/", icon: "\u2302" },
  { label: "Services", path: "/services", icon: "\u25C8" },
  { label: "Store", path: "/store", icon: "\u25CE" },
  { label: "Blog", path: "/blog", icon: "\u25A4" },
  { label: "Contact", path: "/contact", icon: "\u2709" },
];

const actionItems = [
  { label: "Get a Free Audit", path: "/contact", icon: "\u26A1" },
  { label: "View Pricing", path: "/services", icon: "\u25C7" },
];

const groupHeadingClass =
  "**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-[10px] **:[[cmdk-group-heading]]:font-mono **:[[cmdk-group-heading]]:tracking-widest **:[[cmdk-group-heading]]:text-slate-600 **:[[cmdk-group-heading]]:uppercase";

export default function CommandPalette() {
  const [open, setOpen] = useState(false);

  const isE2E = process.env.NEXT_PUBLIC_E2E === "1";

  useEffect(() => {
    if (isE2E) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => (prev ? false : true));
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isE2E]);

  function navigate(path: string) {
    // Use location navigation to avoid router initialization timing issues.
    window.location.assign(path);
    setOpen(false);
  }

  if (isE2E || !open) return null;

  return (
    <div className="fixed inset-0 z-100">
      <div className="bg-void/70 absolute inset-0 backdrop-blur-sm" onClick={() => setOpen(false)} />

      <div className="relative mx-auto mt-[20vh] max-w-lg px-4">
        <Command
          className="border-neon-cyan/30 bg-void overflow-hidden rounded-lg border shadow-[0_0_40px_rgba(0,255,245,0.1)]"
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <Command.Input
            placeholder="Type a command or search..."
            className="border-neon-cyan/15 w-full border-b bg-transparent px-4 py-3.5 font-mono text-sm text-white outline-none placeholder:text-slate-500"
            autoFocus
          />

          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center font-mono text-sm text-slate-500">
              No results found.
            </Command.Empty>

            <Command.Group heading="Navigation" className={groupHeadingClass}>
              {navItems.map((item) => (
                <Command.Item
                  key={item.path}
                  value={item.label}
                  onSelect={() => navigate(item.path)}
                  className="data-[selected=true]:bg-neon-cyan/10 data-[selected=true]:text-neon-cyan flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 font-mono text-sm text-slate-400 transition-colors"
                >
                  <span className="text-neon-cyan/40 w-4 text-center text-xs">{item.icon}</span>
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Separator className="bg-neon-cyan/10 my-1 h-px" />

            <Command.Group heading="Actions" className={groupHeadingClass}>
              {actionItems.map((item) => (
                <Command.Item
                  key={item.label}
                  value={item.label}
                  onSelect={() => navigate(item.path)}
                  className="data-[selected=true]:bg-neon-magenta/10 data-[selected=true]:text-neon-magenta flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 font-mono text-sm text-slate-400 transition-colors"
                >
                  <span className="text-neon-magenta/40 w-4 text-center text-xs">{item.icon}</span>
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>

          <div className="border-neon-cyan/10 flex items-center gap-4 border-t px-4 py-2">
            <span className="font-mono text-[10px] text-slate-600">
              <kbd className="bg-void-lighter rounded border border-slate-700 px-1.5 py-0.5 text-slate-500">
                {"\u2318"}K
              </kbd>{" "}
              toggle
            </span>
            <span className="font-mono text-[10px] text-slate-600">
              <kbd className="bg-void-lighter rounded border border-slate-700 px-1.5 py-0.5 text-slate-500">
                ESC
              </kbd>{" "}
              close
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
