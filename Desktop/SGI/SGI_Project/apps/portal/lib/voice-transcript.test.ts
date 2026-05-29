/**
 * Tests de la logique d'assemblage de la dictée vocale.
 *
 * Utilise le runner natif `node:test` (aucune dépendance externe : vitest n'est
 * pas installé dans ce repo). Exécuter avec :
 *   node --experimental-strip-types --test apps/portal/lib/voice-transcript.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildVoiceText,
  VoiceSession,
  type SpeechResultLike,
} from "./voice-transcript.ts";

const F = (transcript: string): SpeechResultLike => ({ isFinal: true, transcript });
const I = (transcript: string): SpeechResultLike => ({ isFinal: false, transcript });

test("buildVoiceText — pas d'espace en tête quand la base est vide", () => {
  assert.equal(buildVoiceText("", "", "bonjour"), "bonjour");
});

test("buildVoiceText — séparateur entre base et texte dicté", () => {
  assert.equal(
    buildVoiceText("J'ai besoin", "", "d'un appartement"),
    "J'ai besoin d'un appartement",
  );
});

test("buildVoiceText — pas de double espace si la base finit par une espace", () => {
  assert.equal(
    buildVoiceText("J'ai besoin ", "", "d'un appartement"),
    "J'ai besoin d'un appartement",
  );
});

test("buildVoiceText — séparateur entre finalisé et provisoire", () => {
  assert.equal(buildVoiceText("", "bonjour le monde", "je cherche"), "bonjour le monde je cherche");
});

test("buildVoiceText — base inchangée si rien n'est dicté", () => {
  assert.equal(buildVoiceText("texte", "", ""), "texte");
});

test("VoiceSession — NE duplique PAS sur interim → final (bug d'origine)", () => {
  const s = new VoiceSession("");
  assert.equal(s.onResult(0, [I("bonjour")]), "bonjour");
  assert.equal(s.onResult(0, [I("bonjour le")]), "bonjour le");
  assert.equal(s.onResult(0, [F("bonjour le monde")]), "bonjour le monde");
});

test("VoiceSession — plusieurs phrases finalisées sans répétition", () => {
  const s = new VoiceSession("");
  s.onResult(0, [F("bonjour le monde")]);
  assert.equal(
    s.onResult(1, [F("bonjour le monde"), I("je cherche")]),
    "bonjour le monde je cherche",
  );
  assert.equal(
    s.onResult(1, [F("bonjour le monde"), F("je cherche un bien")]),
    "bonjour le monde je cherche un bien",
  );
});

test("VoiceSession — préserve le texte déjà saisi (base figée)", () => {
  const s = new VoiceSession("Je cherche");
  assert.equal(s.onResult(0, [I("un appartement")]), "Je cherche un appartement");
  assert.equal(
    s.onResult(0, [F("un appartement à Dubai Marina")]),
    "Je cherche un appartement à Dubai Marina",
  );
});

test("VoiceSession — simulation longue, aucune accumulation parasite", () => {
  const s = new VoiceSession("");
  for (const t of ["je", "je veux", "je veux un", "je veux un studio"]) {
    s.onResult(0, [I(t)]);
  }
  const last = s.onResult(0, [F("je veux un studio")]);
  assert.equal(last, "je veux un studio");
  assert.equal(last.match(/studio/g)?.length, 1);
});
