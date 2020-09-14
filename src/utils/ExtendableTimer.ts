class ExtendableTimer {
  active = false
  private fn: () => void
  private timer: NodeJS.Timer|undefined = undefined

  constructor (fn: () => void) {
    this.fn = fn
  }

  /**
   * Clears the previous interval and creates a new one
   * with the time passed as an argument
   */
  resetWith(time: number) {
    if (this.timer) {
      clearTimeout(this.timer)
    }
    this.active = true
    this.timer = setTimeout(() => {
      this.fn()
      this.active = false
    }, time)
  }
}

export default ExtendableTimer
