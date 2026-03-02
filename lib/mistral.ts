import { TAXONOMY } from '@/constants/taxonomy';
import type { MistralVisionResult } from './types';

const MISTRAL_API_KEY = process.env.EXPO_PUBLIC_MISTRAL_API_KEY!;
const BASE_URL = 'https://api.mistral.ai/v1/chat/completions';

async function mistralPost(model: string, messages: object[], maxTokens = 600): Promise<string> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mistral API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

const TAXONOMY_JSON = JSON.stringify(TAXONOMY, null, 2);

// Single pixtral call: identify + enrich in one round trip
const VISION_PROMPT = `You are the AI behind Memoria, a real-world photo journal app. Identify what is in the image and return a single JSON response.

SUBCATEGORY RULE: The "subcategory" value MUST be one of the exact strings listed under the chosen category in the TAXONOMY below. Never invent or free-form a subcategory. If no existing subcategory fits the subject, use entry_type "gallery" or "rejected" instead.

TAXONOMY:
${TAXONOMY_JSON}

RETURN FORMAT (valid JSON only):
{
  "entry_type": "identified" | "gallery" | "rejected",
  "name": string | null,
  "category": string | null,
  "subcategory": string | null,
  "is_endangered": boolean,
  "description": string | null,
  "fun_fact": string | null
}

IDENTIFICATION CONFIDENCE:
- Only return entry_type "identified" when you can name the subject with REASONABLE CERTAINTY.
- If you recognise the general type but cannot confidently name the specific subject, return "gallery".
- When in doubt, "gallery" is the correct choice — do not guess a specific name.

ENTRY TYPE RULES:
- "identified": you can name the specific thing with confidence — species, model, landmark, artist+work, etc.
  Examples: "Golden Retriever", "Blue Jay", "Eiffel Tower", "1969 Ford Mustang Fastback"
- "gallery": you recognise the type but cannot name it specifically, OR you are uncertain, OR no subcategory in the taxonomy fits.
  Examples: unknown graffiti, unidentified car, generic cloud, unidentified mushroom, ambiguous food dish
- "rejected": nothing of notable natural, cultural, or world interest — or no clear collectable subject.
  Examples: blank wall, person's face, everyday clothing/socks/shoes being worn, generic garments,
  household objects, limbs or body parts as the main subject, phone screen, generic furniture

DESCRIPTION RULES:
- Describe THE SUBJECT of the photo (the specific thing being collected), not the scene, background, or incidental elements.
- If a hand, limb, or body part appears because it is holding or adjacent to the subject, ignore it — describe only the subject itself.
- Only describe what is LITERALLY AND VISUALLY OBSERVABLE about the subject.
- Never infer, assume, or fabricate: temperature, smell, taste, texture, backstory, internal state, or any physical attribute not directly visible.
- If something is unclear or not visible, stay vague or omit it entirely.
- 2-3 sentences. Do not start with the subject name. Null if rejected.

OTHER RULES:
- For "gallery": name is null. Write a brief description of the type (e.g. "Street art on a brick wall").
- For "rejected": all fields null/false except entry_type.
- is_endangered: true only for IUCN endangered or critically endangered species.
- fun_fact: one genuinely surprising fact about this specific subject. Null if none or if rejected/gallery.
- name format: for animals, plants, and fungi use "Common Name (Scientific Name)" when a well-known scientific name exists. Examples: "Blue Jay (Cyanocitta cristata)", "Sunflower seeds (Helianthus annuus)", "Portobello Mushroom (Agaricus bisporus)". For food dishes, vehicles, landmarks, and cultural subjects, use common name only.`;

export interface FullVisionResult extends MistralVisionResult {
  description: string | null;
  fun_fact: string | null;
}

export async function identifyAndEnrich(base64Image: string): Promise<FullVisionResult> {
  const content = await mistralPost('pixtral-12b-2409', [
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${base64Image}` },
        },
        {
          type: 'text',
          text: VISION_PROMPT,
        },
      ],
    },
  ], 800);

  const raw = JSON.parse(content);
  // Sanitize: Mistral occasionally returns these as objects instead of strings
  if (typeof raw.description !== 'string') raw.description = null;
  if (typeof raw.fun_fact !== 'string') raw.fun_fact = null;
  return raw as FullVisionResult;
}

export type RelabelResult =
  | {
      agreed: true;
      entry_type: 'identified';
      name: string;
      category: string;
      subcategory: string;
      is_endangered: boolean;
      description: string | null;
      fun_fact: string | null;
    }
  | {
      agreed: false;
      reason: string;
    };

export async function relabelEntry(base64Image: string, userSuggestion: string, originalName: string): Promise<RelabelResult> {
  const prompt = `This photo was previously identified as "${originalName}". The user believes this label is wrong and suggests it should be "${userSuggestion}".

Look at the image again. Is "${userSuggestion}" a plausible identification for what is visible?

GUIDELINES:
- The user is physically holding this object and has direct knowledge of what it is — weight their suggestion very heavily
- Agree if there is any plausible way the suggestion could be correct given what is visible
- Do not reject because the suggestion is "unlikely" or because your original identification seemed "more probable"
- Only reject if the visual evidence makes the suggestion absolutely impossible (e.g. image clearly shows a bird but user suggests a mammal, image clearly shows architecture but user suggests a food item)

SUBJECT RULE: The suggestion must refer to the PRIMARY SUBJECT of the photo — the specific thing being collected. Return agreed: false for suggestions that name background elements, furniture, flooring, walls, bedding, or anything that is context rather than the main subject.

SUBCATEGORY RULE: The "subcategory" value MUST be one of the exact strings listed under the chosen category in the TAXONOMY below. Never invent a category or subcategory. If the suggestion doesn't map cleanly to the taxonomy, return agreed: false.

TAXONOMY:
${TAXONOMY_JSON}

NAME FORMAT: for animals, plants, and fungi use "Common Name (Scientific Name)" when a well-known scientific name exists. For food dishes, vehicles, landmarks, and cultural subjects, use common name only.

If yes, return:
{ "agreed": true, "entry_type": "identified", "name": "...", "category": "...", "subcategory": "...", "is_endangered": false, "description": "2-3 sentences describing only what is literally visible", "fun_fact": "one surprising fact or null" }

If no, return:
{ "agreed": false, "reason": "A short friendly explanation of why this doesn't match what is visible." }`;

  const content = await mistralPost('pixtral-12b-2409', [
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
        { type: 'text', text: prompt },
      ],
    },
  ], 600);

  return JSON.parse(content) as RelabelResult;
}

export async function reinsistLabel(suggestion: string): Promise<RelabelResult> {
  const prompt = `A user insists their photo shows "${suggestion}". Without any image analysis, answer only:
1. Is "${suggestion}" a real, specific, identifiable thing in the world?
2. Can it be classified under any category and subcategory in the TAXONOMY below?

TAXONOMY:
${TAXONOMY_JSON}

NAME FORMAT: for animals, plants, and fungi use "Common Name (Scientific Name)" when a well-known scientific name exists. For food dishes, vehicles, landmarks, and cultural subjects, use common name only.

If both yes, return:
{ "agreed": true, "entry_type": "identified", "name": "...", "category": "...", "subcategory": "...", "is_endangered": false, "description": "2-3 sentences describing what this thing typically looks like", "fun_fact": "one surprising fact or null" }

If no (the suggestion is not a real thing, is nonsensical, or cannot fit any taxonomy category), return:
{ "agreed": false, "reason": "Brief friendly explanation." }`;

  const content = await mistralPost('ministral-8b-2410', [
    { role: 'user', content: prompt },
  ], 400);

  const raw = JSON.parse(content);
  if (typeof raw.description !== 'string') raw.description = null;
  if (typeof raw.fun_fact !== 'string') raw.fun_fact = null;
  return raw as RelabelResult;
}

export async function generateNarration(
  name: string,
  category: string,
  funFact: string | null
): Promise<string> {
  const prompt = `Generate a 1-2 sentence spoken audio narration announcing the discovery of a "${name}" (${category}) for the Memoria app. Make it exciting and brief. ${funFact ? `Include this fun fact: "${funFact}"` : ''}

Return JSON: { "narration": "..." }`;

  const content = await mistralPost('ministral-8b-2410', [
    { role: 'user', content: prompt },
  ], 200);

  return (JSON.parse(content) as { narration: string }).narration;
}
