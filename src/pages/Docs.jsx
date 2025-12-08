import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageTransition from '../components/PageTransition';

const Docs = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 100);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className='bg-bg-100 min-h-screen' data-theme="claude">
            <PageTransition loading={loading} className='text-text-100 font-ui min-h-screen flex flex-col'>
                {/* Header */}
                <nav className="w-full bg-bg-100 z-50">
                    <div
                        className="flex items-center justify-between max-w-[90rem] mx-auto pl-8"
                        style={{ width: 'calc(100% - 2 * clamp(2rem, calc(1.43rem + 2.86vw), 4rem))' }}
                    >
                        <div className="flex items-center">
                            <a href="#" className="flex items-center gap-[0.5rem] py-[1.375rem]">
                                <img src="/logo.svg" alt="Appointer Logo" className="w-[2.5rem] h-[2.5rem] object-contain" />
                                <span className="text-[1.5rem] font-display font-medium text-text-0 tracking-tight">
                                    Appointer
                                </span>
                            </a>
                        </div>
                        <div className="hidden sm:flex items-center gap-3">
                            <button
                                onClick={() => navigate('/login', { state: { from: 'docs' } })}
                                className="inline-flex items-center justify-center relative shrink-0 overflow-hidden transition-transform will-change-transform ease-[cubic-bezier(0.165,0.85,0.45,1)] duration-150 hover:scale-y-[1.015] hover:scale-x-[1.005] h-9 px-5 rounded-lg min-w-[7rem] active:scale-[0.985] whitespace-nowrap bg-bg-100 text-text-100 border border-border-200 text-[15px] hover:border-border-200 hover:bg-bg-150"
                            >
                                Log in
                            </button>
                            <button
                                onClick={() => navigate('/register', { state: { from: 'docs' } })}
                                className="inline-flex items-center justify-center relative shrink-0 overflow-hidden transition-transform will-change-transform ease-[cubic-bezier(0.165,0.85,0.45,1)] duration-150 hover:scale-y-[1.015] hover:scale-x-[1.005] h-9 px-5 rounded-lg min-w-[7rem] active:scale-[0.985] whitespace-nowrap bg-text-0 text-bg-0 text-[15px]"
                            >
                                Sign up
                            </button>
                        </div>
                    </div>
                </nav>

                {/* Main Content */}
                <div
                    className="font-ui mx-auto flex w-full grow flex-col justify-center max-w-3xl min-[1000px]:max-w-[90rem]"
                    style={{ width: 'calc(100% - 2 * clamp(2rem, calc(1.43rem + 2.86vw), 4rem))' }}
                >
                    <main className="flex justify-center items-center flex-1">
                        <div className="w-full max-w-2xl">
                            <h1 className="text-center text-text-100 font-display min-[500px]:text-[3.5rem] min-[350px]:text-[3.2rem] text-[1.75rem] select-none leading-none mb-4">
                                Appointer Docs
                            </h1>
                            <p className="mt-4 text-center text-text-200 text-base md:text-lg leading-relaxed max-w-xl mx-auto">
                                Learn how to make the most of Appointer. This page will contain documentation and guides
                                about booking devices, managing reservations, and getting the best out of the system.
                            </p>
                        </div>
                    </main>
                </div>
            </PageTransition>
        </div>
    );
};

export default Docs;
