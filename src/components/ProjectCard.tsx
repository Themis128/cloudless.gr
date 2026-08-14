import type { Project } from "@/lib/appflowy-projects";

const STATUS_STYLES: Record<string, { badge: string; bar: string }> = {
  Planning: {
    badge: "bg-neon-blue/10 text-neon-blue border-neon-blue/30",
    bar: "bg-neon-blue",
  },
  "In Progress": {
    badge: "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30",
    bar: "bg-neon-cyan",
  },
  "On Hold": {
    badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    bar: "bg-yellow-400",
  },
  Completed: {
    badge: "bg-neon-green/10 text-neon-green border-neon-green/30",
    bar: "bg-neon-green",
  },
  Cancelled: {
    badge: "bg-slate-700/40 text-slate-500 border-slate-600/30",
    bar: "bg-slate-600",
  },
};

const PRIORITY_COLOR: Record<string, string> = {
  Critical: "text-red-400",
  High: "text-neon-magenta",
  Medium: "text-yellow-400",
  Low: "text-slate-500",
};

const PRIORITY_ICON: Record<string, string> = {
  Critical: "▲▲",
  High: "▲",
  Medium: "◆",
  Low: "▽",
};

const TYPE_STYLES: Record<string, string> = {
  Client: "border-neon-magenta/20 bg-neon-magenta/10 text-neon-magenta",
  Internal: "border-slate-700 bg-slate-800/50 text-slate-400",
  Maintenance: "border-yellow-500/20 bg-yellow-500/10 text-yellow-400",
};

function formatDate(iso: string) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
      timeZone: "Europe/Athens",
    });
  } catch {
    return null;
  }
}

interface ProjectCardProps {
  project: Project;
  /** Render as an anchor tag linking to the project URL */
  linkToNotion?: boolean;
  className?: string;
}

export default function ProjectCard({
  project,
  linkToNotion = false,
  className = "",
}: ProjectCardProps) {
  const statusStyle = STATUS_STYLES[project.status] ?? STATUS_STYLES.Planning;
  const priorityColor = PRIORITY_COLOR[project.priority] ?? "text-slate-400";
  const priorityIcon = PRIORITY_ICON[project.priority] ?? "◆";
  const typeStyle = TYPE_STYLES[project.type] ?? TYPE_STYLES.Internal;
  const startFmt = formatDate(project.startDate);
  const dueFmt = formatDate(project.dueDate);

  const inner = (
    <div
      className={`group neon-border bg-void-light/50 rounded-xl p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 ${className}`}
    >
      {/* Header row */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="font-heading group-hover:text-neon-cyan text-base leading-snug font-bold text-white transition-colors">
          {project.name}
        </h3>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-medium ${statusStyle.badge}`}
        >
          {project.status}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-mono text-[10px] text-slate-500">Progress</span>
          <span className="font-mono text-[10px] text-slate-400">{project.progress}%</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full transition-all ${statusStyle.bar}`}
            style={{
              width: `${Math.min(100, Math.max(0, project.progress))}%`,
            }}
          />
        </div>
      </div>

      {/* Description */}
      {project.description && (
        <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-slate-400">
          {project.description}
        </p>
      )}

      {/* Tags */}
      {project.tags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {project.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded border border-slate-700 bg-slate-800/50 px-2 py-0.5 font-mono text-[9px] text-slate-500"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`rounded border px-2 py-0.5 font-mono text-[9px] font-medium ${typeStyle}`}
          >
            {project.type}
          </span>
          <span className={`font-mono text-[10px] font-semibold ${priorityColor}`}>
            {priorityIcon} {project.priority}
          </span>
        </div>
        {(startFmt || dueFmt) && (
          <span className="font-mono text-[10px] text-slate-600">
            {startFmt && dueFmt ? `${startFmt} → ${dueFmt}` : (startFmt ?? dueFmt)}
          </span>
        )}
      </div>
    </div>
  );

  if (linkToNotion && project.url) {
    return (
      <a href={project.url} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }

  return inner;
}
