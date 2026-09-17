export async function readImages(
  files: FileList | File[],
  max = 4,
): Promise<string[]> {
  const list = Array.from(files);
  if (list.length > max)
    throw new Error("Kies maximaal " + max + " afbeeldingen.");
  return Promise.all(
    list.map(async (file) => {
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 500 * 1024
      )
        throw new Error(
          "Gebruik JPG, PNG of WebP van maximaal 500 KB per foto.",
        );
      const result = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () =>
          reject(new Error("Foto kon niet worden gelezen."));
        reader.readAsDataURL(file);
      });
      const image = new Image();
      image.src = result;
      await image.decode();
      return result;
    }),
  );
}
