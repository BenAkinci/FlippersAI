export function validateImages(images) {
  if (!Array.isArray(images) || images.length < 1 || images.length > 10) throw new Error('Choose between 1 and 10 screenshots.')
  let total = 0
  for (const image of images) {
    if (typeof image !== 'string' || image.length > 8 * 1024 * 1024) throw new Error('Image payload too large.')
    total += image.length
    if (total > 24 * 1024 * 1024) throw new Error('Image payload too large; upload fewer screenshots.')
    const match = /^data:image\/(jpeg|jpg|png|webp);base64,/.exec(image)
    const payload = match ? image.slice(match[0].length) : ''
    if (!payload || payload.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) throw new Error('Invalid base64 image.')
    let bytes
    try { bytes = atob(payload) } catch { throw new Error('Invalid base64 image.') }
    const valid = match[1] === 'png' ? bytes.startsWith('\x89PNG\r\n\x1a\n') : match[1] === 'webp' ? bytes.startsWith('RIFF') && bytes.slice(8,12) === 'WEBP' : bytes.startsWith('\xff\xd8\xff')
    if (!valid) throw new Error('Invalid image format; use JPEG, PNG or WebP.')
  }
  return images
}

