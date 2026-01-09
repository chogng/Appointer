import Card from './ui/Card';
import { Plus, Check } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';

const AddDeviceCard = ({ onClick, isConfirming }) => {
    const { t } = useLanguage();

    return (
        <Card
            variant="glass"
            className={`flex items-center justify-center min-h-[280px] cursor-pointer group hover-lift border-2 border-dashed transition-all duration-300 ${isConfirming
                ? 'border-green-400 bg-green-50/30'
                : 'border-gray-200 hover:border-green-300'
                }`}
            onClick={onClick}
        >
            <div className={`flex flex-col items-center gap-3 transition-colors duration-300 ${isConfirming ? 'text-green-600' : 'text-gray-400 group-hover:text-green-500'
                }`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${isConfirming
                    ? 'bg-green-100 text-green-600'
                    : 'bg-gray-100 group-hover:bg-green-100'
                    }`}>
                    {isConfirming ? (
                        <Check className="w-8 h-8" />
                    ) : (
                        <Plus className="w-8 h-8" />
                    )}
                </div>
                <span className="text-sm font-medium">
                    {isConfirming ? t('confirmCreate') : t('addNewDevice')}
                </span>
            </div>
        </Card>
    );
};

export default AddDeviceCard;
