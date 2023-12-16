import { UserInputMachineScoring } from "./scoring";

export const readSpanishWords = (scoring: UserInputMachineScoring): Boolean => {
  let isSpanish = false;

  if (scoring.low_cost_spanish_points > 2) {
    isSpanish = true;
  }

  return isSpanish;
};
