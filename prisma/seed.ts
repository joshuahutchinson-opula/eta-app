import { PrismaClient, City, VendorCategory, AccommodationType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Clear all data
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
  await prisma.user.deleteMany()

  // Create demo user
  const hashedPassword = await bcrypt.hash('password123', 10)
  const jordan = await prisma.user.create({
    data: {
      email: 'jordan@eta.app',
      password: hashedPassword,
      name: 'Jordan',
      points: 1240,
      walletBalance: 250,
      streak: 3,
      city: City.NEGRIL,
    },
  })

  const marcus = await prisma.user.create({
    data: {
      email: 'marcus@eta.app',
      password: hashedPassword,
      name: 'Marcus',
      points: 850,
      walletBalance: 100,
      streak: 5,
      city: City.NEGRIL,
    },
  })

  const sarah = await prisma.user.create({
    data: {
      email: 'sarah@eta.app',
      password: hashedPassword,
      name: 'Sarah',
      points: 2100,
      walletBalance: 400,
      streak: 7,
      city: City.NEGRIL,
    },
  })

  // Create vendors
  const pushCart = await prisma.vendor.create({
    data: {
      name: 'Push Cart',
      category: VendorCategory.FOOD,
      neighborhood: 'West End',
      city: City.NEGRIL,
      lat: 18.2856,
      lng: -78.3397,
      priceRange: '$$',
      description: 'Family-run. Catch of the day. Best jerk chicken on the west end.',
      images: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400'],
      videos: [],
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
      name: 'Blue Mahoe',
      category: VendorCategory.FOOD,
      neighborhood: 'Cliffs',
      city: City.NEGRIL,
      lat: 18.2983,
      lng: -78.3356,
      priceRange: '$$$',
      description: 'Ackee and saltfish with a view. Breakfast done right.',
      images: ['https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400'],
      videos: [],
      open: true,
      live: false,
      isPremium: true,
      whoThere: 7,
      tipsJar: true,
      payItForward: true,
    },
  })

  const coralReef = await prisma.vendor.create({
    data: {
      name: 'Coral Reef Bar',
      category: VendorCategory.DRINKS,
      neighborhood: 'Seven Mile',
      city: City.NEGRIL,
      lat: 18.2695,
      lng: -78.3512,
      priceRange: '$$',
      description: 'Rum punch so good you\'ll forget your name.',
      images: ['https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400'],
      videos: [],
      open: true,
      live: true,
      isPremium: true,
      whoThere: 23,
      tipsJar: true,
      payItForward: true,
    },
  })

  const islandWellness = await prisma.vendor.create({
    data: {
      name: 'Island Wellness',
      category: VendorCategory.WELLNESS,
      neighborhood: 'West End',
      city: City.NEGRIL,
      lat: 18.2934,
      lng: -78.3278,
      priceRange: '$$$',
      description: 'Massage, yoga, and healing vibes.',
      images: ['https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400'],
      videos: [],
      open: false,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: true,
      payItForward: false,
    },
  })

  const rastaTaxi = await prisma.vendor.create({
    data: {
      name: 'Rasta Taxi',
      category: VendorCategory.TRANSPORT,
      neighborhood: 'Negril Strip',
      city: City.NEGRIL,
      lat: 18.2712,
      lng: -78.3478,
      priceRange: '$',
      description: 'Red plates. Loud music. Gets you there.',
      images: ['https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=400'],
      videos: [],
      open: true,
      live: true,
      isPremium: false,
      isTransport: true,
      visibleInMarketplace: false,
      visibleOnMap: false,
      whoThere: 3,
      tipsJar: true,
      payItForward: false,
    },
  })

  const coconutMan = await prisma.vendor.create({
    data: {
      name: 'Coconut Man',
      category: VendorCategory.FOOD,
      neighborhood: 'Seven Mile',
      city: City.NEGRIL,
      lat: 18.2723,
      lng: -78.3521,
      priceRange: '$',
      description: 'Best coconut on the beach. Cold, fresh, perfect.',
      images: ['https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400'],
      videos: [],
      open: true,
      live: true,
      isPremium: false,
      whoThere: 5,
      tipsJar: true,
      payItForward: true,
    },
  })

  // Create experiences
  const fullMoon = await prisma.experience.create({
    data: {
      name: 'Full Moon Float',
      tagline: 'Dinner, dubs, boat at sunrise.',
      price: 185,
      imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600',
      city: City.NEGRIL,
      startLocation: 'Seven Mile Beach',
      travelTime: 5,
      travelMode: 'walking',
    },
  })

  const rumBass = await prisma.experience.create({
    data: {
      name: 'Rum & Bass',
      tagline: 'Tastings, sound system, jerk.',
      price: 120,
      imageUrl: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600',
      city: City.NEGRIL,
      startLocation: 'West End',
      travelTime: 15,
      travelMode: 'taxi',
    },
  })

  const cliffMorning = await prisma.experience.create({
    data: {
      name: 'Cliff Morning',
      tagline: 'Yoga, breakfast, dip.',
      price: 90,
      imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600',
      city: City.NEGRIL,
      startLocation: 'The Cliffs',
      travelTime: 10,
      travelMode: 'walking',
    },
  })

  // Create photo spots
  await prisma.photoSpot.createMany({
    data: [
      {
        name: 'Fisherman\'s Cove',
        description: 'Boats at dawn',
        lat: 18.2634,
        lng: -78.3621,
        bestTime: 'Dawn',
        officialPhoto: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400',
        city: City.NEGRIL,
      },
      {
        name: 'Hidden Swing',
        description: 'Tree swing',
        lat: 18.2934,
        lng: -78.3456,
        bestTime: 'Golden Hour',
        officialPhoto: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400',
        city: City.NEGRIL,
      },
      {
        name: 'Mural Wall',
        description: 'Photo spot',
        lat: 18.2812,
        lng: -78.3321,
        bestTime: 'Afternoon',
        officialPhoto: 'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=400',
        city: City.NEGRIL,
      },
      {
        name: 'Coconut Man Spot',
        description: 'Best coconut',
        lat: 18.2723,
        lng: -78.3521,
        bestTime: 'Anytime',
        officialPhoto: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400',
        city: City.NEGRIL,
      },
    ],
  })

  // Create stories
  await prisma.story.createMany({
    data: [
      {
        content: 'Fresh catch!',
        type: 'premium',
        imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',
        vendorId: pushCart.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      {
        content: 'Breakfast view',
        type: 'premium',
        imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400',
        vendorId: blueMahoe.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      {
        content: 'Live music 9pm!',
        type: 'premium',
        imageUrl: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400',
        vendorId: coralReef.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    ],
  })

  // Create accommodations
  await prisma.accommodation.createMany({
    data: [
      {
        name: 'The Cliff Hotel',
        type: AccommodationType.A_LA_CARTE,
        googleStars: 4.7,
        description: 'Boutique cliffside hotel with stunning sunsets.',
        amenities: ['Pool', 'Spa', 'Restaurant', 'Bar', 'WiFi', 'AC'],
        priceRange: '$$$',
        lat: 18.2985,
        lng: -78.3312,
        city: City.NEGRIL,
        vetted: true,
        media: [{ type: 'photo', url: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800' }],
        roomViews: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400'],
      },
      {
        name: 'Sandals Negril',
        type: AccommodationType.ALL_INCLUSIVE,
        googleStars: 4.5,
        description: 'Luxury all-inclusive resort on Seven Mile Beach.',
        amenities: ['Private Beach', 'Pools', 'Restaurants', 'Bars', 'Spa', 'Water Sports'],
        priceRange: '$$$$',
        lat: 18.2712,
        lng: -78.3498,
        city: City.NEGRIL,
        vetted: true,
        media: [{ type: 'photo', url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800' }],
        roomViews: ['https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=400'],
      },
      {
        name: 'Villa Sur Mer',
        type: AccommodationType.VILLA,
        googleStars: 4.9,
        description: 'Private villa with infinity pool and chef.',
        amenities: ['Private Pool', 'Chef', 'Housekeeper', 'AC', 'WiFi', 'Ocean View'],
        priceRange: '$$$$$',
        lat: 18.3021,
        lng: -78.3256,
        city: City.NEGRIL,
        vetted: true,
        media: [{ type: 'photo', url: 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=800' }],
        roomViews: ['https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=400'],
      },
    ],
  })

  // Create moods
  const moods = [
    { name: 'R&R', description: 'Rest and relaxation.', icon: 'wellness', coverImage: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400' },
    { name: 'Just The Two Of Us', description: 'Romantic. Sunset dinners.', icon: 'sparkle', coverImage: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400' },
    { name: 'Out Til Sunrise', description: 'Party. Late night.', icon: 'moon', coverImage: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=400' },
    { name: 'Golden Hour', description: 'Sunset chasing.', icon: 'sun', coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400' },
    { name: 'Water Life', description: 'Snorkeling, boats, cliffs.', icon: 'activity', coverImage: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400' },
    { name: 'Street Food Crawl', description: 'Jerk stands, patties.', icon: 'food', coverImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400' },
    { name: 'Hangover Cures', description: 'Recovery.', icon: 'drink', coverImage: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400' },
    { name: 'Solo Missions', description: 'For the lone explorer.', icon: 'user', coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400' },
    { name: 'Family Day', description: 'Kid-friendly.', icon: 'users', coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400' },
    { name: 'Rum & Bass', description: 'Drinks and music.', icon: 'drink', coverImage: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400' },
  ]

  for (const mood of moods) {
    await prisma.mood.create({ data: mood })
  }

  // Create flash deals
  await prisma.flashDeal.createMany({
    data: [
      {
        deal: '20% off jerk chicken',
        vendorId: pushCart.id,
        expires: new Date(Date.now() + 6 * 60 * 60 * 1000),
      },
      {
        deal: '2-for-1 rum punch',
        vendorId: coralReef.id,
        expires: new Date(Date.now() + 4 * 60 * 60 * 1000),
      },
    ],
  })

  // Create check-ins
  await prisma.checkIn.createMany({
    data: [
      { userId: marcus.id, vendorId: pushCart.id },
      { userId: sarah.id, vendorId: coralReef.id },
    ],
  })

  // Create reviews
  await prisma.review.createMany({
    data: [
      { userId: marcus.id, vendorId: pushCart.id, rating: 5, comment: 'Best jerk chicken in Negril. Period.' },
      { userId: sarah.id, vendorId: coralReef.id, rating: 5, comment: 'Rum punch changed my life.' },
    ],
  })

  // Create discoveries
  await prisma.discovery.createMany({
    data: [
      { userId: jordan.id, vendorId: pushCart.id, type: 'VENDOR', points: 10 },
      { userId: marcus.id, vendorId: coralReef.id, type: 'VENDOR', points: 10 },
      { userId: sarah.id, vendorId: blueMahoe.id, type: 'VENDOR', points: 10 },
    ],
  })

  // Create bookings
  await prisma.booking.create({
    data: {
      userId: jordan.id,
      experienceId: fullMoon.id,
      date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      totalPrice: fullMoon.price,
      pointsEarned: Math.floor(fullMoon.price),
      status: 'CONFIRMED',
    },
  })

  await prisma.booking.create({
    data: {
      userId: marcus.id,
      experienceId: rumBass.id,
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      totalPrice: rumBass.price,
      pointsEarned: Math.floor(rumBass.price),
      status: 'CONFIRMED',
    },
  })

  // Create transactions
  await prisma.transaction.createMany({
    data: [
      { userId: jordan.id, vendorId: pushCart.id, amount: 45, type: 'PAYMENT', status: 'COMPLETED' },
      { userId: jordan.id, vendorId: coralReef.id, amount: 30, type: 'PAYMENT', status: 'COMPLETED' },
      { userId: marcus.id, vendorId: pushCart.id, amount: 25, type: 'PAYMENT', status: 'COMPLETED' },
    ],
  })

  console.log('Seed complete!')
  console.log('Demo users:')
  console.log('jordan@eta.app / password123')
  console.log('marcus@eta.app / password123')
  console.log('sarah@eta.app / password123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })