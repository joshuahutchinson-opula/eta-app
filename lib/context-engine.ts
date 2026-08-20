interface BounceSuggestion {
  title: string
  desc: string
  icon: string
  action: 'vendor' | 'map' | 'experiences'
  vendorId?: string
}

export function getBounceSuggestion(
  currentVendorCategory: string | null,
  userLocation: { lat: number; lng: number } | null,
  hour: number = new Date().getHours(),
  tempC: number = 28,
  justBoughtFood: boolean = false,
  atVendorForHours: number = 0
): BounceSuggestion {
  // Hour 17-19 → Sunset viewpoint
  if (hour >= 17 && hour <= 19) {
    return {
      title: 'Sunset in 42 min',
      desc: 'You\'re 7 min from the best viewpoint.',
      icon: 'sun',
      action: 'map'
    }
  }

  // Just bought food → Spot with view nearby
  if (justBoughtFood) {
    return {
      title: 'Food with a view?',
      desc: '5 min away. Bring your plate.',
      icon: 'food',
      action: 'map'
    }
  }

  // Hour >= 20 → Night run
  if (hour >= 20) {
    return {
      title: 'Night run loading',
      desc: 'Live music at Coral Reef Bar. 8 min away.',
      icon: 'moon',
      action: 'vendor',
      vendorId: 'coral-reef'
    }
  }

  // At vendor 2+ hours → Live music alert
  if (atVendorForHours >= 2) {
    return {
      title: 'Live music alert',
      desc: 'Something else is happening nearby.',
      icon: 'audio',
      action: 'map'
    }
  }

  // Hour 10-16 → Cliffside morning
  if (hour >= 10 && hour <= 16) {
    return {
      title: 'Cliffside morning',
      desc: 'Yoga, breakfast, dip. 10 min away.',
      icon: 'activity',
      action: 'experiences'
    }
  }

  // Walking 2+ hours AND temp >= 25 → Coconut vendor
  if (tempC >= 25) {
    return {
      title: 'Coconut time',
      desc: 'Cold coconut nearby. 3 min walk.',
      icon: 'drink',
      action: 'map'
    }
  }

  // Default
  return {
    title: 'Explore the area',
    desc: 'Some spots only appear when close.',
    icon: 'compass',
    action: 'map'
  }
}