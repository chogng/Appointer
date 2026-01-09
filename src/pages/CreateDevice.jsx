import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { ArrowLeft } from "lucide-react";
import { apiService } from "../services/apiService";
import { useLanguage } from "../hooks/useLanguage";

const CreateDevice = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    timeGranularity: "30",
    availabilityType: "everyday",
    timeRangeType: "24hours",
    specificDays: [],
    specificTimeStart: "09:00",
    specificTimeEnd: "18:00",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const dayMap = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    const openDays =
      formData.availabilityType === "everyday"
        ? [0, 1, 2, 3, 4, 5, 6]
        : formData.specificDays
            .map((day) => dayMap[day])
            .filter((day) => typeof day === "number");

    const granularity = parseInt(formData.timeGranularity, 10) || 60;

    const openTime =
      formData.timeRangeType === "24hours"
        ? { start: "00:00", end: "24:00" }
        : { start: formData.specificTimeStart, end: formData.specificTimeEnd };

    // 构建设备数据
    const deviceData = {
      name: formData.name,
      description: formData.description,
      granularity,
      openDays,
      openTime,
      timeSlots: [], // legacy field (kept for compatibility)
    };

    try {
      // 保存设备到服务器（服务器会通过 WebSocket 广播给所有客户端）
      await apiService.createDevice(deviceData);
      navigate("/devices");
    } catch (error) {
      console.error("Failed to create device:", error);
      alert(t("createDeviceFailed"));
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleDay = (day) => {
    setFormData((prev) => ({
      ...prev,
      specificDays: prev.specificDays.includes(day)
        ? prev.specificDays.filter((d) => d !== day)
        : [...prev.specificDays, day],
    }));
  };

  const weekDays = [
    { value: "monday", label: `${t("week")}${t("mon")}` },
    { value: "tuesday", label: `${t("week")}${t("tue")}` },
    { value: "wednesday", label: `${t("week")}${t("wed")}` },
    { value: "thursday", label: `${t("week")}${t("thu")}` },
    { value: "friday", label: `${t("week")}${t("fri")}` },
    { value: "saturday", label: `${t("week")}${t("sat")}` },
    { value: "sunday", label: `${t("week")}${t("sun")}` },
  ];

  return (
    <div className="w-full">
      <div className="mb-8">
        <button
          onClick={() => navigate("/devices")}
          className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-4"
        >
          <ArrowLeft size={20} />
          <span>{t("backToDeviceList")}</span>
        </button>
        <h1 className="text-3xl font-serif font-medium text-text-primary mb-2">
          {t("createDevice")}
        </h1>
        <p className="text-text-secondary">{t("createDeviceSubtitle")}</p>
      </div>

      <Card className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 设备名称 */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-primary">
              {t("deviceNameLabel")} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder={t("deviceNamePlaceholder")}
              required
              className="bg-bg-subtle border border-border-subtle hover:border-border-default focus:border-blue-500 transition-colors placeholder:text-text-tertiary h-11 px-3 rounded-lg w-full outline-none"
            />
          </div>

          {/* 设备描述 */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-primary">
              {t("deviceDescriptionLabel")}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder={t("deviceDescriptionPlaceholder")}
              rows={3}
              className="bg-bg-subtle border border-border-subtle hover:border-border-default focus:border-blue-500 transition-colors placeholder:text-text-tertiary px-3 py-2 rounded-lg w-full outline-none resize-none"
            />
          </div>

          {/* 时间粒度 */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-primary">
              {t("bookingGranularityLabel")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { value: "30", label: t("granularity30m") },
                { value: "60", label: t("granularity60m") },
                { value: "90", label: t("granularity90m") },
                { value: "120", label: t("granularity120m") },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleChange("timeGranularity", option.value)}
                  className={`h-11 px-4 rounded-lg border transition-all ${
                    formData.timeGranularity === option.value
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-bg-subtle border-border-subtle hover:border-border-default"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 可预约日期类型 */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-primary">
              {t("bookableDaysLabel")} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleChange("availabilityType", "everyday")}
                className={`h-11 px-4 rounded-lg border transition-all ${
                  formData.availabilityType === "everyday"
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-bg-subtle border-border-subtle hover:border-border-default"
                }`}
              >
                {t("bookableEveryday")}
              </button>
              <button
                type="button"
                onClick={() => handleChange("availabilityType", "specific")}
                className={`h-11 px-4 rounded-lg border transition-all ${
                  formData.availabilityType === "specific"
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-bg-subtle border-border-subtle hover:border-border-default"
                }`}
              >
                {t("bookableSpecificWeekdays")}
              </button>
            </div>
          </div>

          {/* 特定星期选择 */}
          {formData.availabilityType === "specific" && (
            <div className="flex flex-col gap-2 pl-4 border-l-2 border-blue-500">
              <label className="text-sm font-medium text-text-primary">
                {t("selectWeekdaysLabel")}
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
                {weekDays.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`h-10 px-3 rounded-lg border text-sm transition-all ${
                      formData.specificDays.includes(day.value)
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-bg-subtle border-border-subtle hover:border-border-default"
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 可预约时间段类型 */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-primary">
              {t("bookableTimeRangeLabel")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleChange("timeRangeType", "24hours")}
                className={`h-11 px-4 rounded-lg border transition-all ${
                  formData.timeRangeType === "24hours"
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-bg-subtle border-border-subtle hover:border-border-default"
                }`}
              >
                {t("bookable24Hours")}
              </button>
              <button
                type="button"
                onClick={() => handleChange("timeRangeType", "specific")}
                className={`h-11 px-4 rounded-lg border transition-all ${
                  formData.timeRangeType === "specific"
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-bg-subtle border-border-subtle hover:border-border-default"
                }`}
              >
                {t("bookableSpecificTimeRange")}
              </button>
            </div>
          </div>

          {/* 特定时间段选择 */}
          {formData.timeRangeType === "specific" && (
            <div className="flex flex-col gap-3 pl-4 border-l-2 border-blue-500">
              <label className="text-sm font-medium text-text-primary">
                {t("setTimeRangeLabel")}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-text-secondary">
                    {t("startTime")}
                  </label>
                  <input
                    type="time"
                    value={formData.specificTimeStart}
                    onChange={(e) =>
                      handleChange("specificTimeStart", e.target.value)
                    }
                    className="bg-bg-subtle border border-border-subtle hover:border-border-default focus:border-blue-500 transition-colors h-11 px-3 rounded-lg w-full outline-none"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-text-secondary">
                    {t("endTime")}
                  </label>
                  <input
                    type="time"
                    value={formData.specificTimeEnd}
                    onChange={(e) =>
                      handleChange("specificTimeEnd", e.target.value)
                    }
                    className="bg-bg-subtle border border-border-subtle hover:border-border-default focus:border-blue-500 transition-colors h-11 px-3 rounded-lg w-full outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 提交按钮 */}
          <div className="flex gap-3 pt-4 border-t border-border-subtle">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/devices")}
              className="flex-1"
            >
              {t("cancel")}
            </Button>
            <Button type="submit" className="flex-1">
              {t("createDevice")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default CreateDevice;
