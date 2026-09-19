import { PrismaClient, City, VendorCategory, AccommodationType, Role, Level, BookingStatus, TransactionType, TransactionStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Clear all data in dependency order
  await prisma.flashDeal.deleteMany()
  await prisma.bundle.deleteMany()
  await prisma.crewMember.deleteMany()
  await prisma.crewGroup.deleteMany()
  await prisma.userMoment.deleteMany()
  await prisma.transaction.deleteMany()
  await prisma.checkIn.deleteMany()
  await prisma.discovery.deleteMany()
  await prisma.review.deleteMany()
  await prisma.booking.deleteMany()
  await prisma.story.deleteMany()
  await prisma.moodMedia.deleteMany()
  await prisma.mood.deleteMany()
  await prisma.experience.deleteMany()
  await prisma.accommodation.deleteMany()
  await prisma.vendor.deleteMany()
  await prisma.photoSpot.deleteMany()
  await prisma.user.deleteMany()

  // Create users
  const hashedPassword = await bcrypt.hash('password123', 10)

  const jordan = await prisma.user.create({
    data: {
      email: 'jordan@eta.app',
      password: hashedPassword,
      name: 'Jordan',
      role: Role.EXPLORER,
      level: Level.TRAILBLAZER,
      points: 1240,
      walletBalance: 250,
      streak: 3,
      city: City.NEGRIL,
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
    },
  })

  const marcus = await prisma.user.create({
    data: {
      email: 'marcus@eta.app',
      password: hashedPassword,
      name: 'Marcus',
      role: Role.EXPLORER,
      level: Level.EXPLORER,
      points: 850,
      walletBalance: 100,
      streak: 5,
      city: City.NEGRIL,
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    },
  })

  const sarah = await prisma.user.create({
    data: {
      email: 'sarah@eta.app',
      password: hashedPassword,
      name: 'Sarah',
      role: Role.EXPLORER,
      level: Level.LOCAL_LEGEND,
      points: 2100,
      walletBalance: 400,
      streak: 7,
      city: City.NEGRIL,
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
    },
  })

  const devon = await prisma.user.create({
    data: {
      email: 'devon@eta.app',
      password: hashedPassword,
      name: 'Devon',
      role: Role.EXPLORER,
      level: Level.WANDERER,
      points: 120,
      walletBalance: 50,
      streak: 1,
      city: City.MONTEGO_BAY,
      avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200',
    },
  })

  const tasha = await prisma.user.create({
    data: {
      email: 'tasha@eta.app',
      password: hashedPassword,
      name: 'Tasha',
      role: Role.EXPLORER,
      level: Level.EXPLORER,
      points: 620,
      walletBalance: 75,
      streak: 2,
      city: City.NEGRIL,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
    },
  })

  const admin = await prisma.user.create({
    data: {
      email: 'admin@eta.app',
      password: hashedPassword,
      name: 'Admin',
      role: Role.ADMIN,
      level: Level.LOCAL_LEGEND,
      points: 0,
      walletBalance: 0,
      streak: 0,
      city: City.NEGRIL,
    },
  })

  // Create real Negril vendors (sourced from vendor guide spreadsheet)
  // NOTE: images/videos below are category-matched placeholders pending real
  // vendor-provided content and written consent -- see project plan.
  // lat/lng are estimated along known Negril corridors, not precisely geocoded.

  const pushCart = await prisma.vendor.create({
    data: {
      name: 'Pushcart Restaurant & Rum Bar',
      category: VendorCategory.FOOD,
      neighborhood: 'West End (Rockhouse)',
      city: City.NEGRIL,
      lat: 18.2668,
      lng: -78.3502,
      priceRange: '$$',
      description: 'Street-food-style Jamaican spot at Rockhouse — jerk and local dishes with a twist. Lively, colorful, music-filled. (Instagram: @rockhousehotel)',
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
      ],
      videos: [
        'https://videos.pexels.com/video-files/5134443/5134443-hd_1920_1080_30fps.mp4',
      ],
      open: true,
      live: true,
      isPremium: true,
      whoThere: 14,
      tipsJar: true,
      payItForward: true,
    },
  })

  const blueMahoe = await prisma.vendor.create({
    data: {
      name: 'Zimbali Retreats',
      category: VendorCategory.FOOD,
      neighborhood: 'Inland / jungle, off West End',
      city: City.NEGRIL,
      lat: 18.2589,
      lng: -78.3701,
      priceRange: '$$$$',
      description: 'Farm-to-table tasting menu — a 6-course chef\'s menu plus a working farm tour. Reservation required, off the beaten path. (Instagram: @zimbaliretreats)',
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
      ],
      videos: ['https://videos.pexels.com/video-files/5937335/5937335-uhd_3840_2160_25fps.mp4'],
      open: true,
      live: false,
      isPremium: true,
      whoThere: 6,
      tipsJar: false,
      payItForward: false,
    },
  })

  const coralReef = await prisma.vendor.create({
    data: {
      name: 'Bourbon Beach',
      category: VendorCategory.DRINKS,
      neighborhood: 'Seven Mile Beach',
      city: City.NEGRIL,
      lat: 18.2914,
      lng: -78.3641,
      priceRange: '$$',
      description: 'Beach club with live reggae and themed parties nightly. Music runs til early morning. (Instagram: @bourbon_beach_negril)',
      images: [
        'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800',
        'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800',
        'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800',
      ],
      videos: [
        'https://videos.pexels.com/video-files/35659845/15111600_1920_1080_60fps.mp4',
      ],
      open: true,
      live: true,
      isPremium: true,
      whoThere: 23,
      tipsJar: true,
      payItForward: false,
    },
  })

  const islandWellness = await prisma.vendor.create({
    data: {
      name: 'Ocean View Spa',
      category: VendorCategory.WELLNESS,
      neighborhood: 'Norman Manley Blvd, near Couples Swept Away',
      city: City.NEGRIL,
      lat: 18.2801,
      lng: -78.3521,
      priceRange: '$$',
      description: 'Negril-born, NCTVET-certified owner-operator Claudette Nicholson. Massage, reflexology, facials, and hair braiding, beachfront. From $60/hr. (Instagram: @ocean_view_spa_negril_ja)',
      images: [
        'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800',
        'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800',
      ],
      videos: [],
      open: true,
      live: true,
      isPremium: false,
      whoThere: 3,
      tipsJar: true,
      payItForward: false,
    },
  })

  const cliffsideGrill = await prisma.vendor.create({
    data: {
      name: 'Ivan\'s Bar & Restaurant',
      category: VendorCategory.FOOD,
      neighborhood: 'West End (Catcha Falling Star)',
      city: City.NEGRIL,
      lat: 18.2601,
      lng: -78.3512,
      priceRange: '$$$',
      description: 'Jamaican fine dining at Catcha Falling Star — lobster and modern Jamaican plates with some of the best coastal views on the West End. Romantic.',
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: true,
      whoThere: 9,
      tipsJar: false,
      payItForward: false,
    },
  })

  const negrilWatersports = await prisma.vendor.create({
    data: {
      name: 'Seven Mile Beach Snorkel Tours',
      category: VendorCategory.ACTIVITY,
      neighborhood: 'Seven Mile Beach',
      city: City.NEGRIL,
      lat: 18.2954,
      lng: -78.3689,
      priceRange: '$$',
      description: 'Independent small-boat operators running snorkel trips to Booby Cay, Middle Reef and Sandy Cay — Negril\'s best snorkeling areas, from $40/person. NOTE: represents a cluster of independent operators, not a single confirmed business — identify a specific real operator during vendor outreach.',
      images: [
        'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800',
        'https://images.unsplash.com/photo-1512100356356-de1b84283e18?w=800',
      ],
      videos: [],
      open: true,
      live: true,
      isPremium: false,
      whoThere: 12,
      tipsJar: false,
      payItForward: false,
    },
  })

  // Additional real Negril vendors (not wired into demo engagement data below,
  // but part of the real catalog)

  const mobayJerkHouse = await prisma.vendor.create({
    data: {
      name: 'MoBay Jerk House',
      category: VendorCategory.FOOD,
      neighborhood: 'Hip Strip',
      city: City.MONTEGO_BAY,
      lat: 18.4712,
      lng: -77.9186,
      priceRange: '$$',
      description: 'The official taste of Montego Bay. Jerk pork, festival, and secret pepper sauce.',
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
      ],
      videos: [
        'https://videos.pexels.com/video-files/29641502/12753409_1920_1080_25fps.mp4',
      ],
      open: true,
      live: true,
      isPremium: true,
      whoThere: 18,
      tipsJar: true,
      payItForward: true,
    },
  })

  const doctorCave = await prisma.vendor.create({
    data: {
      name: 'Doctor\'s Cave Beach Bar',
      category: VendorCategory.BEACH,
      neighborhood: 'Gloucester Avenue',
      city: City.MONTEGO_BAY,
      lat: 18.4852,
      lng: -77.9358,
      priceRange: '$$',
      description: 'Beachfront drinks and snacks on the most famous beach in MoBay.',
      images: [
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800',
      ],
      videos: ['https://videos.pexels.com/video-files/5937335/5937335-uhd_3840_2160_25fps.mp4'],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 9,
      tipsJar: true,
      payItForward: true,
    },
  })

  const mobayWatersports = await prisma.vendor.create({
    data: {
      name: 'MoBay Watersports',
      category: VendorCategory.ACTIVITY,
      neighborhood: 'Freeport',
      city: City.MONTEGO_BAY,
      lat: 18.4567,
      lng: -77.9456,
      priceRange: '$$$',
      description: 'Catamaran cruises, snorkeling, and deep sea fishing charters.',
      images: [
        'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
        'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=800',
      ],
      videos: ['https://videos.pexels.com/video-files/6983517/6983517-hd_1920_1080_24fps.mp4'],

      open: true,
      live: true,
      isPremium: true,
      whoThere: 12,
      tipsJar: true,
      payItForward: false,
    },
  })

  // MoBay vendors above are still placeholder -- no Montego Bay data provided yet

  const rockhouseRestaurant = await prisma.vendor.create({
    data: {
      name: 'Rockhouse Restaurant',
      category: VendorCategory.FOOD,
      neighborhood: 'West End (cliffs)',
      city: City.NEGRIL,
      lat: 18.2665,
      lng: -78.3499,
      priceRange: '$$$',
      description: 'Upscale Jamaican dining — blackened mahi-mahi, banana-leaf snapper. Romantic cliffside setting, candlelit at night. (Instagram: @rockhousehotel)',
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const theLodgeRestaurant = await prisma.vendor.create({
    data: {
      name: 'The Lodge Restaurant',
      category: VendorCategory.FOOD,
      neighborhood: 'West End (Tensing Pen)',
      city: City.NEGRIL,
      lat: 18.2622,
      lng: -78.3509,
      priceRange: '$$$',
      description: 'Caribbean dinners with ocean views at boutique hotel Tensing Pen. (Instagram: @tensingpen)',
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const threeDivesRestaurant = await prisma.vendor.create({
    data: {
      name: '3 Dives Restaurant & Cliff Bar',
      category: VendorCategory.FOOD,
      neighborhood: 'West End (cliffs)',
      city: City.NEGRIL,
      lat: 18.2578,
      lng: -78.3505,
      priceRange: '$$',
      description: 'Family-run hidden gem — slow-cooked jerk chicken, granny sauce, lobster. Swim off the cliff between courses. Cash preferred. (Instagram: @3divesjerkcentre)',
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const sweetSpice = await prisma.vendor.create({
    data: {
      name: 'Sweet Spice Restaurant',
      category: VendorCategory.FOOD,
      neighborhood: 'Past the roundabout, town',
      city: City.NEGRIL,
      lat: 18.2701,
      lng: -78.3421,
      priceRange: '$',
      description: 'Curry goat, oxtail, steamed snapper, and blended juices. A long-time local staple, unassuming from the outside.',
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const koolVybes = await prisma.vendor.create({
    data: {
      name: 'Kool Vybes Bar & Jerk Center',
      category: VendorCategory.FOOD,
      neighborhood: 'West End Rd, across from Tensing Pen',
      city: City.NEGRIL,
      lat: 18.2618,
      lng: -78.3507,
      priceRange: '$',
      description: 'Small jerk hut with real local-favorite energy — jerk chicken and pork. (Instagram: @koolvybesbarandjerkcentre)',
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const bestInTheWest = await prisma.vendor.create({
    data: {
      name: 'Best in the West Jerk Centre',
      category: VendorCategory.FOOD,
      neighborhood: 'Mid-town / Seven Mile Beach area',
      city: City.NEGRIL,
      lat: 18.2789,
      lng: -78.3556,
      priceRange: '$',
      description: 'Hidden-gem jerk shack — jerk chicken, curry chicken, oxtail. Casual and cheap. (Instagram: @bestinthewestja)',
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const borderJerk = await prisma.vendor.create({
    data: {
      name: 'Border Jerk',
      category: VendorCategory.FOOD,
      neighborhood: 'On the way in/out of Negril',
      city: City.NEGRIL,
      lat: 18.2445,
      lng: -78.3389,
      priceRange: '$',
      description: 'Roadside jerk stand serving jerk pork and chicken — a local\'s pick, easy to miss if you\'re not looking.',
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const devonsJerkPan = await prisma.vendor.create({
    data: {
      name: 'Devon\'s Jerk Pan',
      category: VendorCategory.FOOD,
      neighborhood: 'Norman Manley Blvd, opposite Coco La Palm',
      city: City.NEGRIL,
      lat: 18.2933,
      lng: -78.3667,
      priceRange: '$',
      description: 'Started as the first jerk man on the boulevard. Jerk chicken, pork, lobster, and shrimp.',
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const kamaras = await prisma.vendor.create({
    data: {
      name: 'Kamara\'s',
      category: VendorCategory.FOOD,
      neighborhood: 'Seven Mile Beach, beside Rooms Hotel',
      city: City.NEGRIL,
      lat: 18.2867,
      lng: -78.3612,
      priceRange: '$$',
      description: 'Signature jerk sauce and jerk pasta. Candlelit at night, laid-back beach vibe.',
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const chickenLavish = await prisma.vendor.create({
    data: {
      name: 'Chicken Lavish',
      category: VendorCategory.FOOD,
      neighborhood: 'West End cliffs',
      city: City.NEGRIL,
      lat: 18.2555,
      lng: -78.3501,
      priceRange: '$',
      description: 'Decades-old West End institution — flash-fried whole chicken, no frills.',
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const momsPlace = await prisma.vendor.create({
    data: {
      name: 'Mom\'s Place',
      category: VendorCategory.FOOD,
      neighborhood: 'Town',
      city: City.NEGRIL,
      lat: 18.2695,
      lng: -78.3455,
      priceRange: '$',
      description: 'Home-style Jamaican cooking. A local favorite, off the tourist radar.',
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const coconutsInternational = await prisma.vendor.create({
    data: {
      name: 'Coconuts International',
      category: VendorCategory.FOOD,
      neighborhood: 'Town',
      city: City.NEGRIL,
      lat: 18.2712,
      lng: -78.3438,
      priceRange: '$',
      description: 'Jamaican classics at a local hangout spot.',
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const threeStars = await prisma.vendor.create({
    data: {
      name: '3Stars (the Cook Shop)',
      category: VendorCategory.FOOD,
      neighborhood: 'Alley between Bourbon Beach & Bar-B-Barn',
      city: City.NEGRIL,
      lat: 18.2919,
      lng: -78.3646,
      priceRange: '$',
      description: 'Street lunch stall with daily specials — sells out by noon, so go early.',
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const niahsPatties = await prisma.vendor.create({
    data: {
      name: 'Niah\'s Patties',
      category: VendorCategory.FOOD,
      neighborhood: 'Wavz Art Complex, Seven Mile Beach',
      city: City.NEGRIL,
      lat: 18.2887,
      lng: -78.3622,
      priceRange: '$',
      description: 'Tiny beach shack making hand-made fried patties — beef, chicken, and lobster.',
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const hammondsBakery = await prisma.vendor.create({
    data: {
      name: 'Hammond\'s Bakery',
      category: VendorCategory.FOOD,
      neighborhood: 'Near Seven Mile Beach',
      city: City.NEGRIL,
      lat: 18.2825,
      lng: -78.3589,
      priceRange: '$',
      description: 'Local bakery known for Jamaican patties. Affordable snack stop away from the tourist strip.',
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const conerBar = await prisma.vendor.create({
    data: {
      name: 'Coner Bar takeout window',
      category: VendorCategory.FOOD,
      neighborhood: 'Downtown Negril',
      city: City.NEGRIL,
      lat: 18.2679,
      lng: -78.3467,
      priceRange: '$',
      description: 'Jerk chicken takeout window — where locals actually go.',
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const redDragon = await prisma.vendor.create({
    data: {
      name: 'Red Dragon',
      category: VendorCategory.FOOD,
      neighborhood: 'Side road, Negril',
      city: City.NEGRIL,
      lat: 18.2634,
      lng: -78.3444,
      priceRange: '$',
      description: 'Roadside jerk pork stand. Runs out early, so go right after breakfast.',
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const shamrockJuice = await prisma.vendor.create({
    data: {
      name: 'Shamrock grocery store juice counter',
      category: VendorCategory.FOOD,
      neighborhood: 'Town',
      city: City.NEGRIL,
      lat: 18.2688,
      lng: -78.3449,
      priceRange: '$',
      description: 'Fresh-squeezed orange juice at a local grocery counter. Not a tourist spot — a genuine local tip.',
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const justNatural = await prisma.vendor.create({
    data: {
      name: 'Just Natural Veggie & Seafood',
      category: VendorCategory.FOOD,
      neighborhood: 'West End',
      city: City.NEGRIL,
      lat: 18.2647,
      lng: -78.3498,
      priceRange: '$$',
      description: 'Ital/vegetarian dishes and seafood, serving since 1998 — a longstanding local spot.',
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const alfredsOceanPalace = await prisma.vendor.create({
    data: {
      name: 'Alfred\'s Ocean Palace',
      category: VendorCategory.DRINKS,
      neighborhood: 'Seven Mile Beach',
      city: City.NEGRIL,
      lat: 18.2879,
      lng: -78.3617,
      priceRange: '$$',
      description: 'Long-running beach institution — live bands and beach party atmosphere. (Instagram: @alfredsnegril)',
      images: [
        'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800',
        'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800',
        'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const ltuPub = await prisma.vendor.create({
    data: {
      name: 'LTU Pub (LTU Cliff Bar)',
      category: VendorCategory.DRINKS,
      neighborhood: 'West End',
      city: City.NEGRIL,
      lat: 18.2611,
      lng: -78.3506,
      priceRange: '$',
      description: 'Small cliff pub for post-dinner cocktails and mingling with locals. Casual, low-key.',
      images: [
        'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800',
        'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800',
        'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const canoeBar = await prisma.vendor.create({
    data: {
      name: 'Canoe (Canoe Beach Bar)',
      category: VendorCategory.DRINKS,
      neighborhood: 'Cliffs area',
      city: City.NEGRIL,
      lat: 18.2591,
      lng: -78.351,
      priceRange: '$',
      description: 'Happy hour, steel pan drummers, great views — a private-feeling little beach.',
      images: [
        'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800',
        'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800',
        'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const canJam = await prisma.vendor.create({
    data: {
      name: 'Can Jam',
      category: VendorCategory.DRINKS,
      neighborhood: 'Cliffs',
      city: City.NEGRIL,
      lat: 18.2565,
      lng: -78.3503,
      priceRange: '$',
      description: 'Very local small bar — Rastafarian drum circles and bonfires, off the tourist radar.',
      images: [
        'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800',
        'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800',
        'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const oneLoveBusCrawl = await prisma.vendor.create({
    data: {
      name: 'One Love Bus Bar Crawl',
      category: VendorCategory.DRINKS,
      neighborhood: 'Roams Negril',
      city: City.NEGRIL,
      lat: 18.275,
      lng: -78.355,
      priceRange: '$$',
      description: 'Multi-bar hopping experience — a good way to sample several small local bars in one night.',
      images: [
        'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800',
        'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800',
        'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const woodstockBar = await prisma.vendor.create({
    data: {
      name: 'Woodstock',
      category: VendorCategory.DRINKS,
      neighborhood: 'Seven Mile Beach',
      city: City.NEGRIL,
      lat: 18.2841,
      lng: -78.3598,
      priceRange: '$',
      description: 'Small, family-friendly beach bar hangout. Popular with travelers, casual.',
      images: [
        'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800',
        'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800',
        'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const xtabi = await prisma.vendor.create({
    data: {
      name: 'Xtabi',
      category: VendorCategory.DRINKS,
      neighborhood: 'West End cliffs',
      city: City.NEGRIL,
      lat: 18.2548,
      lng: -78.35,
      priceRange: '$$',
      description: 'Local cliff bar/restaurant with swimming and snorkeling off the caves.',
      images: [
        'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800',
        'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800',
        'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const margaritaville = await prisma.vendor.create({
    data: {
      name: 'Margaritaville Negril',
      category: VendorCategory.DRINKS,
      neighborhood: 'Seven Mile Beach',
      city: City.NEGRIL,
      lat: 18.2958,
      lng: -78.3692,
      priceRange: '$$$',
      description: 'Big Negril fixture — water trampolines, cliff jump, and DJ nights. (Instagram: @margaritavillenegril)',
      images: [
        'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800',
        'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800',
        'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const sandsBar = await prisma.vendor.create({
    data: {
      name: 'Sands Bar (Round Hill area)',
      category: VendorCategory.DRINKS,
      neighborhood: 'West End',
      city: City.NEGRIL,
      lat: 18.2529,
      lng: -78.3495,
      priceRange: '$$',
      description: 'Small-scale hotel bar, open Wed/Sat only, with a monthly Jamaican Night buffet. Community feel.',
      images: [
        'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800',
        'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800',
        'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const natashasSpa = await prisma.vendor.create({
    data: {
      name: 'Natasha\'s One Love Massage Spa',
      category: VendorCategory.WELLNESS,
      neighborhood: 'The Yard House / beachfront pickup points',
      city: City.NEGRIL,
      lat: 18.2856,
      lng: -78.3601,
      priceRange: '$$',
      description: 'Small independent beachside spa — ~$60+/session, transport often included via shuttle pickup from hotels. Warm and professional, oceanview setting.',
      images: [
        'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800',
        'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const koolRunnings = await prisma.vendor.create({
    data: {
      name: 'Kool Runnings Water Park',
      category: VendorCategory.ACTIVITY,
      neighborhood: 'Norman Manley Blvd',
      city: City.NEGRIL,
      lat: 18.2977,
      lng: -78.3701,
      priceRange: '$$$',
      description: 'Jamaica\'s largest water park — also go-karts, paintball, and laser tag. (Instagram: @koolrunningsjm)',
      images: [
        'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800',
        'https://images.unsplash.com/photo-1512100356356-de1b84283e18?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const rutlandPoint = await prisma.vendor.create({
    data: {
      name: 'Rutland Point & Negril Craft Market',
      category: VendorCategory.OTHER,
      neighborhood: 'Near West End roundabout',
      city: City.NEGRIL,
      lat: 18.2669,
      lng: -78.3491,
      priceRange: '$',
      description: '30+ year old original craft market — authentic, locally made goods. Haggling expected. (Instagram: @rutlandpointcraft)',
      images: [
        'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=800',
        'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const royalPalmReserve = await prisma.vendor.create({
    data: {
      name: 'Royal Palm Reserve',
      category: VendorCategory.ACTIVITY,
      neighborhood: 'South Negril River',
      city: City.NEGRIL,
      lat: 18.2523,
      lng: -78.3312,
      priceRange: '$$',
      description: 'Boardwalk through wetland with birdwatching and local guides.',
      images: [
        'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800',
        'https://images.unsplash.com/photo-1512100356356-de1b84283e18?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const negrilHillsGolf = await prisma.vendor.create({
    data: {
      name: 'Negril Hills Golf Club',
      category: VendorCategory.ACTIVITY,
      neighborhood: 'Inland Negril',
      city: City.NEGRIL,
      lat: 18.2812,
      lng: -78.3234,
      priceRange: '$$$',
      description: '9-hole course, more low-key than the resort courses.',
      images: [
        'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800',
        'https://images.unsplash.com/photo-1512100356356-de1b84283e18?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const maroonsCulturalTour = await prisma.vendor.create({
    data: {
      name: 'Negril Maroons Cultural Tour',
      category: VendorCategory.ACTIVITY,
      neighborhood: 'Community-run, various',
      city: City.NEGRIL,
      lat: 18.2701,
      lng: -78.3401,
      priceRange: '$$',
      description: 'Weekly cultural/storytelling and music event, community-run.',
      images: [
        'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800',
        'https://images.unsplash.com/photo-1512100356356-de1b84283e18?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const westEndDiveShops = await prisma.vendor.create({
    data: {
      name: 'West End Dive Shops',
      category: VendorCategory.ACTIVITY,
      neighborhood: 'West End',
      city: City.NEGRIL,
      lat: 18.2589,
      lng: -78.3504,
      priceRange: '$$$',
      description: 'Scuba diving at The Throne Room and other famous West End dive sites. NOTE: represents multiple dive shops, identify specific real operator during outreach.',
      images: [
        'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800',
        'https://images.unsplash.com/photo-1512100356356-de1b84283e18?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const glassBottomBoats = await prisma.vendor.create({
    data: {
      name: 'Seven Mile Beach Glass Bottom Boats',
      category: VendorCategory.ACTIVITY,
      neighborhood: 'Seven Mile Beach',
      city: City.NEGRIL,
      lat: 18.2901,
      lng: -78.3634,
      priceRange: '$$',
      description: 'See the reef without getting wet — small family-run boats. NOTE: operator cluster, identify specific real business during outreach.',
      images: [
        'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800',
        'https://images.unsplash.com/photo-1512100356356-de1b84283e18?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const parasailing = await prisma.vendor.create({
    data: {
      name: 'Seven Mile Beach Parasailing',
      category: VendorCategory.ACTIVITY,
      neighborhood: 'Seven Mile Beach',
      city: City.NEGRIL,
      lat: 18.2933,
      lng: -78.3655,
      priceRange: '$$$',
      description: 'Walk-up or pre-book parasailing along Seven Mile Beach. NOTE: operator cluster, identify specific real business during outreach.',
      images: [
        'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800',
        'https://images.unsplash.com/photo-1512100356356-de1b84283e18?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const jetSkiRentals = await prisma.vendor.create({
    data: {
      name: 'Seven Mile Beach Jet Ski & Watersports Rentals',
      category: VendorCategory.ACTIVITY,
      neighborhood: 'Seven Mile Beach',
      city: City.NEGRIL,
      lat: 18.2872,
      lng: -78.3609,
      priceRange: '$$',
      description: 'Jet skiing and waterskiing, rented by the hour from small beach stands. NOTE: operator cluster, identify specific real business during outreach.',
      images: [
        'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800',
        'https://images.unsplash.com/photo-1512100356356-de1b84283e18?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const kayakRentals = await prisma.vendor.create({
    data: {
      name: 'Seven Mile Beach Kayak & Paddleboard Rentals',
      category: VendorCategory.ACTIVITY,
      neighborhood: 'Seven Mile Beach',
      city: City.NEGRIL,
      lat: 18.2848,
      lng: -78.3594,
      priceRange: '$',
      description: 'Independent small operators renting kayaks and paddleboards by the hour. NOTE: operator cluster, identify specific real business during outreach.',
      images: [
        'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800',
        'https://images.unsplash.com/photo-1512100356356-de1b84283e18?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const hobieCatSailing = await prisma.vendor.create({
    data: {
      name: 'Seven Mile Beach Hobie Cat Sailing',
      category: VendorCategory.ACTIVITY,
      neighborhood: 'Seven Mile Beach',
      city: City.NEGRIL,
      lat: 18.2895,
      lng: -78.3628,
      priceRange: '$$',
      description: 'Beginner-friendly small sailboats, rented from beach stands. NOTE: operator cluster, identify specific real business during outreach.',
      images: [
        'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800',
        'https://images.unsplash.com/photo-1512100356356-de1b84283e18?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  const deepSeaFishing = await prisma.vendor.create({
    data: {
      name: 'Negril Deep-Sea Fishing Charters',
      category: VendorCategory.ACTIVITY,
      neighborhood: 'Negril docks',
      city: City.NEGRIL,
      lat: 18.2721,
      lng: -78.3512,
      priceRange: '$$$$',
      description: 'Half-day deep-sea fishing charters with local captains, departing from the fishing beach. NOTE: operator cluster, identify specific real captain during outreach.',
      images: [
        'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800',
        'https://images.unsplash.com/photo-1512100356356-de1b84283e18?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: false,
      payItForward: false,
    },
  })

  // Create experiences
  const fullMoon = await prisma.experience.create({
    data: {
      name: 'Full Moon Float',
      tagline: 'Dinner, dubs, boat at sunrise.',
      price: 185,
      imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
      videoUrl: null,
      city: City.NEGRIL,
      startLocation: 'Seven Mile Beach',
      travelTime: 5,
      travelMode: 'walking',
      vendorId: negrilWatersports.id,
    },
  })

  const rumBass = await prisma.experience.create({
    data: {
      name: 'Rum & Bass',
      tagline: 'Tastings, sound system, jerk.',
      price: 120,
      imageUrl: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800',
      videoUrl: null,
      city: City.NEGRIL,
      startLocation: 'West End',
      travelTime: 15,
      travelMode: 'taxi',
      vendorId: coralReef.id,
    },
  })

  const cliffMorning = await prisma.experience.create({
    data: {
      name: 'Cliff Morning',
      tagline: 'Yoga, breakfast, dip.',
      price: 90,
      imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
      videoUrl: null,
      city: City.NEGRIL,
      startLocation: 'The Cliffs',
      travelTime: 10,
      travelMode: 'walking',
      vendorId: islandWellness.id,
    },
  })

  const jerkTour = await prisma.experience.create({
    data: {
      name: 'Jerk Tour',
      tagline: 'Five stops. One mission.',
      price: 75,
      imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
      videoUrl: null,
      city: City.NEGRIL,
      startLocation: 'West End',
      travelTime: 20,
      travelMode: 'taxi',
      vendorId: pushCart.id,
    },
  })

  const reefSnorkel = await prisma.experience.create({
    data: {
      name: 'Reef Snorkel',
      tagline: 'Coral, fish, blue.',
      price: 60,
      imageUrl: 'https://images.unsplash.com/photo-1512100356356-de1b84283e18?w=800',
      videoUrl: null,
      city: City.NEGRIL,
      startLocation: 'Seven Mile',
      travelTime: 10,
      travelMode: 'boat',
      vendorId: negrilWatersports.id,
    },
  })

  const sunsetDinner = await prisma.experience.create({
    data: {
      name: 'Sunset Dinner',
      tagline: 'Lobster, champagne, view.',
      price: 210,
      imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
      videoUrl: null,
      city: City.NEGRIL,
      startLocation: 'West End',
      travelTime: 15,
      travelMode: 'taxi',
      vendorId: cliffsideGrill.id,
    },
  })

  const beachDay = await prisma.experience.create({
    data: {
      name: 'Beach Day Pass',
      tagline: 'Loungers, drinks, lunch.',
      price: 55,
      imageUrl: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800',
      videoUrl: null,
      city: City.MONTEGO_BAY,
      startLocation: 'Gloucester Avenue',
      travelTime: 5,
      travelMode: 'walking',
      vendorId: doctorCave.id,
    },
  })

  const catamaranSunset = await prisma.experience.create({
    data: {
      name: 'Catamaran Sunset',
      tagline: 'Sail, rum, reggae.',
      price: 140,
      imageUrl: 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=800',
      videoUrl: null,
      city: City.MONTEGO_BAY,
      startLocation: 'Freeport',
      travelTime: 20,
      travelMode: 'taxi',
      vendorId: mobayWatersports.id,
    },
  })

  const coffeeFarm = await prisma.experience.create({
    data: {
      name: 'Coffee Farm Trip',
      tagline: 'Beans, hills, brew.',
      price: 95,
      imageUrl: 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=800',
      videoUrl: null,
      city: City.NEGRIL,
      startLocation: 'Cliffs',
      travelTime: 25,
      travelMode: 'taxi',
      vendorId: blueMahoe.id,
    },
  })

  // Create accommodations
  const cliffHotel = await prisma.accommodation.create({
    data: {
      name: 'The Cliff Hotel',
      type: AccommodationType.A_LA_CARTE,
      googleStars: 4.7,
      description: 'Boutique cliffside hotel with stunning sunsets, private decks, and a saltwater pool.',
      amenities: ['Pool', 'Spa', 'Restaurant', 'Bar', 'WiFi', 'AC', 'Ocean View'],
      priceRange: '$$$',
      lat: 18.2985,
      lng: -78.3312,
      city: City.NEGRIL,
      vetted: true,
      hostName: 'Cliff Hotel Management',
      media: [
        { type: 'photo', url: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800' },
        { type: 'photo', url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800' },
      ],
      roomViews: [
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
        'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800',
      ],
    },
  })

  const sandalsNegril = await prisma.accommodation.create({
    data: {
      name: 'Sandals Negril',
      type: AccommodationType.ALL_INCLUSIVE,
      googleStars: 4.5,
      description: 'Luxury all-inclusive resort on Seven Mile Beach with seven restaurants and unlimited water sports.',
      amenities: ['Private Beach', 'Pools', 'Restaurants', 'Bars', 'Spa', 'Water Sports', 'Gym'],
      priceRange: '$$$$',
      lat: 18.2712,
      lng: -78.3498,
      city: City.NEGRIL,
      vetted: true,
      hostName: 'Sandals Resorts',
      media: [
        { type: 'photo', url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800' },
        { type: 'photo', url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800' },
      ],
      roomViews: [
        'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800',
        'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800',
      ],
    },
  })

  const villaSurMer = await prisma.accommodation.create({
    data: {
      name: 'Villa Sur Mer',
      type: AccommodationType.VILLA,
      googleStars: 4.9,
      description: 'Private villa with infinity pool, full-time chef, housekeeper, and panoramic ocean views.',
      amenities: ['Private Pool', 'Chef', 'Housekeeper', 'AC', 'WiFi', 'Ocean View', 'Outdoor Shower'],
      priceRange: '$$$$$',
      lat: 18.3021,
      lng: -78.3256,
      city: City.NEGRIL,
      vetted: true,
      hostName: 'Villa Sur Mer',
      media: [
        { type: 'photo', url: 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=800' },
        { type: 'photo', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800' },
      ],
      roomViews: [
        'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800',
        'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=800',
      ],
    },
  })

  const halfMoonRock = await prisma.accommodation.create({
    data: {
      name: 'Half Moon Rock Resort',
      type: AccommodationType.A_LA_CARTE,
      googleStars: 4.6,
      description: 'Classic MoBay elegance with a championship golf course and two miles of private beach.',
      amenities: ['Private Beach', 'Golf', 'Tennis', 'Spa', 'Restaurants', 'Bars', 'Horseback Riding'],
      priceRange: '$$$$',
      lat: 18.4902,
      lng: -77.9638,
      city: City.MONTEGO_BAY,
      vetted: true,
      hostName: 'Half Moon',
      media: [
        { type: 'photo', url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800' },
        { type: 'photo', url: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800' },
      ],
      roomViews: [
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
        'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800',
      ],
    },
  })

  const tryallVilla = await prisma.accommodation.create({
    data: {
      name: 'Tryall Villa Estate',
      type: AccommodationType.VILLA,
      googleStars: 4.8,
      description: 'Colonial-era great house estate with individual villas, private chef, and beach access.',
      amenities: ['Private Pool', 'Chef', 'Butler', 'Beach Access', 'Tennis', 'Golf', 'Gym'],
      priceRange: '$$$$$',
      lat: 18.4734,
      lng: -77.9656,
      city: City.MONTEGO_BAY,
      vetted: false,
      hostName: 'Tryall Club',
      media: [
        { type: 'photo', url: 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=800' },
        { type: 'photo', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800' },
      ],
      roomViews: [
        'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800',
        'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=800',
      ],
    },
  })

  const secretsMoBay = await prisma.accommodation.create({
    data: {
      name: 'Secrets St. James',
      type: AccommodationType.ALL_INCLUSIVE,
      googleStars: 4.4,
      description: 'Adults-only all-inclusive with swim-out suites and a lively pool scene.',
      amenities: ['Private Beach', 'Pools', 'Restaurants', 'Bars', 'Spa', 'Nightclub', 'Water Sports'],
      priceRange: '$$$$',
      lat: 18.4612,
      lng: -77.9234,
      city: City.MONTEGO_BAY,
      vetted: true,
      hostName: 'Secrets Resorts',
      media: [
        { type: 'photo', url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800' },
        { type: 'photo', url: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800' },
      ],
      roomViews: [
        'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800',
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
      ],
    },
  })

  // Create moods
  const moods = [
    { name: 'R&R', description: 'Rest and relaxation.', icon: 'wellness', coverImage: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800', videoUrl: 'https://assets.mixkit.co/videos/51169/51169-720.mp4' },
    { name: 'Just The Two Of Us', description: 'Romantic. Sunset dinners.', icon: 'sparkle', coverImage: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800', videoUrl: 'https://assets.mixkit.co/videos/1040/1040-720.mp4' },
    { name: 'Out Til Sunrise', description: 'Party. Late night.', icon: 'moon', coverImage: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800', videoUrl: 'https://assets.mixkit.co/videos/333/333-720.mp4' },
    { name: 'Golden Hour', description: 'Sunset chasing.', icon: 'sun', coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800', videoUrl: 'https://assets.mixkit.co/videos/44498/44498-720.mp4' },
    { name: 'Water Life', description: 'Snorkeling, boats, cliffs.', icon: 'activity', coverImage: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800', videoUrl: 'https://assets.mixkit.co/videos/1582/1582-720.mp4' },
    { name: 'Street Food Crawl', description: 'Jerk stands, patties.', icon: 'food', coverImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800', videoUrl: 'https://assets.mixkit.co/videos/31348/31348-720.mp4' },
    { name: 'Hangover Cures', description: 'Recovery.', icon: 'drink', coverImage: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800', videoUrl: 'https://assets.mixkit.co/videos/41859/41859-720.mp4' },
    { name: 'Solo Missions', description: 'For the lone explorer.', icon: 'user', coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800', videoUrl: 'https://assets.mixkit.co/videos/28297/28297-720.mp4' },
    { name: 'Family Day', description: 'Kid-friendly.', icon: 'users', coverImage: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800', videoUrl: 'https://assets.mixkit.co/videos/6221/6221-720.mp4' },
    { name: 'Rum & Bass', description: 'Drinks and music.', icon: 'drink', coverImage: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800', videoUrl: 'https://assets.mixkit.co/videos/4295/4295-720.mp4' },
  ]

  const createdMoods = []
  for (const mood of moods) {
    const created = await prisma.mood.create({ data: mood })
    createdMoods.push(created)
  }

  // Create mood media
  await prisma.moodMedia.createMany({
    data: [
      { moodId: createdMoods[0].id, type: 'photo', url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800', uploadedBy: 'Sarah' },
      { moodId: createdMoods[1].id, type: 'photo', url: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800', uploadedBy: 'Jordan' },
      { moodId: createdMoods[2].id, type: 'photo', url: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800', uploadedBy: 'Marcus' },
      { moodId: createdMoods[3].id, type: 'photo', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800', uploadedBy: 'Tasha' },
      { moodId: createdMoods[4].id, type: 'photo', url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800', uploadedBy: 'Devon' },
    ],
  })

  // Link moods to experiences
  await prisma.experience.update({
    where: { id: fullMoon.id },
    data: { moods: { connect: [createdMoods[2].id, createdMoods[4].id].map(id => ({ id })) } },
  })

  await prisma.experience.update({
    where: { id: rumBass.id },
    data: { moods: { connect: [createdMoods[9].id, createdMoods[2].id].map(id => ({ id })) } },
  })

  await prisma.experience.update({
    where: { id: cliffMorning.id },
    data: { moods: { connect: [createdMoods[0].id, createdMoods[7].id].map(id => ({ id })) } },
  })

  await prisma.experience.update({
    where: { id: sunsetDinner.id },
    data: { moods: { connect: [createdMoods[1].id, createdMoods[3].id].map(id => ({ id })) } },
  })

  // Create photo spots
  await prisma.photoSpot.createMany({
    data: [
      {
        name: 'Fisherman\'s Cove',
        description: 'Boats at dawn. Nets, colors, action.',
        lat: 18.2634,
        lng: -78.3621,
        bestTime: 'Dawn',
        officialPhoto: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
        city: City.NEGRIL,
      },
      {
        name: 'Hidden Swing',
        description: 'Tree swing over the water. Secret spot.',
        lat: 18.2934,
        lng: -78.3456,
        bestTime: 'Golden Hour',
        officialPhoto: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800',
        city: City.NEGRIL,
      },
      {
        name: 'Mural Wall',
        description: 'Jamaican art. Bright colors.',
        lat: 18.2812,
        lng: -78.3321,
        bestTime: 'Afternoon',
        officialPhoto: 'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=800',
        city: City.NEGRIL,
      },
      {
        name: 'Coconut Man Spot',
        description: 'Best coconut on Seven Mile.',
        lat: 18.2723,
        lng: -78.3521,
        bestTime: 'Anytime',
        officialPhoto: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800',
        city: City.NEGRIL,
      },
      {
        name: 'Rasta Cliff Jump',
        description: 'The famous jump. Not for the weak.',
        lat: 18.3012,
        lng: -78.3234,
        bestTime: 'Midday',
        officialPhoto: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
        city: City.NEGRIL,
      },
      {
        name: 'Hip Strip Sign',
        description: 'Classic MoBay photo op.',
        lat: 18.4712,
        lng: -77.9186,
        bestTime: 'Anytime',
        officialPhoto: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800',
        city: City.MONTEGO_BAY,
      },
      {
        name: 'Freeport Marina',
        description: 'Boats, yachts, sunset.',
        lat: 18.4567,
        lng: -77.9456,
        bestTime: 'Golden Hour',
        officialPhoto: 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=800',
        city: City.MONTEGO_BAY,
      },
      {
        name: 'Doctor\'s Cave Sand',
        description: 'The whitest sand in Jamaica.',
        lat: 18.4852,
        lng: -77.9358,
        bestTime: 'Morning',
        officialPhoto: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800',
        city: City.MONTEGO_BAY,
      },
    ],
  })


  // Create real Negril photo spots (sourced from vendor guide spreadsheet)
  await prisma.photoSpot.createMany({
    data: [
      {
        name: 'Rick\'s Café sunset',
        description: 'The most famous sunset-watching spot in Negril — gets crowded, arrive early.',
        lat: 18.2668,
        lng: -78.3502,
        bestTime: 'Sunset',
        officialPhoto: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
        city: City.NEGRIL,
      },
      {
        name: 'West End cliffs',
        description: 'Rugged limestone cliffs with dramatic views, less touristy than the beach.',
        lat: 18.258,
        lng: -78.3505,
        bestTime: 'Golden Hour',
        officialPhoto: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
        city: City.NEGRIL,
      },
      {
        name: 'Seven Mile Beach panorama',
        description: 'Classic white sand and turquoise water panorama.',
        lat: 18.287,
        lng: -78.361,
        bestTime: 'Morning',
        officialPhoto: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
        city: City.NEGRIL,
      },
      {
        name: 'Negril Lighthouse grounds',
        description: 'Quiet, uncrowded sunset views away from the crowds.',
        lat: 18.2519,
        lng: -78.3486,
        bestTime: 'Sunset',
        officialPhoto: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
        city: City.NEGRIL,
      },
      {
        name: '3 Dives Cliff Bar viewpoint',
        description: 'Small, local, less touristy sunset spot.',
        lat: 18.2578,
        lng: -78.3505,
        bestTime: 'Sunset',
        officialPhoto: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
        city: City.NEGRIL,
      },
      {
        name: 'Canoe / Can Jam cliffside',
        description: 'Intimate little coves with great sunset views.',
        lat: 18.2578,
        lng: -78.3507,
        bestTime: 'Sunset',
        officialPhoto: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
        city: City.NEGRIL,
      },
      {
        name: 'Blue Hole Mineral Spring',
        description: 'Turquoise pool in a limestone grotto. Small, local, off the beaten path — cliff jump or ladder in.',
        lat: 18.2301,
        lng: -78.2967,
        bestTime: 'Midday',
        officialPhoto: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
        city: City.NEGRIL,
      },
      {
        name: 'Booby Cay Island',
        description: 'Small island with beach views back toward Negril.',
        lat: 18.3067,
        lng: -78.3801,
        bestTime: 'Midday',
        officialPhoto: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
        city: City.NEGRIL,
      },
      {
        name: 'Royal Palm Reserve boardwalk',
        description: 'Peaceful wetland and mangrove views, good birdwatching.',
        lat: 18.2523,
        lng: -78.3312,
        bestTime: 'Morning',
        officialPhoto: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
        city: City.NEGRIL,
      },
      {
        name: 'Bubbling Spring Mineral Bath',
        description: '100-year-old local mineral bath, very off the tourist trail.',
        lat: 18.2412,
        lng: -78.3189,
        bestTime: 'Afternoon',
        officialPhoto: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
        city: City.NEGRIL,
      },
    ],
  })

  // Get photo spots for references
  const fishermansCove = await prisma.photoSpot.findFirst({ where: { name: 'Fisherman\'s Cove' } })
  const hiddenSwing = await prisma.photoSpot.findFirst({ where: { name: 'Hidden Swing' } })
  const muralWall = await prisma.photoSpot.findFirst({ where: { name: 'Mural Wall' } })
  const rastaJump = await prisma.photoSpot.findFirst({ where: { name: 'Rasta Cliff Jump' } })

  // Create stories
  const now = Date.now()
  await prisma.story.createMany({
    data: [
      {
        content: 'Fresh catch!',
        type: 'premium',
        imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        vendorId: pushCart.id,
        expiresAt: new Date(now + 24 * 60 * 60 * 1000),
      },
      {
        content: 'Breakfast view',
        type: 'premium',
        imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800',
        vendorId: blueMahoe.id,
        expiresAt: new Date(now + 20 * 60 * 60 * 1000),
      },
      {
        content: 'Live music 9pm!',
        type: 'premium',
        imageUrl: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800',
        vendorId: coralReef.id,
        expiresAt: new Date(now + 22 * 60 * 60 * 1000),
      },
      {
        content: 'Sunset special: 2-for-1 mojitos',
        type: 'premium',
        imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
        vendorId: cliffsideGrill.id,
        expiresAt: new Date(now + 18 * 60 * 60 * 1000),
      },
      {
        content: 'Jerk pork fresh off the fire',
        type: 'standard',
        imageUrl: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
        vendorId: mobayJerkHouse.id,
        expiresAt: new Date(now + 16 * 60 * 60 * 1000),
      },
      {
        content: 'Catamaran leaving at 4pm',
        type: 'standard',
        imageUrl: 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=800',
        vendorId: mobayWatersports.id,
        expiresAt: new Date(now + 14 * 60 * 60 * 1000),
      },
    ],
  })

  // Create flash deals
  await prisma.flashDeal.createMany({
    data: [
      {
        deal: '20% off jerk chicken',
        vendorId: pushCart.id,
        expires: new Date(now + 6 * 60 * 60 * 1000),
      },
      {
        deal: '2-for-1 rum punch',
        vendorId: coralReef.id,
        expires: new Date(now + 4 * 60 * 60 * 1000),
      },
      {
        deal: 'Free dessert with lobster',
        vendorId: cliffsideGrill.id,
        expires: new Date(now + 3 * 60 * 60 * 1000),
      },
      {
        deal: '15% off snorkel tour',
        vendorId: negrilWatersports.id,
        expires: new Date(now + 8 * 60 * 60 * 1000),
      },
      {
        deal: 'Happy hour all night',
        vendorId: doctorCave.id,
        expires: new Date(now + 5 * 60 * 60 * 1000),
      },
    ],
  })

  // Create check-ins
  await prisma.checkIn.createMany({
    data: [
      { userId: marcus.id, vendorId: pushCart.id },
      { userId: sarah.id, vendorId: coralReef.id },
      { userId: jordan.id, vendorId: cliffsideGrill.id },
      { userId: tasha.id, vendorId: islandWellness.id },
      { userId: devon.id, vendorId: mobayJerkHouse.id },
      { userId: marcus.id, vendorId: coralReef.id },
      { userId: sarah.id, vendorId: blueMahoe.id },
      { userId: jordan.id, vendorId: negrilWatersports.id },
    ],
  })

  // Create reviews
  await prisma.review.createMany({
    data: [
      { userId: marcus.id, vendorId: pushCart.id, rating: 5, comment: 'Best jerk chicken in Negril. Period.' },
      { userId: sarah.id, vendorId: coralReef.id, rating: 5, comment: 'Rum punch changed my life.' },
      { userId: jordan.id, vendorId: pushCart.id, rating: 5, comment: 'The jerk pork is unreal. Cash only.' },
      { userId: tasha.id, vendorId: blueMahoe.id, rating: 4, comment: 'Great breakfast, amazing view.' },
      { userId: devon.id, vendorId: mobayJerkHouse.id, rating: 5, comment: 'The pepper sauce is no joke!' },
      { userId: marcus.id, vendorId: coralReef.id, rating: 4, comment: 'Good vibes, live music on point.' },
      { userId: sarah.id, vendorId: cliffsideGrill.id, rating: 5, comment: 'Lobster was perfect. Sunset unreal.' },
      { userId: jordan.id, vendorId: negrilWatersports.id, rating: 4, comment: 'Great tour, saw stingrays.' },
      { userId: tasha.id, vendorId: islandWellness.id, rating: 5, comment: 'The massage fixed my back.' },
      { userId: devon.id, vendorId: mobayWatersports.id, rating: 5, comment: 'Catamaran sunset was the highlight of my trip.' },
      { userId: marcus.id, vendorId: blueMahoe.id, rating: 4, comment: 'Coffee is next level.' },
      { userId: sarah.id, vendorId: doctorCave.id, rating: 4, comment: 'Beach is beautiful, gets crowded.' },
      { userId: jordan.id, vendorId: cliffsideGrill.id, rating: 5, comment: 'Worth every dollar. Book the private deck.' },
    ],
  })

  // Create discoveries
  await prisma.discovery.createMany({
    data: [
      { userId: jordan.id, vendorId: pushCart.id, type: 'VENDOR', points: 50 },
      { userId: marcus.id, vendorId: coralReef.id, type: 'VENDOR', points: 50 },
      { userId: sarah.id, vendorId: blueMahoe.id, type: 'VENDOR', points: 50 },
      { userId: tasha.id, vendorId: islandWellness.id, type: 'VENDOR', points: 50 },
      { userId: devon.id, vendorId: mobayJerkHouse.id, type: 'VENDOR', points: 50 },
      { userId: jordan.id, photoSpotId: fishermansCove?.id, type: 'PHOTOSPOT', points: 30 },
      { userId: marcus.id, photoSpotId: hiddenSwing?.id, type: 'PHOTOSPOT', points: 30 },
      { userId: sarah.id, photoSpotId: muralWall?.id, type: 'PHOTOSPOT', points: 30 },
      { userId: tasha.id, photoSpotId: rastaJump?.id, type: 'PHOTOSPOT', points: 30 },
    ],
  })

  // Create bookings
  await prisma.booking.createMany({
    data: [
      {
        userId: jordan.id,
        experienceId: fullMoon.id,
        date: new Date(now + 3 * 24 * 60 * 60 * 1000),
        totalPrice: fullMoon.price,
        pointsEarned: Math.floor(fullMoon.price),
        status: BookingStatus.CONFIRMED,
      },
      {
        userId: marcus.id,
        experienceId: rumBass.id,
        date: new Date(now + 2 * 24 * 60 * 60 * 1000),
        totalPrice: rumBass.price,
        pointsEarned: Math.floor(rumBass.price),
        status: BookingStatus.CONFIRMED,
      },
      {
        userId: sarah.id,
        experienceId: cliffMorning.id,
        date: new Date(now + 1 * 24 * 60 * 60 * 1000),
        totalPrice: cliffMorning.price,
        pointsEarned: Math.floor(cliffMorning.price),
        status: BookingStatus.PENDING,
      },
      {
        userId: tasha.id,
        experienceId: sunsetDinner.id,
        date: new Date(now - 2 * 24 * 60 * 60 * 1000),
        totalPrice: sunsetDinner.price,
        pointsEarned: Math.floor(sunsetDinner.price),
        status: BookingStatus.COMPLETED,
      },
      {
        userId: devon.id,
        experienceId: catamaranSunset.id,
        date: new Date(now + 5 * 24 * 60 * 60 * 1000),
        totalPrice: catamaranSunset.price,
        pointsEarned: Math.floor(catamaranSunset.price),
        status: BookingStatus.CONFIRMED,
      },
      {
        userId: jordan.id,
        experienceId: jerkTour.id,
        date: new Date(now - 5 * 24 * 60 * 60 * 1000),
        totalPrice: jerkTour.price,
        pointsEarned: Math.floor(jerkTour.price),
        status: BookingStatus.COMPLETED,
      },
      {
        userId: marcus.id,
        experienceId: reefSnorkel.id,
        date: new Date(now - 1 * 24 * 60 * 60 * 1000),
        totalPrice: reefSnorkel.price,
        pointsEarned: Math.floor(reefSnorkel.price),
        status: BookingStatus.CANCELLED,
      },
      {
        userId: sarah.id,
        accommodationId: villaSurMer.id,
        date: new Date(now + 14 * 24 * 60 * 60 * 1000),
        totalPrice: 5200,
        pointsEarned: 5200,
        status: BookingStatus.CONFIRMED,
      },
    ],
  })

  // Create transactions
  await prisma.transaction.createMany({
    data: [
      { userId: jordan.id, vendorId: pushCart.id, amount: 45, type: TransactionType.PAYMENT, status: TransactionStatus.COMPLETED },
      { userId: jordan.id, vendorId: coralReef.id, amount: 30, type: TransactionType.PAYMENT, status: TransactionStatus.COMPLETED },
      { userId: jordan.id, vendorId: cliffsideGrill.id, amount: 185, type: TransactionType.PAYMENT, status: TransactionStatus.COMPLETED },
      { userId: jordan.id, amount: 100, type: TransactionType.TOPUP, status: TransactionStatus.COMPLETED },
      { userId: jordan.id, amount: 50, type: TransactionType.REWARD, status: TransactionStatus.COMPLETED },
      { userId: marcus.id, vendorId: pushCart.id, amount: 25, type: TransactionType.PAYMENT, status: TransactionStatus.COMPLETED },
      { userId: marcus.id, vendorId: coralReef.id, amount: 55, type: TransactionType.PAYMENT, status: TransactionStatus.COMPLETED },
      { userId: marcus.id, amount: 50, type: TransactionType.TOPUP, status: TransactionStatus.COMPLETED },
      { userId: marcus.id, vendorId: negrilWatersports.id, amount: 60, type: TransactionType.PAYMENT, status: TransactionStatus.PENDING },
      { userId: sarah.id, vendorId: blueMahoe.id, amount: 40, type: TransactionType.PAYMENT, status: TransactionStatus.COMPLETED },
      { userId: sarah.id, vendorId: cliffsideGrill.id, amount: 210, type: TransactionType.PAYMENT, status: TransactionStatus.COMPLETED },
      { userId: sarah.id, amount: 200, type: TransactionType.TOPUP, status: TransactionStatus.COMPLETED },
      { userId: sarah.id, amount: 50, type: TransactionType.REWARD, status: TransactionStatus.COMPLETED },
      { userId: tasha.id, vendorId: islandWellness.id, amount: 120, type: TransactionType.PAYMENT, status: TransactionStatus.COMPLETED },
      { userId: tasha.id, amount: 75, type: TransactionType.TOPUP, status: TransactionStatus.COMPLETED },
      { userId: devon.id, vendorId: mobayJerkHouse.id, amount: 35, type: TransactionType.PAYMENT, status: TransactionStatus.COMPLETED },
      { userId: devon.id, vendorId: mobayWatersports.id, amount: 140, type: TransactionType.PAYMENT, status: TransactionStatus.COMPLETED },
      { userId: devon.id, amount: 50, type: TransactionType.TOPUP, status: TransactionStatus.COMPLETED },
      { userId: jordan.id, vendorId: negrilWatersports.id, amount: 185, type: TransactionType.PAYMENT, status: TransactionStatus.COMPLETED },
    ],
  })

  // Create crew groups
  const squad = await prisma.crewGroup.create({
    data: {
      name: 'Negril Squad',
      code: 'NEGRIL25',
      creatorId: jordan.id,
    },
  })

  await prisma.crewMember.createMany({
    data: [
      { groupId: squad.id, userId: jordan.id, isActive: true },
      { groupId: squad.id, userId: marcus.id, isActive: true },
      { groupId: squad.id, userId: sarah.id, isActive: true },
    ],
  })

  const mobayCrew = await prisma.crewGroup.create({
    data: {
      name: 'MoBay Crew',
      code: 'MOBAY99',
      creatorId: devon.id,
    },
  })

  await prisma.crewMember.createMany({
    data: [
      { groupId: mobayCrew.id, userId: devon.id, isActive: true },
      { groupId: mobayCrew.id, userId: tasha.id, isActive: true },
    ],
  })

  // Create user moments (photos at photo spots)
  await prisma.userMoment.createMany({
    data: [
      {
        userId: jordan.id,
        photoSpotId: fishermansCove?.id,
        url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
        caption: 'Dawn at the cove',
        likes: 24,
      },
      {
        userId: marcus.id,
        photoSpotId: hiddenSwing?.id,
        url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800',
        caption: 'Found the swing',
        likes: 45,
      },
      {
        userId: sarah.id,
        photoSpotId: muralWall?.id,
        url: 'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=800',
        caption: 'Colors everywhere',
        likes: 32,
      },
      {
        userId: tasha.id,
        photoSpotId: rastaJump?.id,
        url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
        caption: 'Didn\'t jump... just watched',
        likes: 18,
      },
      {
        userId: jordan.id,
        photoSpotId: muralWall?.id,
        url: 'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=800',
        caption: 'Back again',
        likes: 15,
      },
    ],
  })

  // Create bundles
  await prisma.bundle.createMany({
    data: [
      {
        name: 'Full Moon Package',
        discount: 10,
        bonusPoints: 500,
        experienceId: fullMoon.id,
        accommodationId: villaSurMer.id,
      },
      {
        name: 'Rum & Relax',
        discount: 15,
        bonusPoints: 300,
        experienceId: rumBass.id,
        accommodationId: cliffHotel.id,
      },
    ],
  })

  console.log('Seed complete!')
  console.log('Demo users:')
  console.log('jordan@eta.app / password123')
  console.log('marcus@eta.app / password123')
  console.log('sarah@eta.app / password123')
  console.log('devon@eta.app / password123')
  console.log('tasha@eta.app / password123')
  console.log('admin@eta.app / password123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
