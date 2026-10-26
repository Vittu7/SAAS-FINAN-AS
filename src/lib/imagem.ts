/** Reduz a foto antes do envio: carrega mais rápido, funciona no celular e evita arquivos enormes. */
export async function reduzirImagem(arquivo: File, lado = 512, qualidade = 0.85): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(arquivo);
    const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
    const largura = Math.max(1, Math.round(bitmap.width * escala));
    const altura = Math.max(1, Math.round(bitmap.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) return arquivo;
    ctx.drawImage(bitmap, 0, 0, largura, altura);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", qualidade));
    return blob ?? arquivo;
  } catch {
    return arquivo; // formato que o navegador não decodifica: envia o original
  }
}
