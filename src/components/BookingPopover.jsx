import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Clock,
  MapPin,
  AlignLeft,
  Calendar as CalendarIcon,
  User,
  Check,
  ChevronDown,
  Trash,
} from "lucide-react";
import Button from "./ui/Button";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

const COLORS = [
  {
    name: "default",
    bg: "bg-bg-100 border border-border-200",
    ring: "ring-gray-400",
  },
  { name: "blue", bg: "bg-blue-500", ring: "ring-blue-500" },
  { name: "red", bg: "bg-red-500", ring: "ring-red-500" },
  { name: "green", bg: "bg-green-500", ring: "ring-green-500" },
  { name: "yellow", bg: "bg-yellow-500", ring: "ring-yellow-500" },
  { name: "purple", bg: "bg-purple-500", ring: "ring-purple-500" },
  { name: "pink", bg: "bg-pink-500", ring: "ring-pink-500" },
  { name: "gray", bg: "bg-gray-500", ring: "ring-gray-500" },
];

const BookingPopoverInner = ({
  onClose,
  onSave,
  onColorChange,
  onDelete,
  initialData,
  position,
  placement,
  isSaving = false,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState(() => {
    const savedColor = localStorage.getItem("lastSelectedColor");
    return initialData?.color || savedColor || "default";
  });
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const popoverRef = useRef(null);
  const colorPickerRef = useRef(null);
  const onColorChangeRef = useRef(onColorChange);

  useEffect(() => {
    onColorChangeRef.current = onColorChange;
  }, [onColorChange]);

  useEffect(() => {
    const savedColor = localStorage.getItem("lastSelectedColor");
    if (!initialData?.color && savedColor) {
      onColorChangeRef.current?.(savedColor);
    }
  }, [initialData?.color]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        // Check if the click is inside the color picker before closing
        // Actually, if color picker is open, we might want to close just the picker?
        // But the requirement is to close popover on outside click.
        // If color picker is open, it is inside the popover (visually), but maybe rendered in portal?
        // Here we render it inline, so it is inside popoverRef.
        onClose();
      }
    };

    const handleColorPickerClickOutside = (event) => {
      if (
        isColorPickerOpen &&
        colorPickerRef.current &&
        !colorPickerRef.current.contains(event.target)
      ) {
        setIsColorPickerOpen(false);
      }
    };

    // Use setTimeout to avoid conflict with grid click events
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("mousedown", handleColorPickerClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("mousedown", handleColorPickerClickOutside);
    };
  }, [onClose, isColorPickerOpen]);

  const handleSave = useCallback(() => {
    if (isSaving) return;
    onSave({
      ...initialData,
      title: title || "（无标题）",
      description,
      color: selectedColor,
    });
    onClose();
  }, [description, initialData, isSaving, onClose, onSave, selectedColor, title]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  // Use passed position directly
  const style = {
    top: position?.top || 0,
    left: position?.left || 0,
  };

  const currentColorObj =
    COLORS.find((c) => c.name === selectedColor) || COLORS[0];

  // Determine animation class based on placement
  const animationClass =
    placement === "right"
      ? "animate-popover-in-right"
      : "animate-popover-in-left";

  return (
    <div
      ref={popoverRef}
      className={`fixed z-50 w-[400px] bg-white rounded-[1.5rem] shadow-xl border border-border overflow-hidden ${animationClass}`}
      style={style}
    >
      {/* Header */}
      <div className="bg-bg-50 px-4 py-2 flex items-center justify-between border-b border-border/50 handle cursor-move">
        <div className="flex items-center gap-2 relative">
          {/* Color Selector */}
          <div className="relative" ref={colorPickerRef}>
            <button
              onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
              className="flex items-center gap-1 p-1 rounded hover:bg-gray-100 transition-colors"
              title="Color Selector"
            >
              <div className={`w-5 h-5 rounded-full ${currentColorObj.bg}`} />
              <ChevronDown size={14} className="text-gray-500" />
            </button>
            {isColorPickerOpen && (
              <div className="absolute top-full left-0 mt-2 p-2 bg-white rounded-lg shadow-lg border border-border grid grid-cols-4 gap-2 z-50 w-[140px] animate-in fade-in zoom-in-95 duration-150">
                {COLORS.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => {
                      const newColor = color.name;
                      setSelectedColor(newColor);
                      localStorage.setItem("lastSelectedColor", newColor);
                      setIsColorPickerOpen(false);
                      if (onColorChange) {
                        onColorChange(newColor);
                      }
                    }}
                    className={`w-6 h-6 rounded-full ${color.bg} hover:scale-110 transition-transform flex items-center justify-center`}
                  >
                    {selectedColor === color.name && (
                      <Check size={14} className="text-white" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center">
          {initialData?.id && onDelete && (
            <button
              onClick={() => {
                onClose();
                onDelete(initialData.id);
              }}
              className="text-text-secondary hover:bg-bg-200 rounded p-1 mr-1"
              title="Delete event"
            >
              <Trash size={18} />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-text-secondary hover:bg-bg-200 rounded p-1"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Title Input */}
        <div>
          <input
            type="text"
            placeholder="Add title"
            className="w-full text-2xl border-b-2 border-blue-500 pb-1 focus:outline-none placeholder:text-text-tertiary"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>

        {/* Type Selector (Mock) */}
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">
            Event
          </span>
          <span className="px-3 py-1 hover:bg-bg-100 text-text-secondary rounded text-sm cursor-pointer">
            任务
          </span>
          <span className="px-3 py-1 hover:bg-bg-100 text-text-secondary rounded text-sm cursor-pointer">
            预约安排{" "}
            <span className="text-[10px] bg-blue-600 text-white px-1 rounded ml-1">
              新
            </span>
          </span>
        </div>

        {/* Time Display */}
        <div className="flex items-start gap-4 text-text-secondary">
          <Clock size={20} className="mt-0.5" />
          <div className="text-sm">
            <div>
              {initialData?.date &&
                format(new Date(initialData.date), "M月 d日 (EEEE)", {
                  locale: zhCN,
                })}
            </div>
            <div className="mt-0.5">
              {initialData?.timeSlot &&
                (() => {
                  const [start, end] = initialData.timeSlot.split("-");
                  return `${start} - ${end}`;
                })()}
            </div>
            <div className="text-xs text-text-tertiary mt-0.5">
              时区 · 不重复
            </div>
          </div>
        </div>

        {/* Mock Fields */}
        <div className="flex items-center gap-4 text-text-secondary cursor-pointer hover:bg-bg-50 p-1 -ml-1 rounded">
          <User size={20} />
          <span className="text-sm">添加邀请对象</span>
        </div>

        <div className="flex items-center gap-4 text-text-secondary cursor-pointer hover:bg-bg-50 p-1 -ml-1 rounded">
          <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center text-white text-[10px] font-bold">
            G
          </div>
          <span className="text-sm">添加 Google Meet 视频会议</span>
        </div>

        <div className="flex items-center gap-4 text-text-secondary cursor-pointer hover:bg-bg-50 p-1 -ml-1 rounded">
          <MapPin size={20} />
          <span className="text-sm">添加地点</span>
        </div>

        <div className="flex items-start gap-4 text-text-secondary">
          <AlignLeft size={20} className="mt-1" />
          <textarea
            placeholder="添加说明或Google 云端硬盘附件"
            className="w-full text-sm resize-none focus:outline-none bg-transparent"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-4 text-text-secondary">
          <CalendarIcon size={20} />
          <div className="text-sm">
            <span className="font-medium text-text-primary">chogng</span>
            <span className="ml-2 w-3 h-3 bg-blue-500 rounded-full inline-block"></span>
            <div className="text-xs text-text-tertiary">
              忙碌 · 默认的公开范围 · 通知 30 分钟前
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 p-4 pt-0">
        <Button
          variant="text"
          onClick={() => {}}
          className="text-blue-600 hover:bg-blue-50"
        >
          更多选项
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6"
        >
          保存
        </Button>
      </div>
    </div>
  );
};

const BookingPopover = ({ isOpen, initialData, ...rest }) => {
  if (!isOpen) return null;

  const resetKey = initialData?.id
    ? initialData.id
    : `${initialData?.date || ""}-${initialData?.timeSlot || ""}`;

  return (
    <BookingPopoverInner key={resetKey} initialData={initialData} {...rest} />
  );
};

export default BookingPopover;
