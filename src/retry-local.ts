export async function retryAutomaticLocal<T>(automatic: boolean, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!automatic || !(error instanceof Error) || error.name !== "Error" || "code" in error) throw error;
    return operation();
  }
}
