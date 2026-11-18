export function validScreenshot(file: Pick<File, "type" | "size">): boolean {
  return ["image/png", "image/jpeg"].includes(file.type) && file.size > 0 && file.size <= 8_000_000;
}
