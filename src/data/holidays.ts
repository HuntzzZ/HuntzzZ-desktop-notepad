/**
 * 中国节假日 + 农历数据
 * 使用 lunar-javascript 库提供准确的农历和节假日信息
 */
import { Solar } from 'lunar-javascript'

// 固定日期节假日（公历）
export const FIXED_HOLIDAYS: Record<string, string> = {
  '01-01': '元旦',
  '02-14': '情人节',
  '03-08': '妇女节',
  '04-05': '清明节',
  '05-01': '劳动节',
  '05-04': '青年节',
  '06-01': '儿童节',
  '07-01': '建党节',
  '08-01': '建军节',
  '09-10': '教师节',
  '10-01': '国庆节',
  '10-31': '万圣节',
  '12-24': '平安夜',
  '12-25': '圣诞节',
}

// 农历节日
export const LUNAR_HOLIDAYS: Record<string, string> = {
  '01-01': '春节',
  '01-02': '初二',
  '01-03': '初三',
  '01-15': '元宵节',
  '05-05': '端午节',
  '07-07': '七夕',
  '07-15': '中元节',
  '08-15': '中秋节',
  '09-09': '重阳节',
  '12-08': '腊八节',
  '12-30': '除夕',
  '12-29': '除夕', // 小月情况
}

/**
 * 获取公历日期的节日
 */
export function getHoliday(dateStr: string): string | null {
  const mmdd = dateStr.slice(5)
  return FIXED_HOLIDAYS[mmdd] || null
}

/**
 * 获取农历节日
 */
export function getLunarHoliday(dateStr: string): string | null {
  try {
    const [y, m, d] = dateStr.split('-').map(Number)
    const solar = Solar.fromYmd(y, m, d)
    const lunar = solar.getLunar()
    const lunarMmDd = `${String(lunar.getMonth()).padStart(2, '0')}-${String(lunar.getDay()).padStart(2, '0')}`
    return LUNAR_HOLIDAYS[lunarMmDd] || null
  } catch {
    return null
  }
}

/**
 * 获取农历日期文本（如：正月初一、腊月廿三）
 */
export function getLunarText(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number)
    const solar = Solar.fromYmd(y, m, d)
    const lunar = solar.getLunar()
    return lunar.getMonthInChinese() + '月' + lunar.getDayInChinese()
  } catch {
    return ''
  }
}

/**
 * 获取某天的完整节日信息（公历+农历，优先显示节日）
 */
export function getDateInfo(dateStr: string): { holiday: string | null; lunar: string } {
  const holiday = getHoliday(dateStr) || getLunarHoliday(dateStr)
  const lunar = getLunarText(dateStr)
  return { holiday, lunar }
}

/**
 * 判断是否为周末
 */
export function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr)
  const day = d.getDay()
  return day === 0 || day === 6
}

/**
 * 获取法定节假日列表（含调休信息）
 * 2026年主要假期，可根据需要扩展
 */
export const HOLIDAYS_2026: { start: string; end: string; name: string; workdays?: string[] }[] = [
  { start: '2026-01-01', end: '2026-01-03', name: '元旦' },
  { start: '2026-02-17', end: '2026-02-23', name: '春节', workdays: ['2026-02-14', '2026-02-15'] },
  { start: '2026-04-04', end: '2026-04-06', name: '清明节' },
  { start: '2026-05-01', end: '2026-05-05', name: '劳动节', workdays: ['2026-04-26'] },
  { start: '2026-05-31', end: '2026-06-02', name: '端午节' },
  { start: '2026-10-01', end: '2026-10-07', name: '国庆节', workdays: ['2026-09-27'] },
]

/**
 * 判断某天是否为法定假日
 */
export function isHoliday(dateStr: string): { isHoliday: boolean; name?: string } {
  for (const h of HOLIDAYS_2026) {
    if (dateStr >= h.start && dateStr <= h.end) {
      return { isHoliday: true, name: h.name }
    }
  }
  return { isHoliday: false }
}

/**
 * 判断某天是否为调休工作日
 */
export function isWorkday(dateStr: string): boolean {
  for (const h of HOLIDAYS_2026) {
    if (h.workdays?.includes(dateStr)) {
      return true
    }
  }
  return false
}
