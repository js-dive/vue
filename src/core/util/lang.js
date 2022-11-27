/*
 * @Author: gogoend
 * @Date: 2020-02-02 01:34:53
 * @LastEditors: gogoend
 * @LastEditTime: 2020-06-30 00:04:26
 * @FilePath: \vue\src\core\util\lang.js
 * @Description:
 */
/* @flow */

export const emptyObject = Object.freeze({})

/**
 * Check if a string starts with $ or _
 */
export function isReserved (str: string): boolean {
  const c = (str + '').charCodeAt(0)
  return c === 0x24 || c === 0x5F
}

/**
 * Define a property.
 * 使用参数，将可枚举性变为可控的；递归，使用循环，获得key时，不可枚举属性是访问不到的
 * 在vue中实例存在大量的循环引用，递归遍历对象成员的时候，避免死递归
 */
export function def (obj: Object, key: string, val: any, enumerable?: boolean) {
  Object.defineProperty(obj, key, {
    value: val,
    enumerable: !!enumerable,
    writable: true,
    configurable: true
  })
}

/**
 * Parse simple path.
 */
const bailRE = /[^\w.$]/  // 用于匹配xx.xx.xx.x
export function parsePath (path: string): any {
  if (bailRE.test(path)) {
    return
  }
  const segments = path.split('.')
  return function (obj) {
    for (let i = 0; i < segments.length; i++) {
      if (!obj) return
      obj = obj[segments[i]]
    }
    return obj
  }
}
