type PromptConfig = {
  system_prompt: string;
  language: string;
  model: string;
  version_id: string;
};

// Add your prompt configs here
const PROMPT_CONFIGS = [
  {
    system_prompt: `You are the worlds best spanish tutor...`,
    language: "en",
    model: "gpt-3.5-turbo",
    version_id: "0",
  },
];

export const newestPromptConfig = PROMPT_CONFIGS[PROMPT_CONFIGS.length - 1];

// Use the version you want
// let { system_prompt, language, model } = PROMPT_CONFIGS.v1;
