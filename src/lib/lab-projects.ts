import { listProjects, type Project } from "@/lib/appflowy-projects";
import { isAppFlowyConfigured } from "@/lib/appflowy";
import { staticLabProjects } from "@/lib/cms-static";

// In-house builds ("lab" projects) — self-built products shown on /work and
// the public /projects page. AppFlowy `[Project]` docs with an explicit
// **Type**: Internal merge in at render time; staticLabProjects is the
// curated floor so the section never renders empty.

export async function loadLabProjects(): Promise<Project[]> {
  try {
    const ok = await isAppFlowyConfigured();
    if (!ok) return [...staticLabProjects];
    const all = await listProjects();
    const cms = all.filter(
      (p) =>
        p.type === "Internal" &&
        p.typeExplicit === true &&
        (p.status === "Completed" || p.status === "In Progress")
    );
    return mergeLabProjects(cms);
  } catch {
    return [...staticLabProjects];
  }
}

export function mergeLabProjects(cms: Project[]): Project[] {
  const seen = new Set(cms.map((p) => p.name.toLowerCase()));
  const extras = staticLabProjects.filter((p) => !seen.has(p.name.toLowerCase()));
  return [...cms, ...extras];
}
