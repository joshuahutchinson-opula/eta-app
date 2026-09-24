import { NextResponse } from 'next/server'
import { filterFromParams, queryVendors, vendorFacets, USER_SORTS } from '@/lib/vendor-query'

export const dynamic = 'force-dynamic'

// GET /api/web/vendors?q=&category=FOOD,DRINKS&area=west-end&price=$,$$&access=WHEELCHAIR_ACCESSIBLE&sort=rating&skip=0&take=12
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const { filter, sort } = filterFromParams(params)
    const skip = Math.max(0, Number(params.get('skip')) || 0)
    const take = Math.min(48, Math.max(1, Number(params.get('take')) || 12))
    const withFacets = params.get('facets') !== '0'
    const [result, facets] = await Promise.all([
      queryVendors(filter, { sort, skip, take, prioritize: !USER_SORTS.includes(sort) }),
      withFacets ? vendorFacets(filter) : Promise.resolve(null)
    ])
    return NextResponse.json({ ...result, facets })
  } catch (error) {
    console.error('Error querying web vendors:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
