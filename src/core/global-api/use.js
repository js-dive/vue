/* @flow */

import { toArray } from '../util/index'

export function initUse (Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | Object) {
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    // 执行Vue.use时传入的额外（第一个之外的）参数作为args
    const args = toArray(arguments, 1)
    args.unshift(this) // 此处this为Vue类
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      plugin.apply(null, args)
    }
    // 记录一下插件已安装完成的插件
    installedPlugins.push(plugin)
    return this
  }
}
