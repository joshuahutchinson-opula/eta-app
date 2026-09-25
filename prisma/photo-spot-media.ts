// prisma/photo-spot-media.ts — Cloudinary media for the photo spots (folder photo-spots/<spot>).
// officialPhoto is the cover; gallery and videos show on the spot page. Shared by seed.ts and
// scripts/sync-photo-spot-media.ts so a reseed keeps the same media.

export const PHOTO_SPOT_MEDIA: Record<string, { officialPhoto: string; gallery: string[]; videos: string[] }> = {
  "Rick's Café sunset": {
    officialPhoto: 'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298186/photo-spots/ricks-cafe-sunset/ricks-cafe-sunset-image-1.jpg',
    gallery: [
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298186/photo-spots/ricks-cafe-sunset/ricks-cafe-sunset-image-1.jpg'
    ],
    videos: [
      'https://res.cloudinary.com/wspvflyn/video/upload/q_auto/v1790303994/photo-spots/ricks-cafe-sunset/ricks-cafe-sunset-video-1.mp4',
      'https://res.cloudinary.com/wspvflyn/video/upload/q_auto/v1790303997/photo-spots/ricks-cafe-sunset/ricks-cafe-sunset-video-2.mp4',
      'https://res.cloudinary.com/wspvflyn/video/upload/q_auto/v1790304000/photo-spots/ricks-cafe-sunset/ricks-cafe-sunset-video-3.mp4'
    ]
  },
  'West End cliffs': {
    officialPhoto: 'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298215/photo-spots/west-end-cliffs/west-end-cliffs-image-1.jpg',
    gallery: [
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298215/photo-spots/west-end-cliffs/west-end-cliffs-image-1.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298234/photo-spots/west-end-cliffs/west-end-cliffs-image-3.webp',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298224/photo-spots/west-end-cliffs/west-end-cliffs-image-2.jpg'
    ],
    videos: [
      'https://res.cloudinary.com/wspvflyn/video/upload/q_auto/v1790304003/photo-spots/west-end-cliffs/west-end-cliffs-video-1.mp4',
      'https://res.cloudinary.com/wspvflyn/video/upload/q_auto/v1790304005/photo-spots/west-end-cliffs/west-end-cliffs-video-2.mp4',
      'https://res.cloudinary.com/wspvflyn/video/upload/q_auto/v1790304008/photo-spots/west-end-cliffs/west-end-cliffs-video-3.mp4'
    ]
  },
  'Seven Mile Beach panorama': {
    officialPhoto: 'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298236/photo-spots/seven-mile-beach/seven-mile-beach-image-1.jpg',
    gallery: [
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298236/photo-spots/seven-mile-beach/seven-mile-beach-image-1.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298237/photo-spots/seven-mile-beach/seven-mile-beach-image-2.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298239/photo-spots/seven-mile-beach/seven-mile-beach-image-4.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298238/photo-spots/seven-mile-beach/seven-mile-beach-image-3.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298243/photo-spots/seven-mile-beach/seven-mile-beach-image-5.jpg'
    ],
    videos: [
      'https://res.cloudinary.com/wspvflyn/video/upload/q_auto/v1790304010/photo-spots/seven-mile-beach/seven-mile-beach-video-1.mp4',
      'https://res.cloudinary.com/wspvflyn/video/upload/q_auto/v1790304012/photo-spots/seven-mile-beach/seven-mile-beach-video-2.mp4',
      'https://res.cloudinary.com/wspvflyn/video/upload/q_auto/v1790304021/photo-spots/seven-mile-beach/seven-mile-beach-video-3.mp4'
    ]
  },
  'Negril Lighthouse grounds': {
    officialPhoto: 'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298256/photo-spots/negril-lighthouse/negril-lighthouse-image-4.jpg',
    gallery: [
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298256/photo-spots/negril-lighthouse/negril-lighthouse-image-4.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298253/photo-spots/negril-lighthouse/negril-lighthouse-image-1.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790302162/lighthouse1.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790302160/lighthouse2.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298257/photo-spots/negril-lighthouse/negril-lighthouse-image-5.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298255/photo-spots/negril-lighthouse/negril-lighthouse-image-2.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790302158/lighthouse3.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298256/photo-spots/negril-lighthouse/negril-lighthouse-image-3.jpg'
    ],
    videos: [
      'https://res.cloudinary.com/wspvflyn/video/upload/q_auto/v1790304023/photo-spots/negril-lighthouse/negril-lighthouse-video-1.mp4',
      'https://res.cloudinary.com/wspvflyn/video/upload/q_auto/v1790304024/photo-spots/negril-lighthouse/negril-lighthouse-video-2.mp4'
    ]
  },
  'Booby Cay Island': {
    officialPhoto: 'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790302113/boobycay1.jpg',
    gallery: [
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790302113/boobycay1.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790302102/boobycay5.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298259/photo-spots/booby-cay-island/booby-cay-island-image-1.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790302110/boobycay2.avif',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790302108/boobycay3.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298260/photo-spots/booby-cay-island/booby-cay-island-image-2.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298261/photo-spots/booby-cay-island/booby-cay-island-image-3.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298264/photo-spots/booby-cay-island/booby-cay-island-image-5.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790302105/boobycay4.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790302100/boobycay6.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298262/photo-spots/booby-cay-island/booby-cay-island-image-4.jpg'
    ],
    videos: [
      'https://res.cloudinary.com/wspvflyn/video/upload/q_auto/v1790304030/photo-spots/booby-cay-island/booby-cay-island-video-1.mp4',
      'https://res.cloudinary.com/wspvflyn/video/upload/q_auto/v1790304034/photo-spots/booby-cay-island/booby-cay-island-video-2.mp4',
      'https://res.cloudinary.com/wspvflyn/video/upload/q_auto/v1790304038/photo-spots/booby-cay-island/booby-cay-island-video-3.mp4'
    ]
  },
  'Blue Hole Mineral Spring': {
    officialPhoto: 'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790294270/bluehole1.jpg',
    gallery: [
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790294270/bluehole1.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790294270/bluehole2.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790303990/photo-spots/blue-hole-mineral-spring/blue-hole-mineral-spring-image-1.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790303991/photo-spots/blue-hole-mineral-spring/blue-hole-mineral-spring-image-2.jpg'
    ],
    videos: [
      'https://res.cloudinary.com/wspvflyn/video/upload/q_auto/v1790304052/photo-spots/blue-hole-mineral-spring/blue-hole-mineral-spring-video-1.mp4',
      'https://res.cloudinary.com/wspvflyn/video/upload/q_auto/v1790304057/photo-spots/blue-hole-mineral-spring/blue-hole-mineral-spring-video-2.mp4',
      'https://res.cloudinary.com/wspvflyn/video/upload/q_auto/v1790304059/photo-spots/blue-hole-mineral-spring/blue-hole-mineral-spring-video-3.mp4'
    ]
  },
  'Royal Palm Reserve boardwalk': {
    officialPhoto: 'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790303762/photo-spots/royal-palm-reserve/royal-palm-reserve-image-2.jpg',
    gallery: [
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790303762/photo-spots/royal-palm-reserve/royal-palm-reserve-image-2.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790293410/royalpalm5_png.webp',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790293317/royalpalm3.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790293320/royalpalm1.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790293318/royalpalm2.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790303761/photo-spots/royal-palm-reserve/royal-palm-reserve-image-1.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790293315/royalpalm4.jpg'
    ],
    videos: []
  },
  "Doctor's Cave Sand": {
    officialPhoto: 'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298270/photo-spots/doctors-cave-sand/doctors-cave-sand-image-1.jpg',
    gallery: [
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298270/photo-spots/doctors-cave-sand/doctors-cave-sand-image-1.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298272/photo-spots/doctors-cave-sand/doctors-cave-sand-image-2.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298275/photo-spots/doctors-cave-sand/doctors-cave-sand-image-3.webp',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790298278/photo-spots/doctors-cave-sand/doctors-cave-sand-image-4.webp'
    ],
    videos: [
      'https://res.cloudinary.com/wspvflyn/video/upload/q_auto/v1790304039/photo-spots/doctors-cave-sand/doctors-cave-sand-video-1.mp4'
    ]
  },
  'Mayfield Falls': {
    officialPhoto: 'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790291670/mayfieldfalls1.jpg',
    gallery: [
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790291670/mayfieldfalls1.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790303758/photo-spots/mayfield-falls/mayfield-falls-image-3.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790303757/photo-spots/mayfield-falls/mayfield-falls-image-2.webp',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790292274/mayfieldfalls3.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790291671/mayfieldfalls2.png',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790303760/photo-spots/mayfield-falls/mayfield-falls-image-5.jpg',
      'https://res.cloudinary.com/wspvflyn/image/upload/f_auto,q_auto,c_limit,w_1600/v1790292474/mayfieldfalls4.webp'
    ],
    videos: [
      'https://res.cloudinary.com/wspvflyn/video/upload/q_auto/v1790304042/photo-spots/mayfield-falls/mayfield-falls-video-1.mp4',
      'https://res.cloudinary.com/wspvflyn/video/upload/q_auto/v1790304047/photo-spots/mayfield-falls/mayfield-falls-video-2.mp4',
      'https://res.cloudinary.com/wspvflyn/video/upload/q_auto/v1790304049/photo-spots/mayfield-falls/mayfield-falls-video-3.mp4'
    ]
  }
}
