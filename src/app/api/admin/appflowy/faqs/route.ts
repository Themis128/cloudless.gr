import { getAllFaqsAdmin } from "@/lib/appflowy-faqs";
import { createAppFlowyAdminHandlers } from "@/lib/appflowy-admin-cms-handlers";

export const { GET, POST, PATCH, DELETE } = createAppFlowyAdminHandlers({
  surface: "FAQs",
  listKey: "faqs",
  list: getAllFaqsAdmin,
  createRequired: {
    field: "question",
    message: "question is required",
    read: (body) => body.question,
  },
});
