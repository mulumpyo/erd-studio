export const parsePage = (page?: number, limit?: number, fallback = 8) => {
  const take = Math.min(50, Math.max(1, limit || fallback))
  const current = Math.max(1, page || 1)
  return {
    skip: (current - 1) * take,
    take,
    page: current,
    limit: take,
  }
}

export const pageResult = <T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
) => ({
  items,
  total,
  page,
  limit,
  pages: Math.max(1, Math.ceil(total / Math.max(1, limit))),
})

export const contains = (q: string) => ({
  contains: q,
  mode: 'insensitive' as const,
})
