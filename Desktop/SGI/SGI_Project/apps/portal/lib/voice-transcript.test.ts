/**
 * Tests de la logique d'assemblage de la dictée vocale.
 * Runner : vitest (`pnpm exec vitest run`).
 */
import { describe, expect, test } from "vitest";

import {
  buildVoiceText,
  VoiceSession,
  type SpeechResultLike,
} from "./voice-transcript";

const F = (transcript: string): SpeechResultLike => ({ isFinal: true, transcript });
const I = (transcript: string): SpeechResultLike => ({ isFinal: false, transcript });

describe("buildVoiceText", () => {
  test("pas d'espace en tête quand la base est vide", () => {
    expect(buildVoiceText("", "", "bonjour")).toBe("bonjour");
  });

  test("séparateur entre base et texte dicté", () => {
    expect(buildVoiceText("J'ai besoin", "", "d'un appartement")).toBe(
      "J'ai besoin d'un appartement",
    );
  });

  test("pas de double espace si la base finit par une espace", () => {
    expect(buildVoiceText("J'ai besoin ", "", "d'un appartement")).toBe(
      "J'ai besoin d'un appartement",
    );
  });

  test("séparateur entre finalisé et provisoire", () => {
    expect(buildVoiceText("", "bonjour le monde", "je cherche")).toBe(
      "bonjour le monde je cherche",
    );
  });

  test("base inchangée si rien n'est dicté", () => {
    expect(buildVoiceText("texte", "", "")).toBe("texte");
  });
});

describe("VoiceSession", () => {
  test("NE duplique PAS sur interim → final (bug d'origine)", () => {
    const s = new VoiceSession("");
    expect(s.onResult(0, [I("bonjour")])).toBe("bonjour");
    expect(s.onResult(0, [I("bonjour le")])).toBe("bonjour le");
    expect(s.onResult(0, [F("bonjour le monde")])).toBe("bonjour le monde");
  });

  test("plusieurs phrases finalisées sans répétition", () => {
    const s = new VoiceSession("");
    s.onResult(0, [F("bonjour le monde")]);
    expect(s.onResult(1, [F("bonjour le monde"), I("je cherche")])).toBe(
      "bonjour le monde je cherche",
    );
    expect(s.onResult(1, [F("bonjour le monde"), F("je cherche un bien")])).toBe(
      "bonjour le monde je cherche un bien",
    );
  });

  test("préserve le texte déjà saisi (base figée)", () => {
    const s = new VoiceSession("Je cherche");
    expect(s.onResult(0, [I("un appartement")])).toBe("Je cherche un appartement");
    expect(s.onResult(0, [F("un appartement à Dubai Marina")])).toBe(
      "Je cherche un appartement à Dubai Marina",
    );
  });

  test("simulation longue, aucune accumulation parasite", () => {
    const s = new VoiceSession("");
    for (const t of ["je", "je veux", "je veux un", "je veux un studio"]) {
      s.onResult(0, [I(t)]);
    }
    const last = s.onResult(0, [F("je veux un studio")]);
    expect(last).toBe("je veux un studio");
    expect(last.match(/studio/g)?.length).toBe(1);
  });
});
