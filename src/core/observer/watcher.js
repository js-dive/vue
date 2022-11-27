/*
 * @Author: gogoend
 * @Date: 2020-02-02 01:34:53
 * @LastEditors: gogoend
 * @LastEditTime: 2020-07-01 00:24:36
 * @FilePath: \vue\src\core\observer\watcher.js
 * @Description:Watcher类
 */

/* @flow */

import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError
} from '../util/index'

import type { ISet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
  vm: Component;
  expression: string; // 关联表达式或渲染方法体
  cb: Function; // 在定义Vue 构造函数的时候，传入的watch函数体（值发生变化时的回调函数，function(nVal,oVal){}）
  id: number;
  deep: boolean;// watcher来源，是由Vue内部自己生成的（渲染Watcher、computed选项）还是由用户自己定义的（watch选项）
  user: boolean;
  lazy: boolean;// 计算属性，和watch 来控制不要让Watcher 立即执行
  sync: boolean;// 是否同步执行 - SSR时为true
  dirty: boolean;
  active: boolean;

  // 在Vue中使用了二次提交的概念
  // 每次在数据渲染或计算的时候就会访问响应式的数据，就会进行依赖收集
  // 就将关联的Watcher 与dep相关联,
  // 在数据发生变化的时候，根据dep找到关联的watcher, 依次调用update
  // 执行完成后会清空watcher

  deps: Array<Dep>;
  depIds: ISet;

  newDeps: Array<Dep>;
  newDepIds: ISet;

  // 旧版本（2.5.0）里没有
  // before: ?Function; // Watcher触发之前的，类似于生命周期

  getter: Function; // 就是渲染函数(模板或组件的渲染)或计算函数(watch) // 计算函数，watch中的对象路径'a,b,c'写法
  value: any;// 如果是渲染函数，value 无效;如果是计算属性，就会有一个值，值就存储在value 中

  constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: Object
  ) {
    this.vm = vm
    vm._watchers.push(this)
    // options
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.lazy // for lazy watchers
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    if (typeof expOrFn === 'function') { // watch前面那个key，如果找到了是函数，就是render 函数
      this.getter = expOrFn
    } else {
      this.getter = parsePath(expOrFn) // 找不到的话需要去解析路径看一看
      if (!this.getter) {
        this.getter = function () { }
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    // 如果是lazy就什么也不做，否则就立即调用getter 函数求值( expOrFn )
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   * 计算getter，重新收集依赖
   */
  get () {
    // 执行前把watcher放到全局作用域 - 赋值给Dep类的静态属性target
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      value = this.getter.call(vm, vm)
      debugger
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) {
        traverse(value)
      }
    // 执行后把watcher从全局作用域移除 - Dep类的静态属性target换为先前的watcher或undefined
      popTarget()
      // "清空"关联的dep数据 - 清理旧的无关的依赖
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  addDep (dep: Dep) {
    const id = dep.id
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep) // 让watcher关联到dep
      if (!this.depIds.has(id)) {
        dep.addSub(this) // 让dep关联到watcher
      }
    }
  }

  /**
   * Clean up for dependency collection.
   * 清理依赖集合
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      // 在二次提交中归档就是让旧的deps 和新的 newDeps-致
      // 如果新的dep集合不存在当前dep，则从dep中移除当前watcher（自己）
      // 也就是当重新收集依赖时，若不再依赖当前watcher，应该删掉
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    // 交换新旧depId集合
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps // 同步处理
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  update () {
    // 本质就是调用run方法
    /* istanbul ignore else */
    if (this.lazy) {
      // 主要针对计算属性，一 般用于求值计算
      // state createComputedGetter 中有调用
      this.dirty = true
    } else if (this.sync) {
      // 同步，主要用于SSR，同步就表示立即计算
      this.run()
    } else {
      // 将当前watcher插入到异步队列
      // 一般浏览器中的异步运行，本质上就是异步执行run //类比: setTimeout( () => this.run(),
      // 转到相关定义，可发现是在 -- 循环调用run方法
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   * 调用get求值或渲染，如果求值，新旧值不同，触发cb
   */
  run () {
    if (this.active) {
      const value = this.get() // 要么渲染，要么求值
      // 如果值不一样，触发cb
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        if (this.user) {
          try {
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   * 计算值，计算完成后dirty设为true
   */
  evaluate () {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   * 从所有的依赖管理器中把自己移除
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
const seenObjects = new Set()
function traverse (val: any) {
  seenObjects.clear()
  _traverse(val, seenObjects)
}

function _traverse (val: any, seen: ISet) {
  let i, keys
  const isA = Array.isArray(val)
  if ((!isA && !isObject(val)) || !Object.isExtensible(val)) {
    return
  }
  if (val.__ob__) {
    const depId = val.__ob__.dep.id
    if (seen.has(depId)) {
      return
    }
    seen.add(depId)
  }
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  } else {
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
