import { DebuggerEvent } from './debug'
import { Component } from 'types/component'
import { mergeLifecycleHook, warn } from '../core/util'
import { currentInstance } from './currentInstance'

/**
 * 生命周期工厂函数？
 * @param hookName 生命周期的名称
 * @returns
 */
function createLifeCycle<T extends (...args: any[]) => any = () => void>(
  hookName: string
) {
  /**
   * 在setup函数执行期间，在调用生命周期钩子（如onMounted等）将会执行的函数 - 该函数用于合并生命周期钩子
   * @param callback 生命周期回调函数
   * @param target Vue3 对象
   * @returns
   */
  return (fn: T, target: any = currentInstance) => {
    if (!target) {
      __DEV__ &&
        warn(
          `${formatName(
            hookName
          )} is called when there is no active component instance to be ` +
            `associated with. ` +
            `Lifecycle injection APIs can only be used during execution of setup().`
        )
      return
    }
    return injectHook(target, hookName, fn)
  }
}

function formatName(name: string) {
  if (name === 'beforeDestroy') {
    name = 'beforeUnmount'
  } else if (name === 'destroyed') {
    name = 'unmounted'
  }
  return `on${name[0].toUpperCase() + name.slice(1)}`
}

/**
 * 合并生命周期钩子
 * @param instance 当前实例（Vue3）
 * @param hookName 生命周期钩子名称
 * @param fn 生命周期回调函数
 * @returns
 */
function injectHook(instance: Component, hookName: string, fn: () => void) {
  // 当前实例中的选项
  const options = instance.$options
  // 将经过合并的钩子重新赋值给到组件option
  // options[hook] 是个数组，组件生命周期的执行实际上是挨个执行其中的函数
  // 每调用一次对应的onHook（eg. onMounted）都会往对应数组里加一个函数
  options[hookName] = mergeLifecycleHook(options[hookName], fn)
}

export const onBeforeMount = createLifeCycle('beforeMount')
export const onMounted = createLifeCycle('mounted')
export const onBeforeUpdate = createLifeCycle('beforeUpdate')
export const onUpdated = createLifeCycle('updated')
export const onBeforeUnmount = createLifeCycle('beforeDestroy')
export const onUnmounted = createLifeCycle('destroyed')
export const onActivated = createLifeCycle('activated')
export const onDeactivated = createLifeCycle('deactivated')
export const onServerPrefetch = createLifeCycle('serverPrefetch')

export const onRenderTracked =
  createLifeCycle<(e: DebuggerEvent) => any>('renderTracked')
export const onRenderTriggered =
  createLifeCycle<(e: DebuggerEvent) => any>('renderTriggered')

export type ErrorCapturedHook<TError = unknown> = (
  err: TError,
  instance: any,
  info: string
) => boolean | void

const injectErrorCapturedHook =
  createLifeCycle<ErrorCapturedHook<any>>('errorCaptured')

export function onErrorCaptured<TError = Error>(
  hook: ErrorCapturedHook<TError>,
  target: any = currentInstance
) {
  injectErrorCapturedHook(hook, target)
}
