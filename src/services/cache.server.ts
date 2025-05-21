import { nextTick } from 'node:process'

// Simple in-memory cache implementation without dependencies
export const cache = <Value>(fn: () => Value): (() => Value) => {
  let cachedValue: Value | undefined
  let hasValue = false

  const cachedFn = () => {
    if (!hasValue) {
      cachedValue = fn()
      hasValue = true
    }
    return cachedValue as Value
  }

  // Call and cache asynchronously to ensure dependencies are initialized.
  nextTick(cachedFn)
  return cachedFn
}
