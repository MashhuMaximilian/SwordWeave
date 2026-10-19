import { handleContactRequest } from "@/lib/server/contact-handler";
import { deliverContactMessage, getContactMailConfig } from "@/lib/server/contact-mail";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const config = getContactMailConfig();
  return handleContactRequest(request, {
    configured: Boolean(config),
    deliver: async message => {
      if (!config) throw new Error("Contact delivery is not configured.");
      await deliverContactMessage(message, config);
    },
  });
}
