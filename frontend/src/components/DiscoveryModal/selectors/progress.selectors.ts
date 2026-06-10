// selectors/progress.selectors.ts

export const getProgressPercent = (
  bom: any[],
  wiring: any[],
  milestones: any[],
  logs: any[],
  isCompleted: boolean,
  isFailed: boolean
): number => {
  if (isCompleted) return 100;
  if (isFailed) return 0;

  let base = 5;

  if (bom && bom.length > 0) {
    base = 25;

    if (wiring && wiring.length > 0) {
      base = 50;

      if (milestones && milestones.length > 0) {
        base = 75;

        if (
          logs.some(
            l =>
              l.type === "tool_call" &&
              l.name === "generate_diagram_json" &&
              l.status === "done"
          )
        ) {
          base = 90;
        }
      }
    }
  }

  return base;
};

export const getProgressStatus = (
  progressPercent: number,
  isCompleted: boolean,
  isFailed: boolean
): string => {
  if (isCompleted) {
    return "Formulation completed successfully!";
  }

  if (isFailed) {
    return "Formulation paused/interrupted.";
  }

  if (progressPercent === 5) {
    return "Discovering and sourcing components...";
  }

  if (progressPercent === 25) {
    return "Generating wiring connection matrix...";
  }

  if (progressPercent === 50) {
    return "Structuring code milestones and test parameters...";
  }

  if (progressPercent === 75) {
    return "Mapping Wokwi schematic layout and diagrams...";
  }

  if (progressPercent === 90) {
    return "Finalizing formulation payload...";
  }

  return "Initializing formulation assistant...";
};