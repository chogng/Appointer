import React, { useMemo } from "react";
import Select from "./ui/Select";

const TimeIcon = ({ size = 24, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16 2V6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 2V6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 10H21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7 16H17"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7 16H7.01"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M17 16H17.01"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const generateTimeOptions = (granularity = 60) => {
  const options = [];
  const totalMinutes = 24 * 60; // 24 hours

  for (let m = 0; m < totalMinutes; m += granularity) {
    const h = Math.floor(m / 60);
    const min = m % 60;

    let displayH = h % 12;
    if (displayH === 0) displayH = 12;
    const ampm = h < 12 || h === 24 ? "am" : "pm";

    const hStr = h.toString().padStart(2, "0");
    const minStr = min.toString().padStart(2, "0");
    const val = `${hStr}:${minStr}`;

    let label = `${displayH}:${minStr} ${ampm}`;

    options.push({
      label,
      value: val,
    });
  }

  // Allow selecting end-of-day explicitly.
  if (!options.some((opt) => opt.value === "24:00")) {
    options.push({ label: "24:00", value: "24:00" });
  }
  return options;
};

const BookingTime = ({ device, onUpdate, isAdmin }) => {
  const granularity = device.granularity || 60;
  const timeOptions = useMemo(
    () => generateTimeOptions(granularity),
    [granularity],
  );

  const handleStartChange = (newStart) => {
    onUpdate(device.id, {
      openTime: {
        ...device.openTime,
        start: newStart,
      },
    });
  };

  const handleEndChange = (newEnd) => {
    onUpdate(device.id, {
      openTime: {
        ...device.openTime,
        end: newEnd,
      },
    });
  };

  const normalizeTime = (t) => {
    if (!t) return "00:00";
    const [h, m] = t.split(":");
    return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
  };

  const startTime = normalizeTime(device.openTime?.start || "09:00");
  const endTime = normalizeTime(device.openTime?.end || "18:00");

  if (!isAdmin) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-text-secondary">
        <TimeIcon size={18} className="text-text-tertiary" />
        <span>
          {startTime} - {endTime}
        </span>
      </div>
    );
  }

  const formatDisplay = (opt) => opt?.label || opt?.value;

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <TimeIcon size={18} className="text-text-tertiary shrink-0" />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Select
          options={timeOptions}
          value={startTime}
          onChange={handleStartChange}
          title="START TIME"
          className="w-[5.5rem]"
          formatDisplay={formatDisplay}
          align="center"
          popupClassName="min-w-[8.75rem]"
        />
        <span className="text-text-tertiary">-</span>
        <Select
          options={timeOptions}
          value={endTime}
          onChange={handleEndChange}
          title="END TIME"
          className="w-[5.5rem]"
          formatDisplay={formatDisplay}
          align="center"
          popupClassName="min-w-[8.75rem]"
        />
      </div>
    </div>
  );
};

export default BookingTime;
