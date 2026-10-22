import { ACCEPTED_TYPES, MAX_IMAGE_BYTES } from './models'

export async function prepareImage(file: File): Promise<Blob> {
  if (!ACCEPTED_TYPES.includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP photo.')
  if (file.size > 20 * 1024 * 1024) throw new Error('Please choose a photo smaller than 20 MB.')
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('This photo could not be opened. Try another image.')
  })
  try {
    if (bitmap.width * bitmap.height > 60_000_000)
      throw new Error('This photo is too large. Please resize it first.')
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Your browser could not prepare this photo.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error('Could not prepare this photo.'))),
        'image/jpeg',
        0.88,
      ),
    )
    if (blob.size > MAX_IMAGE_BYTES)
      throw new Error('The optimized photo is still too large. Please try a smaller one.')
    return blob
  } finally {
    bitmap.close()
  }
}
