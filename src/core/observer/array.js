/*
 * @Author: gogoend
 * @Date: 2020-02-02 01:34:53
 * @LastEditors: gogoend
 * @LastEditTime: 2020-06-29 21:35:11
 * @FilePath: \vue\src\core\observer\array.js
 * @Description:重写数组方法，创建含有重写数组方法的数组，让所有的响应式数据数组继承自该数组
 */
/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

// arrayMethods就是继承自Array. prototype的数组
// 只需要让响应式数组继承自arrayMethods

/**
 * Intercept mutating methods and emit events
 */
;[
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]
.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]
  def(arrayMethods, method, function mutator (...args) {
    const result = original.apply(this, args)
    const ob = this.__ob__
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    if (inserted) ob.observeArray(inserted)
    // notify change
    ob.dep.notify()
    return result
  })
})
