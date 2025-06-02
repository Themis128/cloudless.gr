import type { Project, ProjectImage, ProjectTag } from '../types/projects';

export function findThumbnailImage(images: ProjectImage[]): ProjectImage | undefined {
  return images.find((image) => image.is_thumbnail);
}

export function findPrimaryTags(tags: ProjectTag[]): ProjectTag[] | undefined {
  return tags.filter((tag) => tag.is_primary);
}

export function findFavoriteProjects(projects: Project[]): Project[] {
  return projects.filter((project) => project.isFavorite);
}

// Demo/mock data for projects
export function getAllProjects() {
  return [
    {
      id: 1,
      project_name: 'Nuxt 3 Portfolio',
      slug: 'nuxt-3-portfolio',
      overview: 'A modern portfolio built with Nuxt 3.',
      description: 'Showcase your work and skills with a blazing fast Nuxt 3 site.',
      isFavorite: true,
      live_url: 'https://portfolio.example.com',
      github_url: 'https://github.com/example/nuxt3-portfolio',
      tech_tags: [
        { tag_name: 'Nuxt 3', is_primary: true },
        { tag_name: 'TypeScript', is_primary: false },
      ],
      images: [{ img_name: 'thumb', img_url: '/images/portfolio-thumb.png', is_thumbnail: true }],
    },
    {
      id: 2,
      project_name: 'LLM Dev Agent',
      slug: 'llm-dev-agent',
      overview: 'Integrate LLMs into your dev workflow.',
      description: 'A Nuxt 3 app for portable LLM integration and codegen.',
      isFavorite: false,
      live_url: '',
      github_url: 'https://github.com/example/llm-dev-agent',
      tech_tags: [
        { tag_name: 'Nuxt 3', is_primary: true },
        { tag_name: 'LLM', is_primary: true },
      ],
      images: [{ img_name: 'thumb', img_url: '/images/llm-thumb.png', is_thumbnail: true }],
    },
  ];
}
