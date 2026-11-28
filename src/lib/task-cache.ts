import type { QueryClient } from "@tanstack/react-query";
import type { Task } from "../api/generated";
import { getTaskQueryKey, listTasksQueryKey } from "../api/generated/@tanstack/react-query.gen";

export function patchCachedTasks(queryClient: QueryClient, ids: string[], patch: Partial<Task>) {
  const patched = (task: Task) => (ids.includes(task.id) ? { ...task, ...patch } : task);
  queryClient.setQueryData<Task[]>(listTasksQueryKey(), (tasks) => tasks?.map(patched));
  for (const id of ids)
    queryClient.setQueryData<Task>(
      getTaskQueryKey({ path: { id } }),
      (task) => task && patched(task),
    );
}

export async function cancelTaskQueries(queryClient: QueryClient, ids: string[]) {
  await queryClient.cancelQueries({ queryKey: listTasksQueryKey() });
  for (const id of ids)
    await queryClient.cancelQueries({ queryKey: getTaskQueryKey({ path: { id } }) });
}

export function refreshTasks(queryClient: QueryClient, ids: string[]) {
  void queryClient.invalidateQueries({ queryKey: listTasksQueryKey() });
  for (const id of ids)
    void queryClient.invalidateQueries({ queryKey: getTaskQueryKey({ path: { id } }) });
}
