import { isAuthoredEquationOperator } from "@/lib/authored-lesson";

function getSideIssue(side: readonly { label: string }[]): string | null {
  let needsTerm = true;
  let openParentheses = 0;
  for (const [index, token] of side.entries()) {
    const label = token.label;
    if (label === "(") {
      openParentheses += 1;
      needsTerm = true;
    } else if (label === ")") {
      if (openParentheses === 0 || needsTerm) return "Close parentheses after a term.";
      openParentheses -= 1;
      needsTerm = false;
    } else if (isAuthoredEquationOperator(label)) {
      if (needsTerm && (label === "-" || label === "−")) continue;
      if (needsTerm) return index === 0 ? "Start each side with a number or variable." : "Choose a term between operators.";
      needsTerm = true;
    } else {
      needsTerm = false;
    }
  }
  if (openParentheses > 0) return "Close open parentheses before saving.";
  if (needsTerm) return "Finish each side with a term before saving.";
  return null;
}

/** A short authoring guard; runtime and lesson validation still own the full contract. */
export function getEquationDraftIssue(tokens: readonly { label: string }[]): string | null {
  if (tokens.length === 0) return "Add a term to start your equation.";
  const equalsIndexes = tokens.flatMap((token, index) => token.label === "=" ? [index] : []);
  if (equalsIndexes.length === 0) return "Add an = sign and a right side before saving.";
  if (equalsIndexes.length > 1) return "Use one = sign in an equation.";
  const equalsIndex = equalsIndexes[0];
  const left = tokens.slice(0, equalsIndex);
  const right = tokens.slice(equalsIndex + 1);
  if (!left.some((token) => !isAuthoredEquationOperator(token.label)) ||
      !right.some((token) => !isAuthoredEquationOperator(token.label))) {
    return "Add a term on both sides of the = sign.";
  }
  return getSideIssue(left) ?? getSideIssue(right);
}
