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

  // Create vendors with verified Pexels videos
  const pushCart = await prisma.vendor.create({
    data: {
      name: 'Push Cart',
      category: VendorCategory.FOOD,
      neighborhood: 'West End',
      city: City.NEGRIL,
      lat: 18.2856,
      lng: -78.3397,
      priceRange: '$$',
      description: 'Family-run. Catch of the day. Best jerk chicken on the west end. Wood fire, open grill, no shortcuts.',
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=800',
        'https://images.unsplash.com/photo-1562967914-608f82629710?w=800',
      ],
      videos: [
        'https://videos.pexels.com/video-files/35659845/15111600_1920_1080_60fps.mp4',
      ],
      open: true,
      live: true,
      isPremium: true,
      whoThere: 14,
      tipsJar: true,
      payItForward: true,
      ownerId: jordan.id,
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
      description: 'Ackee and saltfish with a view. Breakfast done right. Cliffside seating, sea breeze, freshly ground Blue Mountain coffee.',
      images: [
        'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800',
        'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800',
        'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: true,
      whoThere: 7,
      tipsJar: true,
      payItForward: true,
      ownerId: sarah.id,
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
      description: 'Rum punch so good you\'ll forget your name. Live music on weekends. Right on the sand, toes in the water.',
      images: [
        'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800',
        'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800',
        'https://images.unsplash.com/photo-1525268323446-0505b6fe7778?w=800',
      ],
      videos: [
        'https://videos.pexels.com/video-files/35659845/15111600_1920_1080_60fps.mp4',
      ],
      open: true,
      live: true,
      isPremium: true,
      whoThere: 23,
      tipsJar: true,
      payItForward: true,
      ownerId: marcus.id,
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
      description: 'Massage, yoga, and healing vibes. Deep tissue, hot stone, and guided meditation with ocean views.',
      images: [
        'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800',
        'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800',
        'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800',
      ],
      videos: [],
      open: false,
      live: false,
      isPremium: false,
      whoThere: 0,
      tipsJar: true,
      payItForward: false,
      ownerId: tasha.id,
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
      description: 'Red plates. Loud music. Gets you there. Routes from Negril to Montego Bay and everywhere in between.',
      images: [
        'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800',
        'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800',
      ],
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
      ownerId: devon.id,
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
      description: 'Best coconut on the beach. Cold, fresh, perfect. Machete opened while you wait.',
      images: [
        'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800',
        'https://images.unsplash.com/photo-1581928297871-d2f1e519b816?w=800',
      ],
      videos: [],
      open: true,
      live: true,
      isPremium: false,
      whoThere: 5,
      tipsJar: true,
      payItForward: true,
    },
  })

  const cliffsideGrill = await prisma.vendor.create({
    data: {
      name: 'Cliffside Grill',
      category: VendorCategory.FOOD,
      neighborhood: 'West End',
      city: City.NEGRIL,
      lat: 18.2971,
      lng: -78.3298,
      priceRange: '$$$',
      description: 'Lobster, steak, and sunset dinners. Perched on the cliffs with private dining decks.',
      images: [
        'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
        'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800',
      ],
      videos: [],
      open: true,
      live: true,
      isPremium: true,
      whoThere: 11,
      tipsJar: true,
      payItForward: true,
    },
  })

  const negrilWatersports = await prisma.vendor.create({
    data: {
      name: 'Negril Watersports',
      category: VendorCategory.ACTIVITY,
      neighborhood: 'Seven Mile',
      city: City.NEGRIL,
      lat: 18.2678,
      lng: -78.3545,
      priceRange: '$$',
      description: 'Jet skis, parasailing, glass-bottom boat tours. All the water action.',
      images: [
        'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
        'https://images.unsplash.com/photo-1560089000-7433a4ebbd64?w=800',
      ],
      videos: [],
      open: true,
      live: false,
      isPremium: false,
      whoThere: 6,
      tipsJar: true,
      payItForward: false,
    },
  })

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
        'https://videos.pexels.com/video-files/35659845/15111600_1920_1080_60fps.mp4',
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
      videos: [],
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
      videos: [
      ],
      open: true,
      live: true,
      isPremium: true,
      whoThere: 12,
      tipsJar: true,
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
    { name: 'R&R', description: 'Rest and relaxation.', icon: 'wellness', coverImage: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800' },
    { name: 'Just The Two Of Us', description: 'Romantic. Sunset dinners.', icon: 'sparkle', coverImage: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800' },
    { name: 'Out Til Sunrise', description: 'Party. Late night.', icon: 'moon', coverImage: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800' },
    { name: 'Golden Hour', description: 'Sunset chasing.', icon: 'sun', coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800' },
    { name: 'Water Life', description: 'Snorkeling, boats, cliffs.', icon: 'activity', coverImage: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800' },
    { name: 'Street Food Crawl', description: 'Jerk stands, patties.', icon: 'food', coverImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800' },
    { name: 'Hangover Cures', description: 'Recovery.', icon: 'drink', coverImage: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800' },
    { name: 'Solo Missions', description: 'For the lone explorer.', icon: 'user', coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800' },
    { name: 'Family Day', description: 'Kid-friendly.', icon: 'users', coverImage: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800' },
    { name: 'Rum & Bass', description: 'Drinks and music.', icon: 'drink', coverImage: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800' },
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