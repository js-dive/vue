/*
 * @Author: gogoend
 * @Date: 2020-02-02 01:34:53
 * @LastEditors: gogoend
 * @LastEditTime: 2020-06-28 16:45:11
 * @FilePath: \vue\src\core\instance\index.js
 * @Description:
 */
import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

/**
 * Vue 构造函数
 * @param {*} options
 *
 */
function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    // 函数有五种调用模式！！
    // 判断是否是用new调用的
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}
console.log(Vue)
initMixin(Vue) // 挂载初始化方法
stateMixin(Vue)// 挂载状态处理方法
eventsMixin(Vue)// 挂载事件的方法
lifecycleMixin(Vue)// 挂载生命周期
renderMixin(Vue)// 挂载渲染

export default Vue
