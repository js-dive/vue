import { isRef, Ref } from './reactivity/ref'
import { ComputedRef } from './reactivity/computed'
import { isReactive, isShallow } from './reactivity/reactive'
import {
  warn,
  noop,
  isArray,
  isFunction,
  emptyObject,
  hasChanged,
  isServerRendering,
  invokeWithErrorHandling
} from 'core/util'
import { currentInstance } from './currentInstance'
import { traverse } from 'core/observer/traverse'
import Watcher from '../core/observer/watcher'
import { queueWatcher } from '../core/observer/scheduler'
import { DebuggerOptions } from './debug'

const WATCHER = `watcher`
const WATCHER_CB = `${WATCHER} callback`
const WATCHER_GETTER = `${WATCHER} getter`
const WATCHER_CLEANUP = `${WATCHER} cleanup`

export type WatchEffect = (onCleanup: OnCleanup) => void

export type WatchSource<T = any> = Ref<T> | ComputedRef<T> | (() => T)

export type WatchCallback<V = any, OV = any> = (
  value: V,
  oldValue: OV,
  onCleanup: OnCleanup
) => any

type MapSources<T, Immediate> = {
  [K in keyof T]: T[K] extends WatchSource<infer V>
    ? Immediate extends true
      ? V | undefined
      : V
    : T[K] extends object
    ? Immediate extends true
      ? T[K] | undefined
      : T[K]
    : never
}

type OnCleanup = (cleanupFn: () => void) => void

// flushSchedulerQueue sortCompareFn 调用时，会根据此进行排序
export interface WatchOptionsBase extends DebuggerOptions {
  flush?: 'pre' | 'post' | 'sync'
}

export interface WatchOptions<Immediate = boolean> extends WatchOptionsBase {
  immediate?: Immediate
  deep?: boolean
}

export type WatchStopHandle = () => void

// Simple effect.
export function watchEffect(
  effect: WatchEffect,
  options?: WatchOptionsBase
): WatchStopHandle {
  return doWatch(effect, null, options)
}

export function watchPostEffect(
  effect: WatchEffect,
  options?: DebuggerOptions
) {
  return doWatch(
    effect,
    null,
    (__DEV__
      ? { ...options, flush: 'post' }
      : { flush: 'post' }) as WatchOptionsBase
  )
}

export function watchSyncEffect(
  effect: WatchEffect,
  options?: DebuggerOptions
) {
  return doWatch(
    effect,
    null,
    (__DEV__
      ? { ...options, flush: 'sync' }
      : { flush: 'sync' }) as WatchOptionsBase
  )
}

// initial value for watchers to trigger on undefined initial values
const INITIAL_WATCHER_VALUE = {}

type MultiWatchSources = (WatchSource<unknown> | object)[]

//#region watch 函数定义与实现
// overload: array of multiple sources + cb
export function watch<
  T extends MultiWatchSources,
  Immediate extends Readonly<boolean> = false
>(
  sources: [...T],
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>
): WatchStopHandle

// overload: multiple sources w/ `as const`
// watch([foo, bar] as const, () => {})
// somehow [...T] breaks when the type is readonly
export function watch<
  T extends Readonly<MultiWatchSources>,
  Immediate extends Readonly<boolean> = false
>(
  source: T,
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>
): WatchStopHandle

// overload: single source + cb
export function watch<T, Immediate extends Readonly<boolean> = false>(
  source: WatchSource<T>,
  cb: WatchCallback<T, Immediate extends true ? T | undefined : T>,
  options?: WatchOptions<Immediate>
): WatchStopHandle

// overload: watching reactive object w/ cb
export function watch<
  T extends object,
  Immediate extends Readonly<boolean> = false
>(
  source: T,
  cb: WatchCallback<T, Immediate extends true ? T | undefined : T>,
  options?: WatchOptions<Immediate>
): WatchStopHandle

// implementation
/**
 * watch 函数入口
 *
 * @param source 监听源
 * @param cb 回调函数
 * @param options 监听选项
 * @returns
 */
export function watch<T = any, Immediate extends Readonly<boolean> = false>(
  source: T | WatchSource<T>,
  cb: any,
  options?: WatchOptions<Immediate>
): WatchStopHandle {
  if (__DEV__ && typeof cb !== 'function') {
    warn(
      `\`watch(fn, options?)\` signature has been moved to a separate API. ` +
        `Use \`watchEffect(fn, options?)\` instead. \`watch\` now only ` +
        `supports \`watch(source, cb, options?) signature.`
    )
  }
  // 真正的创建watcher的逻辑
  return doWatch(source as any, cb, options)
}
//#endregion

function doWatch(
  source: WatchSource | WatchSource[] | WatchEffect | object,
  cb: WatchCallback | null,
  {
    immediate,
    deep,
    flush = 'pre',
    onTrack,
    onTrigger
  }: WatchOptions = emptyObject
): WatchStopHandle {
  // cb 未传入，但传了immediate、deep时将会报错
  if (__DEV__ && !cb) {
    if (immediate !== undefined) {
      warn(
        `watch() "immediate" option is only respected when using the ` +
          `watch(source, callback, options?) signature.`
      )
    }
    if (deep !== undefined) {
      warn(
        `watch() "deep" option is only respected when using the ` +
          `watch(source, callback, options?) signature.`
      )
    }
  }

  const warnInvalidSource = (s: unknown) => {
    warn(
      `Invalid watch source: ${s}. A watch source can only be a getter/effect ` +
        `function, a ref, a reactive object, or an array of these types.`
    )
  }

  const instance = currentInstance
  /**
   * 对函数调用进行一层包裹
   * @param fn 要调用的函数
   * @param type 调用的类型？
   * @param args 函数参数
   * @returns
   */
  const call = (fn: Function, type: string, args: any[] | null = null) =>
    invokeWithErrorHandling(fn, null, args, instance, type)

  let getter: () => any
  let forceTrigger = false
  let isMultiSource = false

  // 如果是ref则返回其中的value
  if (isRef(source)) {
    getter = () => source.value
    forceTrigger = isShallow(source)
  }
  // 如果经过reactive处理，就返回这个值
  else if (isReactive(source)) {
    getter = () => {
      ;(source as any).__ob__.dep.depend()
      return source
    }
    deep = true
  }
  // 如果是个数组，那就说明是有多个监听源
  else if (isArray(source)) {
    isMultiSource = true
    forceTrigger = source.some(s => isReactive(s) || isShallow(s))
    getter = () =>
      // 因此对这些监听源再各自处理一次
      source.map(s => {
        if (isRef(s)) {
          return s.value
        } else if (isReactive(s)) {
          return traverse(s)
        } else if (isFunction(s)) {
          return call(s, WATCHER_GETTER)
        } else {
          __DEV__ && warnInvalidSource(s)
        }
      })
  }
  // 如果是个函数
  else if (isFunction(source)) {
    if (cb) {
      // getter with cb
      getter = () => call(source, WATCHER_GETTER)
    } else {
      // no cb -> simple effect
      getter = () => {
        if (instance && instance._isDestroyed) {
          return
        }
        if (cleanup) {
          cleanup()
        }
        return call(source, WATCHER, [onCleanup])
      }
    }
  }
  // 其它神经的情况 - watch源无效
  else {
    getter = noop
    __DEV__ && warnInvalidSource(source)
  }

  // TODO: 如果deep为true的话，就遍历一下整个对象，重新设置getter？
  if (cb && deep) {
    const baseGetter = getter
    getter = () => traverse(baseGetter())
  }

  //#region 清理函数定义、设置
  let cleanup: () => void
  /**
   * 设置cleanup函数
   * @param fn
   */
  let onCleanup: OnCleanup = (fn: () => void) => {
    cleanup = watcher.onStop = () => {
      call(fn, WATCHER_CLEANUP) // TODO: 好像没有任何地方有传入fn这个参数？
    }
  }
  //#endregion

  // in SSR there is no need to setup an actual effect, and it should be noop
  // unless it's eager
  if (isServerRendering()) {
    // we will also not call the invalidate callback (+ runner is not set up)
    onCleanup = noop
    if (!cb) {
      getter()
    } else if (immediate) {
      call(cb, WATCHER_CB, [
        getter(),
        isMultiSource ? [] : undefined,
        onCleanup
      ])
    }
    return noop
  }

  // 拿到watcher - 与@vue/composition-api相比，这里是通过Vue内部Watcher类来获取的
  const watcher = new Watcher(currentInstance, getter, noop, {
    lazy: true
  })
  watcher.noRecurse = !cb

  let oldValue = isMultiSource ? [] : INITIAL_WATCHER_VALUE
  // overwrite default run
  // 覆盖调Watcher类中源先提供的run方法
  watcher.run = () => {
    if (!watcher.active) {
      return
    }
    if (cb) {
      // watch(source, cb)
      const newValue = watcher.get()
      if (
        deep ||
        forceTrigger ||
        (isMultiSource
          ? (newValue as any[]).some((v, i) =>
              hasChanged(v, (oldValue as any[])[i])
            )
          : hasChanged(newValue, oldValue))
      ) {
        // cleanup before running cb again
        // 在watch中传入的回调执行之前，进行一次清理
        if (cleanup) {
          cleanup()
        }
        // 调用我们传入的回调函数
        call(cb, WATCHER_CB, [
          newValue,
          // pass undefined as the old value when it's changed for the first time
          oldValue === INITIAL_WATCHER_VALUE ? undefined : oldValue,
          onCleanup
        ])
        oldValue = newValue
      }
    } else {
      // watchEffect
      watcher.get()
    }
  }

  // TODO: 似乎和调度相关？
  // 覆盖watcher中原有的update方法
  // 同步调用
  if (flush === 'sync') {
    watcher.update = watcher.run
  }
  // post调用
  else if (flush === 'post') {
    watcher.post = true
    watcher.update = () => queueWatcher(watcher)
  }
  // pre调用
  else {
    // pre
    watcher.update = () => {
      // 如果当前实例未挂载，就把pre watcher往_preWatchers数组里压
      // TODO: 在beforeMount后，mounted之前，会遍历_preWatchers，执行其中watcher.run，不进行排队（按照同步watcher执行）
      if (instance && instance === currentInstance && !instance._isMounted) {
        // pre-watcher triggered before
        const buffer = instance._preWatchers || (instance._preWatchers = [])
        // 只压一次，已存在就不压了
        if (buffer.indexOf(watcher) < 0) buffer.push(watcher)
      } else {
        // 否则正常排队
        queueWatcher(watcher)
      }
    }
  }

  if (__DEV__) {
    watcher.onTrack = onTrack
    watcher.onTrigger = onTrigger
  }

  // initial run
  // 初次运行
  // 如果传入了cb
  if (cb) {
    // 如果是立即执行
    if (immediate) {
      watcher.run()
    } else {
      // TODO: 否则，获取一下值？
      oldValue = watcher.get()
    }
  } else if (flush === 'post' && instance) {
    instance.$once('hook:mounted', () => watcher.get())
  } else {
    watcher.get()
  }

  return () => {
    watcher.teardown()
  }
}
