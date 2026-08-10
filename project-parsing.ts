export const projectStatuses = ["active", "paused", "completed", "archived"] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "進行中",
  paused: "一時停止",
  completed: "完了",
  archived: "アーカイブ",
};

export function isProjectStatus(value: string): value is ProjectStatus {
  return (projectStatuses as readonly string[]).includes(value);
}

export function projectStatusLabel(status: ProjectStatus): string {
  return PROJECT_STATUS_LABELS[status];
}

export type ProjectUpdateInput = {
  name: string;
  currentFocus: string | null;
  nextAction: string | null;
  progressPercent: number | null;
};

export function parseProjectUpdate(input: string): ProjectUpdateInput | null {
  const [name, currentFocus, nextAction, progressText] = input
    .split("|")
    .map((part) => part.trim());

  if (!name) return null;

  const progressPercent = progressText === undefined || progressText === ""
    ? null
    : Number(progressText.replace("%", ""));

  if (
    progressPercent !== null
    && (!Number.isInteger(progressPercent) || progressPercent < 0 || progressPercent > 100)
  ) {
    return null;
  }

  return {
    name,
    currentFocus: currentFocus || null,
    nextAction: nextAction || null,
    progressPercent,
  };
}

export function parseProjectStatusChange(input: string): { name: string; status: ProjectStatus } | null {
  const [name, statusRaw] = input.split("|").map((part) => part.trim());
  if (!name || !statusRaw || !isProjectStatus(statusRaw)) return null;
  return { name, status: statusRaw };
}
