import { getCaseStudies } from "@/lib/appflowy-case-studies";
import { createAppFlowyAdminHandlers } from "@/lib/appflowy-admin-cms-handlers";

export const { GET, POST, PATCH, DELETE } = createAppFlowyAdminHandlers({
  surface: "Case Studies",
  listKey: "caseStudies",
  list: getCaseStudies,
  createRequired: {
    field: "title",
    message: "title is required",
    read: (body) => body.title,
  },
});
