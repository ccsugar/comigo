// 阅读交互几何判断工具 IIFE。
// 只集中“区域命中”这类纯判断；点击响应和鼠标图标仍由各阅读模式自己决定。
(function (global) {
    'use strict'

    function isPointInRect(rect, x, y) {
        if (!rect) return false
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    }

    const api = {
        isPointInRect,
    }

    global.ComiGoInteraction = api
    global.ComiGoFlip = global.ComiGoFlip || {}
    global.ComiGoFlip.interaction = api
    // 如果是 CommonJS 模块系统，则导出 api
    // 让 Node/Bun 测试环境也能 require() 这个模块，方便测试。
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api
    }
})(typeof window !== 'undefined' ? window : globalThis)
