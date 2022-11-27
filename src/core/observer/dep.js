/*
 * @Author: gogoend
 * @Date: 2020-02-02 01:34:53
 * @LastEditors: gogoend
 * @LastEditTime: 2020-06-29 21:38:24
 * @FilePath: \vue\src\core\observer\dep.js
 * @Description:Dep类
 */

/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++
    this.subs = []
  }

  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }
/**
*每一个属性都会包含一个dep实例
*这个dep实例会记录下参与计算或渲染的watcher
*/
  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice()
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.
// 当前正在被计算的watcher。
// 同一时刻内只能存在一个watcher
// 仅在Watcher类下get方法中发生改变
Dep.target = null
const targetStack = []

export function pushTarget (_target: Watcher) {
  // 如果当前正在被计算的watcher存在，在计算另一个watcher前先把当前被计算的watcher压入到栈中
  if (Dep.target) targetStack.push(Dep.target)
  Dep.target = _target
}

export function popTarget () {
  // 计算完成后把之前被压入到栈中的watcher弹出来，恢复上一个watcher
  Dep.target = targetStack.pop()
}
