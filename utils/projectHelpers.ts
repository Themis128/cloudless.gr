import type { Project, ProjectImage, ProjectTag } from "../types/projects";

export function findThumbnailImage(
  images: ProjectImage[]
): ProjectImage | undefined {
  return images.find((image) => image.is_thumbnail);
}

export function findPrimaryTags(tags: ProjectTag[]): ProjectTag[] | undefined {
  return tags.filter((tag) => tag.is_primary);
}

export function findFavoriteProjects(projects: Project[]): Project[] {
  return projects.filter((project) => project.isFavorite);
}
