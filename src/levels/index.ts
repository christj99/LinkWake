import type { LevelScript } from "../types/level-script";
import { validateLevelScript } from "../types/level-script";

import commerceAmazon from "./commerce-amazon.json";
import longformNyt from "./longform-nyt.json";
import referenceWikipedia from "./reference-wikipedia.json";

/**
 * All Phase 0 levels, validated at module load.
 * Throws LevelScriptValidationError synchronously if any file is malformed.
 */
export const LEVELS: readonly LevelScript[] = Object.freeze([
  validateLevelScript(longformNyt, "longform-nyt.json"),
  validateLevelScript(referenceWikipedia, "reference-wikipedia.json"),
  validateLevelScript(commerceAmazon, "commerce-amazon.json"),
]);

