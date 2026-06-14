import Groq from "groq-sdk";

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? "";

export async function getMoodQuote(moodLabel: string): Promise<string> {
  const groq = new Groq({ apiKey: GROQ_API_KEY, dangerouslyAllowBrowser: true } as any);

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "You are a warm, encouraging companion inside a personal finance app. " +
          "Given the user's current mood, give one short motivational quote or piece of " +
          "advice (max 140 characters, 1 sentence). No quotation marks, no hashtags, no emojis.",
      },
      { role: "user", content: `The user is feeling: ${moodLabel}. Give your quote now.` },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() || "";
}
