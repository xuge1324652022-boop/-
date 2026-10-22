import gsap from 'gsap'

/** 淡出/淡入窗口（秒）。某段结尾是强剪辑时可以传更大的值单独调。 */
const LOOP_FADE_S = 0.4

/**
 * 循环接缝的淡入淡出。
 *
 * 成片都是 `loop`，回绕那一刻是硬切（片尾构图 ≠ 片头构图），在白底
 * 页上尤其刺眼。做法：片尾前把 **video 自己**淡到透明，趁「看不见」的
 * 这几帧完成回绕，再淡回来。
 *
 * 为什么必须写在 video 上、而不是外层容器：滚动淡入淡出归外层
 * `.cview__media` 管（IntersectionObserver 切 `is-playing`）。同一元素共写
 * opacity 的话两套补间会互相覆盖 —— 滚回来时外层刚把 0 拉到 1，循环的补间
 * 又把它拉向 0，表现为「视频时隐时现」。两层各管各的，互不干涉。
 *
 * ⚠️ reduced-motion 由**调用方**决定挂不挂：那种情况下视频根本不播，没有
 * 循环可谈。把 `reduced` 做成这里的参数只会是一个永远走不到的分支。
 *
 * @param video       目标视频（必须已经 muted + loop）
 * @param fadeSeconds 淡出/淡入时长，默认 0.4s
 * @returns 清理函数：组件卸载时必须调用
 */
export function attachLoopFade(video: HTMLVideoElement, fadeSeconds = LOOP_FADE_S): () => void {
  /** 上一次读到的播放位置，用来识别回绕 */
  let last = 0
  /** 补间进行中 —— 避免同一段循环里反复起补间 */
  let busy = false

  const onTime = (): void => {
    const t = video.currentTime
    // 离屏暂停后的主动归零不是播放循环的接缝，不能误触发一次淡入。
    if (video.paused) {
      last = t
      return
    }
    const d = video.duration
    // duration 在 metadata 到达之前是 NaN，那几帧什么都别做
    if (!Number.isFinite(d) || d <= 0) {
      last = t
      return
    }

    if (t < last - 0.5) {
      /*
       * 回绕。`loop` 是浏览器无缝重启的，等我们被叫醒时 currentTime 已经回到
       * 开头了 —— 能观察到的信号只有「比上一次读数小了一大截」。
       * 此刻画面正被淡出遮住，直接淡回来。
       */
      gsap.killTweensOf(video)
      busy = true
      gsap.fromTo(
        video,
        { opacity: 0 },
        {
          opacity: 1,
          duration: fadeSeconds,
          ease: 'power2.inOut',
          // 淡入结束 → 解除忙标记，允许下一次片尾判定介入
          onComplete: () => {
            busy = false
          },
        },
      )
    } else if (!busy && !video.paused && d - t <= fadeSeconds) {
      /*
       * 临近片尾：淡到透明。
       *
       * 补间时长用**剩余时间**、而不是固定的 fadeSeconds —— `timeupdate` 的
       * 粒度是 250ms 级（规范只保证不低于 250ms），进来时可能只剩 60ms 了。
       * 用固定 0.4s 的话，片尾那一刻才淡到 15%，回绕照样看得见；用剩余时间
       * 就保证「到片尾刚好淡到 0」，无论这一帧什么时候被叫醒。
       */
      busy = true
      gsap.to(video, {
        opacity: 0,
        duration: Math.max(d - t, 0.06),
        ease: 'power2.inOut',
        // 淡出结束 → 解除忙标记；回绕时视频已被浏览器无缝重启
        onComplete: () => {
          busy = false
        },
      })
    }
    last = t
  }

  /*
   * 暂停即复位。这条是**承重的**，别当成保险丝删掉：
   *
   * 滚出视口时 IntersectionObserver 会 `pause()` + `currentTime = 0`；
   * 遮罩覆盖或切到后台时只暂停。两种情况都要取消尚在进行的片尾淡出，
   * 否则视频暂停后补间仍可能走到 opacity 0，下次恢复时就没有画面。
   * 暂停状态的归零已在 onTime 中跳过，不能靠 seek 意外触发的淡入来修复。
   *
   * 所以这里的契约是「**暂停 ⇒ 完全不透明**」，由本模块自己保证，不依赖
   * 调用方归不归零。verify-color-page.cjs 的 K 段专门构造「暂停但不归零」
   * 来锁这一条（走 IO 那条路验不出来：回绕检测会把它治好）。
   */
  const onPause = (): void => {
    gsap.killTweensOf(video)
    busy = false
    gsap.set(video, { opacity: 1 })
  }

  /*
   * 回前台兜底。标签页隐藏时 rAF 停摆，补间会冻在半路；GSAP 的 lag
   * smoothing 通常会在恢复时把它推到终点，这里再补一道，保证「不可能停在
   * 半透明」。是安全网，不是主路径。
   */
  const onVisibility = (): void => {
    if (document.visibilityState !== 'visible' || video.paused) return
    if (Number(getComputedStyle(video).opacity) < 0.99) {
      gsap.to(video, { opacity: 1, duration: 0.3, ease: 'power2.inOut' })
    }
  }

  video.addEventListener('timeupdate', onTime)
  video.addEventListener('pause', onPause)
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    video.removeEventListener('timeupdate', onTime)
    video.removeEventListener('pause', onPause)
    document.removeEventListener('visibilitychange', onVisibility)
    gsap.killTweensOf(video)
  }
}
