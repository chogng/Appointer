import { memo, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import Card from "./ui/Card";
import Button from "./ui/Button";
import Switch from "./ui/Switch";
import BookingDate from "./BookingDate";
import BookingTime from "./BookingTime";
import BookingGranularity from "./BookingGranularity";
import { Trash2, ArrowUp } from "lucide-react";

const DeviceIcon = ({ className }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M12.5 16H5C3.89543 16 3 15.1046 3 14V5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V8.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 16V21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5 21H11"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect
      x="14"
      y="9"
      width="8"
      height="12"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M18 17H18.01"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const DeviceCard = ({
  device,
  isAdmin,
  onToggle,
  onUpdate,
  onBook,
  deleteConfirmId,
  onDeleteClick,
  onShowToast,
  isBlocked = false,
}) => {
  // Local state for inputs
  const [nameValue, setNameValue] = useState(device.name);
  const [descValue, setDescValue] = useState(device.description || "");
  const [isNameDirty, setIsNameDirty] = useState(false);
  const [isDescDirty, setIsDescDirty] = useState(false);

  const nameInputValue = isNameDirty ? nameValue : device.name;
  const descInputValue = isDescDirty ? descValue : device.description || "";

  const { t } = useLanguage();

  const handleSaveName = () => {
    if (!isNameDirty) return;

    const trimmed = nameValue.trim();
    if (trimmed !== device.name) {
      onUpdate(device.id, { name: trimmed });
      setNameValue(trimmed);
      onShowToast(t("updateSuccess"));
      return;
    }

    setIsNameDirty(false);
    setNameValue(device.name);
  };

  const handleSaveDesc = () => {
    if (!isDescDirty) return;

    const trimmed = descValue.trim();
    const current = device.description || "";
    if (trimmed !== current) {
      onUpdate(device.id, { description: trimmed });
      setDescValue(trimmed);
      onShowToast(t("updateSuccess"));
      return;
    }

    setIsDescDirty(false);
    setDescValue(current);
  };

  const handleSaveAll = () => {
    const updates = {};

    if (isNameDirty) {
      const trimmed = nameValue.trim();
      if (trimmed !== device.name) {
        updates.name = trimmed;
        setNameValue(trimmed);
      } else {
        setIsNameDirty(false);
        setNameValue(device.name);
      }
    }

    if (isDescDirty) {
      const trimmed = descValue.trim();
      const current = device.description || "";
      if (trimmed !== current) {
        updates.description = trimmed;
        setDescValue(trimmed);
      } else {
        setIsDescDirty(false);
        setDescValue(current);
      }
    }

    if (Object.keys(updates).length > 0) {
      onUpdate(device.id, updates);
      onShowToast(t("updateSuccess"));
    }
  };

  const handleKeyDownName = (e) => {
    if (e.key === "Enter") {
      handleSaveName();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setNameValue(device.name); // Reset
      setIsNameDirty(false);
      e.currentTarget.blur();
    }
  };

  const handleKeyDownDesc = (e) => {
    if (e.key === "Enter") {
      handleSaveDesc();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setDescValue(device.description || ""); // Reset
      setIsDescDirty(false);
      e.currentTarget.blur();
    }
  };

  return (
    <Card
      className="flex flex-col gap-[0.75rem] sm:gap-[1rem] hover-lift group"
    >
      <div className="flex items-start gap-[0.75rem] sm:gap-[1rem]">
        {isAdmin ? (
          <div
            onClick={() => onToggle(device.id, device.isEnabled)}
            className={`
                            relative w-[2.5rem] h-[2.5rem] sm:w-[3rem] sm:h-[3rem] rounded-[0.5rem]
                            transition-all duration-200 cursor-pointer
                            flex items-center justify-center
                            backdrop-blur-md shadow-lg active:scale-90 hover:scale-105
                            ${device.isEnabled
                ? "bg-gradient-to-br from-white/90 to-white/50 dark:from-green-500/20 dark:to-green-900/10"
                : "bg-gray-100/80 dark:bg-gray-800/50"
              }
                        `}
          >
            <div
              className={`
                            transition-colors duration-300
                            ${device.isEnabled
                  ? "text-[#7FB77E] dark:text-green-400"
                  : "text-gray-400 dark:text-gray-500"
                }
                        `}
            >
              <DeviceIcon className="w-[1.25rem] h-[1.25rem] sm:w-[1.5rem] sm:h-[1.5rem]" />
            </div>
          </div>
        ) : (
          <div className="w-[2.5rem] h-[2.5rem] sm:w-[3rem] sm:h-[3rem] rounded-[0.5rem] bg-white/60 dark:bg-green-900/10 backdrop-blur-md flex items-center justify-center border border-green-100/50 dark:border-green-500/10 transition-transform duration-300">
            <DeviceIcon
              className={`w-[1.25rem] h-[1.25rem] sm:w-[1.5rem] sm:h-[1.5rem] ${device.isEnabled ? "text-[#7FB77E] dark:text-green-400" : "text-gray-400"}`}
            />
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col justify-center min-h-[2.5rem] sm:min-h-[3rem]">
          <div className="flex justify-between items-start gap-2">
            {isAdmin ? (
              <div className="relative flex-1 min-w-0 z-10">
                <div className="flex items-center p-1 bg-transparent rounded-xl focus-within:ring-1 focus-within:ring-black transition-all">
                  <input
                    id={`device-name-${device.id}`}
                    name="deviceName"
                    type="text"
                    value={nameInputValue}
                    onChange={(e) => {
                      setIsNameDirty(true);
                      setNameValue(e.target.value);
                    }}
                    onKeyDown={handleKeyDownName}
                    autoComplete="off"
                    spellCheck={false}
                    className="flex-1 min-w-0 pl-2 pr-4 py-1 bg-transparent border-none text-[1rem] sm:text-[1.125rem] font-semibold text-text-primary focus:outline-none focus:ring-0 placeholder:text-text-secondary"
                    placeholder={t("enterDeviceName")}
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSaveAll();
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-black text-white text-xs sm:text-sm font-medium rounded-lg hover:scale-102 active:scale-95 transition-all whitespace-nowrap"
                  >
                    <span>{t("save")}</span>
                    <ArrowUp size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <h3 className="text-[1rem] sm:text-[1.125rem] font-semibold text-text-primary truncate transition-colors duration-200 border-b-2 border-transparent">
                {device.name}
              </h3>
            )}

            {/* Status for user ONLY - Admin switch moved to description row */}
            {!isAdmin && (
              /* Status dot only for User in narrow views, or full pill in large */
              <span
                className={`flex items-center gap-[0.375rem] px-[0.5rem] py-[0.125rem] rounded-[0.5rem] text-[0.875rem] font-semibold shrink-0 md:hidden xl:flex ${isBlocked
                    ? "bg-red-500/10 text-red-600"
                    : device.isEnabled
                      ? "bg-green-500/10 text-green-600"
                      : "bg-red-500/10 text-red-600"
                  }`}
              >
                <span
                  className={`w-[0.375rem] h-[0.375rem] rounded-full shrink-0 ${isBlocked || !device.isEnabled ? "bg-red-600" : "bg-green-600"}`}
                ></span>
                <span className="hidden xl:inline">
                  {isBlocked
                    ? "Banned"
                    : device.isEnabled
                      ? t("available")
                      : t("unavailable")}
                </span>
                <span className="xl:hidden">
                  {isBlocked ? "Ban" : device.isEnabled ? t("on") : t("off")}
                </span>
              </span>
            )}
          </div>
          {isAdmin ? (
            <div className="flex items-center gap-2 mt-[0.125rem] sm:mt-[0.25rem] z-10 w-full">
              <div className="relative flex-1 min-w-0">
                <div className="flex items-center p-1 bg-transparent rounded-lg focus-within:ring-1 focus-within:ring-black transition-all">
                  <input
                    id={`device-desc-${device.id}`}
                    name="deviceDescription"
                    type="text"
                    value={descInputValue}
                    onChange={(e) => {
                      setIsDescDirty(true);
                      setDescValue(e.target.value);
                    }}
                    onKeyDown={handleKeyDownDesc}
                    placeholder={t("addDescription")}
                    autoComplete="off"
                    spellCheck={false}
                    className="flex-1 min-w-0 pl-2 pr-4 py-0.5 bg-transparent border-none text-[0.6875rem] text-text-secondary focus:outline-none focus:ring-0 placeholder:text-text-secondary"
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[0.6875rem] text-text-secondary leading-tight line-clamp-2 mt-[0.125rem] sm:mt-[0.25rem] transition-colors duration-200 border-b border-transparent">
              {device.description || "\u00A0"}
            </p>
          )}
        </div>
      </div>

      {/* Booking date editor */}
      <div className="mt-2">
        <BookingDate device={device} onUpdate={onUpdate} isAdmin={isAdmin} />
      </div>

      {/* Booking granularity editor and booking time editor*/}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-[0.5rem] mt-2">
        <BookingGranularity
          value={device.granularity}
          onChange={(val) => onUpdate(device.id, { granularity: val })}
          isAdmin={isAdmin}
        />
        <BookingTime device={device} onUpdate={onUpdate} isAdmin={isAdmin} />
      </div>

      <div className="mt-auto pt-[0.75rem] sm:pt-[1rem] border-t border-border-subtle flex gap-[0.75rem]">
        <Button
          variant="primary"
          className={`flex-1 text-[0.875rem] sm:text-base whitespace-nowrap overflow-hidden ${isBlocked ? "opacity-50 cursor-not-allowed" : ""}`}
          disabled={!device.isEnabled || isBlocked}
          onClick={() => onBook(device.id)}
        >
          {isBlocked ? "Banned" : t("bookNow")}
        </Button>
        {isAdmin && (
          <Button
            variant={deleteConfirmId === device.id ? "danger" : "secondary"}
            onClick={(e) => onDeleteClick(device.id, e)}
            className={`flex-1 text-[0.875rem] sm:text-base transition-all duration-300 ${deleteConfirmId === device.id
                ? "bg-red-600 shadow-red-200 border-transparent shadow-lg text-white"
                : "bg-white/40 hover:bg-red-50 hover:text-red-600 hover:border-red-100 border-border-subtle backdrop-blur-sm"
              }`}
            title={
              deleteConfirmId === device.id ? t("confirm") : t("deleteDevice")
            }
          >
            {deleteConfirmId === device.id ? (
              <div className="flex items-center gap-1">
                <Trash2 className="w-4 h-4" />
                <span>{t("confirm")}</span>
              </div>
            ) : (
              t("delete")
            )}
          </Button>
        )}
      </div>
    </Card>
  );
};

export default memo(DeviceCard);
