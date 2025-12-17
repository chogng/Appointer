import Card from './ui/Card';
import Button from './ui/Button';
import { Monitor, Trash2 } from 'lucide-react';
import BookingDate from './BookingDate';
import BookingTime from './BookingTime';
import BookingGranularity from './BookingGranularity';

const DeviceCard = ({
    device,
    isAdmin,
    onToggle,
    onUpdate,
    onBook,
    deleteConfirmId,
    onDeleteClick
}) => {
    return (
        <Card className="flex flex-col gap-[0.75rem] sm:gap-[1rem] shadow-[0_0.5rem_1.875rem_rgba(0,0,0,0.12)] hover:shadow-[0_1.25rem_2.5rem_rgba(0,0,0,0.16)] transition-shadow duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-[0.75rem] sm:gap-0">
                <div className="flex items-center gap-[0.75rem] sm:gap-[1rem] w-full sm:w-auto">
                    <div className="w-[2.5rem] h-[2.5rem] sm:w-[3rem] sm:h-[3rem] rounded-[0.75rem] bg-bg-subtle flex items-center justify-center shrink-0">
                        <Monitor className="w-[1.25rem] h-[1.25rem] sm:w-[1.5rem] sm:h-[1.5rem] text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-[1rem] sm:text-[1.125rem] font-semibold mb-[0.25rem] text-text-primary truncate">{device.name}</h3>
                        <p className="text-[0.6875rem] text-text-secondary leading-relaxed line-clamp-2">
                            {device.description}
                        </p>
                    </div>
                </div>

                {/* On/Off switch (Only show in admin) */}
                {isAdmin ? (
                    <label className="flex items-center gap-[0.5rem] cursor-pointer shrink-0 self-end sm:self-start">
                        <span className="text-[0.875rem] font-medium text-text-secondary">
                            {device.isEnabled ? 'On' : 'Off'}
                        </span>
                        <div className="relative">
                            <input
                                type="checkbox"
                                checked={device.isEnabled}
                                onChange={() => onToggle(device.id)}
                                className="sr-only peer"
                            />
                            <div className="w-[2.75rem] h-[1.5rem] bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0.125rem] after:left-[0.125rem] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-[1.25rem] after:w-[1.25rem] after:transition-all peer-checked:bg-green-500"></div>
                        </div>
                    </label>
                ) : (
                    /* Status: available/unavailable for User */
                    <span className={`flex items-center gap-[0.375rem] px-[0.5rem] py-[0.25rem] rounded-[0.5rem] text-[0.875rem] font-semibold shrink-0 self-end sm:self-start ${device.isEnabled
                        ? 'bg-green-500/10 text-green-600'
                        : 'bg-red-500/10 text-red-600'
                        }`}>
                        <span className={`w-[0.375rem] h-[0.375rem] rounded-full ${device.isEnabled ? 'bg-green-600' : 'bg-red-600'}`}></span>
                        {device.isEnabled ? 'Available' : 'Unavailable'}
                    </span>
                )}
            </div>

            {/* Booking date editor */}
            <BookingDate
                device={device}
                onUpdate={onUpdate}
                isAdmin={isAdmin}
            />

            {/* Booking granularity editor and booking time editor*/}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-[0.5rem]">
                <BookingGranularity
                    value={device.granularity}
                    onChange={(val) => onUpdate(device.id, { granularity: val })}
                    isAdmin={isAdmin}
                />
                <BookingTime
                    device={device}
                    onUpdate={onUpdate}
                    isAdmin={isAdmin}
                />
            </div>

            <div className="mt-auto pt-[0.75rem] sm:pt-[1rem] border-t border-border-subtle flex flex-col sm:flex-row gap-[0.5rem] sm:gap-[0.75rem]">
                <Button
                    className="flex-1 text-[0.875rem] sm:text-base"
                    disabled={!device.isEnabled}
                    onClick={onBook}
                >
                    立即预约
                </Button>
                {isAdmin && (
                    <Button
                        variant={deleteConfirmId === device.id ? "danger" : "primary"}
                        onClick={(e) => onDeleteClick(device.id, e)}
                        className={`transition-all duration-200 ease-[cubic-bezier(0.165,0.85,0.45,1)] overflow-hidden whitespace-nowrap text-[0.875rem] sm:text-base ${deleteConfirmId === device.id
                            ? 'shrink-0 w-[2.625rem] !px-0'
                            : 'flex-1 bg-black hover:bg-gray-800 text-white border-transparent'
                            }`}
                        title={deleteConfirmId === device.id ? "确认删除" : "删除设备"}
                    >
                        {deleteConfirmId === device.id ? (
                            <Trash2 className="w-[1.125rem] h-[1.125rem]" />
                        ) : (
                            "删除设备"
                        )}
                    </Button>
                )}
            </div>
        </Card>
    );
};

export default DeviceCard;
