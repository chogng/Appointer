import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { ArrowLeft } from 'lucide-react';
import { apiService } from '../services/apiService';

const CreateDevice = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        timeGranularity: '30',
        availabilityType: 'everyday',
        timeRangeType: '24hours',
        specificDays: [],
        specificTimeStart: '09:00',
        specificTimeEnd: '18:00'
    });

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 构建设备数据
        const deviceData = {
            name: formData.name,
            description: formData.description,
            timeGranularity: parseInt(formData.timeGranularity),
            openDays: formData.availabilityType === 'everyday'
                ? [0, 1, 2, 3, 4, 5, 6] // 所有天
                : formData.specificDays.map(day => {
                    const dayMap = {
                        'sunday': 0, 'monday': 1, 'tuesday': 2,
                        'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6
                    };
                    return dayMap[day];
                }),
            timeSlots: formData.timeRangeType === '24hours'
                ? ['00:00-23:59']
                : [`${formData.specificTimeStart}-${formData.specificTimeEnd}`]
        };

        try {
            // 保存设备到服务器（服务器会通过 WebSocket 广播给所有客户端）
            await apiService.createDevice(deviceData);
            navigate('/devices');
        } catch (error) {
            console.error('Failed to create device:', error);
            alert('创建设备失败，请重试');
        }
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const toggleDay = (day) => {
        setFormData(prev => ({
            ...prev,
            specificDays: prev.specificDays.includes(day)
                ? prev.specificDays.filter(d => d !== day)
                : [...prev.specificDays, day]
        }));
    };

    const weekDays = [
        { value: 'monday', label: '周一' },
        { value: 'tuesday', label: '周二' },
        { value: 'wednesday', label: '周三' },
        { value: 'thursday', label: '周四' },
        { value: 'friday', label: '周五' },
        { value: 'saturday', label: '周六' },
        { value: 'sunday', label: '周日' }
    ];

    return (
        <div className="max-w-[800px] mx-auto">
            <div className="mb-8">
                <button
                    onClick={() => navigate('/devices')}
                    className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-4"
                >
                    <ArrowLeft size={20} />
                    <span>返回设备列表</span>
                </button>
                <h1 className="text-3xl font-serif font-medium text-text-primary mb-2">创建新设备</h1>
                <p className="text-text-secondary">填写设备信息并设置预约规则</p>
            </div>

            <Card className="p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* 设备名称 */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-text-primary">
                            设备名称 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            placeholder="例如：会议室 A / 投影仪 01"
                            required
                            className="bg-bg-subtle border border-border-subtle hover:border-border-default focus:border-blue-500 transition-colors placeholder:text-text-tertiary h-11 px-3 rounded-lg w-full outline-none"
                        />
                    </div>

                    {/* 设备描述 */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-text-primary">
                            设备描述
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            placeholder="简要描述设备的功能、位置或使用说明"
                            rows={3}
                            className="bg-bg-subtle border border-border-subtle hover:border-border-default focus:border-blue-500 transition-colors placeholder:text-text-tertiary px-3 py-2 rounded-lg w-full outline-none resize-none"
                        />
                    </div>

                    {/* 时间粒度 */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-text-primary">
                            预约时间粒度 <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { value: '30', label: '30分钟' },
                                { value: '60', label: '1小时' },
                                { value: '90', label: '90分钟' },
                                { value: '120', label: '2小时' }
                            ].map(option => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleChange('timeGranularity', option.value)}
                                    className={`h-11 px-4 rounded-lg border transition-all ${formData.timeGranularity === option.value
                                        ? 'bg-blue-500 text-white border-blue-500'
                                        : 'bg-bg-subtle border-border-subtle hover:border-border-default'
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
                            可预约日期 <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => handleChange('availabilityType', 'everyday')}
                                className={`h-11 px-4 rounded-lg border transition-all ${formData.availabilityType === 'everyday'
                                    ? 'bg-blue-500 text-white border-blue-500'
                                    : 'bg-bg-subtle border-border-subtle hover:border-border-default'
                                    }`}
                            >
                                每天可预约
                            </button>
                            <button
                                type="button"
                                onClick={() => handleChange('availabilityType', 'specific')}
                                className={`h-11 px-4 rounded-lg border transition-all ${formData.availabilityType === 'specific'
                                    ? 'bg-blue-500 text-white border-blue-500'
                                    : 'bg-bg-subtle border-border-subtle hover:border-border-default'
                                    }`}
                            >
                                特定星期可预约
                            </button>
                        </div>
                    </div>

                    {/* 特定星期选择 */}
                    {formData.availabilityType === 'specific' && (
                        <div className="flex flex-col gap-2 pl-4 border-l-2 border-blue-500">
                            <label className="text-sm font-medium text-text-primary">
                                选择可预约的星期
                            </label>
                            <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
                                {weekDays.map(day => (
                                    <button
                                        key={day.value}
                                        type="button"
                                        onClick={() => toggleDay(day.value)}
                                        className={`h-10 px-3 rounded-lg border text-sm transition-all ${formData.specificDays.includes(day.value)
                                            ? 'bg-blue-500 text-white border-blue-500'
                                            : 'bg-bg-subtle border-border-subtle hover:border-border-default'
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
                            可预约时间段 <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => handleChange('timeRangeType', '24hours')}
                                className={`h-11 px-4 rounded-lg border transition-all ${formData.timeRangeType === '24hours'
                                    ? 'bg-blue-500 text-white border-blue-500'
                                    : 'bg-bg-subtle border-border-subtle hover:border-border-default'
                                    }`}
                            >
                                24小时可预约
                            </button>
                            <button
                                type="button"
                                onClick={() => handleChange('timeRangeType', 'specific')}
                                className={`h-11 px-4 rounded-lg border transition-all ${formData.timeRangeType === 'specific'
                                    ? 'bg-blue-500 text-white border-blue-500'
                                    : 'bg-bg-subtle border-border-subtle hover:border-border-default'
                                    }`}
                            >
                                特定时间段可预约
                            </button>
                        </div>
                    </div>

                    {/* 特定时间段选择 */}
                    {formData.timeRangeType === 'specific' && (
                        <div className="flex flex-col gap-3 pl-4 border-l-2 border-blue-500">
                            <label className="text-sm font-medium text-text-primary">
                                设置时间段
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs text-text-secondary">开始时间</label>
                                    <input
                                        type="time"
                                        value={formData.specificTimeStart}
                                        onChange={(e) => handleChange('specificTimeStart', e.target.value)}
                                        className="bg-bg-subtle border border-border-subtle hover:border-border-default focus:border-blue-500 transition-colors h-11 px-3 rounded-lg w-full outline-none"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs text-text-secondary">结束时间</label>
                                    <input
                                        type="time"
                                        value={formData.specificTimeEnd}
                                        onChange={(e) => handleChange('specificTimeEnd', e.target.value)}
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
                            onClick={() => navigate('/devices')}
                            className="flex-1"
                        >
                            取消
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1"
                        >
                            创建设备
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default CreateDevice;
