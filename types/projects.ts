export type Project = {
  id: number;
  project_name: string;
  slug: string;
  overview: string;
  description: string;
  isFavorite: boolean;
  live_url: string;
  github_url: string;
  tech_tags: ProjectTag[];
  images: ProjectImage[];
};

export type ProjectImage = {
  img_name: string;
  img_url: string;
  is_thumbnail: boolean;
};

export type ProjectTag = {
  tag_name: string;
  is_primary: boolean;
};
