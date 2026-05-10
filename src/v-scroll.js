import V_SCROLL_CSS from './v-scroll.css?inline';
import './v-scroll-drag.css';

const V_SCROLL_TEMPLATE = document.getElementById('v-scroll-template');
/** 与 handleDragMove 中一致：滑块在轨道内上下留白，避免贴边 */
const TRACK_EDGE_PADDING = 3;

class VScroll extends HTMLElement {
    /* ========== 静态资源 ========== */
    static #STYLE_SHEET = null;

    static loadStyles() {
        if (VScroll.#STYLE_SHEET) return VScroll.#STYLE_SHEET;
        const ADOPTED_SHEET = new CSSStyleSheet();
        ADOPTED_SHEET.replaceSync(V_SCROLL_CSS);
        VScroll.#STYLE_SHEET = ADOPTED_SHEET;
        return ADOPTED_SHEET;
    }

    /* ========== 生命周期 ========== */
    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        this.shadowRoot.appendChild(V_SCROLL_TEMPLATE.content.cloneNode(true));

        /* DOM 引用 */
        this._viewport = this.shadowRoot.querySelector('.viewport');
        this._track = this.shadowRoot.querySelector('.track');
        this._thumb = this.shadowRoot.querySelector('.thumb');

        /* 拖拽状态 */
        this._dragging = false;
        this._dragStartY = 0;
        this._startScrollTop = 0;

        /* 观察者 */
        this._resizeObserver = new ResizeObserver(() => this.updateLayout());
        this._mutationObserver = new MutationObserver(() => this.updateLayout());

        /* 绑定方法 */
        this._handleScroll = this.handleScroll.bind(this);
        this._handleDragStart = this.handleDragStart.bind(this);
        this._handleDragMove = this.handleDragMove.bind(this);
        this._handleDragEnd = this.handleDragEnd.bind(this);
    }

    connectedCallback() {
        /* 注入样式（仅首次） */
        const ADOPTED_SHEET = VScroll.loadStyles();
        if (!this.shadowRoot.adoptedStyleSheets.includes(ADOPTED_SHEET)) {
            this.shadowRoot.adoptedStyleSheets = [ADOPTED_SHEET];
        }

        /* 绑定事件 */
        this._viewport.addEventListener('scroll', this._handleScroll, {passive: true});
        this._thumb.addEventListener('pointerdown', this._handleDragStart);

        /* 启动观察 */
        this._resizeObserver.observe(this._viewport);
        this._mutationObserver.observe(this._viewport, {
            childList: true,
            subtree: true,
            characterData: true,
        });

        /* 初始化尺寸 */
        requestAnimationFrame(() => this.updateLayout());
    }

    disconnectedCallback() {
        /* 彻底销毁 */
        this._viewport.removeEventListener('scroll', this._handleScroll);
        this._thumb.removeEventListener('pointerdown', this._handleDragStart);
        this._resizeObserver.disconnect();
        this._mutationObserver.disconnect();

        /* 清理拖拽残留 */
        if (this._dragging) {
            document.removeEventListener('pointermove', this._handleDragMove);
            document.removeEventListener('pointerup', this._handleDragEnd);
            document.removeEventListener('pointercancel', this._handleDragEnd);
            this.classList.remove('dragging');
            this._dragging = false;
        }
    }

    /* ========== 尺寸更新 ========== */
    updateLayout() {
        const {scrollHeight, clientHeight} = this._viewport;
        const hasScroll = scrollHeight > clientHeight;

        if (!hasScroll) {
            this._track.classList.remove('visible');
            return;
        }

        this._track.classList.add('visible');

        const trackHeight = this._track.clientHeight;
        const minThumb = parseInt(getComputedStyle(this).getPropertyValue('--thumb-min-size')) || 16;
        const thumbHeight = Math.max(
            (clientHeight / scrollHeight) * trackHeight,
            minThumb
        );

        this._thumb.style.height = `${thumbHeight}px`;
        this.syncThumbPosition();
    }

    handleScroll() {
        this.syncThumbPosition();
    }

    syncThumbPosition() {
        const {scrollTop, scrollHeight, clientHeight} = this._viewport;
        const trackHeight = this._track.clientHeight;
        const thumbHeight = this._thumb.clientHeight;
        const maxScrollTop = scrollHeight - clientHeight;
        const usableThumbTravel = Math.max(
            0,
            trackHeight - thumbHeight - TRACK_EDGE_PADDING * 2
        );

        if (maxScrollTop <= 0) {
            this._thumb.style.top = `${TRACK_EDGE_PADDING}px`;
            return;
        }

        const ratio = scrollTop / maxScrollTop;
        this._thumb.style.top = `${TRACK_EDGE_PADDING + ratio * usableThumbTravel}px`;
    }

    /* ========== 指针拖拽 ========== */
    handleDragStart(e) {
        e.preventDefault();
        e.stopPropagation();

        this._thumb.setPointerCapture(e.pointerId);
        this._dragging = true;
        this._dragStartY = e.clientY;
        this._startScrollTop = this._viewport.scrollTop;
        this.classList.add('dragging');

        document.addEventListener('pointermove', this._handleDragMove);
        document.addEventListener('pointerup', this._handleDragEnd);
        document.addEventListener('pointercancel', this._handleDragEnd);
    }

    handleDragMove(e) {
        if (!this._dragging) return;

        const deltaY = e.clientY - this._dragStartY;
        const trackHeight = this._track.clientHeight;
        const thumbHeight = this._thumb.clientHeight;
        const maxScrollTop = this._viewport.scrollHeight - this._viewport.clientHeight;

        const usableTrack = trackHeight - thumbHeight - TRACK_EDGE_PADDING * 2;

        if (usableTrack <= 0) return;

        const ratio = deltaY / usableTrack;
        const newScrollTop = this._startScrollTop + ratio * maxScrollTop;

        this._viewport.scrollTop = Math.max(0, Math.min(newScrollTop, maxScrollTop));
        this.syncThumbPosition();
    }

    handleDragEnd(e) {
        if (!this._dragging) return;

        this._dragging = false;
        this.classList.remove('dragging');

        document.removeEventListener('pointermove', this._handleDragMove);
        document.removeEventListener('pointerup', this._handleDragEnd);
        document.removeEventListener('pointercancel', this._handleDragEnd);

        const POINTER_ID = e?.pointerId;
        if (POINTER_ID != null) {
            try {
                this._thumb.releasePointerCapture(POINTER_ID);
            } catch {
                /* 已释放 */
            }
        }
    }
}

/* 注册自定义元素 */
if (!customElements.get('v-scroll')) {
    customElements.define('v-scroll', VScroll);
}

export default VScroll;
