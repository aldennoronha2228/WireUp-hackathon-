// selectors/conflict.selectors.ts

export interface ConflictDetails {
  title: string;
  description: string;
  options: string[];
}

export const getConflictDetails = (
  logs: any[]
): ConflictDetails | null => {
  const errorLog = logs.find(
    log =>
      log.type === "error" ||
      (
        log.type === "tool_call" &&
        log.status === "failed"
      )
  );

  if (!errorLog) {
    return null;
  }

  const message = (
    errorLog.text ||
    JSON.stringify(errorLog.output) ||
    ""
  ).toLowerCase();

  const hasConflict =
    message.includes("conflict") ||
    message.includes("constraint") ||
    message.includes("power") ||
    message.includes("limit");

  if (!hasConflict) {
    return null;
  }

  return {
    title: "Constraint Conflict Detected",

    description:
      errorLog.text ||
      "The formulation agent detected conflicting requirements in your constraints (for example WiFi connectivity versus battery-life targets).",

    options: [
      "Optimize for low power (reduce WiFi updates)",
      "Increase battery capacity spec",
      "Change to low power BLE connectivity"
    ]
  };
};