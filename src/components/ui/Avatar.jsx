import React from "react";

const cx = (...classes) => classes.filter(Boolean).join(" ");

const Avatar = ({
    src,
    fallback,
    icon: Icon,
    size = "md",
    className,
    imageClassName,
    ...props
}) => {
    const sizeClasses = {
        sm: "w-8 h-8 text-xs",
        md: "w-10 h-10 text-sm",
        lg: "w-12 h-12 text-base",
        xl: "w-16 h-16 text-2xl",
    };

    const baseClasses =
        "relative inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden bg-bg-200 text-text-primary font-medium transition-colors";

    return (
        <div
            className={cx(baseClasses, sizeClasses[size], className)}
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
