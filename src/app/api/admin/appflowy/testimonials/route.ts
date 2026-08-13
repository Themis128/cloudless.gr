import { getAllTestimonialsAdmin } from "@/lib/appflowy-testimonials";
import { createAppFlowyAdminHandlers } from "@/lib/appflowy-admin-cms-handlers";

export const { GET, POST, PATCH, DELETE } = createAppFlowyAdminHandlers({
  surface: "Testimonials",
  listKey: "testimonials",
  list: getAllTestimonialsAdmin,
  createRequired: {
    field: "name",
    message: "name is required",
    read: (body) => body.name,
  },
});
