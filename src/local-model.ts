export const textModelOptions = {
  expectedInputs: [{ type: "text" as const, languages: ["en"] }],
  expectedOutputs: [{ type: "text" as const, languages: ["en"] }],
};

export async function downloadedTextModel(): Promise<boolean> {
  const model = (globalThis as { LanguageModel?: { availability?: (options: typeof textModelOptions) => Promise<string> } | null }).LanguageModel;
  return typeof model?.availability === "function" && await model.availability(textModelOptions) === "available";
}
