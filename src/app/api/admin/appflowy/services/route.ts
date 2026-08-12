import { getServices } from "@/lib/appflowy-services";
import { createAppFlowyAdminHandlers } from "@/lib/appflowy-admin-cms-handlers";

export const { GET, POST, PATCH, DELETE } = createAppFlowyAdminHandlers({
  surface: "Services",
  listKey: "services",
  list: getServices,
  createRequired: {
    field: "name",
    message: "name is required",
    read: (body) => body.name,
  },
});
