import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  computeUsagePoint,
  computeUsageSeries,
  eachUsageDay,
  isUsageDay,
  shiftUsageDay,
  usageDayBounds,
  usageDayKey,
} from './usage-day'

test('usageDayKey uses the Seoul calendar date', () => {
  // 2026-09-04 00:30 KST = 2026-09-03 15:30 UTC
  assert.equal(usageDayKey(new Date('2026-09-03T15:30:00.000Z')), '2026-09-04')
  assert.equal(usageDayKey(new Date('2026-09-03T14:59:00.000Z')), '2026-09-03')
})

test('usageDayBounds is a Seoul calendar day in UTC', () => {
  const { start, end } = usageDayBounds('2026-09-04')
  assert.equal(start.toISOString(), '2026-09-03T15:00:00.000Z')
  assert.equal(end.toISOString(), '2026-09-04T15:00:00.000Z')
})

test('shiftUsageDay and eachUsageDay walk calendar days', () => {
  assert.equal(shiftUsageDay('2026-09-04', -6), '2026-08-29')
  assert.equal(shiftUsageDay('2026-03-01', -1), '2026-02-28')
  assert.deepEqual(eachUsageDay('2026-09-03', '2026-09-05'), [
    '2026-09-03',
    '2026-09-04',
    '2026-09-05',
  ])
  assert.equal(isUsageDay('2026-09-04'), true)
  assert.equal(isUsageDay('09-04'), false)
})

test('DAU is unique users that day; WAU/MAU roll the windows', () => {
  const rows = [
    { day: '2026-08-06', userId: 'a' },
    { day: '2026-08-20', userId: 'b' },
    { day: '2026-08-29', userId: 'c' },
    { day: '2026-09-04', userId: 'a' },
    { day: '2026-09-04', userId: 'd' },
  ]
  assert.deepEqual(computeUsagePoint(rows, '2026-09-04'), {
    day: '2026-09-04',
    dau: 2,
    wau: 3,
    mau: 4,
  })
  const series = computeUsageSeries(rows, '2026-09-04', '2026-09-04')
  assert.equal(series.length, 1)
  assert.equal(series[0].dau, 2)
})
