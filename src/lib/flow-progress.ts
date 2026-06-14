export type FlowStepStatus = "complete" | "current" | "pending" | "error";

export type FlowStepDefinition = {
  id: number;
  eyebrow: string;
  title: string;
};

export type FlowStepPresentation = FlowStepDefinition & {
  status: FlowStepStatus;
  statusLabel: string;
  ariaLabel: string;
  isLocked: boolean;
  isGoal: boolean;
};

function getStatusLabel(status: FlowStepStatus) {
  if (status === "complete") return "Completado";
  if (status === "current") return "Actual";
  if (status === "error") return "Requiere atención";
  return "Pendiente";
}

export function buildFlowStepPresentation(
  steps: ReadonlyArray<FlowStepDefinition>,
  options: {
    activeStepId: number;
    unlockedStepId: number;
    errorStepIds?: number[];
    goalStepId?: number;
  },
): FlowStepPresentation[] {
  const errorIds = new Set(options.errorStepIds ?? []);

  return steps.map((step) => {
    const isCurrent = step.id === options.activeStepId;
    const isComplete = step.id < options.activeStepId && step.id <= options.unlockedStepId && !errorIds.has(step.id);
    const isLocked = step.id > options.unlockedStepId;
    const status: FlowStepStatus = errorIds.has(step.id)
      ? "error"
      : isCurrent
        ? "current"
        : isComplete
          ? "complete"
          : "pending";
    const statusLabel = getStatusLabel(status);

    return {
      ...step,
      status,
      statusLabel,
      ariaLabel: `${step.eyebrow}: ${step.title}. Estado: ${statusLabel}.`,
      isLocked,
      isGoal: step.id === (options.goalStepId ?? steps[steps.length - 1]?.id),
    };
  });
}
