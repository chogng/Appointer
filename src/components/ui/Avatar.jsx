import React from "react";
import { normalizeCtaName, normalizeCtaToken } from "../../utils/cta";

const cx = (...classes) => classes.filter(Boolean).join(" ");

const Avatar = ({
    src,
    fallback,
    icon: Icon,
    size = "md",
    groupHover = false,
    className,
    imageClassName,
    cta,
    ctaPosition,
    ctaCopy,
    ...props
}) => {
    const mode = src ? "image" : Icon ? "icon" : "fallback";

    const sizeClasses = {
        sm: "avatar_warp--sm",
        md: "avatar_warp--md",
        lg: "avatar_warp--lg",
        xl: "avatar_warp--xl",
    };

    const baseClasses = "avatar_warp";

    return (
        <div
            className={cx(
                baseClasses,
                sizeClasses[size],
                groupHover && "avatar_warp--group_hover_accent",
                className,
            )}
            data-mode={mode}
            data-cta={normalizeCtaName(cta)}
            data-cta-position={normalizeCtaToken(ctaPosition)}
            data-cta-copy={normalizeCtaToken(ctaCopy)}
            {...props}
        >
            {src ? (
                <img
                    src={src}
                    alt={fallback || "Avatar"}
                    className={cx("w-full h-full object-cover", imageClassName)}
                />
            ) : Icon ? (
                <Icon className={cx("w-[60%] h-[60%]")} />
            ) : (
                <span>{fallback?.slice(0, 1).toUpperCase()}</span>
            )}
        </div>
    );
};

export default Avatar;
