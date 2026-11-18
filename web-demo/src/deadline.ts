export class DeadlineExceededError extends Error {
  constructor() {
    super("The check took too long");
    this.name = "DeadlineExceededError";
  }
}

// The Firebase SDK cannot cancel a local Prompt API call. This bounds only the UI wait.
export function withDeadline<T>(work: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    work,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new DeadlineExceededError()), milliseconds);
    }),
  ]).finally(() => clearTimeout(timer));
}
