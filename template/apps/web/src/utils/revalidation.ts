"use server";

import { revalidatePath } from "next/cache";

export async function revalidatePaths(path: string): Promise<void> {
  revalidatePath(path, "page");
}
