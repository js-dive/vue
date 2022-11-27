/*
 * @Author: gogoend
 * @Date: 2020-02-02 01:34:54
 * @LastEditors: gogoend
 * @LastEditTime: 2020-06-28 16:25:07
 * @FilePath: \vue\src\platforms\web\runtime\index.js
 * @Description:
 * 1.配置__patch__
 * 2.定义原始$mount方法
 */
/* @flow */

import Vue from 'core/index'
import config from 'core/config'
import { extend, noop } from 'shared/util'
import { mountComponent } from 'core/instance/lifecycle'
import { devtools, inBrowser, isChrome } from 'core/util/index'

import {
  query,
  mustUseProp,
  isReservedTag,
  isReservedAttr,
  getTagNamespace,
  isUnknownElement
} from 'web/util/index'

import { patch } from './patch'
import platformDirectives from './directives/index'
import platformComponents from './components/index'

// install platform specific utils
Vue.config.mustUseProp = mustUseProp
Vue.config.isReservedTag = isReservedTag
Vue.config.isReservedAttr = isReservedAttr
Vue.config.getTagNamespace = getTagNamespace
Vue.config.isUnknownElement = isUnknownElement

// install platform runtime directives & components
extend(Vue.options.directives, platformDirectives)
extend(Vue.options.components, platformComponents)

// install platform patch function
// 使用虚拟DOM更新真正的DOM的核心算法
Vue.prototype.__patch__ = inBrowser ? patch : noop // 仅在浏览器端有操作，其他环境下 noop 无操作

// public mount method
// 原始的$mount方法，调用挂载的组件的方法
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && inBrowser ? query(el) : undefined
  return mountComponent(this, el, hydrating)
}

// devtools global hook
/* istanbul ignore next */
Vue.nextTick(() => {
  if (config.devtools) {
    if (devtools) {
      devtools.emit('init', Vue)
    } else if (process.env.NODE_ENV !== 'production' && isChrome) {
      console[console.info ? 'info' : 'log'](
        'Download the Vue Devtools extension for a better development experience:\n' +
        'https://github.com/vuejs/vue-devtools'
      )
    }
  }
  if (process.env.NODE_ENV !== 'production' &&
    config.productionTip !== false &&
    inBrowser && typeof console !== 'undefined'
  ) {
    console[console.info ? 'info' : 'log'](
      `You are running Vue in development mode.\n` +
      `Make sure to turn on production mode when deploying for production.\n` +
      `See more tips at https://vuejs.org/guide/deployment.html`
    )
  }
}, 0)

export default Vue
