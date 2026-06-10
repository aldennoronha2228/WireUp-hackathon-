// selectors/stage.selectors.ts

export const getActiveStage = (
  logs: any[],
  bom: any[],
  wiring: any[],
  milestones: any[],
  isCompleted: boolean,
  isFailed: boolean
): string => {
  if (isCompleted) {
    return "curriculum";
  }

  if (isFailed) {
    return "validation";
  }

  const latestTool = [...logs]
    .reverse()
    .find(
      log =>
        log.type === "tool_call" &&
        log.status === "running"
    );

  if (latestTool) {
    if (
      latestTool.name === "search_library" ||
      latestTool.name ===
        "get_component_details"
    ) {
      return "components";
    }

    if (
      latestTool.name === "generate_wiring" ||
      latestTool.name === "validate_wiring"
    ) {
      return "wiring";
    }

    if (
      latestTool.name ===
        "generate_milestones" ||
      latestTool.name ===
        "generate_milestone"
    ) {
      return "curriculum";
    }
  }

  if (bom.length === 0) {
    return "components";
  }

  if (wiring.length === 0) {
    return "wiring";
  }

  if (milestones.length === 0) {
    return "curriculum";
  }

  return "validation";
};