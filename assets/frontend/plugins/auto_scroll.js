import Alpine from 'alpinejs'

// 在线卷轴与本地阅读器共用按像素/秒计速的连续滚动。
Alpine.data('autoScroll', () => ({
    autoScrollEnabled: false,
    animationFrame: null,
    lastFrameTime: null,
    speed: Alpine.$persist(60).as((window.ComiGoReaderMode ? 'reader' : 'scroll') + '.autoScrollSpeed'),

    init() {
        this.$watch('$store.global.readMode', (mode) => {
            if (mode !== 'scroll') this.stopAutoScroll()
        })
    },

    startAutoScroll() {
        this.autoScrollEnabled = true
        this.lastFrameTime = null
        const scrollArea = document.body
        let position = scrollArea.scrollTop
        let lastScrollTop = position

        const step = (timestamp) => {
            const scrollTop = scrollArea.scrollTop
            const maxScrollTop = scrollArea.scrollHeight - scrollArea.clientHeight

            // 手动滚动后从当前位置继续，浮点目标避免低速时被逐帧取整吞掉。
            if (scrollTop !== lastScrollTop) position = scrollTop
            const elapsed = timestamp - (this.lastFrameTime ?? timestamp)
            this.lastFrameTime = timestamp
            position = Math.min(maxScrollTop, position + this.speed * elapsed / 1000)
            scrollArea.scrollTo({ top: position, behavior: 'instant' })
            lastScrollTop = scrollArea.scrollTop
            if (lastScrollTop >= maxScrollTop - 1) {
                this.stopAutoScroll()
                return
            }
            this.animationFrame = requestAnimationFrame(step)
        }
        this.animationFrame = requestAnimationFrame(step)
    },

    // 暂停、到达底部或销毁组件时取消动画。
    stopAutoScroll() {
        cancelAnimationFrame(this.animationFrame)
        this.autoScrollEnabled = false
    },

    destroy() {
        this.stopAutoScroll()
    },
}))
