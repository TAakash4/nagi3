import { and, eq } from "drizzle-orm";

import { db } from "./db";
import { projectsTable } from "./projects";
import type { ProjectStatus, ProjectUpdateInput } from "./project-parsing";

export {
  isProjectStatus,
  parseProjectStatusChange,
  parseProjectUpdate,
  projectStatuses,
  projectStatusLabel,
  type ProjectStatus,
  type ProjectUpdateInput,
} from "./project-parsing";

export async function upsertProject(chatId: number, input: ProjectUpdateInput): Promise<void> {
  await db.insert(projectsTable).values({
    chatId,
    name: input.name,
    currentFocus: input.currentFocus,
    nextAction: input.nextAction,
    progressPercent: input.progressPercent,
  }).onConflictDoUpdate({
    target: [projectsTable.chatId, projectsTable.name],
    set: {
      currentFocus: input.currentFocus,
      nextAction: input.nextAction,
      progressPercent: input.progressPercent,
      updatedAt: new Date(),
    },
  });
}

export async function changeProjectStatus(
  chatId: number,
  name: string,
  status: ProjectStatus,
): Promise<boolean> {
  const updated = await db.update(projectsTable)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(projectsTable.chatId, chatId), eq(projectsTable.name, name)))
    .returning({ id: projectsTable.id });
  return updated.length > 0;
}
