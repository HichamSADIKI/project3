/**
 * voice-transcript — assemblage du texte issu de la dictée vocale.
 *
 * La Web Speech API (`SpeechRecognition`) émet des événements `onresult`
 * répétés : pour une même phrase, plusieurs résultats *interim* (provisoires)
 * cumulatifs, puis un résultat *final*. Le piège classique est d'AJOUTER le
 * texte reconnu au contenu précédent à chaque événement — or ce contenu
 * contient déjà la partie finalisée, d'où une duplication en cascade.
 *
 * Règle correcte : on repart toujours d'une base figée (le texte saisi avant
 * de lancer la dictée) et on RECONSTRUIT la valeur complète = base + finalisé
 * + provisoire. La valeur n'est jamais dérivée de l'état précédent du champ.
 */

/** Joint deux fragments avec une seule espace de séparation si nécessaire. */
function join(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return a.endsWith(" ") ? `${a}${b}` : `${a} ${b}`;
}

/** Concatène la base figée avec le texte dicté, en gérant l'espace de jonction. */
export function buildVoiceText(
  base: string,
  finalText: string,
  interim: string,
): string {
  const spoken = join(finalText, interim);
  if (!spoken) return base;
  return join(base, spoken);
}

export interface SpeechResultLike {
  isFinal: boolean;
  transcript: string;
}

/**
 * Accumulateur stateful reproduisant la logique d'un `onresult` continu.
 * Garde la base figée + le texte finalisé cumulé, et recalcule la valeur
 * complète du champ à chaque événement (pas de dérivation depuis l'état UI).
 */
export class VoiceSession {
  private readonly base: string;
  private finalText = "";

  constructor(base: string) {
    this.base = base;
  }

  /** Traite un événement `onresult` et renvoie la valeur complète du champ. */
  onResult(resultIndex: number, results: SpeechResultLike[]): string {
    let interim = "";
    for (let i = resultIndex; i < results.length; i++) {
      const r = results[i];
      if (r.isFinal) {
        // Espace de séparation entre segments finalisés si nécessaire.
        const sep =
          this.finalText && !this.finalText.endsWith(" ") ? " " : "";
        this.finalText += `${sep}${r.transcript.trim()}`;
      } else {
        interim += r.transcript;
      }
    }
    return buildVoiceText(this.base, this.finalText, interim);
  }
}
