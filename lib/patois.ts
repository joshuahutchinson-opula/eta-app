export const patois = {
  loadingHome: 'Wull on deh',
  loadingMarketplace: 'Wi a look fi di spots',
  loadingVibe: 'Wi a find sumth nice fi yuh',
  loadingPayment: 'Wi a maths it up, wull on',
  loadingBooking: 'Wi a book it fi yuh',
  loadingRedeem: 'Wi a sort out yuh reward',
  loadingShare: 'Wi a share it',
  successPayment: 'Money dun sen',
  successBooked: 'Book off',
  successRedeemed: 'Reward dun sort',
  successSaved: 'Save up',
  successLinkCopied: 'Link dun copy',
  successDiscovery: 'Yuh find it!',
  successShoutout: 'Shoutout dun sen',
  errorGeneric: 'Sumth nah wuk',
  errorNetwork: 'Connection gone',
  errorPaymentFailed: 'Di money neva go thru',
  errorNotEnoughPoints: 'Yuh nave nuh points',
  errorClosed: 'Dem lock',
  emptySearch: 'Nuttin nuh go suh',
  emptySaved: 'Nuttin deh yah',
  emptyReceipts: 'Nah nuh receipt',
  emptyRewards: 'Nah nuh rewards',
  emptyReviews: 'Nuh nuh reviews',
  ctaPrimary: 'Fawud',
  ctaSkip: 'Skip dat',
  ctaVibe: 'Mek wi go',
  ctaSurprise: 'Shock mi',
  ctaPay: 'Pay',
  ctaConfirm: 'Dun',
  ctaBook: 'Book dis',
  ctaWelcome: 'Wah Gwan',
  ctaGroupMode: 'Pass di phone',
  ctaPushNotification: 'Pree dis'
}

export type PatoisKey = keyof typeof patois

// Spanish keeps the same register — short, warm, a bit cheeky — using
// Caribbean Spanish where it fits, rather than word-for-word patois.
// "Wah Gwan" stays as-is: it's the brand's greeting, not just a word.
// Phrases that only work as patois wordplay are rewritten; each is listed
// in PATOIS_TRANSLATION_NOTES (lib/i18n.ts) for a native speaker to review.
export const patoisEs: Record<PatoisKey, string> = {
  loadingHome: 'Aguanta ahí',
  loadingMarketplace: 'Buscando los spots',
  loadingVibe: 'Te buscamos algo sabroso',
  loadingPayment: 'Sacando la cuenta, aguanta',
  loadingBooking: 'Te lo estamos reservando',
  loadingRedeem: 'Arreglando tu premio',
  loadingShare: 'Compartiendo',
  successPayment: 'Dinero enviado',
  successBooked: '¡Reservado!',
  successRedeemed: 'Premio listo',
  successSaved: 'Guardado',
  successLinkCopied: 'Enlace copiado',
  successDiscovery: '¡Lo encontraste!',
  successShoutout: 'Saludo enviado',
  errorGeneric: 'Algo no funcionó',
  errorNetwork: 'Se fue la conexión',
  errorPaymentFailed: 'El pago no pasó',
  errorNotEnoughPoints: 'No te alcanzan los puntos',
  errorClosed: 'Está cerrado',
  emptySearch: 'Nada por aquí',
  emptySaved: 'Aquí no hay nada',
  emptyReceipts: 'No hay recibos',
  emptyRewards: 'No hay premios todavía',
  emptyReviews: 'Aún no hay reseñas',
  ctaPrimary: 'Dale',
  ctaSkip: 'Salta eso',
  ctaVibe: '¡Vámonos!',
  ctaSurprise: 'Sorpréndeme',
  ctaPay: 'Pagar',
  ctaConfirm: 'Listo',
  ctaBook: 'Reserva esto',
  ctaWelcome: 'Wah Gwan',
  ctaGroupMode: 'Pasa el teléfono',
  ctaPushNotification: 'Mira esto'
}

export function getPatois(lang: 'en' | 'es'): Record<PatoisKey, string> {
  return lang === 'es' ? patoisEs : patois
}
