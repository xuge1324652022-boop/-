/** 每章先停留、走完全部照片、再停留；下一章的遮罩绝不提前进入。 */
export function chapterSchedule(distances: readonly number[], height: number) {
  let cursor = 0
  const hold = height * .3
  const wipe = height * .8
  return distances.map((distance, index) => {
    const enter = cursor
    const start = enter + (index ? wipe : 0) + hold
    const end = start + Math.max(0, distance)
    cursor = end + hold
    return { enter, start, end, finish: cursor, wipe: index ? wipe : 0 }
  })
}
export const unit = (value: number) => Math.max(0, Math.min(1, value))
