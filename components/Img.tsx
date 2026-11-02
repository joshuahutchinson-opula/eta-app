// components/Img.tsx — images sized for the phone showing them. next/image
// picks the width for the screen; Cloudinary and Unsplash URLs are rewritten
// to ask their CDN for that width, auto format (WebP/AVIF) and auto quality,
// so nothing runs through the Next.js optimizer on our server. Other hosts
// load as-is.
'use client'

import Image, { type ImageLoader } from 'next/image'

const CLOUDINARY = /^https:\/\/res\.cloudinary\.com\/[^/]+\/(image|video)\/upload\//
const UNSPLASH = /^https:\/\/(images|plus)\.unsplash\.com\//

/** A Cloudinary URL with its transformation replaced by a phone-sized one. */
export function cloudinaryUrl(src: string, width: number, crop: 'fill' | 'limit' = 'limit'): string {
  const m = src.match(CLOUDINARY)
  if (!m) return src
  const rest = src.slice(m[0].length)
  // Drop an existing transformation segment (e.g. "f_auto,q_auto,c_limit,w_1600/").
  const path = /^[a-z]{1,3}_[^/]*\//.test(rest) && !/^v\d+\//.test(rest) ? rest.replace(/^[^/]+\//, '') : rest
  const transform = m[1] === 'video' ? `so_0,f_jpg,q_auto,c_${crop},w_${width}` : `f_auto,q_auto,c_${crop},w_${width}`
  return `${m[0]}${transform}/${path}`
}

const loader: ImageLoader = ({ src, width, quality }) => {
  if (CLOUDINARY.test(src)) return cloudinaryUrl(src, width)
  if (UNSPLASH.test(src)) {
    const u = new URL(src)
    u.searchParams.set('w', String(width))
    u.searchParams.set('q', String(quality ?? 70))
    u.searchParams.set('auto', 'format')
    u.searchParams.set('fit', 'crop')
    return u.toString()
  }
  return src
}

export function isOptimizable(src: string): boolean {
  return CLOUDINARY.test(src) || UNSPLASH.test(src)
}

interface Props {
  src: string
  alt: string
  /** Intrinsic size used for the aspect ratio; the image still fills its box. */
  width: number
  height: number
  /** How wide it's shown, e.g. "100vw" or "240px", so the right size is fetched. */
  sizes?: string
  priority?: boolean
  style?: React.CSSProperties
  className?: string
}

export default function Img({ src, alt, width, height, sizes = '100vw', priority, style, className }: Props) {
  const known = isOptimizable(src)
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      loader={known ? loader : undefined}
      unoptimized={!known}
      className={className}
      style={{ width: '100%', height: '100%', objectFit: 'cover', ...style }}
    />
  )
}
