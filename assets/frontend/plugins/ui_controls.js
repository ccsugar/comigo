// 此文件实现顶部栏及模板使用的 drawer、modal 和 dropdown 交互。
// 调用点集中在 templ/common/header.templ、drawer.templ 与 qrcode.templ。

// 固定状态改变后统一通知阅读器重排。
function setPinnedLayout(name, pinned) {
    if (document.body.classList.contains(name) === pinned) return
    document.body.classList.toggle(name, pinned)
    window.dispatchEvent(new Event('resize'))
}

// 页面共用一个右侧设置抽屉；固定时占据独立右栏，正文仍可滚动。
function initDrawer() {
    const drawer = document.getElementById('drawer-right')
    if (!drawer) return
    const settings = Alpine.store('global')
    let visible = false
    const backdrop = document.createElement('div')
    backdrop.setAttribute('drawer-backdrop', '')
    backdrop.addEventListener('click', () => setVisible(false))

    // 显隐和固定共用一次更新，仅在左右栏宽度改变时通知阅读器。
    function update() {
        const modal = visible && !settings.drawerPinned
        drawer.classList.toggle('translate-x-full', !visible)
        drawer.setAttribute('aria-hidden', String(!visible))
        drawer.setAttribute('aria-modal', String(modal))
        if (modal) {
            document.body.append(backdrop)
        } else {
            backdrop.remove()
        }
        setPinnedLayout('drawer-pinned', visible && settings.drawerPinned)
    }

    function setVisible(open) {
        visible = open
        update()
        // 二维码只在打开抽屉时按需刷新。
        if (open) {
            drawer.dispatchEvent(new CustomEvent('comigo-drawer-shown', { bubbles: true }))
        }
    }

    document.querySelector('[data-drawer-show]').addEventListener('click', () => setVisible(true))
    drawer.querySelector('[data-drawer-hide]').addEventListener('click', () => setVisible(false))
    drawer.querySelector('[data-pin]').addEventListener('click', () => {
        settings.drawerPinned = !settings.drawerPinned
        visible = settings.drawerPinned
        update()
    })
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && visible && !settings.drawerPinned) setVisible(false)
    })
    if (settings.drawerPinned) setVisible(true)
}

// 条漫上栏悬浮呼出，固定时让出一行；齿轮独立于上栏显隐。
function initReaderToolbar() {
    if (!document.getElementById('ScrollMainArea')) return
    const body = document.body
    const header = document.getElementById('header')
    const settings = Alpine.store('global')
    body.append(document.getElementById('OpenSettingButton'))
    header.querySelector('[data-pin]').addEventListener('click', () => {
        settings.toolbarPinned = !settings.toolbarPinned
    })

    Alpine.effect(() => {
        const enabled = settings.readMode === 'scroll'
        body.classList.toggle('scroll-toolbar', enabled)
        setPinnedLayout('toolbar-pinned', enabled && settings.toolbarPinned)
    })
    new ResizeObserver(() => {
        document.documentElement.style.setProperty('--reader-scrollbar-width', `${body.offsetWidth - body.clientWidth}px`)
    }).observe(body)

    function reveal(event) {
        if (settings.readMode !== 'scroll') return
        const height = body.classList.contains('toolbar-shown') ? header.offsetHeight : 12
        body.classList.toggle('toolbar-shown', header.contains(event.target) ||
            (event.clientX < body.clientWidth && event.clientY <= height))
    }

    document.addEventListener('pointermove', reveal)
    document.addEventListener('pointerdown', reveal)
}

// modal 本身是 flex 容器，placement 决定内容在视口中的对齐位置。
function getModalPlacementClasses(placement) {
    switch (placement) {
        case 'top-left':
            return ['justify-start', 'items-start']
        case 'top-center':
            return ['justify-center', 'items-start']
        case 'top-right':
            return ['justify-end', 'items-start']
        case 'center-left':
            return ['justify-start', 'items-center']
        case 'center-right':
            return ['justify-end', 'items-center']
        case 'bottom-left':
            return ['justify-start', 'items-end']
        case 'bottom-center':
            return ['justify-center', 'items-end']
        case 'bottom-right':
            return ['justify-end', 'items-end']
        case 'center':
        default:
            return ['justify-center', 'items-center']
    }
}

// 控制单个模态框；dynamic 遮罩允许点击空白处关闭，所有模态框都支持 ESC。
function createModalController(modal, options) {
    let visible = false
    let backdrop = null

    modal.classList.add(...getModalPlacementClasses(options.placement))

    function removeBackdrop() {
        backdrop?.remove()
        backdrop = null
    }

    function createBackdrop() {
        if (backdrop) return
        backdrop = document.createElement('div')
        backdrop.className = 'bg-dark-backdrop/70 fixed inset-0 z-40'
        document.body.append(backdrop)
    }

    function handleOutsideClick(event) {
        if (
            options.backdrop === 'dynamic' &&
            (event.target === modal || event.target === backdrop)
        ) {
            hide()
        }
    }

    function handleKeydown(event) {
        if (event.key === 'Escape') {
            hide()
        }
    }

    // Modal 保留原先的 dynamic backdrop 与 ESC 关闭能力，便携 reader 页也会复用该路径。
    function show() {
        if (visible) return
        modal.classList.remove('hidden')
        modal.classList.add('flex')
        modal.setAttribute('aria-modal', 'true')
        modal.setAttribute('role', 'dialog')
        modal.removeAttribute('aria-hidden')
        createBackdrop()
        document.body.classList.add('overflow-hidden')
        modal.addEventListener('click', handleOutsideClick, true)
        document.body.addEventListener('keydown', handleKeydown, true)
        visible = true
        // 模态框真正显示后再刷新其按需内容，关闭动作不会触发后台请求。
        modal.dispatchEvent(
            new CustomEvent('comigo-modal-shown', { bubbles: true }),
        )
    }

    function hide() {
        if (!visible && modal.classList.contains('hidden')) return
        modal.classList.add('hidden')
        modal.classList.remove('flex')
        modal.setAttribute('aria-hidden', 'true')
        modal.removeAttribute('aria-modal')
        modal.removeAttribute('role')
        removeBackdrop()
        document.body.classList.remove('overflow-hidden')
        modal.removeEventListener('click', handleOutsideClick, true)
        document.body.removeEventListener('keydown', handleKeydown, true)
        visible = false
    }

    function toggle() {
        if (visible) {
            hide()
        } else {
            show()
        }
    }

    return {
        hide,
        show,
        toggle,
        isVisible: () => visible,
    }
}

// data-modal-target 负责注册模态框，toggle/show/hide 只调用已注册的控制器。
function initModals() {
    const modals = new Map()

    document.querySelectorAll('[data-modal-target]').forEach((trigger) => {
        const modalId = trigger.getAttribute('data-modal-target')
        const modal = document.getElementById(modalId)
        if (!modal || modals.has(modalId)) return

        modals.set(
            modalId,
            createModalController(modal, {
                backdrop:
                    modal.getAttribute('data-modal-backdrop') || 'dynamic',
                placement:
                    modal.getAttribute('data-modal-placement') || 'center',
            }),
        )
    })

    document.querySelectorAll('[data-modal-toggle]').forEach((trigger) => {
        trigger.addEventListener('click', () => {
            modals.get(trigger.getAttribute('data-modal-toggle'))?.toggle()
        })
    })

    document.querySelectorAll('[data-modal-show]').forEach((trigger) => {
        trigger.addEventListener('click', () => {
            modals.get(trigger.getAttribute('data-modal-show'))?.show()
        })
    })

    document.querySelectorAll('[data-modal-hide]').forEach((trigger) => {
        trigger.addEventListener('click', () => {
            modals.get(trigger.getAttribute('data-modal-hide'))?.hide()
        })
    })
}

// 当前排序菜单固定显示在触发器下方并水平居中，同时限制在视口宽度内。
function positionDropdown(trigger, menu, offsetDistance) {
    menu.style.position = 'absolute'
    menu.style.inset = '0px auto auto 0px'
    menu.style.margin = '0px'
    const triggerRect = trigger.getBoundingClientRect()
    const menuRect = menu.getBoundingClientRect()
    const parent = menu.offsetParent
    const parentRect = parent.getBoundingClientRect()
    const viewportWidth = document.body.clientWidth
    const centeredLeft =
        triggerRect.left + triggerRect.width / 2 - menuRect.width / 2
    const maxLeft = Math.max(0, viewportWidth - menuRect.width)
    const left = Math.max(0, Math.min(centeredLeft, maxLeft)) - parentRect.left + parent.scrollLeft
    const top = triggerRect.bottom - parentRect.top + parent.scrollTop + offsetDistance

    menu.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`
    menu.setAttribute('data-popper-placement', 'bottom')
}

// 排序菜单支持模板声明的 hover 或 click 触发，并在点击菜单外部时关闭。
function createDropdownController(trigger, menu, options) {
    let visible = false
    let hideTimer = null

    function clearHideTimer() {
        if (!hideTimer) return
        window.clearTimeout(hideTimer)
        hideTimer = null
    }

    function show() {
        clearHideTimer()
        menu.classList.remove('hidden')
        menu.classList.add('block')
        menu.removeAttribute('aria-hidden')
        positionDropdown(trigger, menu, options.offsetDistance)
        visible = true
        document.body.addEventListener('click', handleOutsideClick, true)
    }

    function hide() {
        clearHideTimer()
        menu.classList.remove('block')
        menu.classList.add('hidden')
        menu.setAttribute('aria-hidden', 'true')
        visible = false
        document.body.removeEventListener('click', handleOutsideClick, true)
    }

    function toggle() {
        if (visible) {
            hide()
        } else {
            show()
        }
    }

    function handleOutsideClick(event) {
        if (trigger.contains(event.target) || menu.contains(event.target))
            return
        hide()
    }

    function scheduleHide() {
        clearHideTimer()
        hideTimer = window.setTimeout(() => {
            if (!menu.matches(':hover') && !trigger.matches(':hover')) {
                hide()
            }
        }, options.delay)
    }

    if (options.triggerType === 'hover') {
        trigger.addEventListener('mouseenter', () => {
            window.setTimeout(show, options.delay)
        })
        trigger.addEventListener('click', toggle)
        trigger.addEventListener('mouseleave', scheduleHide)
        menu.addEventListener('mouseenter', show)
        menu.addEventListener('mouseleave', scheduleHide)
    } else if (options.triggerType === 'click') {
        trigger.addEventListener('click', toggle)
    }
}

// 读取 header.templ 中的 data-dropdown-* 参数并初始化排序菜单。
function initDropdowns() {
    document.querySelectorAll('[data-dropdown-toggle]').forEach((trigger) => {
        const dropdownId = trigger.getAttribute('data-dropdown-toggle')
        const menu = document.getElementById(dropdownId)
        if (!menu) return

        createDropdownController(trigger, menu, {
            delay: Number.parseInt(
                trigger.getAttribute('data-dropdown-delay') || '300',
                10,
            ),
            offsetDistance: Number.parseInt(
                trigger.getAttribute('data-dropdown-offset-distance') || '10',
                10,
            ),
            triggerType:
                trigger.getAttribute('data-dropdown-trigger') || 'click',
        })
    })
}

// 主入口只初始化当前模板实际使用的控件。
export function initComigoUIControls() {
    initDrawer()
    initReaderToolbar()
    initModals()
    initDropdowns()
}

// 主包脚本可能先于页面节点执行，等待 DOM 就绪后再扫描 data-* 属性。
document.addEventListener('DOMContentLoaded', initComigoUIControls)
