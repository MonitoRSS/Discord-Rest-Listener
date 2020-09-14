import ExtendableTimer from './ExtendableTimer'

jest.useFakeTimers()

describe('ExtendableTimer', () => {
  describe('resetWith', () => {
    it('does not call the fn if delayed', () => {
      const fn = jest.fn()
      const timer = new ExtendableTimer(() => fn())
      timer.resetWith(5000)
      jest.advanceTimersByTime(2000)
      // 3000 ms left on timer, it should be reset back to 5000
      timer.resetWith(5000)
      /**
       * Advancing by a total of 5000ms should not trigger the fn with
       * the original timer created with resetWith()
       */
      jest.advanceTimersByTime(3000)
      expect(fn).not.toHaveBeenCalled()
      jest.advanceTimersByTime(1000)
      expect(fn).not.toHaveBeenCalled()
      jest.advanceTimersByTime(1000)
      expect(fn).toHaveBeenCalled()
    })
    it('calls the fn after delay', () => {
      const fn = jest.fn()
      const timer = new ExtendableTimer(() => fn())
      timer.resetWith(5000)
      expect(fn).not.toHaveBeenCalled()
      jest.advanceTimersByTime(5000)
      expect(fn).toHaveBeenCalled()
    })
  })
})
