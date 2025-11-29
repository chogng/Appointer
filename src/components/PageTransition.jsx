import { useEffect, useState, useRef, useLayoutEffect } from 'react';

/**
 * 页面过渡动画组件
 * loading 时隐藏内容，加载完成后从上到下缓慢浮现
 * 
 * @param {boolean} loading - 是否正在加载
 * @param {React.ReactNode} children - 页面内容
 * @param {string} className - 额外的样式类
 */
const PageTransition = ({ loading, children, className = '' }) => {
    const [shouldRender, setShouldRender] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!loading) {
            setShouldRender(true);
        } else {
            setShouldRender(false);
        }
    }, [loading]);

    useLayoutEffect(() => {
        if (!shouldRender || !containerRef.current) return;

        const container = containerRef.current;

        // 1. Prepare (Hide elements immediately before paint)
        // Header Animation (First child)
        const header = container.firstElementChild;
        if (header) {
            header.style.opacity = '0';
            header.style.animation = 'none';
        }

        // Main Content Animation (Rest of children)
        const contentNodes = Array.from(container.children).slice(1);
        const elementsToAnimate = [];

        contentNodes.forEach(node => {
            // Find all significant text/content elements
            const textElements = node.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, li, td, button, input, label, a, .card-content');

            if (textElements.length > 0) {
                textElements.forEach(el => {
                    // Skip if element is hidden
                    if (el.offsetParent === null) return;

                    el.style.opacity = '0';
                    el.style.animation = 'none';
                    elementsToAnimate.push(el);
                });
            } else {
                // Fallback for non-text containers
                node.style.opacity = '0';
                node.style.animation = 'none';
                elementsToAnimate.push(node);
            }
        });

        // 2. Trigger Animations (Next frame)
        requestAnimationFrame(() => {
            if (header) {
                header.style.animation = 'slideDownFadeIn 0.8s ease-out forwards';
            }

            let delay = 0.3; // Start after header animation begins

            elementsToAnimate.forEach(el => {
                el.style.animation = `fadeIn 0.6s ease-out forwards ${delay}s`;
                delay += 0.02; // Fast stagger
            });
        });

    }, [shouldRender]);

    if (loading || !shouldRender) {
        return <div className="min-h-[200px]" />;
    }

    return (
        <div
            ref={containerRef}
            className={`${className}`}
        >
            {children}
        </div>
    );
};

export default PageTransition;
