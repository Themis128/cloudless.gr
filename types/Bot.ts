// Bot type
export interface Bot {
  id: string; // uuid
  name: string;
  prompt: string;
  created_at: string;
  user_id?: string;       // If bots are user-specific
  avatar_url?: string;    // Optional profile/avatar for the bot
  is_active?: boolean;    // Bot enabled/disabled
  model?: string;         // (optional) model used, like gpt-3.5-turbo
  template_type?: string; // For categorization, e.g., "support", "dev-helper"
  memory?: string;        // Optional memory for the bot
  tools?: string;         // Optional tools the bot can use
}

